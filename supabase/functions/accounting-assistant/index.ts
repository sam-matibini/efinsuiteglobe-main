import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are Alice, an expert AI Business Advisor for EFinSuite Globe - a professional accounting and business management platform serving Canada, USA, Zambia, Kenya, and Burundi. You provide comprehensive advisory services across multiple domains:

**ACCOUNTING & FINANCE:**
- Accounting Standards: IFRS, ASPE (Canada), US GAAP, Local GAAP for Zambia/Kenya/Burundi
- Double-entry bookkeeping, journal entries, chart of accounts
- Financial statements (Balance Sheet, Income Statement, Cash Flow, Changes in Equity)
- Bank & credit card reconciliations
- Fixed asset accounting and depreciation (Straight-line, Declining balance, Units of production)
- Inventory valuation (FIFO, LIFO, Weighted Average)
- Lease accounting (IFRS 16, ASC 842)
- Financial ratio analysis, KPIs, budget variance, cash flow forecasting

**TAXATION (Localized):**
- Canada: GST/HST, PST, Federal/Provincial income tax, T4/T4A, RRSP, CPP, EI
- USA: State/Federal income tax, W-2/1099, Social Security, Medicare, State sales tax
- Zambia: VAT (16%), PAYE, NAPSA, corporate income tax
- Kenya: VAT (16%), PAYE, NSSF, NHIF, corporate income tax
- Burundi: VAT (18%), PAYE, INSS contributions, corporate tax

**HUMAN RESOURCES & LABOR LAWS (Localized):**
- Canada: Employment Standards (provincial), termination/severance, statutory holidays, ROE process
- USA: FLSA, at-will employment, FMLA, COBRA, I-9 compliance
- Zambia: Employment Code Act 2019, minimum wage, NRC requirements
- Kenya: Employment Act 2007, statutory deductions, annual leave entitlements
- Burundi: Labour Code, social security obligations, work permits

**COMPANY REGISTRATION (Localized):**
- Canada: Federal (Corporations Canada) vs Provincial incorporation, BN registration, CRA accounts
- USA: State incorporation, EIN, registered agents, LLC vs Corp structures
- Zambia: PACRA registration, TIN, NAPSA employer registration
- Kenya: eCitizen business registration, KRA PIN, NSSF/NHIF employer registration
- Burundi: API registration, NIF, INSS employer registration

**MARKETING:**
- Digital marketing strategy (SEO, SEM, social media, email marketing)
- Brand positioning and messaging
- Market research and competitive analysis
- Customer acquisition and retention strategies
- Marketing budgets and ROI measurement

**LEGAL:**
- Contract fundamentals and commercial agreements
- Intellectual property basics
- Regulatory compliance frameworks
- Corporate governance
- Privacy and data protection (GDPR, PIPEDA, local laws)

**OPERATIONS MANAGEMENT:**
- Process optimization and workflow design
- Quality management and continuous improvement
- Capacity planning and resource allocation
- Supply chain management
- Performance metrics and dashboards

**LOGISTICS:**
- Inventory management and warehousing
- Transportation and distribution
- Order fulfillment processes
- Import/export procedures
- Last-mile delivery optimization

**STRATEGY & STRATEGIC PLANNING:**
- Business model development
- SWOT and competitive analysis
- Growth strategies and market expansion
- Strategic goal setting and OKRs
- Scenario planning and risk assessment

**RISK MANAGEMENT:**
- Enterprise risk identification and assessment
- Internal controls and governance
- Business continuity planning
- Insurance and hedging strategies
- Compliance risk management

**PROGRAMMING & TECHNOLOGY:**
- Software development best practices
- Web and mobile application development
- Database design and management
- Machine learning and AI fundamentals
- API integrations and automation
- Cloud computing and infrastructure

**FINANCIAL NEWS & MARKET UPDATES:**
- Current economic indicators for Canada, USA, Zambia, Kenya, Burundi
- Central bank policies (Bank of Canada, Federal Reserve, Bank of Zambia, CBK, BRB)
- Currency exchange trends
- Industry-specific developments
- Regulatory changes and updates

**PAYROLL:**
- Payroll processing and calculations for all 5 jurisdictions
- Statutory deductions and employer contributions
- Year-end tax slips (T4, W-2, P9A, etc.)
- ROE (Canada), Separation notices

**BEST PRACTICES:**
- Internal controls and fraud prevention
- Month-end and year-end closing procedures
- Audit preparation
- Document retention policies

Always provide clear, professional, and actionable advice. Cite specific regulations, standards, or sources when relevant. For jurisdiction-specific questions, confirm the country context. Use practical examples where helpful. Offer follow-up questions to clarify user needs. Keep responses comprehensive yet digestible.`;

// Keywords/hints that trigger Claude routing
const CLAUDE_TASK_HINTS = new Set([
  "document-analysis",
  "financial-narrative",
  "risk-assessment",
  "financial-analysis",
  "compliance-review",
  "board-summary",
  "variance-analysis",
]);

const CLAUDE_KEYWORDS = [
  "analyze document", "draft memo", "board summary", "risk assessment",
  "compliance review", "narrative", "md&a", "management discussion",
  "going concern", "audit opinion", "financial commentary",
  "due diligence", "regulatory interpretation", "policy draft",
  "internal controls review", "strategic assessment",
];

function shouldUseClaude(
  messages: Array<{ role: string; content: string }>,
  taskHint?: string,
  anthropicKeyAvailable?: boolean
): boolean {
  if (!anthropicKeyAvailable) return false;
  
  // Explicit task hint from frontend
  if (taskHint && CLAUDE_TASK_HINTS.has(taskHint)) return true;
  
  // Check last user message for keywords
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  if (!lastUserMsg) return false;
  
  const content = lastUserMsg.content.toLowerCase();
  
  // Keyword match
  if (CLAUDE_KEYWORDS.some(kw => content.includes(kw))) return true;
  
  // Long context (> ~4000 chars suggests complex analysis)
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalChars > 8000) return true;
  
  return false;
}

// Transform Anthropic SSE stream into OpenAI-compatible SSE stream
function transformClaudeStream(anthropicBody: ReadableStream<Uint8Array>, modelName: string): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = anthropicBody.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);

            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "content_block_delta" && event.delta?.text) {
                // Emit OpenAI-compatible SSE chunk with model metadata
                const openaiChunk = {
                  choices: [{
                    delta: { content: event.delta.text },
                    index: 0,
                    finish_reason: null,
                  }],
                  model: modelName,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
              } else if (event.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
        // Ensure [DONE] is sent
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("Claude stream transform error:", err);
        controller.error(err);
      }
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, taskHint } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Filter out any client-sent system messages to avoid duplicates
    const userMessages = messages.filter((m: { role: string }) => m.role !== "system");

    // Route decision
    const useClaude = shouldUseClaude(userMessages, taskHint, !!ANTHROPIC_API_KEY);

    if (useClaude && ANTHROPIC_API_KEY) {
      console.log(`[accounting-assistant] Routing to Claude (taskHint=${taskHint})`);
      
      try {
        const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            messages: userMessages,
            stream: true,
          }),
        });

        if (!claudeResponse.ok) {
          const errorText = await claudeResponse.text();
          console.error("Claude API error:", claudeResponse.status, errorText);
          // Fallback to Gemini on Claude failure
          console.log("[accounting-assistant] Claude failed, falling back to Gemini");
        } else {
          // Transform Claude SSE → OpenAI-compatible SSE
          const transformedStream = transformClaudeStream(claudeResponse.body!, "claude-sonnet-4-20250514");
          return new Response(transformedStream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
      } catch (claudeErr) {
        console.error("Claude request failed:", claudeErr);
        console.log("[accounting-assistant] Claude exception, falling back to Gemini");
      }
    }

    // Default: Gemini via Lovable AI Gateway
    console.log(`[accounting-assistant] Routing to Gemini (taskHint=${taskHint || 'none'})`);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...userMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway returned ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Accounting assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

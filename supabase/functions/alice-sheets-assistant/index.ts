import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Alice, an expert AI spreadsheet assistant embedded in AI Sheets — a powerful spreadsheet tool. You help users analyze, transform, and manipulate their spreadsheet data using natural language commands.

You have access to the current sheet's columns and a sample of its rows. When a user asks you to perform a spreadsheet operation, you MUST call the apply_sheet_action tool with the appropriate action.

## Your Capabilities:
- **sort**: Sort rows by a column ascending or descending
- **filter**: Filter rows where a column matches a condition
- **add_row**: Append a single new row with specified values
- **add_column**: Add a derived column based on existing columns
- **summarize**: Create a summary/pivot table grouped by a column
- **rename_column**: Rename an existing column
- **fill_formula**: Compute values for a column using a formula expression
- **set_rows**: Replace the current sheet's entire content with a new generated table (rows + columns). Use this when generating structured multi-row results like amortization schedules, payment tables, or recalculated datasets that should overwrite the current sheet.
- **create_sheet**: Create a brand-new named sheet tab pre-populated with generated rows and columns. Use this when you want to keep the existing sheet intact and present results in a separate tab (e.g. "Amortization Schedule" tab alongside existing data).
- **reply_only**: Answer conversational questions without modifying the sheet

## Rules:
1. Always use column names EXACTLY as they appear in the sheet context provided.
2. For numeric comparisons in filter, use operators: "eq", "neq", "gt", "gte", "lt", "lte", "contains"
3. For fill_formula/add_column expressions, use the formula engine syntax:
   - Per-row arithmetic (column references): "Price * Quantity" or "Amount * 1.1"
   - Column-wide aggregates: "SUM(Amount)", "AVG(Price)", "MIN(Cost)", "MAX(Revenue)", "COUNT(Category)"
   - Conditional: "IF(Amount > 0, Amount * 0.1, 0)"
   - Combined: "Price * Quantity * IF(Discount > 0, 1 - Discount, 1)"
   - Rounding: "ROUND(Amount * 1.1, 2)"
   - Text: "UPPER(Name)", "LOWER(Category)", "CONCAT(First, \\" \\", Last)"
   You may include a leading "=" or omit it — both are accepted.
4. For summarize, supported operations: "sum", "count", "avg", "min", "max"
5. If the user asks something that doesn't require sheet mutation (e.g., explaining a formula, data insight), use reply_only with a helpful markdown response.
6. Always include a friendly, concise message field explaining what you did or found.
7. Be proactive: suggest follow-up actions the user might want to take.
8. When a user attaches a document or asks you to generate a structured table (amortization schedule, cash flow projection, payment schedule, invoice breakdown, depreciation table, etc.), use set_rows or create_sheet with a COMPLETE rows array containing ALL generated data rows in a single tool call. NEVER ask the user to run it again for each row — generate ALL rows at once.
9. For set_rows and create_sheet, always include both "columns" (array of column name strings) and "rows" (array of objects where keys match column names exactly). Numeric values must be numbers, not strings.
10. Use create_sheet (not set_rows) when the user's current sheet already has data they want to preserve. Use set_rows only when the sheet is empty or the user explicitly wants to replace existing data.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "apply_sheet_action",
      description:
        "Apply a structured action to the spreadsheet. Use this for any data manipulation request.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: [
              "sort", "filter", "add_row", "add_column", "summarize",
              "rename_column", "fill_formula", "set_rows", "create_sheet", "reply_only",
            ],
            description: "The type of action to perform",
          },
          params: {
            type: "object",
            description: "Action-specific parameters",
            properties: {
              column: { type: "string", description: "Column name for sort/filter operations" },
              direction: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
              operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contains"], description: "Comparison operator for filter" },
              value: { description: "Comparison value for filter" },
              values: { type: "object", description: "Key-value pairs for add_row (column: value)" },
              name: { type: "string", description: "New column name for add_column" },
              formula_column: { type: "string", description: "Source column for formula" },
              operation: { type: "string", description: "Aggregation operation for summarize: sum, count, avg, min, max" },
              group_by: { type: "string", description: "Column to group by for summarize" },
              aggregate_column: { type: "string", description: "Column to aggregate for summarize" },
              from: { type: "string", description: "Original column name for rename_column" },
              to: { type: "string", description: "New column name for rename_column" },
              target_column: { type: "string", description: "Column to fill for fill_formula/add_column" },
              expression: { type: "string", description: "Math expression using column names as variables for fill_formula" },
              columns: { type: "array", items: { type: "string" }, description: "Array of column header strings for set_rows or create_sheet" },
              rows: { type: "array", items: { type: "object" }, description: "Full array of row objects to write for set_rows or create_sheet. Keys must match column names exactly." },
              sheet_name: { type: "string", description: "Name for the new sheet tab when using create_sheet" },
            },
          },
          message: { type: "string", description: "Human-readable explanation of what was done or found. Use markdown for formatting." },
        },
        required: ["action", "message"],
        additionalProperties: false,
      },
    },
  },
];

// Convert OpenAI-style tools to Anthropic tool format
const CLAUDE_TOOLS = TOOLS.map((t) => ({
  name: t.function.name,
  description: t.function.description,
  input_schema: t.function.parameters,
}));

// ── Routing Logic ──────────────────────────────────────────────────────────────

const CLAUDE_KEYWORDS = [
  "analyze", "forecast", "projection", "amortization", "depreciation",
  "cash flow", "financial plan", "scenario analysis", "what-if", "sensitivity",
  "monte carlo", "regression", "trend analysis", "variance analysis",
  "budget projection", "revenue model", "cost model",
];

function shouldUseClaude(
  messages: { role: string; content: string }[],
  hasAttachment: boolean,
  anthropicKeyAvailable: boolean
): boolean {
  if (!anthropicKeyAvailable) return false;
  if (hasAttachment) return true;

  // Check total content length
  const totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  if (totalChars > 8000) return true;

  // Check last user message for analytical keywords
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const lower = lastUserMsg.content.toLowerCase();
    if (CLAUDE_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  }

  return false;
}

// ── Build context string ───────────────────────────────────────────────────────

function buildSheetContextStr(sheetContext: any): string {
  if (!sheetContext) return "";
  return `\n\n## Current Sheet: "${sheetContext.activeSheetName}"
Columns: ${sheetContext.columns.join(", ")}
Total rows: ${sheetContext.rowCount}
Sample data (first ${Math.min(sheetContext.sampleRows?.length || 0, 10)} rows):
${JSON.stringify(sheetContext.sampleRows?.slice(0, 10) || [], null, 2)}`;
}

// ── Claude API call ────────────────────────────────────────────────────────────

async function callClaude(
  systemContent: string,
  userMessages: { role: string; content: string }[],
  anthropicKey: string
): Promise<{ result: any; model_used: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16384,
      system: systemContent,
      messages: userMessages,
      tools: CLAUDE_TOOLS,
      tool_choice: { type: "auto" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude API error:", response.status, errText);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract tool use from Claude's response format
  const toolBlock = data.content?.find((b: any) => b.type === "tool_use");
  if (toolBlock && toolBlock.name === "apply_sheet_action") {
    return { result: toolBlock.input, model_used: "claude" };
  }

  // Fallback: text-only response from Claude
  const textBlock = data.content?.find((b: any) => b.type === "text");
  return {
    result: { action: "reply_only", message: textBlock?.text || "" },
    model_used: "claude",
  };
}

// ── Gemini API call (existing logic) ───────────────────────────────────────────

async function callGemini(
  systemMessage: { role: string; content: string },
  userMessages: { role: string; content: string }[],
  lovableKey: string
): Promise<{ result: any; model_used: string }> {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [systemMessage, ...userMessages],
        tools: TOOLS,
        tool_choice: "auto",
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 429) throw { status: 429, message: "Rate limit exceeded" };
    if (response.status === 402) throw { status: 402, message: "AI credits exhausted" };
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("No response from AI");

  if (choice.finish_reason === "tool_calls" || choice.message?.tool_calls?.length > 0) {
    const toolCall = choice.message.tool_calls[0];
    const toolArgs = JSON.parse(toolCall.function.arguments);
    return { result: toolArgs, model_used: "gemini" };
  }

  const content = choice.message?.content || "";
  return { result: { action: "reply_only", message: content }, model_used: "gemini" };
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, sheetContext, hasAttachment } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const sheetContextStr = buildSheetContextStr(sheetContext);
    const systemContent = SYSTEM_PROMPT + sheetContextStr;

    const userMessages = (messages || []).filter(
      (m: { role: string }) => m.role !== "system"
    );

    const useClaude = shouldUseClaude(userMessages, !!hasAttachment, !!ANTHROPIC_API_KEY);
    let result: any;
    let model_used: string;

    if (useClaude) {
      try {
        const claudeResult = await callClaude(systemContent, userMessages, ANTHROPIC_API_KEY!);
        result = claudeResult.result;
        model_used = claudeResult.model_used;
      } catch (claudeErr) {
        console.error("Claude failed, falling back to Gemini:", claudeErr);
        const geminiResult = await callGemini(
          { role: "system", content: systemContent },
          userMessages,
          LOVABLE_API_KEY
        );
        result = geminiResult.result;
        model_used = geminiResult.model_used;
      }
    } else {
      try {
        const geminiResult = await callGemini(
          { role: "system", content: systemContent },
          userMessages,
          LOVABLE_API_KEY
        );
        result = geminiResult.result;
        model_used = geminiResult.model_used;
      } catch (err: any) {
        // Propagate rate limit / credit errors
        if (err?.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (err?.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw err;
      }
    }

    return new Response(
      JSON.stringify({ type: "action", result, model_used }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("alice-sheets-assistant error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

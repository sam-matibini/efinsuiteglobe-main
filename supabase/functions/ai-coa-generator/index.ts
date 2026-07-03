import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GenerateRequest {
  industry: string;
  industryLabel: string;
  country: string;
  countryName: string;
  taxRegime: string;
  organizationSize: string;
  accountingFramework: string;
  specializedAccounts: string[];
  cogsRequired: boolean;
  inventoryRequired: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      industry,
      industryLabel,
      country,
      countryName,
      taxRegime,
      organizationSize,
      accountingFramework,
      specializedAccounts,
      cogsRequired,
      inventoryRequired,
    }: GenerateRequest = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const sizeDetails = {
      small: { employees: "1-10", accounts: "40-60", detail: "simplified" },
      medium: { employees: "11-50", accounts: "60-100", detail: "standard" },
      large: { employees: "50+", accounts: "100-150", detail: "comprehensive" },
    };
    const size = sizeDetails[organizationSize as keyof typeof sizeDetails] || sizeDetails.medium;

    const systemPrompt = `You are an expert Chart of Accounts generator for accounting software. Generate industry-specific, compliant charts of accounts following ${accountingFramework} standards.

CRITICAL RULES:
1. Generate VALID JSON array only - no markdown, no explanations
2. Use hierarchical account codes: Headers use X-XX format (e.g., "1-01"), detail accounts use X-XX-XXX-XXXX format
3. Headers have is_header: true, posting_allowed: false
4. Detail accounts have is_header: false, posting_allowed: true
5. Include parent_code for child accounts
6. Account types: asset, liability, equity, income, cogs, expense, other_income, other_expense
7. normal_balance: "debit" for assets/expenses, "credit" for liabilities/equity/income
8. is_current: true for current assets/liabilities (< 1 year), false for long-term
9. Include account_class, account_group, account_sub_group for proper classification

TAX ACCOUNTS for ${taxRegime} in ${countryName}:
- CRITICAL TAX ACCOUNT TYPES:
  * GST/HST PAYABLE (2-01-1XX): This is a LIABILITY (credit-normal) - tax collected on sales that is owed to CRA
  * GST/HST INPUT TAX CREDITS/ITC (1-01-1XX): This is an ASSET (debit-normal) - tax paid on purchases that can be reclaimed from CRA
  * PST/QST Payable: LIABILITY for provincial sales tax collected
  * PST/QST Recoverable (QC only): ASSET for QST input credits
- Include income tax payable accounts (LIABILITY)
- Include payroll tax liability accounts (CPP, EI, etc. for Canada; FICA, FUTA for US)`;

    const userPrompt = `Generate a ${size.detail} Chart of Accounts for a ${size.employees} employee ${industryLabel} business in ${countryName} using ${taxRegime} tax regime.

Requirements:
- Approximately ${size.accounts} accounts total
- ${accountingFramework} compliant
- ${cogsRequired ? "Include COGS section with cost of goods sold accounts" : "No COGS section needed"}
- ${inventoryRequired ? "Include inventory accounts (raw materials, WIP, finished goods as applicable)" : "No inventory accounts needed"}
- Include these specialized accounts: ${specializedAccounts.length > 0 ? specializedAccounts.join(", ") : "standard accounts only"}

CRITICAL - BANKING & CREDIT CARD ACCOUNTS:
You MUST include multiple bank and credit card accounts under the Cash header (1-01-1XX):
- At least 3 bank accounts: Operating Bank, Payroll Bank, and Savings/Reserve Bank
- At least 2 credit card liability accounts under Current Liabilities (2-01-1XX): Corporate Credit Card, Employee Expense Card

Bank account codes should be 1-01-101-XXXX format:
- 1-01-101-0001: Operating Bank Account (primary checking)
- 1-01-101-0002: Payroll Bank Account (for payroll disbursements)
- 1-01-101-0003: Savings/Reserve Account (for reserves/savings)
- 1-01-101-0004: USD Operating Account (if multi-currency business)

Credit Card liability codes should be 2-01-110-XXXX format:
- 2-01-110-0001: Corporate Credit Card (main business card)
- 2-01-110-0002: Employee Expense Card (for employee reimbursements)
- 2-01-110-0003: Fuel/Fleet Card (if applicable to industry)

CRITICAL - SALES TAX ACCOUNTS (must create with correct account types!):
For Canadian organizations:
- 1-01-120-0001: GST/HST Input Tax Credits (ITC) - account_type: "asset", normal_balance: "debit" (tax PAID on purchases, reclaimable)
- 2-01-140-0001: GST/HST Payable - account_type: "liability", normal_balance: "credit" (tax COLLECTED on sales, owed to CRA)
- 2-01-140-0002: PST Payable (if applicable) - account_type: "liability" (for BC, SK, MB)
- 1-01-120-0002: QST Input Tax Rebate (if QC) - account_type: "asset" (QST is recoverable unlike PST)

Account Structure Required:
1. ASSETS (1-XX): Current Assets (1-01-XXX) with MULTIPLE bank accounts AND tax receivable accounts (ITC), Fixed Assets (1-02-XXX), Other Assets (1-03-XXX)
2. LIABILITIES (2-XX): Current Liabilities (2-01-XXX) with credit card accounts AND tax payable accounts, Long-Term Liabilities (2-02-XXX)
3. EQUITY (3-XX): Share Capital, Retained Earnings, Dividends, Opening Balance Equity
4. INCOME (4-XX): Operating Revenue, Other Income
${cogsRequired ? "5. COGS (5-XX): Cost of Goods Sold accounts" : ""}
6. EXPENSES (6-XX): Operating Expenses by category
7. OTHER (7-XX): Other Income/Expenses, Gains/Losses

Return ONLY a JSON array of account objects with these fields:
{
  "code": "1-01-101-0001",
  "name": "Operating Bank - ${country}",
  "account_type": "asset",
  "is_header": false,
  "normal_balance": "debit",
  "parent_code": "1-01-101",
  "account_class": "Asset",
  "account_group": "Current Asset",
  "account_sub_group": "Cash",
  "is_current": true,
  "posting_allowed": true,
  "description": "Primary operating bank account"
}`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response, handling potential markdown code blocks
    let accounts;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : content.trim();
      accounts = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI-generated accounts");
    }

    if (!Array.isArray(accounts)) {
      throw new Error("AI response is not an array");
    }

    // Validate and clean up accounts
    const validatedAccounts = accounts.map((acc: any, index: number) => ({
      code: acc.code || `GEN-${index}`,
      name: acc.name || `Account ${index}`,
      account_type: acc.account_type || "asset",
      is_header: acc.is_header ?? false,
      normal_balance: acc.normal_balance || "debit",
      parent_code: acc.parent_code || null,
      account_class: acc.account_class || "Asset",
      account_group: acc.account_group || "Current Asset",
      account_sub_group: acc.account_sub_group || null,
      is_current: acc.is_current ?? true,
      posting_allowed: acc.posting_allowed ?? !acc.is_header,
      description: acc.description || null,
    }));

    return new Response(JSON.stringify({ 
      accounts: validatedAccounts,
      meta: {
        industry,
        country,
        taxRegime,
        organizationSize,
        accountingFramework,
        totalAccounts: validatedAccounts.length,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI CoA Generator error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to generate accounts" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

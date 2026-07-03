import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const ALLOWED_ORIGINS = [
  'https://ffijmmkgbrifrkjndzms.lovableproject.com',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.endsWith('.lovable.app'));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Input validation schema
const provinceEnum = z.enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);

const employeeSchema = z.object({
  first_name: z.string().max(100).trim().optional(),
  last_name: z.string().max(100).trim().optional(),
  date_of_birth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional()
    .nullable(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary'])
    .optional()
    .nullable(),
  annual_salary: z.number()
    .min(0, 'Salary cannot be negative')
    .max(10000000, 'Salary unreasonably high')
    .optional()
    .nullable(),
  hire_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .optional()
    .nullable(),
}).optional().nullable();

const td1RequestSchema = z.object({
  province: provinceEnum,
  formType: z.enum(['federal', 'provincial']),
  employee: employeeSchema,
});

// Data minimization helpers - anonymize PII before sending to AI
function getAgeCategory(dob: string | null | undefined): string {
  if (!dob) return 'Unknown';
  try {
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    if (age >= 65) return '65+';
    if (age >= 18) return 'Under 65';
    return 'Under 18';
  } catch {
    return 'Unknown';
  }
}

function getSalaryBracket(salary: number | null | undefined): string {
  if (!salary) return 'Not provided';
  if (salary < 50000) return 'Under $50k';
  if (salary < 100000) return '$50k-$100k';
  if (salary < 150000) return '$100k-$150k';
  if (salary < 200000) return '$150k-$200k';
  return 'Over $200k';
}

function getTenureBracket(hireDate: string | null | undefined): string {
  if (!hireDate) return 'Unknown';
  try {
    const years = Math.floor((Date.now() - new Date(hireDate).getTime()) / 31536000000);
    if (years < 1) return 'Less than 1 year';
    if (years < 5) return '1-5 years';
    return 'Over 5 years';
  } catch {
    return 'Unknown';
  }
}

// 2025 TD1 Default amounts by province/territory
const TD1_DEFAULTS: Record<string, {
  basicPersonalAmount: number;
  canadaEmploymentAmount: number;
  ageAmount: number;
  disabilityAmount: number;
  pensionIncomeAmount: number;
  caregiverAmount: number;
}> = {
  'federal': {
    basicPersonalAmount: 16129,
    canadaEmploymentAmount: 1433,
    ageAmount: 8790,
    disabilityAmount: 9872,
    pensionIncomeAmount: 2000,
    caregiverAmount: 8375
  },
  'AB': { basicPersonalAmount: 21885, canadaEmploymentAmount: 0, ageAmount: 6608, disabilityAmount: 16635, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'BC': { basicPersonalAmount: 12932, canadaEmploymentAmount: 0, ageAmount: 5557, disabilityAmount: 9428, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'MB': { basicPersonalAmount: 15780, canadaEmploymentAmount: 0, ageAmount: 0, disabilityAmount: 0, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'NB': { basicPersonalAmount: 13396, canadaEmploymentAmount: 0, ageAmount: 5928, disabilityAmount: 9626, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'NL': { basicPersonalAmount: 10818, canadaEmploymentAmount: 0, ageAmount: 7354, disabilityAmount: 7259, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'NS': { basicPersonalAmount: 11481, canadaEmploymentAmount: 0, ageAmount: 6096, disabilityAmount: 8081, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'NT': { basicPersonalAmount: 17373, canadaEmploymentAmount: 0, ageAmount: 8282, disabilityAmount: 15064, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'NU': { basicPersonalAmount: 18767, canadaEmploymentAmount: 0, ageAmount: 13934, disabilityAmount: 16274, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'ON': { basicPersonalAmount: 12399, canadaEmploymentAmount: 0, ageAmount: 5868, disabilityAmount: 9586, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'PE': { basicPersonalAmount: 13500, canadaEmploymentAmount: 0, ageAmount: 5508, disabilityAmount: 7618, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'QC': { basicPersonalAmount: 18571, canadaEmploymentAmount: 0, ageAmount: 3658, disabilityAmount: 3958, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'SK': { basicPersonalAmount: 18491, canadaEmploymentAmount: 0, ageAmount: 5852, disabilityAmount: 11385, pensionIncomeAmount: 0, caregiverAmount: 0 },
  'YT': { basicPersonalAmount: 16129, canadaEmploymentAmount: 1433, ageAmount: 8790, disabilityAmount: 9872, pensionIncomeAmount: 2000, caregiverAmount: 8375 }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Validate origin for non-OPTIONS requests
  const origin = req.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.endsWith('.lovable.app'));
  if (origin && !isAllowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse and validate JSON input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input with Zod
    const validationResult = td1RequestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { employee, province, formType } = validationResult.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get default values for this province/form
    const defaults = formType === 'federal' ? TD1_DEFAULTS.federal : (TD1_DEFAULTS[province] || TD1_DEFAULTS.ON);

    // Build ANONYMIZED employee context for AI analysis - data minimization
    // Only send generalized brackets, not exact PII values
    const employeeContext = employee ? `
Employee Context (anonymized for privacy):
- Age Category: ${getAgeCategory(employee.date_of_birth)}
- Province: ${province}
- Employment Type: ${employee.employment_type || 'full_time'}
- Income Bracket: ${getSalaryBracket(employee.annual_salary)}
- Tenure: ${getTenureBracket(employee.hire_date)}
` : 'No employee details provided.';

    const systemPrompt = `You are a Canadian payroll tax expert assistant helping complete TD1 tax credit forms.
Your role is to analyze employee information and suggest applicable tax credits based on Canadian tax law.

For the ${formType === 'federal' ? 'Federal' : province} TD1 form:
- Basic Personal Amount for ${formType === 'federal' ? 'Federal' : province}: $${defaults.basicPersonalAmount.toLocaleString()}
${formType === 'federal' ? `- Canada Employment Amount: $${defaults.canadaEmploymentAmount.toLocaleString()}` : ''}
- Age Amount (65+): $${defaults.ageAmount.toLocaleString()}
- Disability Amount: $${defaults.disabilityAmount.toLocaleString()}

Analyze the employee information and provide:
1. Confirmed applicable credits with amounts
2. Potential credits that may apply (with confidence level)
3. Brief explanations for each suggestion

Be conservative - only suggest credits with high confidence when employee data supports it.
If age category indicates 65+, suggest the age amount.
Always include the basic personal amount.
For federal forms, include Canada Employment Amount for employees.`;

    const userPrompt = `${employeeContext}

Please analyze this employee and suggest TD1 ${formType === 'federal' ? 'Federal' : 'Provincial (' + province + ')'} tax credits.

Respond with a JSON object containing:
{
  "suggestions": [
    {
      "credit_name": "string",
      "field_name": "basic_personal_amount | age_amount | disability_amount | spouse_amount | caregiver_amount | canada_employment_amount | tuition_amount | pension_income_amount | other_credits",
      "amount": number,
      "confidence": "high" | "medium" | "low",
      "reason": "string explanation"
    }
  ],
  "total_estimated_claim": number,
  "notes": "any additional notes or questions to ask employee"
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
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      // Return defaults if AI fails
      return new Response(
        JSON.stringify({
          suggestions: [
            {
              credit_name: "Basic Personal Amount",
              field_name: "basic_personal_amount",
              amount: defaults.basicPersonalAmount,
              confidence: "high",
              reason: `Standard ${formType === 'federal' ? 'federal' : province} basic personal amount for 2025`
            },
            ...(formType === 'federal' ? [{
              credit_name: "Canada Employment Amount",
              field_name: "canada_employment_amount",
              amount: defaults.canadaEmploymentAmount,
              confidence: "high",
              reason: "Standard employment amount for all employees"
            }] : [])
          ],
          total_estimated_claim: defaults.basicPersonalAmount + (formType === 'federal' ? defaults.canadaEmploymentAmount : 0),
          notes: "AI analysis unavailable. Showing standard defaults.",
          defaults
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Parse the JSON from AI response
    let parsedResult;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsedResult = JSON.parse(jsonMatch[1].trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return defaults on parse error
      parsedResult = {
        suggestions: [
          {
            credit_name: "Basic Personal Amount",
            field_name: "basic_personal_amount",
            amount: defaults.basicPersonalAmount,
            confidence: "high",
            reason: `Standard ${formType === 'federal' ? 'federal' : province} basic personal amount`
          }
        ],
        total_estimated_claim: defaults.basicPersonalAmount,
        notes: "Using standard defaults."
      };
    }

    return new Response(
      JSON.stringify({
        ...parsedResult,
        defaults,
        province,
        formType,
        taxYear: 2025
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("td1-ai-assist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

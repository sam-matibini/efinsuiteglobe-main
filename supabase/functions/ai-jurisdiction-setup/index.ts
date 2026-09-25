import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://id-preview--7ad11d58-fd56-4aea-9970-5a9b2d47b933.lovable.app",
  "https://efinsuite.com",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.some((allowed) => origin === allowed);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Input validation schemas
const OrganizationInputSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().max(200).trim(),
  legalName: z.string().max(200).trim().optional().nullable(),
  addressLine1: z.string().max(255).trim().optional().nullable(),
  addressLine2: z.string().max(255).trim().optional().nullable(),
  city: z.string().max(100).trim().optional().nullable(),
  province: z.string().max(50).trim().optional().nullable(),
  postalCode: z.string().max(20).trim().optional().nullable(),
  country: z.string().max(100).trim().optional().nullable(),
  phone: z.string().max(50).trim().optional().nullable(),
  industry: z.string().max(100).trim().optional().nullable(),
});

const RequestBodySchema = z.union([
  z.object({
    organization_id: z.string().uuid(),
    organization: z.undefined().optional(),
    action: z.undefined().optional(),
  }),
  z.object({
    organization: OrganizationInputSchema,
    action: z.enum(["detect", "apply"]),
  }),
]);

type OrganizationInput = z.infer<typeof OrganizationInputSchema>;

interface CountryData {
  id: string;
  code: string;
  name: string;
  default_currency: string;
  accounting_standard: string;
  phone_code: string | null;
}

interface JurisdictionData {
  id: string;
  code: string;
  name: string;
  country_id: string;
}

interface JurisdictionDetection {
  countryId: string;
  countryCode: string;
  countryName: string;
  jurisdictionId?: string;
  jurisdictionCode?: string;
  jurisdictionName?: string;
  confidence: number;
  currency: string;
  accountingStandard: string;
  taxTypes: Array<{
    id: string;
    code: string;
    name: string;
    defaultRate: number;
  }>;
  payrollDeductions: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

// Sanitize input for AI prompts - prevents prompt injection
// deno-lint-ignore no-control-regex
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F-\x9F]/g;

function sanitizeForPrompt(input: string | null | undefined, maxLength: number): string {
  if (!input) return "N/A";
  return input
    .replace(CONTROL_CHARS_REGEX, "") // Remove control characters
    .replace(/[\n\r]/g, " ") // Replace newlines with spaces
    .replace(/[<>{}[\]]/g, "") // Remove brackets that could be interpreted as commands
    .trim()
    .slice(0, maxLength);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin for non-OPTIONS requests
  const origin = req.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.some((allowed) => origin === allowed)) {
    console.error("Origin not allowed:", origin);
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized - missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized - invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validationResult = RequestBodySchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          details: validationResult.error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validatedBody = validationResult.data;

    let organization: OrganizationInput | undefined;
    let action: "detect" | "apply" | undefined;
    let targetOrgId: string;

    if ("organization_id" in validatedBody && validatedBody.organization_id) {
      // Re-run setup mode - fetch org data and apply
      targetOrgId = validatedBody.organization_id;

      // Verify user is a member of this organization
      const { data: isMember, error: memberError } = await supabase.rpc("is_org_member", {
        _user_id: user.id,
        _organization_id: targetOrgId,
      });

      if (memberError) {
        console.error("Membership check error:", memberError);
        return new Response(JSON.stringify({ error: "Failed to verify organization membership" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isMember) {
        console.error("User not a member of organization:", { userId: user.id, orgId: targetOrgId });
        return new Response(JSON.stringify({ error: "Not authorized to access this organization" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select(
          "id, name, legal_name, address_line1, address_line2, city, province, postal_code, country, phone, industry, country_id"
        )
        .eq("id", targetOrgId)
        .single();

      if (orgError) {
        console.error("Org fetch error:", orgError);
        return new Response(JSON.stringify({ error: "Organization not found", details: orgError.message }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!orgData) {
        return new Response(JSON.stringify({ error: "Organization not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch country info separately if country_id exists
      let countryName: string | null = orgData.country;
      if (orgData.country_id) {
        const { data: countryData } = await supabase
          .from("countries")
          .select("code, name")
          .eq("id", orgData.country_id)
          .single();
        if (countryData) {
          countryName = countryData.name;
        }
      }

      organization = {
        organizationId: orgData.id,
        name: orgData.name,
        legalName: orgData.legal_name,
        addressLine1: orgData.address_line1,
        addressLine2: orgData.address_line2,
        city: orgData.city,
        province: orgData.province,
        postalCode: orgData.postal_code,
        country: countryName || undefined,
        phone: orgData.phone,
        industry: orgData.industry,
      };
      action = "apply";
    } else if ("organization" in validatedBody && validatedBody.organization) {
      organization = validatedBody.organization;
      action = validatedBody.action;
      targetOrgId = organization.organizationId;

      // Verify user is a member of this organization
      const { data: isMember, error: memberError } = await supabase.rpc("is_org_member", {
        _user_id: user.id,
        _organization_id: targetOrgId,
      });

      if (memberError) {
        console.error("Membership check error:", memberError);
        return new Response(JSON.stringify({ error: "Failed to verify organization membership" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isMember) {
        console.error("User not a member of organization:", { userId: user.id, orgId: targetOrgId });
        return new Response(JSON.stringify({ error: "Not authorized to access this organization" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid request format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "detect" && organization) {
      const detection = await detectJurisdiction(supabase, organization, lovableApiKey);

      return new Response(JSON.stringify({ success: true, detection }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "apply" && organization) {
      const result = await applyJurisdictionSetup(supabase, organization);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action or missing organization" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI Jurisdiction Setup Error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
async function detectJurisdiction(
  supabase: any,
  org: OrganizationInput,
  lovableApiKey?: string
): Promise<JurisdictionDetection> {
  // Get all countries for matching
  const { data: countries } = await supabase.from("countries").select("*").eq("is_active", true);

  // Get all jurisdictions
  const { data: jurisdictions } = await supabase.from("jurisdictions").select("*").eq("is_active", true);

  const countryList = (countries || []) as CountryData[];
  const jurisdictionList = (jurisdictions || []) as JurisdictionData[];

  let detectedCountry: CountryData | null = null;
  let detectedJurisdiction: JurisdictionData | null = null;
  let confidence = 0;

  // Try to match country from explicit country field
  if (org.country) {
    const countryMatch = countryList.find(
      (c) =>
        c.code.toLowerCase() === org.country?.toLowerCase() || c.name.toLowerCase() === org.country?.toLowerCase()
    );
    if (countryMatch) {
      detectedCountry = countryMatch;
      confidence = 95;
    }
  }

  // Try to detect from phone number
  if (!detectedCountry && org.phone) {
    const phoneCountry = countryList.find((c) => c.phone_code && org.phone?.startsWith(c.phone_code));
    if (phoneCountry) {
      detectedCountry = phoneCountry;
      confidence = Math.max(confidence, 80);
    }
  }

  // Try to detect from postal code format
  if (!detectedCountry && org.postalCode) {
    if (/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(org.postalCode)) {
      detectedCountry = countryList.find((c) => c.code === "CA") || null;
      confidence = Math.max(confidence, 90);
    } else if (/^\d{5}(-\d{4})?$/.test(org.postalCode)) {
      detectedCountry = countryList.find((c) => c.code === "US") || null;
      confidence = Math.max(confidence, 85);
    }
  }

  // Try to match jurisdiction (province/state)
  if (detectedCountry && org.province) {
    const jurisdictionMatch = jurisdictionList.find(
      (j) =>
        j.country_id === detectedCountry!.id &&
        (j.code.toLowerCase() === org.province?.toLowerCase() || j.name.toLowerCase() === org.province?.toLowerCase())
    );
    if (jurisdictionMatch) {
      detectedJurisdiction = jurisdictionMatch;
      confidence = Math.min(confidence + 5, 100);
    }
  }

  // If AI is available and low confidence, use AI to enhance detection
  if (lovableApiKey && confidence < 70) {
    try {
      const aiDetection = await aiEnhancedDetection(org, countryList, lovableApiKey);
      if (aiDetection && aiDetection.confidence > confidence) {
        const aiCountry = countryList.find((c) => c.code === aiDetection.countryCode);
        if (aiCountry) {
          detectedCountry = aiCountry;
          if (aiDetection.jurisdictionCode) {
            detectedJurisdiction =
              jurisdictionList.find((j) => j.country_id === aiCountry.id && j.code === aiDetection.jurisdictionCode) ||
              null;
          }
          confidence = aiDetection.confidence;
        }
      }
    } catch (aiError) {
      console.error("AI detection failed:", aiError);
    }
  }

  // Default to Canada if nothing detected
  if (!detectedCountry) {
    detectedCountry = countryList.find((c) => c.code === "CA") || null;
    confidence = 50;
  }

  if (!detectedCountry) {
    throw new Error("No countries configured in the system");
  }

  // Get tax types for the country
  const { data: taxTypes } = await supabase
    .from("tax_types")
    .select(
      `
      id, code, name,
      tax_rates (rate, is_default)
    `
    )
    .eq("country_id", detectedCountry.id)
    .eq("is_active", true)
    .eq("tax_category", "sales");

  // Get payroll deductions for the country
  const { data: payrollDeductions } = await supabase
    .from("payroll_deduction_types")
    .select("id, code, name")
    .eq("country_id", detectedCountry.id)
    .eq("is_active", true);

  return {
    countryId: detectedCountry.id,
    countryCode: detectedCountry.code,
    countryName: detectedCountry.name,
    jurisdictionId: detectedJurisdiction?.id,
    jurisdictionCode: detectedJurisdiction?.code,
    jurisdictionName: detectedJurisdiction?.name,
    confidence,
    currency: detectedCountry.default_currency,
    accountingStandard: detectedCountry.accounting_standard,
    taxTypes: (
      taxTypes || []
    ).map(
      (t: { id: string; code: string; name: string; tax_rates: Array<{ rate: number; is_default: boolean }> }) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        defaultRate: t.tax_rates?.find((r) => r.is_default)?.rate || 0,
      })
    ),
    payrollDeductions: payrollDeductions || [],
  };
}

async function aiEnhancedDetection(
  org: OrganizationInput,
  countries: CountryData[],
  apiKey: string
): Promise<{ countryCode: string; jurisdictionCode?: string; confidence: number } | null> {
  // Sanitize all inputs to prevent prompt injection
  const sanitizedName = sanitizeForPrompt(org.name, 200);
  const sanitizedLegalName = sanitizeForPrompt(org.legalName, 200);
  const sanitizedAddress1 = sanitizeForPrompt(org.addressLine1, 255);
  const sanitizedAddress2 = sanitizeForPrompt(org.addressLine2, 255);
  const sanitizedCity = sanitizeForPrompt(org.city, 100);
  const sanitizedProvince = sanitizeForPrompt(org.province, 50);
  const sanitizedPostalCode = sanitizeForPrompt(org.postalCode, 20);
  const sanitizedCountry = sanitizeForPrompt(org.country, 100);
  const sanitizedPhone = sanitizeForPrompt(org.phone, 50);

  const prompt = `Based on the following organization information, determine the most likely country and jurisdiction (state/province). Return ONLY a JSON object.

Organization:
- Name: ${sanitizedName}
- Legal Name: ${sanitizedLegalName}
- Address: ${sanitizedAddress1} ${sanitizedAddress2}
- City: ${sanitizedCity}
- Province/State: ${sanitizedProvince}
- Postal Code: ${sanitizedPostalCode}
- Country: ${sanitizedCountry}
- Phone: ${sanitizedPhone}

Available countries: ${countries.map((c) => `${c.code} (${c.name})`).join(", ")}

Return JSON: { "countryCode": "XX", "jurisdictionCode": "XX" (optional), "confidence": 0-100 }`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a jurisdiction detection AI. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.error("Failed to parse AI response:", content, parseError);
  }

  return null;
}

// deno-lint-ignore no-explicit-any
async function applyJurisdictionSetup(
  supabase: any,
  org: OrganizationInput
): Promise<{ organizationUpdated: boolean; taxSettingsCreated: number; payrollSettingsCreated: number }> {
  const detection = await detectJurisdiction(supabase, org, Deno.env.get("LOVABLE_API_KEY"));

  // Update organization with jurisdiction
  const { error: orgError } = await supabase
    .from("organizations")
    .update({
      primary_country_id: detection.countryId,
      primary_jurisdiction_id: detection.jurisdictionId,
      currency: detection.currency,
      accounting_standard: detection.accountingStandard,
      ai_setup_completed: true,
      ai_setup_completed_at: new Date().toISOString(),
    })
    .eq("id", org.organizationId);

  if (orgError) throw orgError;

  // Create organization jurisdiction record
  await supabase.from("organization_jurisdictions").upsert(
    {
      organization_id: org.organizationId,
      country_id: detection.countryId,
      is_primary: true,
      is_active: true,
      reporting_currency: detection.currency,
      accounting_standard: detection.accountingStandard,
      ai_setup_confidence: detection.confidence,
      setup_completed_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,country_id" }
  );

  // Enable tax types
  let taxSettingsCreated = 0;
  for (const taxType of detection.taxTypes) {
    const { error } = await supabase.from("organization_tax_settings").upsert(
      {
        organization_id: org.organizationId,
        tax_type_id: taxType.id,
        is_enabled: true,
        is_registered: true,
      },
      { onConflict: "organization_id,tax_type_id" }
    );

    if (!error) taxSettingsCreated++;
  }

  // Enable payroll deductions
  let payrollSettingsCreated = 0;
  for (const deduction of detection.payrollDeductions) {
    const { error } = await supabase.from("organization_payroll_settings").upsert(
      {
        organization_id: org.organizationId,
        deduction_type_id: deduction.id,
        is_enabled: true,
      },
      { onConflict: "organization_id,deduction_type_id" }
    );

    if (!error) payrollSettingsCreated++;
  }

  // Log AI setup decision
  await supabase.from("ai_setup_logs").insert({
    organization_id: org.organizationId,
    setup_type: "jurisdiction",
    detected_value: detection,
    applied_value: detection,
    confidence_score: detection.confidence,
    was_overridden: false,
  });

  return {
    organizationUpdated: true,
    taxSettingsCreated,
    payrollSettingsCreated,
  };
}

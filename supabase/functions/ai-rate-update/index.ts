import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateUpdateRequest {
  organization_id: string;
  update_type: 'sales_tax' | 'payroll' | 'both';
  target_date?: string; // ISO date string, defaults to current date
}

interface RateChange {
  type: string;
  code: string;
  name: string;
  old_rate?: number;
  new_rate: number;
  effective_date: string;
  source?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    // Create authenticated client
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { organization_id, update_type = 'both', target_date } = await req.json() as RateUpdateRequest;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get organization and country info
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, country_id, country')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get country details
    let countryId = org.country_id;
    let countryCode = '';
    let countryName = '';

    if (countryId) {
      const { data: country } = await supabaseAdmin
        .from('countries')
        .select('id, code, name')
        .eq('id', countryId)
        .single();
      
      if (country) {
        countryCode = country.code;
        countryName = country.name;
      }
    } else if (org.country) {
      // Try to match by name
      const { data: country } = await supabaseAdmin
        .from('countries')
        .select('id, code, name')
        .ilike('name', org.country)
        .single();
      
      if (country) {
        countryId = country.id;
        countryCode = country.code;
        countryName = country.name;
      }
    }

    if (!countryId || !countryCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Country not configured for organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveDate = target_date || new Date().toISOString().split('T')[0];
    const currentYear = new Date(effectiveDate).getFullYear();

    // Get current tax types and rates
    const { data: currentTaxTypes } = await supabaseAdmin
      .from('tax_types')
      .select('*, tax_rates(*)')
      .eq('country_id', countryId)
      .eq('is_active', true);

    // Get current payroll deduction types
    const { data: currentPayrollTypes } = await supabaseAdmin
      .from('payroll_deduction_types')
      .select('*, payroll_rate_brackets(*)')
      .eq('country_id', countryId)
      .eq('is_active', true);

    // Get organization province for provincial tax credits
    let orgProvince = '';
    const { data: orgSettings } = await supabaseAdmin
      .from('organization_jurisdictions')
      .select('jurisdiction_id, jurisdictions(code, name)')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .limit(1);
    
    if (orgSettings?.[0]?.jurisdictions) {
      orgProvince = (orgSettings[0].jurisdictions as any).code || '';
    }

    // Build AI prompt for rate research with CRA sources
    const prompt = buildRateResearchPrompt(
      countryCode,
      countryName,
      currentYear,
      effectiveDate,
      update_type,
      currentTaxTypes || [],
      currentPayrollTypes || [],
      orgProvince
    );

    if (!lovableApiKey) {
      console.log('LOVABLE_API_KEY not configured, using fallback rates');
      
      // Use hardcoded fallback rates for known jurisdictions
      const fallbackChanges = getFallbackRates(countryCode, currentYear, update_type);
      
      // Create rate update log
      const { data: logEntry, error: logError } = await supabaseAdmin
        .from('rate_update_logs')
        .insert({
          organization_id,
          country_id: countryId,
          update_type,
          effective_date: effectiveDate,
          status: 'pending',
          changes_detected: fallbackChanges,
          ai_source: 'fallback',
          ai_confidence: 0.7,
          triggered_by: 'manual',
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Rate check completed using fallback data',
          log_id: logEntry?.id,
          changes: fallbackChanges,
          source: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build dynamic system prompt based on country
    const systemPrompts: Record<string, string> = {
      CA: `You are a Canadian tax and payroll compliance expert specializing in CRA regulations. You must provide accurate, current tax rates and payroll contribution rates based ONLY on official Canada Revenue Agency (CRA) publications and provincial tax authority sources. Always cite specific CRA publications (T4032, T4127, etc.) or government webpage URLs. For the current tax year, use indexed amounts published by CRA.`,
      US: `You are a United States tax and payroll compliance expert specializing in IRS regulations. You must provide accurate, current tax rates and payroll contribution rates based ONLY on official Internal Revenue Service (IRS) publications and state tax authority sources. Always cite specific IRS publications (Pub 15, Pub 15-T, etc.) or government webpage URLs.`,
      ZM: `You are a Zambian tax and payroll compliance expert specializing in ZRA regulations. You must provide accurate, current tax rates and payroll contribution rates based ONLY on official Zambia Revenue Authority (ZRA) publications, NAPSA, and NHIMA sources. Include PAYE brackets, VAT rates, NAPSA contributions, NHIMA contributions, and Skills Development Levy. Always cite specific legislation or government sources.`,
      KE: `You are a Kenyan tax and payroll compliance expert specializing in KRA regulations. You must provide accurate, current tax rates and payroll contribution rates based ONLY on official Kenya Revenue Authority (KRA) publications, NSSF, NHIF/SHIF, and AHL sources. Include PAYE brackets, VAT rates, and all statutory deductions. Always cite specific legislation or government sources.`,
      BI: `You are a Burundian tax and payroll compliance expert specializing in OBR regulations. You must provide accurate, current tax rates and payroll contribution rates based ONLY on official Office Burundais des Recettes (OBR) and INSS sources. Include IPR brackets, TVA rates, and INSS contributions. Always cite specific legislation or government sources.`,
      NG: `You are a Nigerian tax and payroll compliance expert specializing in NRS, State Internal Revenue Services (PAYE), and statutory agency regulations (PenCom, NHF, ITF, NSITF). You must provide accurate, current tax rates and payroll contribution rates based ONLY on official Nigeria Revenue Service (NRS), State IRS, Pension Commission (PenCom PRA 2014), Federal Mortgage Bank (NHF Act), Industrial Training Fund (ITF Act), NSITF (ECS Act 2010), and the Finance Act. Include VAT (7.5%), Withholding Tax (WHT) rates by service type, PAYE progressive brackets and Consolidated Relief Allowance (CRA), Companies Income Tax (CIT) tiers (small/medium/large), Tertiary Education Tax (TET), Capital Gains Tax, and Stamp Duty. Always cite specific legislation or NRS/PenCom publications.`
    };


    const systemPrompt = systemPrompts[countryCode] || `You are a tax and payroll compliance expert for ${countryName}. You must provide accurate, current tax rates and payroll contribution rates based ONLY on official government revenue authority publications. Always cite specific legislation or government sources.`;

    // Call Lovable AI to research current rates
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          { role: 'user', content: prompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_rate_updates',
              description: `Report comprehensive tax and payroll rate updates sourced from official government authorities for ${countryName}`,
              parameters: {
                type: 'object',
                properties: {
                  sales_tax_changes: {
                    type: 'array',
                    description: countryCode === 'CA' ? 'GST, HST, PST, QST rate updates' : 'VAT, sales tax, and withholding tax rate updates',
                    items: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', description: 'Tax code (e.g., VAT, GST, HST-ON)' },
                        name: { type: 'string', description: 'Full tax name' },
                        current_rate: { type: 'number', description: 'Rate as percentage (e.g., 16 for 16%)' },
                        effective_date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
                        source: { type: 'string', description: 'Official government source document or URL' }
                      },
                      required: ['code', 'name', 'current_rate', 'effective_date', 'source']
                    }
                  },
                  payroll_changes: {
                    type: 'array',
                    description: countryCode === 'CA' ? 'CPP, CPP2, EI contribution rate updates' : 'All statutory payroll deductions (pension, health insurance, income tax brackets, levies)',
                    items: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', description: 'Deduction code (e.g., PAYE, NAPSA, NHIMA, CPP, EI)' },
                        name: { type: 'string', description: 'Full name' },
                        employee_rate: { type: 'number', description: 'Employee contribution rate as percentage or decimal' },
                        employer_rate: { type: 'number', description: 'Employer contribution rate as percentage or decimal' },
                        max_earnings: { type: 'number', description: 'Maximum pensionable/insurable earnings ceiling' },
                        exemption: { type: 'number', description: 'Basic exemption amount (if applicable)' },
                        max_contribution: { type: 'number', description: 'Maximum annual contribution' },
                        effective_date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
                        source: { type: 'string', description: 'Official government source document' }
                      },
                      required: ['code', 'name', 'effective_date', 'source']
                    }
                  },
                  tax_credits: {
                    type: 'array',
                    description: 'Personal tax credits and allowances',
                    items: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', description: 'Credit code' },
                        name: { type: 'string', description: 'Full credit name' },
                        amount: { type: 'number', description: 'Amount of credit in local currency' },
                        type: { type: 'string', enum: ['federal', 'provincial', 'national'], description: 'Credit level' },
                        province: { type: 'string', description: 'Province/region code if applicable' },
                        effective_date: { type: 'string', description: 'ISO date (YYYY-MM-DD)' },
                        source: { type: 'string', description: 'Source document' }
                      },
                      required: ['code', 'name', 'amount', 'type', 'effective_date', 'source']
                    }
                  },
                  tax_brackets: {
                    type: 'array',
                    description: 'Income tax brackets (PAYE brackets)',
                    items: {
                      type: 'object',
                      properties: {
                        jurisdiction: { type: 'string', description: 'Country or province code' },
                        min_income: { type: 'number', description: 'Bracket minimum income' },
                        max_income: { type: 'number', description: 'Bracket maximum income (use 999999999 for no limit)' },
                        rate: { type: 'number', description: 'Marginal tax rate as percentage' },
                        effective_date: { type: 'string' },
                        source: { type: 'string' }
                      },
                      required: ['jurisdiction', 'min_income', 'max_income', 'rate', 'effective_date']
                    }
                  },
                  confidence: { type: 'number', description: 'Confidence score 0-1 (0.95+ for official government sources)' },
                  notes: { type: 'string', description: 'Additional notes about data sources or upcoming changes' },
                  authority_sources: {
                    type: 'array',
                    description: 'List of official government source documents used',
                    items: { type: 'string' }
                  },
                  cra_sources: {
                    type: 'array',
                    description: 'List of CRA source documents used (for Canada)',
                    items: { type: 'string' }
                  }
                },
                required: ['sales_tax_changes', 'payroll_changes', 'confidence']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'report_rate_updates' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      
      // Fall back to hardcoded rates
      const fallbackChanges = getFallbackRates(countryCode, currentYear, update_type);
      
      const { data: logEntry } = await supabaseAdmin
        .from('rate_update_logs')
        .insert({
          organization_id,
          country_id: countryId,
          update_type,
          effective_date: effectiveDate,
          status: 'pending',
          changes_detected: fallbackChanges,
          ai_source: 'fallback_after_error',
          ai_confidence: 0.7,
          triggered_by: 'manual',
          error_message: `AI error: ${aiResponse.status}`,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Rate check completed using fallback data (AI unavailable)',
          log_id: logEntry?.id,
          changes: fallbackChanges,
          source: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    
    // Extract tool call response
    let rateUpdates: any = null;
    if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        rateUpdates = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    if (!rateUpdates) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to get rate updates from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create rate update log
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('rate_update_logs')
      .insert({
        organization_id,
        country_id: countryId,
        update_type,
        effective_date: effectiveDate,
        status: 'pending',
        changes_detected: rateUpdates,
        ai_source: 'efinsuite_ai',
        ai_confidence: rateUpdates.confidence || 0.8,
        triggered_by: 'manual',
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create log entry:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rate check completed',
        log_id: logEntry?.id,
        changes: rateUpdates,
        source: 'ai',
        notes: rateUpdates.notes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Rate update error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildRateResearchPrompt(
  countryCode: string,
  countryName: string,
  year: number,
  effectiveDate: string,
  updateType: string,
  currentTaxTypes: any[],
  currentPayrollTypes: any[],
  province: string = ''
): string {
  // Country-specific revenue authority sources
  const revenueAuthorities: Record<string, { name: string; website: string; taxDoc: string; payrollDoc: string }> = {
    CA: {
      name: 'Canada Revenue Agency (CRA)',
      website: 'https://www.canada.ca/en/revenue-agency.html',
      taxDoc: 'RC4022 - GST/HST Information',
      payrollDoc: 'T4032 - Payroll Deductions Tables'
    },
    US: {
      name: 'Internal Revenue Service (IRS)',
      website: 'https://www.irs.gov',
      taxDoc: 'Publication 15 - Circular E',
      payrollDoc: 'Publication 15-T - Federal Income Tax Withholding'
    },
    ZM: {
      name: 'Zambia Revenue Authority (ZRA)',
      website: 'https://www.zra.org.zm',
      taxDoc: 'VAT Act Chapter 331',
      payrollDoc: 'Income Tax Act Chapter 323 - PAYE Tables'
    },
    KE: {
      name: 'Kenya Revenue Authority (KRA)',
      website: 'https://www.kra.go.ke',
      taxDoc: 'VAT Act 2013',
      payrollDoc: 'Income Tax Act - PAYE Guidelines'
    },
    BI: {
      name: 'Office Burundais des Recettes (OBR)',
      website: 'https://www.obr.bi',
      taxDoc: 'Code des Impôts - TVA',
      payrollDoc: 'Code des Impôts - IPR'
    }
  };

  const authority = revenueAuthorities[countryCode] || {
    name: 'Local Tax Authority',
    website: '',
    taxDoc: 'Tax Legislation',
    payrollDoc: 'Payroll Legislation'
  };

  let prompt = `You are a tax compliance expert for ${countryName}. Research the OFFICIAL current tax and payroll rates effective as of ${effectiveDate} for the ${year} tax year.\n\n`;
  
  prompt += `## IMPORTANT: Use ONLY official government sources:\n`;
  prompt += `- ${authority.name}: ${authority.website}\n`;
  prompt += `- Tax Document: ${authority.taxDoc}\n`;
  prompt += `- Payroll Document: ${authority.payrollDoc}\n\n`;

  if (updateType === 'sales_tax' || updateType === 'both') {
    if (countryCode === 'CA') {
      prompt += `## Sales Tax Rates (GST/HST/PST/QST)\n`;
      prompt += `Research current rates from CRA for:\n`;
      prompt += `- GST (Goods and Services Tax) - federal rate\n`;
      prompt += `- HST (Harmonized Sales Tax) rates for ON, NS, NB, NL, PE\n`;
      prompt += `- PST (Provincial Sales Tax) rates for BC, SK, MB\n`;
      prompt += `- QST (Quebec Sales Tax) rate\n`;
    } else if (countryCode === 'US') {
      prompt += `## Sales Tax Rates\n`;
      prompt += `Research state sales tax rates from state revenue departments.\n`;
      prompt += `Note: US has state-level sales taxes, not federal.\n`;
    } else if (countryCode === 'ZM') {
      prompt += `## VAT Rates (Zambia Revenue Authority)\n`;
      prompt += `Research current rates from ZRA:\n`;
      prompt += `- Standard VAT rate\n`;
      prompt += `- Zero-rated supplies\n`;
      prompt += `- Exempt supplies\n`;
      prompt += `- Tourism Levy (if applicable)\n`;
    } else if (countryCode === 'KE') {
      prompt += `## VAT Rates (Kenya Revenue Authority)\n`;
      prompt += `Research current rates from KRA:\n`;
      prompt += `- Standard VAT rate (16%)\n`;
      prompt += `- Reduced rate (8% for petroleum)\n`;
      prompt += `- Zero-rated supplies\n`;
      prompt += `- Exempt supplies\n`;
      prompt += `- Digital Services Tax (if applicable)\n`;
    } else if (countryCode === 'BI') {
      prompt += `## TVA Rates (Office Burundais des Recettes)\n`;
      prompt += `Research current rates from OBR:\n`;
      prompt += `- Standard TVA (VAT) rate (18%)\n`;
      prompt += `- Zero-rated supplies\n`;
      prompt += `- Exempt supplies\n`;
    } else if (countryCode === 'NG') {
      prompt += `## VAT & Transactional Taxes (FIRS)\n`;
      prompt += `Research current rates from FIRS:\n`;
      prompt += `- Standard VAT rate (7.5%)\n`;
      prompt += `- Zero-rated and exempt supplies\n`;
      prompt += `- Withholding Tax rates by service type (contracts, professional, rent, dividends, directors' fees)\n`;
      prompt += `- Companies Income Tax tiers (Small ≤₦25m, Medium ₦25m–₦100m, Large >₦100m)\n`;
      prompt += `- Tertiary Education Tax (TET) — 3%\n`;
      prompt += `- Capital Gains Tax and Stamp Duty\n`;
    }

    prompt += `Current configured tax types: ${currentTaxTypes.map(t => t.code).join(', ')}\n\n`;
  }

  if (updateType === 'payroll' || updateType === 'both') {
    if (countryCode === 'CA') {
      prompt += `## Payroll Deduction Rates from CRA\n`;
      prompt += `Research the ${year} rates for:\n\n`;
      prompt += `### CPP (Canada Pension Plan)\n`;
      prompt += `- Employee/employer contribution rate, YMPE, basic exemption, max contribution\n`;
      prompt += `- CPP2 (enhanced) rate for earnings above YMPE\n\n`;
      prompt += `### EI (Employment Insurance)\n`;
      prompt += `- Employee/employer premium rates, maximum insurable earnings\n\n`;
      prompt += `### Personal Tax Credits (TD1)\n`;
      prompt += `- Federal BPA, Canada Employment Amount, Age Amount, Disability Amount\n`;
      if (province) {
        prompt += `- ${province} Provincial tax credits\n`;
      }
      prompt += `\n### Federal Income Tax Brackets for ${year}\n`;
    } else if (countryCode === 'US') {
      prompt += `## Payroll Rates from IRS\n`;
      prompt += `Research the ${year} rates for:\n`;
      prompt += `- Social Security (FICA-SS): rate and wage base\n`;
      prompt += `- Medicare (FICA-MED): rate and additional Medicare tax threshold\n`;
      prompt += `- FUTA: rate and wage base\n`;
      prompt += `- Federal income tax brackets\n`;
    } else if (countryCode === 'ZM') {
      prompt += `## Payroll Rates from ZRA\n`;
      prompt += `Research the ${year} rates for:\n`;
      prompt += `### NAPSA (National Pension Scheme Authority)\n`;
      prompt += `- Employee contribution rate (5%)\n`;
      prompt += `- Employer contribution rate (5%)\n`;
      prompt += `- Maximum pensionable earnings ceiling\n\n`;
      prompt += `### PAYE (Pay As You Earn) Tax Brackets\n`;
      prompt += `- All income tax brackets and rates\n`;
      prompt += `- Personal tax-free threshold\n\n`;
      prompt += `### NHIMA (National Health Insurance)\n`;
      prompt += `- Employee contribution rate (1%)\n`;
      prompt += `- Employer contribution rate (1%)\n`;
    } else if (countryCode === 'KE') {
      prompt += `## Payroll Rates from KRA\n`;
      prompt += `Research the ${year} rates for:\n`;
      prompt += `### NSSF (National Social Security Fund)\n`;
      prompt += `- Employee contribution (6% capped)\n`;
      prompt += `- Employer contribution (6% capped)\n`;
      prompt += `- Upper earnings limit\n\n`;
      prompt += `### NHIF (National Hospital Insurance Fund)\n`;
      prompt += `- Contribution bands by salary\n\n`;
      prompt += `### Housing Levy\n`;
      prompt += `- Employee rate (1.5%)\n`;
      prompt += `- Employer rate (1.5%)\n\n`;
      prompt += `### PAYE Tax Brackets\n`;
      prompt += `- All income tax bands and rates\n`;
      prompt += `- Personal relief amount\n`;
      prompt += `- Insurance relief (if applicable)\n`;
    } else if (countryCode === 'BI') {
      prompt += `## Payroll Rates from OBR\n`;
      prompt += `Research the ${year} rates for:\n`;
      prompt += `### INSS (Social Security)\n`;
      prompt += `- Employee contribution rate\n`;
      prompt += `- Employer contribution rate\n\n`;
      prompt += `### IPR (Impôt Professionnel sur les Rémunérations)\n`;
      prompt += `- Personal income tax brackets and rates\n`;
      prompt += `- Tax-free threshold\n`;
    } else if (countryCode === 'NG') {
      prompt += `## Payroll Rates (Nigeria — FIRS / State IRS / PenCom / NHF / ITF / NSITF)\n`;
      prompt += `Research the ${year} rates for:\n`;
      prompt += `### Pension (PenCom PRA 2014)\n- Employee 8%, Employer 10% of monthly emoluments\n\n`;
      prompt += `### NHF (National Housing Fund)\n- Employee 2.5% (employees earning ≥ ₦3,000/month)\n\n`;
      prompt += `### ITF (Industrial Training Fund)\n- Employer 1% of annual payroll (5+ employees or ₦50m+ turnover)\n\n`;
      prompt += `### NSITF (Employee Compensation Scheme)\n- Employer 1% of monthly payroll\n\n`;
      prompt += `### PAYE Tax Brackets (PIT Act Sixth Schedule)\n- All progressive bands (7/11/15/19/21/24%)\n- Consolidated Relief Allowance (higher of ₦200,000 or 1% of gross + 20% of gross)\n`;
    }

    prompt += `\nCurrent configured payroll deductions: ${currentPayrollTypes.map(d => d.code).join(', ')}\n\n`;
  }

  const currencyMap: Record<string, string> = { CA: 'CAD', US: 'USD', ZM: 'ZMW', KE: 'KES', BI: 'BIF', NG: 'NGN' };

  prompt += `## Response Requirements:\n`;
  prompt += `1. All amounts in ${currencyMap[countryCode] || 'local currency'}\n`;
  prompt += `2. Cite the specific ${authority.name} publication or webpage for each rate\n`;
  prompt += `3. Include effective dates\n`;
  prompt += `4. For tax brackets, use the latest indexed amounts for ${year}\n`;
  prompt += `5. Set confidence based on source reliability (0.95+ for official sources)\n`;

  return prompt;
}

function getFallbackRates(countryCode: string, year: number, updateType: string): any {
  // Hardcoded fallback rates for 2026 based on CRA publications
  if (countryCode === 'CA') {
    return {
      sales_tax_changes: updateType !== 'payroll' ? [
        { code: 'GST', name: 'Goods and Services Tax', current_rate: 5, effective_date: `${year}-01-01`, source: 'CRA RC4022' },
        { code: 'HST-ON', name: 'Harmonized Sales Tax (Ontario)', current_rate: 13, effective_date: `${year}-01-01`, source: 'CRA RC4022' },
        { code: 'HST-NS', name: 'Harmonized Sales Tax (Nova Scotia)', current_rate: 15, effective_date: `${year}-01-01`, source: 'CRA RC4022' },
        { code: 'HST-NB', name: 'Harmonized Sales Tax (New Brunswick)', current_rate: 15, effective_date: `${year}-01-01`, source: 'CRA RC4022' },
        { code: 'HST-NL', name: 'Harmonized Sales Tax (Newfoundland)', current_rate: 15, effective_date: `${year}-01-01`, source: 'CRA RC4022' },
        { code: 'HST-PE', name: 'Harmonized Sales Tax (PEI)', current_rate: 15, effective_date: `${year}-01-01`, source: 'CRA RC4022' },
        { code: 'QST', name: 'Quebec Sales Tax', current_rate: 9.975, effective_date: `${year}-01-01`, source: 'Revenu Quebec' },
        { code: 'PST-BC', name: 'Provincial Sales Tax (BC)', current_rate: 7, effective_date: `${year}-01-01`, source: 'BC Ministry of Finance' },
        { code: 'PST-SK', name: 'Provincial Sales Tax (Saskatchewan)', current_rate: 6, effective_date: `${year}-01-01`, source: 'SK Ministry of Finance' },
        { code: 'PST-MB', name: 'Provincial Sales Tax (Manitoba)', current_rate: 7, effective_date: `${year}-01-01`, source: 'MB Ministry of Finance' },
      ] : [],
      payroll_changes: updateType !== 'sales_tax' ? [
        { 
          code: 'CPP', 
          name: 'Canada Pension Plan', 
          employee_rate: 5.95, 
          employer_rate: 5.95, 
          max_earnings: 74600, 
          exemption: 3500,
          max_contribution: 4230.45,
          effective_date: `${year}-01-01`, 
          source: 'CRA T4032 (2026)'
        },
        { 
          code: 'CPP2', 
          name: 'CPP Enhanced (Second Ceiling)', 
          employee_rate: 4.0, 
          employer_rate: 4.0, 
          max_earnings: 85000,
          exemption: 74600,
          max_contribution: 416.00,
          effective_date: `${year}-01-01`, 
          source: 'CRA T4032 (2026)'
        },
        { 
          code: 'EI', 
          name: 'Employment Insurance', 
          employee_rate: 1.63, 
          employer_rate: 2.282, 
          max_earnings: 68900,
          max_contribution: 1123.07,
          effective_date: `${year}-01-01`, 
          source: 'CRA T4032 (2026)'
        },
        {
          code: 'EI-QC',
          name: 'Employment Insurance (Quebec)',
          employee_rate: 1.30,
          employer_rate: 1.82,
          max_earnings: 68900,
          max_contribution: 896.70,
          effective_date: `${year}-01-01`,
          source: 'CRA T4032 (2026)'
        },
        {
          code: 'QPIP',
          name: 'Quebec Parental Insurance Plan',
          employee_rate: 0.43,
          employer_rate: 0.602,
          max_earnings: 103000,
          max_contribution: 442.90,
          effective_date: `${year}-01-01`,
          source: 'Revenu Quebec (2026)'
        }
      ] : [],
      tax_credits: updateType !== 'sales_tax' ? [
        // Federal Tax Credits (2026 indexed amounts)
        { code: 'BPA', name: 'Federal Basic Personal Amount', amount: 16452, type: 'federal', effective_date: `${year}-01-01`, source: 'CRA TD1 (2026)' },
        { code: 'CEA', name: 'Canada Employment Amount', amount: 1453, type: 'federal', effective_date: `${year}-01-01`, source: 'CRA TD1 (2026)' },
        { code: 'AGE', name: 'Federal Age Amount (65+)', amount: 9135, type: 'federal', effective_date: `${year}-01-01`, source: 'CRA TD1 (2026)' },
        { code: 'DIS', name: 'Federal Disability Amount', amount: 10227, type: 'federal', effective_date: `${year}-01-01`, source: 'CRA TD1 (2026)' },
        { code: 'PEN', name: 'Pension Income Amount', amount: 2000, type: 'federal', effective_date: `${year}-01-01`, source: 'CRA TD1 (2026)' },
        // Ontario Tax Credits (2026)
        { code: 'BPA-ON', name: 'Ontario Basic Personal Amount', amount: 12989, type: 'provincial', province: 'ON', effective_date: `${year}-01-01`, source: 'CRA TD1-ON (2026)' },
        { code: 'AGE-ON', name: 'Ontario Age Amount', amount: 6146, type: 'provincial', province: 'ON', effective_date: `${year}-01-01`, source: 'CRA TD1-ON (2026)' },
        { code: 'DIS-ON', name: 'Ontario Disability Amount', amount: 10041, type: 'provincial', province: 'ON', effective_date: `${year}-01-01`, source: 'CRA TD1-ON (2026)' },
        // Alberta Tax Credits (2026)
        { code: 'BPA-AB', name: 'Alberta Basic Personal Amount', amount: 22769, type: 'provincial', province: 'AB', effective_date: `${year}-01-01`, source: 'CRA TD1-AB (2026)' },
        { code: 'AGE-AB', name: 'Alberta Age Amount', amount: 6873, type: 'provincial', province: 'AB', effective_date: `${year}-01-01`, source: 'CRA TD1-AB (2026)' },
        // BC Tax Credits (2026)
        { code: 'BPA-BC', name: 'BC Basic Personal Amount', amount: 13216, type: 'provincial', province: 'BC', effective_date: `${year}-01-01`, source: 'CRA TD1-BC (2026)' },
        { code: 'AGE-BC', name: 'BC Age Amount', amount: 5819, type: 'provincial', province: 'BC', effective_date: `${year}-01-01`, source: 'CRA TD1-BC (2026)' },
      ] : [],
      tax_brackets: updateType !== 'sales_tax' ? [
        // Federal Tax Brackets
        { jurisdiction: 'Federal', min_income: 0, max_income: 57375, rate: 15, effective_date: `${year}-01-01`, source: 'CRA T4032' },
        { jurisdiction: 'Federal', min_income: 57375, max_income: 114750, rate: 20.5, effective_date: `${year}-01-01`, source: 'CRA T4032' },
        { jurisdiction: 'Federal', min_income: 114750, max_income: 177882, rate: 26, effective_date: `${year}-01-01`, source: 'CRA T4032' },
        { jurisdiction: 'Federal', min_income: 177882, max_income: 253414, rate: 29, effective_date: `${year}-01-01`, source: 'CRA T4032' },
        { jurisdiction: 'Federal', min_income: 253414, max_income: 999999999, rate: 33, effective_date: `${year}-01-01`, source: 'CRA T4032' },
        // Ontario Tax Brackets
        { jurisdiction: 'ON', min_income: 0, max_income: 52835, rate: 5.05, effective_date: `${year}-01-01`, source: 'CRA T4032-ON' },
        { jurisdiction: 'ON', min_income: 52835, max_income: 105672, rate: 9.15, effective_date: `${year}-01-01`, source: 'CRA T4032-ON' },
        { jurisdiction: 'ON', min_income: 105672, max_income: 154050, rate: 11.16, effective_date: `${year}-01-01`, source: 'CRA T4032-ON' },
        { jurisdiction: 'ON', min_income: 154050, max_income: 225940, rate: 12.16, effective_date: `${year}-01-01`, source: 'CRA T4032-ON' },
        { jurisdiction: 'ON', min_income: 225940, max_income: 999999999, rate: 13.16, effective_date: `${year}-01-01`, source: 'CRA T4032-ON' },
      ] : [],
      cra_sources: [
        'CRA T4032 - Payroll Deductions Tables',
        'CRA TD1 - Personal Tax Credits Return',
        'CRA RC4022 - GST/HST Information',
        'CRA T4127 - Payroll Deductions Formulas'
      ],
      confidence: 0.85,
      notes: 'Fallback rates based on CRA publications - verify with canada.ca/cra for latest indexed amounts'
    };
  } else if (countryCode === 'US') {
    // United States - Internal Revenue Service (IRS) 2025 rates
    return {
      sales_tax_changes: [], // US sales tax is state-level, not federal
      payroll_changes: updateType !== 'sales_tax' ? [
        { 
          code: 'FICA-SS', 
          name: 'Social Security (OASDI)', 
          employee_rate: 6.2, 
          employer_rate: 6.2, 
          max_earnings: 176100, // 2025 wage base per SSA announcement Oct 2024
          max_contribution: 10918.20,
          effective_date: `${year}-01-01`, 
          source: 'IRS Publication 15 (Circular E) 2025'
        },
        { 
          code: 'FICA-MED', 
          name: 'Medicare', 
          employee_rate: 1.45, 
          employer_rate: 1.45, 
          effective_date: `${year}-01-01`, 
          source: 'IRS Publication 15 (Circular E) 2025',
          notes: 'No wage base limit. Additional 0.9% on wages over $200,000'
        },
        { 
          code: 'FICA-MED-ADD', 
          name: 'Additional Medicare Tax', 
          employee_rate: 0.9, 
          employer_rate: 0, 
          threshold: 200000,
          effective_date: `${year}-01-01`, 
          source: 'IRS Publication 15 (Circular E) 2025',
          notes: 'Applies to wages exceeding $200,000 (single filer threshold)'
        },
        { 
          code: 'FUTA', 
          name: 'Federal Unemployment Tax', 
          employer_rate: 6.0, 
          effective_rate: 0.6, // After standard 5.4% credit
          max_earnings: 7000, 
          effective_date: `${year}-01-01`, 
          source: 'IRS Publication 15 (Circular E) 2025',
          notes: 'Effective rate is 0.6% with 5.4% state credit'
        },
      ] : [],
      tax_credits: updateType !== 'sales_tax' ? [
        // 2025 Standard Deductions (technically not credits but important for withholding)
        { code: 'STD-S', name: 'Standard Deduction (Single)', amount: 15000, type: 'federal', effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { code: 'STD-MFJ', name: 'Standard Deduction (Married Filing Jointly)', amount: 30000, type: 'federal', effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { code: 'STD-HOH', name: 'Standard Deduction (Head of Household)', amount: 22500, type: 'federal', effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        // Personal exemption is $0 through 2025 under TCJA
        { code: 'PEX', name: 'Personal Exemption', amount: 0, type: 'federal', effective_date: `${year}-01-01`, source: 'TCJA 2017' },
      ] : [],
      tax_brackets: updateType !== 'sales_tax' ? [
        // 2025 Federal Tax Brackets (Single Filers) - IRS Rev. Proc. 2024-40
        { jurisdiction: 'Federal-Single', min_income: 0, max_income: 11925, rate: 10, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-Single', min_income: 11925, max_income: 48475, rate: 12, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-Single', min_income: 48475, max_income: 103350, rate: 22, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-Single', min_income: 103350, max_income: 197300, rate: 24, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-Single', min_income: 197300, max_income: 250525, rate: 32, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-Single', min_income: 250525, max_income: 626350, rate: 35, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-Single', min_income: 626350, max_income: 999999999, rate: 37, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        // 2025 Federal Tax Brackets (Married Filing Jointly)
        { jurisdiction: 'Federal-MFJ', min_income: 0, max_income: 23850, rate: 10, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-MFJ', min_income: 23850, max_income: 96950, rate: 12, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-MFJ', min_income: 96950, max_income: 206700, rate: 22, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-MFJ', min_income: 206700, max_income: 394600, rate: 24, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-MFJ', min_income: 394600, max_income: 501050, rate: 32, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-MFJ', min_income: 501050, max_income: 751600, rate: 35, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
        { jurisdiction: 'Federal-MFJ', min_income: 751600, max_income: 999999999, rate: 37, effective_date: `${year}-01-01`, source: 'IRS Rev. Proc. 2024-40' },
      ] : [],
      authority_sources: [
        'IRS Publication 15 (Circular E) - Employer\'s Tax Guide 2025',
        'IRS Publication 15-T - Federal Income Tax Withholding Methods 2025',
        'IRS Revenue Procedure 2024-40 - Inflation Adjustments',
        'SSA - Social Security Wage Base Announcement October 2024'
      ],
      confidence: 0.90,
      notes: 'Official 2025 rates from IRS publications and SSA announcements'
    };
  } else if (countryCode === 'ZM') {
    // Zambia - Zambia Revenue Authority (ZRA) 2025 rates
    return {
      sales_tax_changes: updateType !== 'payroll' ? [
        { code: 'VAT', name: 'Value Added Tax (Standard)', current_rate: 16, effective_date: `${year}-01-01`, source: 'ZRA VAT Act Cap 331' },
        { code: 'VAT-ZERO', name: 'VAT Zero-Rated (Exports, Basic Foods)', current_rate: 0, effective_date: `${year}-01-01`, source: 'ZRA VAT Act Cap 331' },
        { code: 'VAT-EXEMPT', name: 'VAT Exempt (Financial, Medical, Education)', current_rate: 0, effective_date: `${year}-01-01`, source: 'ZRA VAT Act Cap 331' },
        { code: 'TOURISM', name: 'Tourism Levy', current_rate: 1.5, effective_date: `${year}-01-01`, source: 'Tourism and Hospitality Act 2015' },
      ] : [],
      payroll_changes: updateType !== 'sales_tax' ? [
        {
          code: 'NAPSA',
          name: 'National Pension Scheme Authority',
          employee_rate: 5,
          employer_rate: 5,
          max_earnings: 332460, // Monthly earnings ceiling ZMW for 2025
          max_contribution: 16623, // 5% of ceiling monthly
          effective_date: `${year}-01-01`,
          source: 'NAPSA Act No. 40 of 1996 (as amended)',
          notes: 'Maximum pensionable earnings K332,460/month (adjusted annually)'
        },
        {
          code: 'NHIMA',
          name: 'National Health Insurance',
          employee_rate: 1,
          employer_rate: 1,
          effective_date: `${year}-01-01`,
          source: 'National Health Insurance Act No. 2 of 2018',
          notes: 'No earnings ceiling for NHIMA contributions'
        },
        {
          code: 'WCF',
          name: 'Workers Compensation Fund',
          employer_rate: 1, // Varies by risk category 0.5%-3%
          effective_date: `${year}-01-01`,
          source: 'Workers Compensation Act Cap 271',
          notes: 'Rate varies by industry risk category (0.5% to 3%)'
        },
      ] : [],
      tax_credits: updateType !== 'sales_tax' ? [
        { code: 'TFT', name: 'Tax-Free Threshold (Monthly)', amount: 5100, type: 'federal', effective_date: `${year}-01-01`, source: 'ZRA Income Tax Act - 2025 Budget' },
        { code: 'TFT-ANN', name: 'Tax-Free Threshold (Annual)', amount: 61200, type: 'federal', effective_date: `${year}-01-01`, source: 'ZRA Income Tax Act - 2025 Budget' },
      ] : [],
      tax_brackets: updateType !== 'sales_tax' ? [
        // 2025 PAYE Monthly Tax Bands
        { jurisdiction: 'National', min_income: 0, max_income: 5100, rate: 0, effective_date: `${year}-01-01`, source: 'ZRA 2025 PAYE Tables' },
        { jurisdiction: 'National', min_income: 5100, max_income: 7100, rate: 20, effective_date: `${year}-01-01`, source: 'ZRA 2025 PAYE Tables' },
        { jurisdiction: 'National', min_income: 7100, max_income: 9200, rate: 30, effective_date: `${year}-01-01`, source: 'ZRA 2025 PAYE Tables' },
        { jurisdiction: 'National', min_income: 9200, max_income: 999999999, rate: 37.5, effective_date: `${year}-01-01`, source: 'ZRA 2025 PAYE Tables' },
      ] : [],
      authority_sources: [
        'ZRA - Zambia Revenue Authority (zra.org.zm)',
        'NAPSA - National Pension Scheme Authority (napsa.co.zm)',
        'NHIMA - National Health Insurance Management Authority (nhima.co.zm)',
        'ZRA PAYE Tax Tables 2025'
      ],
      confidence: 0.85,
      notes: 'Rates from ZRA 2025 Budget pronouncements and official publications'
    };
  } else if (countryCode === 'KE') {
    // Kenya - Kenya Revenue Authority (KRA) 2025 rates
    return {
      sales_tax_changes: updateType !== 'payroll' ? [
        { code: 'VAT', name: 'Value Added Tax (Standard)', current_rate: 16, effective_date: `${year}-01-01`, source: 'KRA VAT Act 2013 (as amended)' },
        { code: 'VAT-8', name: 'VAT Reduced (Petroleum Products)', current_rate: 8, effective_date: `${year}-01-01`, source: 'KRA VAT Act 2013' },
        { code: 'VAT-ZERO', name: 'VAT Zero-Rated (Exports, Specified Goods)', current_rate: 0, effective_date: `${year}-01-01`, source: 'KRA VAT Act 2013' },
        { code: 'VAT-EXEMPT', name: 'VAT Exempt', current_rate: 0, effective_date: `${year}-01-01`, source: 'KRA VAT Act 2013' },
        { code: 'DST', name: 'Digital Services Tax', current_rate: 1.5, effective_date: `${year}-01-01`, source: 'KRA Income Tax Act' },
        { code: 'WHT', name: 'Withholding Tax (Resident)', current_rate: 5, effective_date: `${year}-01-01`, source: 'KRA Income Tax Act' },
      ] : [],
      payroll_changes: updateType !== 'sales_tax' ? [
        {
          code: 'NSSF-TI',
          name: 'NSSF Tier I (Mandatory)',
          employee_rate: 6,
          employer_rate: 6,
          max_earnings: 7000, // Lower earnings limit KES monthly
          max_contribution: 420, // 6% of K7,000
          effective_date: `${year}-02-01`, // Enhanced rates from Feb 2025
          source: 'NSSF Act 2013 (as amended by Finance Act 2024)',
          notes: 'Tier I applies to first KES 7,000 of monthly earnings'
        },
        {
          code: 'NSSF-TII',
          name: 'NSSF Tier II (Mandatory)',
          employee_rate: 6,
          employer_rate: 6,
          min_earnings: 7000,
          max_earnings: 36000, // Upper earnings limit KES monthly
          max_contribution: 1740, // 6% of (36,000 - 7,000)
          effective_date: `${year}-02-01`,
          source: 'NSSF Act 2013 (as amended by Finance Act 2024)',
          notes: 'Tier II applies to earnings between KES 7,000 and KES 36,000'
        },
        {
          code: 'SHIF',
          name: 'Social Health Insurance Fund',
          employee_rate: 2.75,
          employer_rate: 0,
          max_contribution: 5000, // Monthly cap KES
          effective_date: `${year}-01-01`,
          source: 'Social Health Insurance Act 2023',
          notes: 'Replaced NHIF from October 2024. 2.75% of gross salary, max KES 5,000/month'
        },
        {
          code: 'AHL',
          name: 'Affordable Housing Levy',
          employee_rate: 1.5,
          employer_rate: 1.5,
          effective_date: `${year}-01-01`,
          source: 'Affordable Housing Act 2024 / Finance Act 2023',
          notes: '1.5% each from employee and employer on gross salary'
        },
        {
          code: 'NITA',
          name: 'National Industrial Training Authority',
          employer_rate: 50, // Flat KES 50 per employee
          effective_date: `${year}-01-01`,
          source: 'Industrial Training Act',
          notes: 'Flat rate of KES 50 per employee per month (employer only)'
        },
      ] : [],
      tax_credits: updateType !== 'sales_tax' ? [
        { code: 'PR', name: 'Personal Relief (Monthly)', amount: 2400, type: 'federal', effective_date: `${year}-01-01`, source: 'KRA Income Tax Act' },
        { code: 'PR-ANN', name: 'Personal Relief (Annual)', amount: 28800, type: 'federal', effective_date: `${year}-01-01`, source: 'KRA Income Tax Act' },
        { code: 'IR', name: 'Insurance Relief (15% of premiums, max)', amount: 5000, type: 'federal', effective_date: `${year}-01-01`, source: 'KRA Income Tax Act', notes: '15% of insurance premiums, capped at KES 5,000/month' },
        { code: 'DR', name: 'Disability Relief', amount: 150000, type: 'federal', effective_date: `${year}-01-01`, source: 'KRA Income Tax Act', notes: 'Monthly exemption for persons with disability' },
      ] : [],
      tax_brackets: updateType !== 'sales_tax' ? [
        // 2025 Monthly PAYE Tax Bands (KES)
        { jurisdiction: 'National', min_income: 0, max_income: 24000, rate: 10, effective_date: `${year}-01-01`, source: 'KRA PAYE Tables 2025' },
        { jurisdiction: 'National', min_income: 24000, max_income: 32333, rate: 25, effective_date: `${year}-01-01`, source: 'KRA PAYE Tables 2025' },
        { jurisdiction: 'National', min_income: 32333, max_income: 500000, rate: 30, effective_date: `${year}-01-01`, source: 'KRA PAYE Tables 2025' },
        { jurisdiction: 'National', min_income: 500000, max_income: 800000, rate: 32.5, effective_date: `${year}-01-01`, source: 'KRA PAYE Tables 2025' },
        { jurisdiction: 'National', min_income: 800000, max_income: 999999999, rate: 35, effective_date: `${year}-01-01`, source: 'KRA PAYE Tables 2025' },
      ] : [],
      authority_sources: [
        'KRA - Kenya Revenue Authority (kra.go.ke)',
        'NSSF - National Social Security Fund (nssf.or.ke)',
        'SHA - Social Health Authority (sha.go.ke)',
        'KRA PAYE Tables 2025',
        'Finance Act 2024'
      ],
      confidence: 0.85,
      notes: 'Rates include NSSF enhanced contributions effective Feb 2025 and SHIF replacing NHIF'
    };
  } else if (countryCode === 'BI') {
    // Burundi - Office Burundais des Recettes (OBR) 2025 rates
    return {
      sales_tax_changes: updateType !== 'payroll' ? [
        { code: 'TVA', name: 'Taxe sur la Valeur Ajoutée (Standard)', current_rate: 18, effective_date: `${year}-01-01`, source: 'OBR Code Général des Impôts' },
        { code: 'TVA-ZERO', name: 'TVA Zero-Rated (Exports)', current_rate: 0, effective_date: `${year}-01-01`, source: 'OBR Code Général des Impôts' },
        { code: 'TVA-EXEMPT', name: 'TVA Exempt (Basic Necessities)', current_rate: 0, effective_date: `${year}-01-01`, source: 'OBR Code Général des Impôts' },
      ] : [],
      payroll_changes: updateType !== 'sales_tax' ? [
        {
          code: 'INSS-PEN',
          name: 'INSS Pension (Vieillesse, Invalidité, Décès)',
          employee_rate: 4,
          employer_rate: 6,
          effective_date: `${year}-01-01`,
          source: 'INSS - Institut National de Sécurité Sociale',
          notes: 'Pension branch: 4% employee + 6% employer = 10% total'
        },
        {
          code: 'INSS-RISK',
          name: 'INSS Professional Risks (Risques Professionnels)',
          employer_rate: 3,
          effective_date: `${year}-01-01`,
          source: 'INSS - Institut National de Sécurité Sociale',
          notes: 'Occupational risk insurance - employer only contribution'
        },
        {
          code: 'MFP',
          name: 'Mutuelle de la Fonction Publique',
          employee_rate: 3,
          employer_rate: 3,
          effective_date: `${year}-01-01`,
          source: 'MFP Regulations',
          notes: 'Applies to public sector employees only'
        },
        {
          code: 'ONPR',
          name: 'Office National des Pensions et Risques (Private Sector)',
          employee_rate: 4,
          employer_rate: 6,
          effective_date: `${year}-01-01`,
          source: 'ONPR Regulations',
          notes: 'Alternative to INSS for certain private sector entities'
        },
      ] : [],
      tax_credits: updateType !== 'sales_tax' ? [
        { code: 'TFT', name: 'Seuil Exonéré (Monthly Tax-Free Threshold)', amount: 150000, type: 'federal', effective_date: `${year}-01-01`, source: 'OBR IPR Tables', notes: 'First 150,000 BIF monthly is tax-free' },
        { code: 'TFT-ANN', name: 'Seuil Exonéré (Annual)', amount: 1800000, type: 'federal', effective_date: `${year}-01-01`, source: 'OBR IPR Tables' },
      ] : [],
      tax_brackets: updateType !== 'sales_tax' ? [
        // IPR (Impôt Professionnel sur les Rémunérations) - Monthly bands in BIF
        { jurisdiction: 'National', min_income: 0, max_income: 150000, rate: 0, effective_date: `${year}-01-01`, source: 'OBR IPR Tables 2025' },
        { jurisdiction: 'National', min_income: 150000, max_income: 300000, rate: 20, effective_date: `${year}-01-01`, source: 'OBR IPR Tables 2025' },
        { jurisdiction: 'National', min_income: 300000, max_income: 500000, rate: 30, effective_date: `${year}-01-01`, source: 'OBR IPR Tables 2025' },
        { jurisdiction: 'National', min_income: 500000, max_income: 999999999, rate: 35, effective_date: `${year}-01-01`, source: 'OBR IPR Tables 2025' },
      ] : [],
      authority_sources: [
        'OBR - Office Burundais des Recettes (obr.bi)',
        'INSS - Institut National de Sécurité Sociale',
        'ONPR - Office National des Pensions et Risques Professionnels',
        'Code Général des Impôts du Burundi'
      ],
      confidence: 0.80,
      notes: 'Rates from OBR and INSS official publications - verify with obr.bi for latest updates'
    };
  } else if (countryCode === 'NG') {
    // Nigeria — FIRS, State IRS, PenCom, NHF, ITF, NSITF (Finance Act 2023)
    return {
      sales_tax_changes: updateType !== 'payroll' ? [
        { code: 'VAT', name: 'Value Added Tax (Standard)', current_rate: 7.5, effective_date: `${year}-01-01`, source: 'FIRS VAT Act (Finance Act 2020)' },
        { code: 'VAT-ZERO', name: 'VAT Zero-Rated (Exports, Basic Foods)', current_rate: 0, effective_date: `${year}-01-01`, source: 'FIRS VAT Act' },
        { code: 'VAT-EXEMPT', name: 'VAT Exempt (Medical, Education, Financial)', current_rate: 0, effective_date: `${year}-01-01`, source: 'FIRS VAT Act' },
        { code: 'WHT-CONTRACT', name: 'Withholding Tax - Contracts/Supplies', current_rate: 5, effective_date: `${year}-01-01`, source: 'FIRS WHT Regulations' },
        { code: 'WHT-PROF', name: 'Withholding Tax - Professional Services', current_rate: 10, effective_date: `${year}-01-01`, source: 'FIRS WHT Regulations' },
        { code: 'WHT-RENT', name: 'Withholding Tax - Rent', current_rate: 10, effective_date: `${year}-01-01`, source: 'FIRS WHT Regulations' },
        { code: 'WHT-DIV', name: 'Withholding Tax - Dividends/Interest/Royalties', current_rate: 10, effective_date: `${year}-01-01`, source: 'CITA / FIRS WHT Regulations' },
        { code: 'WHT-DIR', name: 'Withholding Tax - Directors Fees', current_rate: 10, effective_date: `${year}-01-01`, source: 'FIRS WHT Regulations' },
        { code: 'CIT-SMALL', name: 'Companies Income Tax - Small (≤₦25m turnover)', current_rate: 0, effective_date: `${year}-01-01`, source: 'Finance Act 2023' },
        { code: 'CIT-MED', name: 'Companies Income Tax - Medium (₦25m–₦100m)', current_rate: 20, effective_date: `${year}-01-01`, source: 'Finance Act 2023' },
        { code: 'CIT-LARGE', name: 'Companies Income Tax - Large (>₦100m)', current_rate: 30, effective_date: `${year}-01-01`, source: 'CITA / Finance Act 2023' },
        { code: 'TET', name: 'Tertiary Education Tax', current_rate: 3, effective_date: `${year}-01-01`, source: 'Finance Act 2023' },
        { code: 'CGT', name: 'Capital Gains Tax', current_rate: 10, effective_date: `${year}-01-01`, source: 'Capital Gains Tax Act' },
        { code: 'STAMP', name: 'Stamp Duty (Electronic Transfer)', current_rate: 0.375, effective_date: `${year}-01-01`, source: 'Stamp Duties Act (Finance Act 2020)' },
      ] : [],
      payroll_changes: updateType !== 'sales_tax' ? [
        { code: 'PENSION', name: 'Pension Contribution (PenCom)', employee_rate: 8, employer_rate: 10, effective_date: `${year}-01-01`, source: 'Pension Reform Act 2014', notes: 'Employers with 3+ employees; total 18% of monthly emoluments' },
        { code: 'NHF', name: 'National Housing Fund', employee_rate: 2.5, employer_rate: 0, effective_date: `${year}-01-01`, source: 'NHF Act', notes: 'Applies to employees earning ≥ ₦3,000/month' },
        { code: 'ITF', name: 'Industrial Training Fund', employee_rate: 0, employer_rate: 1, effective_date: `${year}-01-01`, source: 'ITF Act (as amended)', notes: 'Employers with 5+ employees or ₦50m+ turnover; 1% of annual payroll' },
        { code: 'NSITF', name: 'Employee Compensation Scheme (NSITF)', employee_rate: 0, employer_rate: 1, effective_date: `${year}-01-01`, source: 'Employee Compensation Act 2010', notes: '1% of monthly payroll, employer-only' },
      ] : [],
      tax_credits: updateType !== 'sales_tax' ? [
        { code: 'CRA-BASE', name: 'Consolidated Relief Allowance (Base)', amount: 200000, type: 'national', effective_date: `${year}-01-01`, source: 'PIT Act (as amended)', notes: 'Higher of ₦200,000 or 1% of gross income' },
        { code: 'CRA-PCT', name: 'Consolidated Relief Allowance (20% of Gross)', amount: 0, type: 'national', effective_date: `${year}-01-01`, source: 'PIT Act (as amended)', notes: 'Plus 20% of gross income, added to CRA base' },
      ] : [],
      tax_brackets: updateType !== 'sales_tax' ? [
        { jurisdiction: 'NG-PAYE', min_income: 0, max_income: 300000, rate: 7, effective_date: `${year}-01-01`, source: 'PIT Act Sixth Schedule' },
        { jurisdiction: 'NG-PAYE', min_income: 300000, max_income: 600000, rate: 11, effective_date: `${year}-01-01`, source: 'PIT Act Sixth Schedule' },
        { jurisdiction: 'NG-PAYE', min_income: 600000, max_income: 1100000, rate: 15, effective_date: `${year}-01-01`, source: 'PIT Act Sixth Schedule' },
        { jurisdiction: 'NG-PAYE', min_income: 1100000, max_income: 1600000, rate: 19, effective_date: `${year}-01-01`, source: 'PIT Act Sixth Schedule' },
        { jurisdiction: 'NG-PAYE', min_income: 1600000, max_income: 3200000, rate: 21, effective_date: `${year}-01-01`, source: 'PIT Act Sixth Schedule' },
        { jurisdiction: 'NG-PAYE', min_income: 3200000, max_income: 999999999, rate: 24, effective_date: `${year}-01-01`, source: 'PIT Act Sixth Schedule' },
      ] : [],
      authority_sources: [
        'FIRS - Federal Inland Revenue Service (firs.gov.ng)',
        'State Internal Revenue Services (PAYE)',
        'PenCom - National Pension Commission (Pension Reform Act 2014)',
        'FMBN - Federal Mortgage Bank (NHF Act)',
        'ITF - Industrial Training Fund',
        'NSITF - Employee Compensation Act 2010',
        'Finance Act 2023',
        'Personal Income Tax Act (as amended)',
        'Companies Income Tax Act (CITA)'
      ],
      confidence: 0.85,
      notes: 'Rates based on Finance Act 2023 and FIRS publications - verify with firs.gov.ng for latest circulars'
    };
  }


  return {
    sales_tax_changes: [],
    payroll_changes: [],
    tax_credits: [],
    tax_brackets: [],
    authority_sources: [],
    confidence: 0.5,
    notes: 'No fallback rates available for this jurisdiction'
  };
}

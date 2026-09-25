import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplyRateRequest {
  log_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user
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

    const { log_id } = await req.json() as ApplyRateRequest;

    if (!log_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'log_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the rate update log
    const { data: log, error: logError } = await supabaseAdmin
      .from('rate_update_logs')
      .select('*')
      .eq('id', log_id)
      .single();

    if (logError || !log) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate update log not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (log.status === 'applied') {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate update already applied' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const changes = log.changes_detected;
    const appliedChanges: any = {
      tax_rates_updated: [],
      payroll_rates_updated: [],
      tax_credits_updated: [],
      errors: []
    };

    // Apply sales tax rate changes
    if (changes.sales_tax_changes && changes.sales_tax_changes.length > 0) {
      for (const taxChange of changes.sales_tax_changes) {
        try {
          const { data: existingTax } = await supabaseAdmin
            .from('tax_types')
            .select('id')
            .eq('country_id', log.country_id)
            .eq('code', taxChange.code)
            .single();

          if (existingTax) {
            // Check if a rate already exists for this effective_from
            const { data: existingRate } = await supabaseAdmin
              .from('tax_rates')
              .select('id')
              .eq('tax_type_id', existingTax.id)
              .eq('effective_from', taxChange.effective_date)
              .limit(1)
              .maybeSingle();

            let rateError;
            if (existingRate) {
              const { error } = await supabaseAdmin
                .from('tax_rates')
                .update({ rate: taxChange.current_rate, is_default: true })
                .eq('id', existingRate.id);
              rateError = error;
            } else {
              const { error } = await supabaseAdmin
                .from('tax_rates')
                .insert({
                  tax_type_id: existingTax.id,
                  rate: taxChange.current_rate,
                  effective_from: taxChange.effective_date,
                  is_default: true,
                });
              rateError = error;
            }

            if (!rateError) {
              appliedChanges.tax_rates_updated.push({
                code: taxChange.code,
                rate: taxChange.current_rate
              });
            } else {
              appliedChanges.errors.push(`Failed to update ${taxChange.code}: ${rateError.message}`);
            }
          }
        } catch (err) {
          appliedChanges.errors.push(`Error processing ${taxChange.code}: ${err}`);
        }
      }
    }

    // Apply payroll rate changes
    if (changes.payroll_changes && changes.payroll_changes.length > 0) {
      for (const payrollChange of changes.payroll_changes) {
        try {
          const { data: existingDeduction } = await supabaseAdmin
            .from('payroll_deduction_types')
            .select('id')
            .eq('country_id', log.country_id)
            .eq('code', payrollChange.code)
            .single();

          if (existingDeduction) {
            // Use correct column names: rate (employee), employer_rate, bracket_min, bracket_max
            const bracketData: any = {
              deduction_type_id: existingDeduction.id,
              effective_from: payrollChange.effective_date,
            };

            if (payrollChange.employee_rate !== undefined) {
              bracketData.rate = payrollChange.employee_rate;
            }
            if (payrollChange.employer_rate !== undefined) {
              bracketData.employer_rate = payrollChange.employer_rate;
            }
            if (payrollChange.max_earnings !== undefined) {
              bracketData.bracket_max = payrollChange.max_earnings;
            }
            if (payrollChange.exemption !== undefined) {
              bracketData.bracket_min = payrollChange.exemption;
            }

            // Check if bracket already exists
            const { data: existingBracket } = await supabaseAdmin
              .from('payroll_rate_brackets')
              .select('id')
              .eq('deduction_type_id', existingDeduction.id)
              .eq('effective_from', payrollChange.effective_date)
              .limit(1)
              .maybeSingle();

            let bracketError;
            if (existingBracket) {
              const { error } = await supabaseAdmin
                .from('payroll_rate_brackets')
                .update(bracketData)
                .eq('id', existingBracket.id);
              bracketError = error;
            } else {
              const { error } = await supabaseAdmin
                .from('payroll_rate_brackets')
                .insert(bracketData);
              bracketError = error;
            }

            if (!bracketError) {
              appliedChanges.payroll_rates_updated.push({
                code: payrollChange.code,
                employee_rate: payrollChange.employee_rate,
                employer_rate: payrollChange.employer_rate
              });
            } else {
              appliedChanges.errors.push(`Failed to update ${payrollChange.code}: ${bracketError.message}`);
            }
          }
        } catch (err) {
          appliedChanges.errors.push(`Error processing ${payrollChange.code}: ${err}`);
        }
      }
    }

    // Update the log as applied
    const { error: updateError } = await supabaseAdmin
      .from('rate_update_logs')
      .update({
        status: appliedChanges.errors.length > 0 ? 'failed' : 'applied',
        changes_applied: appliedChanges,
        applied_at: new Date().toISOString(),
        applied_by: user.id,
        error_message: appliedChanges.errors.length > 0 ? appliedChanges.errors.join('; ') : null,
      })
      .eq('id', log_id);

    if (updateError) {
      console.error('Failed to update log:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: appliedChanges.errors.length === 0,
        message: appliedChanges.errors.length > 0 
          ? 'Rate update applied with some errors' 
          : 'Rate update applied successfully',
        applied: appliedChanges
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Apply rate update error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

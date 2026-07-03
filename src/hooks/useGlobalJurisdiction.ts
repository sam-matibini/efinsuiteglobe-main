import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  Country, 
  Jurisdiction, 
  TaxType, 
  TaxRate, 
  PayrollDeductionType,
  JurisdictionDetection 
} from '@/types/global';

// Fetch all active countries
export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      return data.map((c): Country => ({
        id: c.id,
        code: c.code,
        codeAlpha3: c.code_alpha3,
        name: c.name,
        defaultCurrency: c.default_currency,
        accountingStandard: c.accounting_standard || 'IFRS',
        fiscalYearType: c.fiscal_year_type || 'calendar',
        defaultFiscalMonth: c.default_fiscal_month || 12,
        taxRegimeType: c.tax_regime_type,
        payrollRegimeType: c.payroll_regime_type,
        phoneCode: c.phone_code,
        dateFormat: c.date_format || 'YYYY-MM-DD',
        numberFormat: c.number_format || '1,234.56',
        timeFormat: c.time_format || '24h',
        defaultTimezone: c.default_timezone,
        isActive: c.is_active,
      }));
    },
  });
}

// Fetch jurisdictions for a country
export function useJurisdictions(countryId?: string) {
  return useQuery({
    queryKey: ['jurisdictions', countryId],
    queryFn: async () => {
      let query = supabase
        .from('jurisdictions')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (countryId) {
        query = query.eq('country_id', countryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((j): Jurisdiction => ({
        id: j.id,
        countryId: j.country_id,
        code: j.code,
        name: j.name,
        jurisdictionType: j.jurisdiction_type || 'province',
        parentJurisdictionId: j.parent_jurisdiction_id,
        taxZoneCode: j.tax_zone_code,
        isActive: j.is_active,
      }));
    },
    enabled: true,
  });
}

// Fetch tax types for a country
export function useTaxTypes(countryId?: string) {
  return useQuery({
    queryKey: ['tax-types', countryId],
    queryFn: async () => {
      let query = supabase
        .from('tax_types')
        .select(`
          *,
          tax_rates (*)
        `)
        .eq('is_active', true)
        .order('code');
      
      if (countryId) {
        query = query.eq('country_id', countryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((t): TaxType & { rates: TaxRate[] } => ({
        id: t.id,
        countryId: t.country_id,
        code: t.code,
        name: t.name,
        taxCategory: t.tax_category as TaxType['taxCategory'],
        isRecoverable: t.is_recoverable,
        isCompound: t.is_compound,
        calculationMethod: t.calculation_method as TaxType['calculationMethod'],
        appliesTo: t.applies_to || 'goods_and_services',
        isActive: t.is_active,
        rates: (t.tax_rates || []).map((r: any): TaxRate => ({
          id: r.id,
          taxTypeId: r.tax_type_id,
          jurisdictionId: r.jurisdiction_id,
          rate: parseFloat(r.rate),
          rateName: r.rate_name,
          effectiveFrom: r.effective_from,
          effectiveTo: r.effective_to,
          thresholdMin: r.threshold_min ? parseFloat(r.threshold_min) : null,
          thresholdMax: r.threshold_max ? parseFloat(r.threshold_max) : null,
          isDefault: r.is_default,
          isActive: r.is_active,
        })),
      }));
    },
    enabled: true,
  });
}

// Fetch payroll deduction types for a country
export function usePayrollDeductionTypes(countryId?: string) {
  return useQuery({
    queryKey: ['payroll-deduction-types', countryId],
    queryFn: async () => {
      let query = supabase
        .from('payroll_deduction_types')
        .select(`
          *,
          payroll_rate_brackets (*)
        `)
        .eq('is_active', true)
        .order('code');
      
      if (countryId) {
        query = query.eq('country_id', countryId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((d): PayrollDeductionType & { brackets: any[] } => ({
        id: d.id,
        countryId: d.country_id,
        code: d.code,
        name: d.name,
        deductionCategory: d.deduction_category as unknown as PayrollDeductionType['deductionCategory'],
        calculationMethod: d.calculation_method as unknown as PayrollDeductionType['calculationMethod'],
        isEmployerContribution: d.is_employer_contribution,
        isEmployeeDeduction: d.is_employee_deduction,
        isTaxableBenefit: d.is_taxable_benefit ?? false,
        isTaxDeductible: d.is_tax_deductible ?? true,
        maxAnnualAmount: d.max_annual_amount ? parseFloat(String(d.max_annual_amount)) : null,
        maxPensionableEarnings: d.max_pensionable_earnings ? parseFloat(String(d.max_pensionable_earnings)) : null,
        exemptionAmount: d.exemption_amount ? parseFloat(String(d.exemption_amount)) : null,
        isActive: d.is_active,
        brackets: d.payroll_rate_brackets || [],
      }));
    },
    enabled: true,
  });
}

// AI Jurisdiction Detection
export function useAIJurisdictionDetection() {
  return useMutation({
    mutationFn: async (organization: {
      organizationId: string;
      name: string;
      legalName?: string;
      addressLine1?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
      industry?: string;
    }): Promise<JurisdictionDetection> => {
      const { data, error } = await supabase.functions.invoke('ai-jurisdiction-setup', {
        body: { organization, action: 'detect' },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Detection failed');
      
      return data.detection;
    },
    onError: (error: Error) => {
      toast.error(`Jurisdiction detection failed: ${error.message}`);
    },
  });
}

// Apply AI Jurisdiction Setup
export function useApplyJurisdictionSetup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (organization: {
      organizationId: string;
      name: string;
      legalName?: string;
      addressLine1?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
      industry?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-jurisdiction-setup', {
        body: { organization, action: 'apply' },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Setup failed');
      
      return data.result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-jurisdictions'] });
      queryClient.invalidateQueries({ queryKey: ['organization-tax-settings'] });
      queryClient.invalidateQueries({ queryKey: ['organization-payroll-settings'] });
      
      toast.success(
        `Setup complete! Configured ${result.taxSettingsCreated} tax types and ${result.payrollSettingsCreated} payroll deductions.`
      );
    },
    onError: (error: Error) => {
      toast.error(`Setup failed: ${error.message}`);
    },
  });
}

// Get organization's jurisdiction settings
export function useOrganizationJurisdictions(organizationId?: string) {
  return useQuery({
    queryKey: ['organization-jurisdictions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('organization_jurisdictions')
        .select(`
          *,
          country:countries (*)
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Get organization's tax settings
export function useOrganizationTaxSettings(organizationId?: string) {
  return useQuery({
    queryKey: ['organization-tax-settings', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('organization_tax_settings')
        .select(`
          *,
          tax_type:tax_types (
            *,
            country:countries (code, name)
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

// Get organization's payroll settings
export function useOrganizationPayrollSettings(organizationId?: string) {
  return useQuery({
    queryKey: ['organization-payroll-settings', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('organization_payroll_settings')
        .select(`
          *,
          deduction_type:payroll_deduction_types (
            *,
            country:countries (code, name)
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

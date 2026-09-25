import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface TaxSlip {
  id: string;
  employee_id: string;
  tax_year: number;
  slip_type: string;
  employer_name?: string;
  employer_bn?: string;
  employer_address?: string;
  employer_account_number?: string;
  province_of_employment?: string;
  employment_code?: string;
  exempt_cpp?: boolean;
  exempt_ei?: boolean;
  exempt_ppip?: boolean;
  dental_benefits_code?: string;
  box_14_employment_income?: number;
  box_16_cpp_contributions?: number;
  box_16a_cpp2_contributions?: number;
  box_17_cpp2_contributions?: number;
  box_17a_qpp2_contributions?: number;
  box_18_ei_premiums?: number;
  box_20_rpp_contributions?: number;
  box_22_income_tax_deducted?: number;
  box_24_ei_insurable_earnings?: number;
  box_26_cpp_pensionable_earnings?: number;
  box_44_union_dues?: number;
  box_46_charitable_donations?: number;
  box_52_pension_adjustment?: number;
  box_55_ppip_premiums?: number;
  box_56_ppip_insurable_earnings?: number;
  other_info?: Record<string, unknown>;
  status?: string;
  issued_date?: string;
  notes?: string;
  sin_display?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    province: string;
    mailing_province?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    postal_code?: string;
  };
}

export function useTaxSlips(year: number = new Date().getFullYear()) {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  const { data: taxSlips, isLoading, error } = useQuery({
    queryKey: ['tax-slips', organization?.id, year],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('tax_slips')
        .select(`
          *,
          employees!inner (
            id,
            first_name,
            last_name,
            employee_number,
            province,
            mailing_province,
            address_line1,
            address_line2,
            city,
            postal_code,
            organization_id
          )
        `)
        .eq('tax_year', year)
        .eq('employees.organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TaxSlip[];
    },
    enabled: !!organization?.id,
  });

  const generateT4Slips = useMutation({
    mutationFn: async (taxYear: number) => {
      if (!organization?.id) throw new Error('No organization');

      // Get all employees with their YTD pay data
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organization.id)
        .in('status', ['active', 'on_leave', 'terminated', 'onboarding']);

      if (empError) throw empError;

      // Get all paid pay stubs for the year
      const startOfYear = `${taxYear}-01-01`;
      const endOfYear = `${taxYear}-12-31`;

      const { data: payRuns, error: payRunError } = await supabase
        .from('pay_runs')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('status', 'paid')
        .gte('pay_date', startOfYear)
        .lte('pay_date', endOfYear);

      if (payRunError) throw payRunError;

      const payRunIds = payRuns?.map(pr => pr.id) || [];

      if (payRunIds.length === 0) {
        throw new Error('No paid pay runs found for the selected year');
      }

      const { data: payStubs, error: stubError } = await supabase
        .from('pay_stubs')
        .select('*')
        .in('pay_run_id', payRunIds);

      if (stubError) throw stubError;

      // Aggregate by employee
      const employeeYTD: Record<string, {
        grossPay: number;
        cpp: number;
        ei: number;
        federalTax: number;
        provincialTax: number;
      }> = {};

      payStubs?.forEach(stub => {
        if (!employeeYTD[stub.employee_id]) {
          employeeYTD[stub.employee_id] = {
            grossPay: 0,
            cpp: 0,
            ei: 0,
            federalTax: 0,
            provincialTax: 0,
          };
        }
        employeeYTD[stub.employee_id].grossPay += stub.gross_pay || 0;
        employeeYTD[stub.employee_id].cpp += stub.cpp_contribution || 0;
        employeeYTD[stub.employee_id].ei += stub.ei_premium || 0;
        employeeYTD[stub.employee_id].federalTax += stub.federal_tax || 0;
        employeeYTD[stub.employee_id].provincialTax += stub.provincial_tax || 0;
      });

      // Create T4 slips
      const t4Slips = employees
        ?.filter(emp => employeeYTD[emp.id])
        .map(emp => {
          const ytd = employeeYTD[emp.id];
          const empAddr = [
            organization.address_line1,
            organization.address_line2,
            [organization.city, organization.province, organization.postal_code].filter(Boolean).join(' '),
            organization.country,
          ].filter(Boolean).join(', ');

          return {
            employee_id: emp.id,
            tax_year: taxYear,
            slip_type: 'T4',
            employer_name: organization.name,
            employer_bn: (organization as any).business_number || null,
            employer_address: empAddr || null,
            employer_account_number: organization.payroll_account_number || (organization as any).business_number || null,
            province_of_employment: emp.province || null,
            box_14_employment_income: ytd.grossPay,
            box_16_cpp_contributions: ytd.cpp,
            box_18_ei_premiums: ytd.ei,
            box_22_income_tax_deducted: ytd.federalTax + ytd.provincialTax,
            box_24_ei_insurable_earnings: ytd.grossPay,
            box_26_cpp_pensionable_earnings: ytd.grossPay,
            notes: `Generated from ${payRunIds.length} paid pay run(s) for tax year ${taxYear}. Employment income includes regular, overtime, vacation, and bonus earnings. Tax deducted includes both federal and provincial income tax.`,
            status: 'draft',
          };
        }) || [];

      if (t4Slips.length === 0) {
        throw new Error('No employees with payroll data found');
      }

      // Delete existing slips for these employees for this year (draft or issued)
      const employeeIds = t4Slips.map(s => s.employee_id);
      await supabase
        .from('tax_slips')
        .delete()
        .eq('tax_year', taxYear)
        .eq('slip_type', 'T4')
        .in('employee_id', employeeIds);

      // Insert new slips
      const { error: insertError } = await supabase
        .from('tax_slips')
        .insert(t4Slips);

      if (insertError) throw insertError;

      return t4Slips.length;
    },
    onSuccess: (count) => {
      toast.success(`Generated ${count} T4 slips`);
      queryClient.invalidateQueries({ queryKey: ['tax-slips'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate T4 slips: ${error.message}`);
    },
  });

  const issueSlip = useMutation({
    mutationFn: async (slipId: string) => {
      const { error } = await supabase
        .from('tax_slips')
        .update({
          status: 'issued',
          issued_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', slipId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('T4 slip issued');
      queryClient.invalidateQueries({ queryKey: ['tax-slips'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to issue slip: ${error.message}`);
    },
  });

  const deleteSlip = useMutation({
    mutationFn: async (slipId: string) => {
      const { error } = await supabase
        .from('tax_slips')
        .delete()
        .eq('id', slipId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('T4 slip deleted');
      queryClient.invalidateQueries({ queryKey: ['tax-slips'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete slip: ${error.message}`);
    },
  });

  // Summary stats
  const stats = {
    totalSlips: taxSlips?.length || 0,
    draftCount: taxSlips?.filter(s => s.status === 'draft').length || 0,
    issuedCount: taxSlips?.filter(s => s.status === 'issued').length || 0,
    totalIncome: taxSlips?.reduce((sum, s) => sum + (s.box_14_employment_income || 0), 0) || 0,
    totalTaxDeducted: taxSlips?.reduce((sum, s) => sum + (s.box_22_income_tax_deducted || 0), 0) || 0,
  };

  return {
    taxSlips,
    isLoading,
    error,
    generateT4Slips,
    issueSlip,
    deleteSlip,
    stats,
  };
}

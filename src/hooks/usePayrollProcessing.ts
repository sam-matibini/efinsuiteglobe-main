import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { 
  calculatePayStub, 
  getDefaultTD1Claims, 
  calculatePayRunTotals,
  type EmployeePayInfo,
  type PayStubCalculation 
} from '@/lib/payrollCalculator';
import { postPayrollJournalEntries } from '@/lib/payrollJournalPosting';
import { recordPayrollTaxes } from '@/lib/ngTax/integration';

export interface TimesheetEntry {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  vacationHours: number;
  sickHours: number;
  bonus: number;
  commission: number;
  otherEarnings: number;
}

export function usePayrollProcessing() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  // Process a pay run - generate pay stubs for all employees
  const processPayRun = useMutation({
    mutationFn: async ({ 
      payRunId, 
      timesheets,
      timesheetIds = [],
    }: { 
      payRunId: string; 
      timesheets: TimesheetEntry[];
      timesheetIds?: string[];
    }) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Fetch employees fresh from DB to avoid stale React Query cache
      const { data: freshEmployees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organization.id)
        .is('deleted_at', null);
      
      if (empError) throw empError;
      if (!freshEmployees || freshEmployees.length === 0) {
        throw new Error('No active employees found for this organization.');
      }

      // Fetch the current pay run so we can scope YTD totals to its tax (calendar) year.
      const { data: payRun, error: payRunError } = await supabase
        .from('pay_runs')
        .select('id, organization_id, pay_period_end, pay_date')
        .eq('id', payRunId)
        .maybeSingle();
      if (payRunError) throw payRunError;
      if (!payRun) throw new Error('Pay run not found');

      const payStubsToInsert: any[] = [];
      const calculatedStubs: PayStubCalculation[] = [];

      for (const timesheet of timesheets) {
        const employee = freshEmployees.find(e => e.id === timesheet.employeeId);
        if (!employee) {
          console.warn(`Employee ${timesheet.employeeId} not found, skipping`);
          continue;
        }

        // Get employee's TD1 data or use defaults
        const { data: td1Data } = await supabase
          .from('employee_td1')
          .select('*')
          .eq('employee_id', employee.id)
          .order('tax_year', { ascending: false })
          .limit(1)
          .maybeSingle();

        const defaultClaims = getDefaultTD1Claims(employee.province);
        const federalClaim = td1Data?.total_claim_amount || defaultClaims.federalClaim;
        const provincialClaim = defaultClaims.provincialClaim;
        const additionalTax = td1Data?.additional_tax_deduction || 0;

        // Get YTD totals from previous pay stubs WITHIN THE SAME TAX YEAR.
        // Canadian payroll year = calendar year (Jan 1 – Dec 31), so January is month 1.
        const currentRunYear = new Date(
          payRun.pay_period_end || payRun.pay_date || new Date().toISOString()
        ).getUTCFullYear();
        const yearStart = `${currentRunYear}-01-01`;
        const yearEnd = `${currentRunYear}-12-31`;

        const { data: ytdData } = await supabase
          .from('pay_stubs')
          .select('gross_pay, cpp_contribution, ei_premium, federal_tax, provincial_tax, pay_runs!inner(pay_period_end, organization_id)')
          .eq('employee_id', employee.id)
          .eq('pay_runs.organization_id', payRun.organization_id)
          .gte('pay_runs.pay_period_end', yearStart)
          .lte('pay_runs.pay_period_end', yearEnd)
          .not('pay_run_id', 'eq', payRunId);

        const ytdGross = ytdData?.reduce((sum, p) => sum + (p.gross_pay || 0), 0) || 0;
        const ytdCpp = ytdData?.reduce((sum, p) => sum + (p.cpp_contribution || 0), 0) || 0;
        const ytdEi = ytdData?.reduce((sum, p) => sum + (p.ei_premium || 0), 0) || 0;
        const ytdFederalTax = ytdData?.reduce((sum, p) => sum + (p.federal_tax || 0), 0) || 0;
        const ytdProvincialTax = ytdData?.reduce((sum, p) => sum + (p.provincial_tax || 0), 0) || 0;

        // Build pay info
        const payInfo: EmployeePayInfo = {
          employeeId: employee.id,
          province: employee.province,
          payFrequency: employee.pay_frequency,
          annualSalary: employee.annual_salary || undefined,
          hourlyRate: employee.hourly_rate || undefined,
          regularHours: timesheet.regularHours,
          overtimeHours: timesheet.overtimeHours,
          vacationHours: timesheet.vacationHours,
          sickHours: timesheet.sickHours,
          bonus: timesheet.bonus,
          commission: timesheet.commission,
          otherEarnings: timesheet.otherEarnings,
          td1FederalClaim: federalClaim,
          td1ProvincialClaim: provincialClaim,
          additionalTaxDeduction: additionalTax,
          ytdGross,
          ytdCpp,
          ytdEi,
          ytdFederalTax,
          ytdProvincialTax,
          cppExempt: employee.cpp_exempt ?? false,
          eiExempt: employee.ei_exempt ?? false,
        };

        // Calculate pay stub
        const calculation = calculatePayStub(payInfo);
        calculatedStubs.push(calculation);

        // Build pay stub record
        payStubsToInsert.push({
          pay_run_id: payRunId,
          employee_id: employee.id,
          employee_mailing_address_line1: employee.address_line1 || null,
          employee_mailing_address_line2: employee.address_line2 || null,
          employee_mailing_city: employee.city || null,
          employee_mailing_region: employee.mailing_province || employee.province || null,
          employee_mailing_postal_code: employee.postal_code || null,
          employee_mailing_country: employee.country || null,
          employer_mailing_address_line1: (organization as any)?.address_line1 || null,
          employer_mailing_address_line2: (organization as any)?.address_line2 || null,
          employer_mailing_city: (organization as any)?.city || null,
          employer_mailing_region: (organization as any)?.province || null,
          employer_mailing_postal_code: (organization as any)?.postal_code || null,
          employer_mailing_country: typeof (organization as any)?.country === 'string'
            ? (organization as any).country
            : (organization as any)?.country?.name || null,
          regular_hours: timesheet.regularHours,
          overtime_hours: timesheet.overtimeHours,
          vacation_hours: timesheet.vacationHours,
          sick_hours: timesheet.sickHours,
          regular_earnings: calculation.regularEarnings,
          overtime_earnings: calculation.overtimeEarnings,
          vacation_pay: calculation.vacationPay,
          bonus: calculation.bonus,
          commission: calculation.commission,
          other_earnings: calculation.otherEarnings,
          gross_pay: calculation.grossPay,
          cpp_contribution: calculation.cppContribution + calculation.cpp2Contribution,
          ei_premium: calculation.eiPremium,
          federal_tax: calculation.federalTax,
          provincial_tax: calculation.provincialTax,
          other_deductions: calculation.additionalTax,
          total_deductions: calculation.totalDeductions,
          net_pay: calculation.netPay,
          cpp_employer: calculation.cppEmployer + calculation.cpp2Employer,
          ei_employer: calculation.eiEmployer,
          ytd_gross: calculation.ytdGross,
          ytd_cpp: calculation.ytdCpp,
          ytd_ei: calculation.ytdEi,
          ytd_federal_tax: calculation.ytdFederalTax,
          ytd_provincial_tax: calculation.ytdProvincialTax,
        });
      }

      // Guard: throw if no pay stubs were generated
      if (payStubsToInsert.length === 0) {
        throw new Error('No pay stubs generated. Verify employees exist and are not deleted.');
      }

      // Delete existing pay stubs for this pay run (in case of re-processing)
      await supabase.from('pay_stubs').delete().eq('pay_run_id', payRunId);

      // Insert new pay stubs
      if (payStubsToInsert.length > 0) {
        const { error: stubsError } = await supabase
          .from('pay_stubs')
          .insert(payStubsToInsert);
        
        if (stubsError) throw stubsError;
      }

      // Calculate pay run totals
      const totals = calculatePayRunTotals(calculatedStubs);

      // Update pay run with totals - move to approved status (processing is just transient)
      const { error: updateError } = await supabase
        .from('pay_runs')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          total_gross: totals.totalGross,
          total_deductions: totals.totalDeductions,
          total_net: totals.totalNet,
          total_employer_contributions: totals.totalEmployerContributions,
          employee_count: totals.employeeCount,
        })
        .eq('id', payRunId);

      if (updateError) throw updateError;

      // Link timesheets to this pay run (mark as processed)
      if (timesheetIds.length > 0) {
        const { error: tsUpdateError } = await supabase
          .from('employee_timesheets')
          .update({ 
            pay_run_id: payRunId,
            status: 'processed',
          })
          .in('id', timesheetIds);

        if (tsUpdateError) {
          console.error('Failed to link timesheets:', tsUpdateError);
          // Non-critical error, don't throw
        }
      }

      return { payRunId, totals, payStubs: calculatedStubs };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      queryClient.invalidateQueries({ queryKey: ['pay-stubs'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success('Pay run processed successfully');
    },
    onError: (error) => {
      toast.error('Failed to process pay run: ' + error.message);
    },
  });

  // Approve a pay run
  const approvePayRun = useMutation({
    mutationFn: async (payRunId: string) => {
      const { data, error } = await supabase
        .from('pay_runs')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', payRunId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      toast.success('Pay run approved');
    },
    onError: (error) => {
      toast.error('Failed to approve pay run: ' + error.message);
    },
  });

  // Mark pay run as paid AND post journal entries to GL
  const markPayRunPaid = useMutation({
    mutationFn: async (payRunId: string) => {
      if (!organization?.id) throw new Error('No organization selected');

      // Fetch pay run info for date
      const { data: payRun, error: fetchError } = await supabase
        .from('pay_runs')
        .select('pay_date')
        .eq('id', payRunId)
        .single();

      if (fetchError) throw fetchError;

      // Build a reference from pay run ID (last 8 chars)
      const payRunRef = payRunId.slice(-8).toUpperCase();

      // Post journal entries to General Ledger
      try {
        await postPayrollJournalEntries(
          payRunId,
          organization.id,
          payRunRef,
          payRun.pay_date
        );
      } catch (jeError) {
        console.error('Failed to post payroll journal entry:', jeError);
        // Continue even if JE fails (non-critical), but warn user
        toast.warning('Pay run marked paid, but could not post journal entry. Check GL accounts.');
      }

      // Update pay run status
      const { data, error } = await supabase
        .from('pay_runs')
        .update({ status: 'paid' })
        .eq('id', payRunId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Pay run marked as paid and posted to General Ledger');
    },
    onError: (error) => {
      toast.error('Failed to update pay run: ' + error.message);
    },
  });

  return {
    processPayRun,
    approvePayRun,
    markPayRunPaid,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface Remittance {
  id: string;
  organization_id: string | null;
  remittance_period: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  total_amount: number;
  total_cpp_employee: number | null;
  total_cpp_employer: number | null;
  total_ei_employee: number | null;
  total_ei_employer: number | null;
  total_federal_tax: number | null;
  total_provincial_tax: number | null;
  paid_date: string | null;
  confirmation_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRemittanceInput {
  remittance_period: string;
  due_date: string;
  total_cpp_employee: number;
  total_cpp_employer: number;
  total_ei_employee: number;
  total_ei_employer: number;
  total_federal_tax: number;
  total_provincial_tax: number;
  notes?: string;
}

export function useRemittances(year?: number) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const currentYear = year || new Date().getFullYear();

  const { data: remittances = [], isLoading, error } = useQuery({
    queryKey: ['remittances', organization?.id, currentYear],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('remittances')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('remittance_period', `${currentYear}-01-01`)
        .lte('remittance_period', `${currentYear}-12-31`)
        .order('remittance_period', { ascending: false });

      if (error) throw error;
      return data as Remittance[];
    },
    enabled: !!organization?.id,
  });

  const createRemittance = useMutation({
    mutationFn: async (input: CreateRemittanceInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const totalAmount = 
        input.total_cpp_employee + 
        input.total_cpp_employer + 
        input.total_ei_employee + 
        input.total_ei_employer + 
        input.total_federal_tax + 
        input.total_provincial_tax;
      
      const { data, error } = await supabase
        .from('remittances')
        .insert([{
          organization_id: organization.id,
          remittance_period: input.remittance_period,
          due_date: input.due_date,
          total_amount: totalAmount,
          total_cpp_employee: input.total_cpp_employee,
          total_cpp_employer: input.total_cpp_employer,
          total_ei_employee: input.total_ei_employee,
          total_ei_employer: input.total_ei_employer,
          total_federal_tax: input.total_federal_tax,
          total_provincial_tax: input.total_provincial_tax,
          notes: input.notes || null,
          status: 'pending',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittances'] });
      toast.success('Remittance created');
    },
    onError: (error) => {
      toast.error('Failed to create remittance: ' + error.message);
    },
  });

  const markRemittancePaid = useMutation({
    mutationFn: async ({ id, confirmationNumber }: { id: string; confirmationNumber?: string }) => {
      const { data, error } = await supabase
        .from('remittances')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString().split('T')[0],
          confirmation_number: confirmationNumber || null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittances'] });
      toast.success('Remittance marked as paid');
    },
    onError: (error) => {
      toast.error('Failed to update remittance: ' + error.message);
    },
  });

  const generateRemittanceFromPayRuns = useMutation({
    mutationFn: async (period: string) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Ensure period is YYYY-MM format, strip any trailing day portion
      const normalizedPeriod = period.substring(0, 7);
      const [year, month] = normalizedPeriod.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];
      
      // Get all paid pay runs whose pay period is fully contained in this month
      const { data: payRuns, error: payRunsError } = await supabase
        .from('pay_runs')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('status', 'paid')
        .gte('pay_period_start', startDate)
        .lte('pay_period_end', endDate);
      
      if (payRunsError) throw payRunsError;
      if (!payRuns || payRuns.length === 0) {
        throw new Error('No paid pay runs found for this period');
      }
      
      // Get all pay stubs for these pay runs
      const payRunIds = payRuns.map(pr => pr.id);
      const { data: payStubs, error: stubsError } = await supabase
        .from('pay_stubs')
        .select('cpp_contribution, cpp_employer, ei_premium, ei_employer, federal_tax, provincial_tax')
        .in('pay_run_id', payRunIds);
      
      if (stubsError) throw stubsError;
      
      // Calculate totals
      const totals = (payStubs || []).reduce((acc, stub) => ({
        cpp_employee: acc.cpp_employee + (stub.cpp_contribution || 0),
        cpp_employer: acc.cpp_employer + (stub.cpp_employer || 0),
        ei_employee: acc.ei_employee + (stub.ei_premium || 0),
        ei_employer: acc.ei_employer + (stub.ei_employer || 0),
        federal_tax: acc.federal_tax + (stub.federal_tax || 0),
        provincial_tax: acc.provincial_tax + (stub.provincial_tax || 0),
      }), {
        cpp_employee: 0,
        cpp_employer: 0,
        ei_employee: 0,
        ei_employer: 0,
        federal_tax: 0,
        provincial_tax: 0,
      });
      
      // CRA remittance due date is the 15th of the following month
      const dueDate = new Date(yearNum, monthNum, 15).toISOString().split('T')[0];
      
      return createRemittance.mutateAsync({
        remittance_period: `${year}-${month.padStart(2, '0')}-01`,
        due_date: dueDate,
        total_cpp_employee: totals.cpp_employee,
        total_cpp_employer: totals.cpp_employer,
        total_ei_employee: totals.ei_employee,
        total_ei_employer: totals.ei_employer,
        total_federal_tax: totals.federal_tax,
        total_provincial_tax: totals.provincial_tax,
      });
    },
  });

  // Calculate summary stats
  const pendingRemittances = remittances.filter(r => r.status === 'pending');
  const overdueRemittances = remittances.filter(r => {
    const [y, m, d] = r.due_date.split('-').map(Number);
    return r.status === 'pending' && new Date(y, m - 1, d) < new Date();
  });
  const totalPending = pendingRemittances.reduce((s, r) => s + r.total_amount, 0);
  const ytdPaid = remittances
    .filter(r => r.status === 'paid')
    .reduce((s, r) => s + r.total_amount, 0);

  // Build the detailed PD7A-style report data for a given period (YYYY-MM)
  const buildRemittanceReport = async (period: string) => {
    if (!organization?.id) throw new Error('No organization selected');
    const normalizedPeriod = period.substring(0, 7);
    const [year, month] = normalizedPeriod.split('-');
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];

    const { data: payRuns, error: payRunsError } = await supabase
      .from('pay_runs')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('status', 'paid')
      .gte('pay_period_start', startDate)
      .lte('pay_period_end', endDate);
    if (payRunsError) throw payRunsError;
    const payRunIds = (payRuns || []).map(pr => pr.id);

    if (payRunIds.length === 0) {
      return {
        startDate,
        endDate,
        dueDate: new Date(yearNum, monthNum, 15).toISOString().split('T')[0],
        numberOfEmployees: 0,
        grossPayroll: 0,
        federalTax: 0,
        provincialTax: 0,
        cppEmployee: 0,
        cppEmployer: 0,
        eiEmployee: 0,
        eiEmployer: 0,
        employees: [] as Array<{
          name: string;
          employeeNumber?: string;
          grossPay: number;
          federalTax: number;
          provincialTax: number;
          cppEmployee: number;
          cppEmployer: number;
          eiEmployee: number;
          eiEmployer: number;
        }>,
      };
    }

    const { data: stubs, error: stubsError } = await supabase
      .from('pay_stubs')
      .select('employee_id, gross_pay, cpp_contribution, cpp_employer, ei_premium, ei_employer, federal_tax, provincial_tax, employees(first_name, last_name, employee_number)')
      .in('pay_run_id', payRunIds);
    if (stubsError) throw stubsError;

    const byEmployee = new Map<string, any>();
    let totals = {
      grossPayroll: 0, federalTax: 0, provincialTax: 0,
      cppEmployee: 0, cppEmployer: 0, eiEmployee: 0, eiEmployer: 0,
    };
    (stubs || []).forEach((s: any) => {
      totals.grossPayroll += s.gross_pay || 0;
      totals.federalTax += s.federal_tax || 0;
      totals.provincialTax += s.provincial_tax || 0;
      totals.cppEmployee += s.cpp_contribution || 0;
      totals.cppEmployer += s.cpp_employer || 0;
      totals.eiEmployee += s.ei_premium || 0;
      totals.eiEmployer += s.ei_employer || 0;

      const key = s.employee_id;
      const prev = byEmployee.get(key) || {
        name: `${s.employees?.first_name || ''} ${s.employees?.last_name || ''}`.trim() || 'Unknown',
        employeeNumber: s.employees?.employee_number,
        grossPay: 0, federalTax: 0, provincialTax: 0,
        cppEmployee: 0, cppEmployer: 0, eiEmployee: 0, eiEmployer: 0,
      };
      prev.grossPay += s.gross_pay || 0;
      prev.federalTax += s.federal_tax || 0;
      prev.provincialTax += s.provincial_tax || 0;
      prev.cppEmployee += s.cpp_contribution || 0;
      prev.cppEmployer += s.cpp_employer || 0;
      prev.eiEmployee += s.ei_premium || 0;
      prev.eiEmployer += s.ei_employer || 0;
      byEmployee.set(key, prev);
    });

    return {
      startDate,
      endDate,
      dueDate: new Date(yearNum, monthNum, 15).toISOString().split('T')[0],
      numberOfEmployees: byEmployee.size,
      ...totals,
      employees: Array.from(byEmployee.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  };

  // Recompute a stored remittance's totals from the current pay_stubs in the
  // period and persist them. Skips rows already marked 'paid' so historical
  // filings stay intact.
  const recalculateRemittance = useMutation({
    mutationFn: async (remittanceId: string) => {
      const target = remittances.find(r => r.id === remittanceId);
      if (!target) throw new Error('Remittance not found');
      if (target.status === 'paid') {
        throw new Error('Cannot recalculate a remittance that is already paid');
      }
      const detail = await buildRemittanceReport(target.remittance_period.substring(0, 7));
      const total =
        (detail.federalTax || 0) +
        (detail.provincialTax || 0) +
        (detail.cppEmployee || 0) +
        (detail.cppEmployer || 0) +
        (detail.eiEmployee || 0) +
        (detail.eiEmployer || 0);
      const { error } = await supabase
        .from('remittances')
        .update({
          total_federal_tax: detail.federalTax,
          total_provincial_tax: detail.provincialTax,
          total_cpp_employee: detail.cppEmployee,
          total_cpp_employer: detail.cppEmployer,
          total_ei_employee: detail.eiEmployee,
          total_ei_employer: detail.eiEmployer,
          total_amount: total,
        })
        .eq('id', remittanceId);
      if (error) throw error;
      return { id: remittanceId, total };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remittances'] });
      toast.success('Remittance totals recalculated from pay stubs');
    },
    onError: (e: any) => toast.error('Recalculate failed: ' + (e?.message || 'Unknown error')),
  });

  return {
    remittances,
    isLoading,
    error,
    pendingRemittances,
    overdueRemittances,
    totalPending,
    ytdPaid,
    createRemittance,
    markRemittancePaid,
    generateRemittanceFromPayRuns,
    buildRemittanceReport,
    recalculateRemittance,
  };
}

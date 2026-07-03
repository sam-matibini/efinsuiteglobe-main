import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type RoEReasonCode = Database['public']['Enums']['roe_reason'];
type PayFrequency = Database['public']['Enums']['pay_frequency'];

export interface RoERecord {
  id: string;
  employee_id: string;
  roe_serial?: string;
  reason_code: RoEReasonCode;
  first_day_worked: string;
  last_day_paid: string;
  final_pay_period_end?: string;
  total_insurable_hours: number;
  total_insurable_earnings: number;
  pay_period_type: PayFrequency;
  insurable_earnings_by_period?: unknown;
  vacation_pay?: number;
  statutory_holiday_pay?: number;
  other_monies?: unknown;
  comments?: string;
  recall_date?: string;
  recall_code?: string;
  status?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string;
    hire_date: string;
    termination_date?: string;
    pay_frequency: PayFrequency;
    province: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    postal_code?: string;
  };
}

export interface CreateRoEInput {
  employee_id: string;
  reason_code: RoEReasonCode;
  last_day_paid: string;
  recall_date?: string;
  comments?: string;
}

export function useRoeRecords() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  const { data: roeRecords, isLoading, error } = useQuery({
    queryKey: ['roe-records', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('roe_records')
        .select(`
          *,
          employees!inner (
            id,
            first_name,
            last_name,
            employee_number,
            hire_date,
            termination_date,
            pay_frequency,
            province,
            address_line1,
            address_line2,
            city,
            postal_code,
            organization_id
          )
        `)
        .eq('employees.organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RoERecord[];
    },
    enabled: !!organization?.id,
  });

  const createRoE = useMutation({
    mutationFn: async (input: CreateRoEInput) => {
      // Get employee details
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', input.employee_id)
        .single();

      if (empError) throw empError;

      // Get last 52 weeks of pay stubs
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data: payRuns, error: prError } = await supabase
        .from('pay_runs')
        .select('id, pay_period_start, pay_period_end')
        .eq('organization_id', employee.organization_id)
        .eq('status', 'paid')
        .gte('pay_date', oneYearAgo.toISOString().split('T')[0])
        .order('pay_date', { ascending: false });

      if (prError) throw prError;

      const payRunIds = payRuns?.map(pr => pr.id) || [];

      let totalHours = 0;
      let totalEarnings = 0;
      const earningsByPeriod: number[] = [];

      if (payRunIds.length > 0) {
        const { data: payStubs, error: stubError } = await supabase
          .from('pay_stubs')
          .select('*')
          .eq('employee_id', input.employee_id)
          .in('pay_run_id', payRunIds);

        if (stubError) throw stubError;

        payStubs?.forEach(stub => {
          const hours = (stub.regular_hours || 0) + (stub.overtime_hours || 0) + (stub.vacation_hours || 0) + (stub.sick_hours || 0);
          totalHours += hours;
          totalEarnings += stub.gross_pay || 0;
          earningsByPeriod.push(stub.gross_pay || 0);
        });
      }

      // Generate ROE serial (simplified - in production would be from CRA)
      const serial = `ROE-${Date.now().toString(36).toUpperCase()}`;

      const roeData = {
        employee_id: input.employee_id,
        roe_serial: serial,
        reason_code: input.reason_code,
        first_day_worked: employee.hire_date,
        last_day_paid: input.last_day_paid,
        final_pay_period_end: input.last_day_paid,
        total_insurable_hours: totalHours,
        total_insurable_earnings: totalEarnings,
        pay_period_type: employee.pay_frequency,
        insurable_earnings_by_period: earningsByPeriod.slice(0, 14), // Last 14 pay periods
        vacation_pay: 0,
        statutory_holiday_pay: 0,
        other_monies: {},
        comments: input.comments,
        recall_date: input.recall_date,
        status: 'draft',
      };

      const { data, error: insertError } = await supabase
        .from('roe_records')
        .insert(roeData)
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: () => {
      toast.success('ROE created successfully');
      queryClient.invalidateQueries({ queryKey: ['roe-records'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create ROE: ${error.message}`);
    },
  });

  const submitRoE = useMutation({
    mutationFn: async (roeId: string) => {
      const { error } = await supabase
        .from('roe_records')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', roeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ROE marked as submitted');
      queryClient.invalidateQueries({ queryKey: ['roe-records'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit ROE: ${error.message}`);
    },
  });

  const deleteRoE = useMutation({
    mutationFn: async (roeId: string) => {
      const { error } = await supabase
        .from('roe_records')
        .delete()
        .eq('id', roeId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('ROE deleted');
      queryClient.invalidateQueries({ queryKey: ['roe-records'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete ROE: ${error.message}`);
    },
  });

  const stats = {
    totalRecords: roeRecords?.length || 0,
    draftCount: roeRecords?.filter(r => r.status === 'draft').length || 0,
    submittedCount: roeRecords?.filter(r => r.status === 'submitted').length || 0,
  };

  return {
    roeRecords,
    isLoading,
    error,
    createRoE,
    submitRoE,
    deleteRoE,
    stats,
  };
}

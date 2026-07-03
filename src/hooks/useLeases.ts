import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

export interface Lease {
  id: string;
  organization_id: string;
  lease_number: string;
  name: string;
  description: string | null;
  category_id: string | null;
  lessor_name: string;
  lessor_contact: string | null;
  lease_type: 'finance' | 'operating' | 'short_term' | 'low_value';
  asset_type: 'real_estate' | 'equipment' | 'vehicle' | 'other';
  commencement_date: string;
  end_date: string;
  term_months: number;
  payment_amount: number;
  payment_frequency: 'monthly' | 'bi_weekly' | 'quarterly' | 'annually';
  payment_timing: 'beginning' | 'end';
  first_payment_date: string;
  discount_rate: number;
  initial_direct_costs: number;
  lease_incentives_received: number;
  residual_value_guarantee: number;
  purchase_option_price: number | null;
  purchase_option_reasonably_certain: boolean;
  present_value_payments: number;
  rou_asset_initial: number;
  lease_liability_initial: number;
  rou_asset_current: number;
  lease_liability_current: number;
  accumulated_depreciation: number;
  accumulated_interest: number;
  rou_asset_account_id: string | null;
  lease_liability_account_id: string | null;
  interest_expense_account_id: string | null;
  depreciation_expense_account_id: string | null;
  accumulated_depreciation_account_id: string | null;
  status: 'draft' | 'active' | 'modified' | 'terminated' | 'expired';
  commencement_journal_id: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeasePaymentSchedule {
  id: string;
  lease_id: string;
  payment_number: number;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  opening_liability: number;
  closing_liability: number;
  depreciation_amount: number;
  rou_asset_opening: number;
  rou_asset_closing: number;
  status: 'scheduled' | 'paid' | 'overdue' | 'cancelled';
  actual_payment_date: string | null;
  actual_payment_amount: number | null;
  journal_entry_id: string | null;
  created_at: string;
}

export interface LeaseInput {
  lease_number: string;
  name: string;
  description?: string;
  category_id?: string;
  lessor_name: string;
  lessor_contact?: string;
  lease_type: 'finance' | 'operating' | 'short_term' | 'low_value';
  asset_type: 'real_estate' | 'equipment' | 'vehicle' | 'other';
  commencement_date: string;
  end_date: string;
  term_months: number;
  payment_amount: number;
  payment_frequency: 'monthly' | 'bi_weekly' | 'quarterly' | 'annually';
  payment_timing: 'beginning' | 'end';
  first_payment_date: string;
  discount_rate: number;
  initial_direct_costs?: number;
  lease_incentives_received?: number;
  residual_value_guarantee?: number;
  purchase_option_price?: number;
  purchase_option_reasonably_certain?: boolean;
  rou_asset_account_id?: string;
  lease_liability_account_id?: string;
  interest_expense_account_id?: string;
  depreciation_expense_account_id?: string;
  accumulated_depreciation_account_id?: string;
  grace_period_months?: number;
  notes?: string;
}

// Calculate present value of lease payments
export function calculatePresentValue(
  paymentAmount: number,
  termMonths: number,
  annualRate: number,
  paymentFrequency: 'monthly' | 'bi_weekly' | 'quarterly' | 'annually',
  paymentTiming: 'beginning' | 'end'
): number {
  const periodsPerYear = paymentFrequency === 'bi_weekly' ? 26 : paymentFrequency === 'monthly' ? 12 : paymentFrequency === 'quarterly' ? 4 : 1;
  const periodRate = annualRate / 100 / periodsPerYear;
  const monthsPerPeriod = 12 / periodsPerYear;
  const numberOfPayments = Math.ceil(termMonths / monthsPerPeriod);
  
  if (periodRate === 0) {
    return paymentAmount * numberOfPayments;
  }
  
  // PV of annuity formula
  let pv = paymentAmount * ((1 - Math.pow(1 + periodRate, -numberOfPayments)) / periodRate);
  
  // Adjust for annuity due (payment at beginning)
  if (paymentTiming === 'beginning') {
    pv = pv * (1 + periodRate);
  }
  
  return Math.round(pv * 100) / 100;
}

// Generate amortization schedule
export function generateAmortizationSchedule(
  presentValue: number,
  rouAssetInitial: number,
  paymentAmount: number,
  termMonths: number,
  annualRate: number,
  paymentFrequency: 'monthly' | 'bi_weekly' | 'quarterly' | 'annually',
  firstPaymentDate: string,
  gracePeriodMonths: number = 0
): Omit<LeasePaymentSchedule, 'id' | 'lease_id' | 'created_at' | 'status' | 'actual_payment_date' | 'actual_payment_amount' | 'journal_entry_id'>[] {
  const periodsPerYear = paymentFrequency === 'bi_weekly' ? 26 : paymentFrequency === 'monthly' ? 12 : paymentFrequency === 'quarterly' ? 4 : 1;
  const periodRate = annualRate / 100 / periodsPerYear;
  const monthsPerPeriod = 12 / periodsPerYear;
  const gracePeriods = gracePeriodMonths > 0 ? Math.ceil(gracePeriodMonths / monthsPerPeriod) : 0;
  const numberOfPayments = Math.ceil(termMonths / monthsPerPeriod);
  const totalPeriods = gracePeriods + numberOfPayments;
  const monthlyDepreciation = rouAssetInitial / (termMonths + gracePeriodMonths);
  const periodDepreciation = monthlyDepreciation * monthsPerPeriod;
  
  const schedule: Omit<LeasePaymentSchedule, 'id' | 'lease_id' | 'created_at' | 'status' | 'actual_payment_date' | 'actual_payment_amount' | 'journal_entry_id'>[] = [];
  
  let openingLiability = presentValue;
  let rouAssetOpening = rouAssetInitial;
  
  for (let i = 1; i <= totalPeriods; i++) {
    const isGracePeriod = i <= gracePeriods;
    const interestAmount = Math.round(openingLiability * periodRate * 100) / 100;
    
    let periodPayment: number;
    let principalAmount: number;
    let closingLiability: number;
    
    if (isGracePeriod) {
      // Grace period: no payment, interest accrues and compounds onto liability
      periodPayment = 0;
      principalAmount = 0;
      closingLiability = Math.round((openingLiability + interestAmount) * 100) / 100;
    } else {
      periodPayment = paymentAmount;
      principalAmount = Math.round((paymentAmount - interestAmount) * 100) / 100;
      closingLiability = Math.max(0, Math.round((openingLiability - principalAmount) * 100) / 100);
    }
    
    const rouAssetClosing = Math.max(0, Math.round((rouAssetOpening - periodDepreciation) * 100) / 100);
    
    let paymentDate: Date;
    if (paymentFrequency === 'bi_weekly') {
      paymentDate = new Date(firstPaymentDate);
      paymentDate.setDate(paymentDate.getDate() + (i - 1) * 14);
    } else {
      paymentDate = addMonths(new Date(firstPaymentDate), (i - 1) * monthsPerPeriod);
    }
    
    schedule.push({
      payment_number: i,
      payment_date: format(paymentDate, 'yyyy-MM-dd'),
      payment_amount: periodPayment,
      principal_amount: principalAmount,
      interest_amount: interestAmount,
      opening_liability: openingLiability,
      closing_liability: closingLiability,
      depreciation_amount: Math.round(periodDepreciation * 100) / 100,
      rou_asset_opening: rouAssetOpening,
      rou_asset_closing: rouAssetClosing
    });
    
    openingLiability = closingLiability;
    rouAssetOpening = rouAssetClosing;
  }
  
  return schedule;
}

export function useLeases() {
  const { organization } = useCurrentOrganization();
  
  return useQuery({
    queryKey: ['leases', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('leases')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Lease[];
    },
    enabled: !!organization?.id
  });
}

export function useLeasePaymentSchedule(leaseId: string | undefined) {
  return useQuery({
    queryKey: ['lease-payments', leaseId],
    queryFn: async () => {
      if (!leaseId) return [];
      
      const { data, error } = await supabase
        .from('lease_payment_schedule')
        .select('*')
        .eq('lease_id', leaseId)
        .order('payment_number', { ascending: true });
      
      if (error) throw error;
      return data as LeasePaymentSchedule[];
    },
    enabled: !!leaseId
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  
  return useMutation({
    mutationFn: async (input: LeaseInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Calculate present value and ROU asset
      const presentValue = calculatePresentValue(
        input.payment_amount,
        input.term_months,
        input.discount_rate,
        input.payment_frequency,
        input.payment_timing
      );
      
      const rouAssetInitial = presentValue + 
        (input.initial_direct_costs || 0) - 
        (input.lease_incentives_received || 0);
      
      // Insert lease
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .insert({
          organization_id: organization.id,
          ...input,
          present_value_payments: presentValue,
          rou_asset_initial: rouAssetInitial,
          lease_liability_initial: presentValue,
          rou_asset_current: rouAssetInitial,
          lease_liability_current: presentValue,
          status: 'active'
        })
        .select()
        .single();
      
      if (leaseError) throw leaseError;
      
      // Generate and insert payment schedule
      const schedule = generateAmortizationSchedule(
        presentValue,
        rouAssetInitial,
        input.payment_amount,
        input.term_months,
        input.discount_rate,
        input.payment_frequency,
        input.first_payment_date,
        input.grace_period_months || 0
      );
      
      const scheduleWithLeaseId = schedule.map(payment => ({
        ...payment,
        lease_id: lease.id,
        status: 'scheduled' as const
      }));
      
      const { error: scheduleError } = await supabase
        .from('lease_payment_schedule')
        .insert(scheduleWithLeaseId);
      
      if (scheduleError) throw scheduleError;
      
      return lease;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create lease: ${error.message}`);
    }
  });
}

export function useRecordLeasePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      actualDate, 
      actualAmount,
      journalEntryId
    }: { 
      paymentId: string; 
      actualDate: string; 
      actualAmount: number;
      journalEntryId?: string;
    }) => {
      const { data, error } = await supabase
        .from('lease_payment_schedule')
        .update({
          status: 'paid',
          actual_payment_date: actualDate,
          actual_payment_amount: actualAmount,
          journal_entry_id: journalEntryId
        })
        .eq('id', paymentId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease-payments'] });
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    }
  });
}

export function useUpdateLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lease> & { id: string }) => {
      const { data, error } = await supabase
        .from('leases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update lease: ${error.message}`);
    }
  });
}

export function useEditLease() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: LeaseInput }) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Calculate present value and ROU asset
      const presentValue = calculatePresentValue(
        input.payment_amount,
        input.term_months,
        input.discount_rate,
        input.payment_frequency,
        input.payment_timing
      );
      
      const rouAssetInitial = presentValue + 
        (input.initial_direct_costs || 0) - 
        (input.lease_incentives_received || 0);
      
      // Update lease
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .update({
          ...input,
          present_value_payments: presentValue,
          rou_asset_initial: rouAssetInitial,
          lease_liability_initial: presentValue,
          rou_asset_current: rouAssetInitial,
          lease_liability_current: presentValue,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (leaseError) throw leaseError;
      
      // Delete old scheduled (unpaid) payments and regenerate
      const { error: deleteError } = await supabase
        .from('lease_payment_schedule')
        .delete()
        .eq('lease_id', id)
        .eq('status', 'scheduled');
      
      if (deleteError) throw deleteError;
      
      // Generate new payment schedule
      const schedule = generateAmortizationSchedule(
        presentValue,
        rouAssetInitial,
        input.payment_amount,
        input.term_months,
        input.discount_rate,
        input.payment_frequency,
        input.first_payment_date,
        input.grace_period_months || 0
      );
      
      const scheduleWithLeaseId = schedule.map(payment => ({
        ...payment,
        lease_id: id,
        status: 'scheduled' as const
      }));
      
      const { error: scheduleError } = await supabase
        .from('lease_payment_schedule')
        .insert(scheduleWithLeaseId);
      
      if (scheduleError) throw scheduleError;
      
      return lease;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      queryClient.invalidateQueries({ queryKey: ['lease-payments'] });
      toast.success('Lease updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update lease: ${error.message}`);
    }
  });
}

export function useDeleteLease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leases')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      toast.success('Lease deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete lease: ${error.message}`);
    }
  });
}

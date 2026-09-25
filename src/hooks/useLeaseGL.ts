import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry, JournalEntryLine } from './useJournalEntryCreation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LeasePaymentSchedule, Lease } from './useLeases';

export interface PostLeasePaymentParams {
  organizationId: string;
  lease: Lease;
  payment: LeasePaymentSchedule;
  paymentDate: string;
  paymentAmount: number;
}

export interface PostBatchLeasePaymentsParams {
  organizationId: string;
  leases: Lease[];
  payments: Array<{
    lease: Lease;
    payment: LeasePaymentSchedule;
  }>;
  periodDate: Date;
}

/**
 * Posts a single lease payment to the GL
 * DR Lease Liability (principal)
 * DR Interest Expense (interest)
 * CR Cash/Bank (total payment)
 */
export async function postLeasePaymentToGL(params: PostLeasePaymentParams): Promise<string> {
  const { organizationId, lease, payment, paymentDate, paymentAmount } = params;

  // Resolve Payment From (Cash/Bank). Required for every path except finance grace-period.
  const resolvePaymentAccount = async (): Promise<string> => {
    if (lease.payment_account_id) return lease.payment_account_id;
    const { data: cashAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('account_type', 'asset')
      .eq('is_header', false)
      .or('name.ilike.%cash%,name.ilike.%bank%')
      .order('code')
      .limit(1);
    const id = cashAccounts?.[0]?.id;
    if (!id) {
      throw new Error('No Payment From (Cash/Bank) account configured on this lease. Edit the lease and set the Payment From account.');
    }
    return id;
  };

  // ==========================================================================
  // SHORT-TERM / LOW-VALUE leases: expense the payment directly, no BS impact.
  // ==========================================================================
  if (lease.lease_type === 'short_term' || lease.lease_type === 'low_value') {
    if (!lease.rent_expense_account_id) {
      throw new Error('Rent / Lease Expense account not mapped. Edit the lease and set the Rent Expense account.');
    }
    const cashAccountId = await resolvePaymentAccount();
    const lines: JournalEntryLine[] = [
      {
        account_id: lease.rent_expense_account_id,
        debit: paymentAmount,
        credit: 0,
        memo: `Rent expense - ${lease.name} #${payment.payment_number}`,
        source_document_type: 'lease_payment',
        source_document_id: payment.id,
      },
      {
        account_id: cashAccountId,
        debit: 0,
        credit: paymentAmount,
        memo: `Lease payment (rent) - ${lease.name} #${payment.payment_number}`,
        source_document_type: 'lease_payment',
        source_document_id: payment.id,
      },
    ];
    const journalEntryId = await createJournalEntry({
      organizationId,
      date: paymentDate,
      description: `Rent Payment #${payment.payment_number} - ${lease.name} (${lease.lease_number})`,
      reference: `LEASE-RENT-${lease.lease_number}-${String(payment.payment_number).padStart(3, '0')}`,
      journalType: 'adjustment',
      lines,
      status: 'posted',
    });
    await supabase
      .from('lease_payment_schedule')
      .update({
        status: 'paid',
        actual_payment_date: paymentDate,
        actual_payment_amount: paymentAmount,
        journal_entry_id: journalEntryId,
      })
      .eq('id', payment.id);
    return journalEntryId;
  }

  // ==========================================================================
  // OPERATING (capitalized): single straight-line lease expense per period.
  //   DR Lease Expense   (straight-line = payment amount)
  //   CR Cash            (actual cash payment)
  // ROU asset + lease liability tracking is maintained on the lease record
  // (memo/schedule) but is not posted to GL — for an operating lease under
  // ASC 842 / IFRS 16 the single Lease Expense line captures the full period
  // cost. Depreciating the ROU asset separately would double-count expense.
  // ==========================================================================
  if (lease.lease_type === 'operating') {
    if (!lease.rent_expense_account_id) {
      throw new Error('Rent / Lease Expense account not mapped. Edit the lease and set the Rent Expense account.');
    }
    const cashAccountId = await resolvePaymentAccount();
    const straightLine = Number(
      (payment as any).straight_line_expense || (payment.principal_amount + payment.interest_amount)
    );
    const interest = Number(payment.interest_amount || 0);
    const rouPlug = Math.max(0, Math.round((straightLine - interest) * 100) / 100);

    const lines: JournalEntryLine[] = [
      { account_id: lease.rent_expense_account_id, debit: paymentAmount, credit: 0,
        memo: `Lease expense (straight-line) - ${lease.name} #${payment.payment_number}`,
        source_document_type: 'lease_payment', source_document_id: payment.id },
      { account_id: cashAccountId, debit: 0, credit: paymentAmount,
        memo: `Operating-lease payment - ${lease.name} #${payment.payment_number}`,
        source_document_type: 'lease_payment', source_document_id: payment.id },
    ];

    const journalEntryId = await createJournalEntry({
      organizationId,
      date: paymentDate,
      description: `Operating Lease Payment #${payment.payment_number} - ${lease.name} (${lease.lease_number})`,
      reference: `LEASE-OP-${lease.lease_number}-${String(payment.payment_number).padStart(3, '0')}`,
      journalType: 'adjustment',
      lines,
      status: 'posted',
    });

    await supabase.from('lease_payment_schedule').update({
      status: 'paid', actual_payment_date: paymentDate, actual_payment_amount: paymentAmount,
      journal_entry_id: journalEntryId,
    }).eq('id', payment.id);

    await supabase.from('leases').update({
      lease_liability_current: payment.closing_liability,
      rou_asset_current: payment.rou_asset_closing,
      accumulated_depreciation: (lease.accumulated_depreciation || 0) + rouPlug,
      accumulated_interest: (lease.accumulated_interest || 0) + interest,
    }).eq('id', lease.id);

    return journalEntryId;
  }



  // ==========================================================================
  // FINANCE lease (default): interest + principal + cash (two-line IS treatment)
  // ==========================================================================

  // Grace period entry: interest accrues but no cash payment
  const isGracePeriod = payment.payment_amount === 0 && payment.interest_amount > 0;

  // Validate required accounts are mapped
  if (!lease.lease_liability_account_id) {
    throw new Error('Lease Liability account not mapped. Please configure GL accounts for this lease.');
  }
  if (!lease.interest_expense_account_id) {
    throw new Error('Interest Expense account not mapped. Please configure GL accounts for this lease.');
  }


  
  const lines: JournalEntryLine[] = [];
  
  if (isGracePeriod) {
    // Grace period: DR Interest Expense, CR Lease Liability (interest compounds)
    lines.push({
      account_id: lease.interest_expense_account_id,
      debit: payment.interest_amount,
      credit: 0,
      memo: `Grace period interest - ${lease.name} #${payment.payment_number}`,
      source_document_type: 'lease_payment',
      source_document_id: payment.id,
    });
    lines.push({
      account_id: lease.lease_liability_account_id,
      debit: 0,
      credit: payment.interest_amount,
      memo: `Accrued interest (grace period) - ${lease.name} #${payment.payment_number}`,
      source_document_type: 'lease_payment',
      source_document_id: payment.id,
    });
  } else {
    // Normal payment period — use the explicit "Payment From" account on the lease.
    // Falls back to the first cash/bank account only if the lease has none configured.
    let cashAccountId = lease.payment_account_id;
    if (!cashAccountId) {
      const { data: cashAccounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('account_type', 'asset')
        .eq('is_header', false)
        .or('name.ilike.%cash%,name.ilike.%bank%')
        .order('code')
        .limit(1);
      cashAccountId = cashAccounts?.[0]?.id;
    }
    if (!cashAccountId) {
      throw new Error('No Payment From (Cash/Bank) account configured on this lease. Edit the lease and set the Payment From account.');
    }
    
    // DR Lease Liability (principal portion)
    if (payment.principal_amount > 0) {
      lines.push({
        account_id: lease.lease_liability_account_id,
        debit: payment.principal_amount,
        credit: 0,
        memo: `Principal payment - ${lease.name} #${payment.payment_number}`,
        source_document_type: 'lease_payment',
        source_document_id: payment.id,
      });
    }
    
    // DR Interest Expense (interest portion)
    if (payment.interest_amount > 0) {
      lines.push({
        account_id: lease.interest_expense_account_id,
        debit: payment.interest_amount,
        credit: 0,
        memo: `Interest expense - ${lease.name} #${payment.payment_number}`,
        source_document_type: 'lease_payment',
        source_document_id: payment.id,
      });
    }
    
    // CR Cash/Bank (total payment)
    lines.push({
      account_id: cashAccountId,
      debit: 0,
      credit: paymentAmount,
      memo: `Lease payment - ${lease.name} #${payment.payment_number}`,
      source_document_type: 'lease_payment',
      source_document_id: payment.id,
    });
  }
  
  const referencePrefix = isGracePeriod ? 'LEASE-INT' : 'LEASE-PMT';
  const description = isGracePeriod 
    ? `Grace Period Interest #${payment.payment_number} - ${lease.name} (${lease.lease_number})`
    : `Lease Payment #${payment.payment_number} - ${lease.name} (${lease.lease_number})`;
  
  // Create the journal entry
  const journalEntryId = await createJournalEntry({
    organizationId,
    date: paymentDate,
    description,
    reference: `${referencePrefix}-${lease.lease_number}-${String(payment.payment_number).padStart(3, '0')}`,
    journalType: 'adjustment',
    lines,
    status: 'posted',
  });
  
  // Update the payment schedule record
  await supabase
    .from('lease_payment_schedule')
    .update({
      status: 'paid',
      actual_payment_date: paymentDate,
      actual_payment_amount: isGracePeriod ? 0 : paymentAmount,
      journal_entry_id: journalEntryId,
    })
    .eq('id', payment.id);
  
  // Update lease current balances
  await supabase
    .from('leases')
    .update({
      lease_liability_current: payment.closing_liability,
      rou_asset_current: payment.rou_asset_closing,
      accumulated_depreciation: (lease.accumulated_depreciation || 0) + payment.depreciation_amount,
      accumulated_interest: (lease.accumulated_interest || 0) + payment.interest_amount,
    })
    .eq('id', lease.id);
  
  return journalEntryId;
}

/**
 * Posts ROU Asset depreciation to the GL
 * DR Depreciation Expense
 * CR Accumulated Depreciation
 */
export async function postLeaseDepreciationToGL(params: {
  organizationId: string;
  lease: Lease;
  payment: LeasePaymentSchedule;
  depreciationDate: string;
}): Promise<string> {
  const { organizationId, lease, payment, depreciationDate } = params;
  
  if (!lease.depreciation_expense_account_id) {
    throw new Error('Depreciation Expense account not mapped. Please configure GL accounts for this lease.');
  }
  if (!lease.accumulated_depreciation_account_id) {
    throw new Error('Accumulated Depreciation account not mapped. Please configure GL accounts for this lease.');
  }
  
  const lines: JournalEntryLine[] = [
    {
      account_id: lease.depreciation_expense_account_id,
      debit: payment.depreciation_amount,
      credit: 0,
      memo: `ROU Asset depreciation - ${lease.name} period ${payment.payment_number}`,
      source_document_type: 'lease_depreciation',
      source_document_id: payment.id,
    },
    {
      account_id: lease.accumulated_depreciation_account_id,
      debit: 0,
      credit: payment.depreciation_amount,
      memo: `Accumulated depreciation - ${lease.name} period ${payment.payment_number}`,
      source_document_type: 'lease_depreciation',
      source_document_id: payment.id,
    },
  ];
  
  const journalEntryId = await createJournalEntry({
    organizationId,
    date: depreciationDate,
    description: `ROU Asset Depreciation - ${lease.name} Period ${payment.payment_number}`,
    reference: `LEASE-DEP-${lease.lease_number}-${String(payment.payment_number).padStart(3, '0')}`,
    journalType: 'depreciation',
    lines,
    status: 'posted',
  });
  
  return journalEntryId;
}

/**
 * Hook for posting a single lease payment
 */
export function usePostLeasePayment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postLeasePaymentToGL,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease-payments'] });
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Lease payment posted to GL');
    },
    onError: (error) => {
      toast.error(`Failed to post payment: ${error.message}`);
    },
  });
}

/**
 * Hook for batch posting multiple lease payments
 */
export function useBatchLeasePaymentPosting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: PostBatchLeasePaymentsParams) => {
      const { organizationId, payments, periodDate } = params;
      const results: { success: string[]; failed: { lease: string; error: string }[] } = {
        success: [],
        failed: [],
      };
      
      for (const { lease, payment } of payments) {
        try {
          // Post the payment (principal + interest, or straight-line rent for operating,
          // or rent-only for short_term/low_value)
          await postLeasePaymentToGL({
            organizationId,
            lease,
            payment,
            paymentDate: payment.payment_date,
            paymentAmount: payment.payment_amount,
          });

          // Post ROU depreciation as a separate JE ONLY for finance leases.
          // Operating leases embed ROU amortization inside the payment JE (via the
          // "ROU amortization (operating-lease plug)" line). Short-term / low-value
          // leases don't capitalize at all. Calling postLeaseDepreciationToGL for
          // those double-books and/or fails on missing depreciation accounts.
          if (lease.lease_type === 'finance' && payment.depreciation_amount > 0) {
            if (!lease.depreciation_expense_account_id || !lease.accumulated_depreciation_account_id) {
              results.failed.push({
                lease: `${lease.name} (depreciation)`,
                error: 'Depreciation Expense / Accumulated Depreciation account not mapped on the lease.',
              });
            } else {
              try {
                await postLeaseDepreciationToGL({
                  organizationId,
                  lease,
                  payment,
                  depreciationDate: payment.payment_date,
                });
              } catch (depErr) {
                results.failed.push({
                  lease: `${lease.name} (depreciation)`,
                  error: depErr instanceof Error ? depErr.message : 'Unknown error',
                });
              }
            }
          }

          results.success.push(lease.name);
        } catch (error) {
          results.failed.push({
            lease: lease.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['lease-payments'] });
      queryClient.invalidateQueries({ queryKey: ['leases'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

      if (results.success.length > 0) {
        toast.success(`Posted ${results.success.length} lease payment(s) to GL`);
      }
      if (results.failed.length > 0) {
        console.error('Lease batch posting failures:', results.failed);
        const preview = results.failed
          .slice(0, 3)
          .map(f => `${f.lease}: ${f.error}`)
          .join('\n');
        const more = results.failed.length > 3 ? `\n…and ${results.failed.length - 3} more` : '';
        toast.error(`Failed to post ${results.failed.length} payment(s)`, {
          description: preview + more,
        });
      }
    },
    onError: (error) => {
      toast.error(`Batch posting failed: ${error.message}`);
    },
  });
}

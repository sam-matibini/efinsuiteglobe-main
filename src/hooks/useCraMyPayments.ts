import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { createJournalEntry } from '@/hooks/useJournalEntryCreation';
import { allowUnreconciledBankUpdate } from '@/lib/bankTransactionLock';
import { mergeCatalog, findType, typeLabel, allocationLabel, type CatalogOverride, type PayerKind } from '@/lib/cra/mypayment/catalog';
import {
  DEFAULT_POLICY,
  normalizeBusinessNumber,
  normalizeProgramAccount,
  parseAmount,
  paymentJournalLines,
  type AccountOption,
  type BankLine,
  type MyPaymentRecord,
  type PaymentDraft,
  type PaymentPolicy,
  type WorkflowStatus,
} from '@/lib/cra/mypayment/workflow';

/** New tables and columns are not in the generated Supabase types yet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const RECEIPT_BUCKET = 'cra-payment-receipts';

export interface MyPaymentRow extends MyPaymentRecord {
  organization_id: string;
  payment_type: string;
  currency: string;
  status: string;
  notes: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  handoff_at: string | null;
  confirmed_by: string | null;
  failure_reason: string | null;
  receipt_file_name: string | null;
  liability_account_id: string | null;
  reconciled_at: string | null;
  represented_client_id: string | null;
  duplicate_override_reason: string | null;
  updated_at: string;
}

export interface BankAccountOption {
  id: string;
  name: string;
  institution: string | null;
  account_number: string | null;
  gl_account_id: string | null;
  currency: string;
}

export interface AuditRow {
  id: string;
  action: string;
  actor_id: string | null;
  created_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  if (/workflow_status|cra_payment_policies|next_cra_my_payment_reference|cra_represent/.test(message) && /does not exist|schema cache|Could not find/.test(message)) {
    return 'The CRA Payments database update has not been applied yet. Run migration 20261116120000_cra_my_payment_module.sql in Supabase.';
  }
  return message;
}

function draftToColumns(draft: PaymentDraft, registerType: string) {
  const isBusiness = draft.payerKind === 'business';
  return {
    payer_kind: draft.payerKind,
    cra_payment_type: draft.typeKey,
    cra_allocation: draft.allocationKey,
    payment_type: registerType,
    business_name: draft.businessName.trim(),
    business_number: isBusiness ? normalizeBusinessNumber(draft.businessNumber) : null,
    program_account: isBusiness ? normalizeProgramAccount(draft.programAccount) : null,
    filing_period_label: draft.periodLabel.trim() || null,
    period_start: draft.periodStart || null,
    period_end: draft.periodEnd || null,
    amount: parseAmount(draft.amount),
    scheduled_for: draft.paymentDate || null,
  };
}

export function useCraMyPayments() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;
  const keys = {
    payments: ['cra-my-payments', orgId] as const,
    policy: ['cra-payment-policy', orgId] as const,
    catalog: ['cra-payment-catalog', orgId] as const,
    accounts: ['cra-my-payment-accounts', orgId] as const,
    banks: ['cra-my-payment-banks', orgId] as const,
    people: ['cra-my-payment-people', orgId] as const,
  };

  const paymentsQuery = useQuery({
    queryKey: keys.payments,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from('tax_payments')
        .select('*')
        .eq('organization_id', orgId)
        .not('workflow_status', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error(friendlyError(error));
      return (data ?? []).map((row: MyPaymentRow) => ({ ...row, amount: Number(row.amount) })) as MyPaymentRow[];
    },
  });

  const policyQuery = useQuery({
    queryKey: keys.policy,
    enabled: !!orgId,
    queryFn: async (): Promise<PaymentPolicy> => {
      const { data, error } = await db.from('cra_payment_policies').select('*').eq('organization_id', orgId).maybeSingle();
      if (error || !data) return DEFAULT_POLICY;
      return {
        approval_levels: data.approval_levels === 2 ? 2 : 1,
        review_threshold: data.review_threshold === null ? null : Number(data.review_threshold),
        separate_duties: !!data.separate_duties,
        reviewer_roles: data.reviewer_roles ?? DEFAULT_POLICY.reviewer_roles,
        approver_roles: data.approver_roles ?? DEFAULT_POLICY.approver_roles,
        max_payment_amount: data.max_payment_amount === null ? null : Number(data.max_payment_amount),
        duplicate_window_days: Number(data.duplicate_window_days ?? DEFAULT_POLICY.duplicate_window_days),
      };
    },
  });

  const catalogQuery = useQuery({
    queryKey: keys.catalog,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.from('cra_payment_catalog_overrides').select('*').eq('organization_id', orgId);
      if (error) return [] as CatalogOverride[];
      return (data ?? []) as CatalogOverride[];
    },
  });

  const accountsQuery = useQuery({
    queryKey: keys.accounts,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name, account_type, is_header')
        .eq('organization_id', orgId!)
        .order('code');
      if (error) throw error;
      return (data ?? []) as AccountOption[];
    },
  });

  const banksQuery = useQuery({
    queryKey: keys.banks,
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name, institution, account_number, gl_account_id, currency')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as BankAccountOption[];
    },
  });

  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const peopleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of payments) {
      for (const id of [row.prepared_by, row.reviewed_by, row.approved_by, row.confirmed_by]) if (id) ids.add(id);
    }
    return [...ids].sort();
  }, [payments]);

  const peopleQuery = useQuery({
    queryKey: [...keys.people, peopleIds.join(',')],
    enabled: !!orgId && peopleIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, email, full_name').in('id', peopleIds);
      const map = new Map<string, string>();
      for (const row of data ?? []) map.set(row.id, row.full_name || row.email);
      return map;
    },
  });

  const catalog = useMemo(() => mergeCatalog(catalogQuery.data ?? []), [catalogQuery.data]);
  const policy = policyQuery.data ?? DEFAULT_POLICY;

  const personName = (id: string | null | undefined) => {
    if (!id) return '—';
    if (id === user?.id) return 'You';
    return peopleQuery.data?.get(id) ?? 'Team member';
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.payments });
    qc.invalidateQueries({ queryKey: ['tax-payments', orgId] });
    qc.invalidateQueries({ queryKey: ['cra-my-payment-audit'] });
  };

  async function patchPayment(id: string, patch: Record<string, unknown>) {
    const { data, error } = await db.from('tax_payments').update(patch).eq('id', id).select('*').single();
    if (error) throw new Error(friendlyError(error));
    return data as MyPaymentRow;
  }

  const create = useMutation({
    mutationFn: async (input: { draft: PaymentDraft; submit: boolean; bankAccountId: string | null; duplicateReason?: string; representedClientId?: string | null; notes?: string }) => {
      if (!orgId || !user?.id) throw new Error('Sign in and choose an organization first.');
      const type = findType(catalog, input.draft.payerKind as PayerKind, input.draft.typeKey);
      if (!type) throw new Error('Choose a payment type.');
      const { data: reference, error: refError } = await db.rpc('next_cra_my_payment_reference', { p_org: orgId });
      if (refError) throw new Error(friendlyError(refError));
      const row = {
        organization_id: orgId,
        reference,
        ...draftToColumns(input.draft, type.registerType),
        currency: 'CAD',
        payment_method: 'cra_my_payment',
        payment_rail: 'cra_my_payment',
        workflow_status: input.submit ? 'awaiting_authorization' : 'draft',
        status: input.submit ? 'pending' : 'draft',
        bank_account_id: input.bankAccountId,
        represented_client_id: input.representedClientId ?? null,
        duplicate_override_reason: input.duplicateReason?.trim() || null,
        notes: input.notes?.trim() || null,
        prepared_by: user.id,
        initiated_by: user.id,
        created_by: user.id,
      };
      const { data, error } = await db.from('tax_payments').insert(row).select('*').single();
      if (error) throw new Error(friendlyError(error));
      return data as MyPaymentRow;
    },
    onSuccess: (row) => {
      invalidate();
      toast.success(row.workflow_status === 'draft' ? `Draft ${row.reference} saved` : `${row.reference} sent for authorization`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateDraft = useMutation({
    mutationFn: async (input: { id: string; draft: PaymentDraft; bankAccountId: string | null; submit: boolean; duplicateReason?: string; notes?: string }) => {
      const type = findType(catalog, input.draft.payerKind as PayerKind, input.draft.typeKey);
      if (!type) throw new Error('Choose a payment type.');
      return patchPayment(input.id, {
        ...draftToColumns(input.draft, type.registerType),
        bank_account_id: input.bankAccountId,
        duplicate_override_reason: input.duplicateReason?.trim() || null,
        notes: input.notes?.trim() || null,
        ...(input.submit ? { workflow_status: 'awaiting_authorization' } : {}),
      });
    },
    onSuccess: (row) => {
      invalidate();
      toast.success(row.workflow_status === 'draft' ? 'Draft updated' : `${row.reference} sent for authorization`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transition = useMutation({
    mutationFn: async (input: { id: string; to: WorkflowStatus; extra?: Record<string, unknown>; message?: string }) => {
      const row = await patchPayment(input.id, { workflow_status: input.to, ...(input.extra ?? {}) });
      return { row, message: input.message };
    },
    onSuccess: ({ message }) => {
      invalidate();
      if (message) toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const review = useMutation({
    mutationFn: async (id: string) => patchPayment(id, { reviewed_by: user?.id }),
    onSuccess: (row) => {
      invalidate();
      toast.success(`${row.reference} reviewed. It now needs approval.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => patchPayment(id, { approved_by: user?.id, workflow_status: 'awaiting_payment' }),
    onSuccess: (row) => {
      invalidate();
      toast.success(`${row.reference} approved. It is ready to pay on CRA My Payment.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function uploadReceipt(row: Pick<MyPaymentRow, 'id' | 'organization_id' | 'reference'>, file: File) {
    if (file.size > 10 * 1024 * 1024) throw new Error('Receipts must be 10 MB or smaller.');
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
    const path = `${row.organization_id}/${row.reference}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw new Error(`Receipt upload failed: ${error.message}`);
    return { path, name: file.name };
  }

  async function postJournalFor(row: MyPaymentRow, liabilityAccountId: string, bankGlAccountId: string) {
    if (row.journal_entry_id) throw new Error('This payment already has a journal entry.');
    const type = findType(catalog, row.payer_kind, row.cra_payment_type);
    const label = `${type?.label ?? 'CRA'} — ${allocationLabel(catalog, row.payer_kind, row.cra_payment_type, row.cra_allocation)}`;
    const memo = `${row.reference} · CRA ${row.confirmation_number ?? ''}`.trim();
    const lines = paymentJournalLines({ amount: row.amount, liabilityAccountId, bankGlAccountId, memo }).map((line) => ({
      ...line,
      source_document_type: 'tax_payment',
      source_document_id: row.id,
    }));
    const journalId = await createJournalEntry({
      organizationId: row.organization_id,
      date: (row.paid_at ?? new Date().toISOString()).slice(0, 10),
      description: `CRA payment ${row.reference}: ${label}${row.filing_period_label ? ` (${row.filing_period_label})` : ''}`,
      reference: row.reference,
      journalType: 'bank',
      lines,
      status: 'posted',
    });
    return patchPayment(row.id, { journal_entry_id: journalId, liability_account_id: liabilityAccountId });
  }

  const confirm = useMutation({
    mutationFn: async (input: {
      row: MyPaymentRow;
      confirmationNumber: string;
      paidAt: string;
      receipt: File | null;
      liabilityAccountId: string | null;
      bankAccountId: string | null;
      postJournal: boolean;
      notes?: string;
    }) => {
      const confirmation = input.confirmationNumber.trim();
      if (!confirmation) throw new Error('Enter the CRA confirmation number.');
      if (!input.paidAt) throw new Error('Enter the payment date.');
      let receipt: { path: string; name: string } | null = null;
      if (input.receipt) receipt = await uploadReceipt(input.row, input.receipt);

      let row = await patchPayment(input.row.id, {
        workflow_status: 'payment_completed',
        confirmation_number: confirmation,
        paid_at: new Date(`${input.paidAt}T12:00:00`).toISOString(),
        confirmed_by: user?.id,
        bank_account_id: input.bankAccountId,
        liability_account_id: input.liabilityAccountId,
        ...(receipt ? { receipt_path: receipt.path, receipt_file_name: receipt.name, confirmation_pdf_url: receipt.path } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      });

      let journalError: string | null = null;
      if (input.postJournal) {
        const bank = (banksQuery.data ?? []).find((b) => b.id === input.bankAccountId);
        if (!input.liabilityAccountId || !bank?.gl_account_id) {
          journalError = !input.liabilityAccountId ? 'Choose the tax liability account.' : 'The bank account has no linked GL account.';
        } else {
          try {
            row = await postJournalFor(row, input.liabilityAccountId, bank.gl_account_id);
          } catch (error) {
            journalError = friendlyError(error);
          }
        }
      }
      return { row, journalError };
    },
    onSuccess: ({ row, journalError }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      if (journalError) toast.warning(`Confirmation saved for ${row.reference}, but the journal entry was not posted: ${journalError}`);
      else toast.success(row.journal_entry_id ? `${row.reference} confirmed and posted to the general ledger` : `${row.reference} confirmed`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const postJournal = useMutation({
    mutationFn: async (input: { row: MyPaymentRow; liabilityAccountId: string; bankAccountId: string }) => {
      const bank = (banksQuery.data ?? []).find((b) => b.id === input.bankAccountId);
      if (!bank?.gl_account_id) throw new Error('The bank account has no linked GL account. Link it in Banking first.');
      let row = input.row;
      if (row.bank_account_id !== input.bankAccountId) row = await patchPayment(row.id, { bank_account_id: input.bankAccountId });
      return postJournalFor(row, input.liabilityAccountId, bank.gl_account_id);
    },
    onSuccess: (row) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success(`Journal entry posted for ${row.reference}`);
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const attachReceipt = useMutation({
    mutationFn: async (input: { row: MyPaymentRow; file: File }) => {
      const receipt = await uploadReceipt(input.row, input.file);
      return patchPayment(input.row.id, { receipt_path: receipt.path, receipt_file_name: receipt.name, confirmation_pdf_url: receipt.path });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Receipt attached');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function receiptUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 300);
    if (error || !data) throw new Error(error?.message ?? 'Could not open the receipt.');
    return data.signedUrl;
  }

  async function findBankLines(row: MyPaymentRow): Promise<BankLine[]> {
    if (!row.paid_at) return [];
    const bankIds = row.bank_account_id ? [row.bank_account_id] : (banksQuery.data ?? []).map((b) => b.id);
    if (!bankIds.length) return [];
    const paid = new Date(row.paid_at);
    const from = new Date(paid.getTime() - 5 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(paid.getTime() + 12 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, bank_account_id, amount, transaction_date, description, payee_payor, reference, transaction_type, journal_entry_id, status')
      .in('bank_account_id', bankIds)
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .in('amount', [row.amount, -row.amount]);
    if (error) throw error;
    return (data ?? []).map((line) => ({ ...line, amount: Number(line.amount) })) as BankLine[];
  }

  const reconcile = useMutation({
    mutationFn: async (input: { row: MyPaymentRow; line: BankLine }) => {
      const { row, line } = input;
      if (!row.journal_entry_id) throw new Error('Post the journal entry before matching the bank transaction.');
      if (line.journal_entry_id && line.journal_entry_id !== row.journal_entry_id) {
        throw new Error('That bank transaction was already posted on its own. Linking it would count the payment twice. Reverse one of the two entries first.');
      }
      if (!line.journal_entry_id) {
        const { data: existing } = await supabase.from('bank_transactions').select('status, is_cleared').eq('id', line.id).single();
        const { error } = await supabase
          .from('bank_transactions')
          .update(allowUnreconciledBankUpdate({
            journal_entry_id: row.journal_entry_id,
            gl_account_id: row.liability_account_id,
            category: 'CRA payment',
            status: 'matched',
            memo: `${row.reference} · CRA ${row.confirmation_number ?? ''}`.trim(),
          }, existing))
          .eq('id', line.id);
        if (error) throw error;
      }
      return patchPayment(row.id, { bank_transaction_id: line.id, workflow_status: 'reconciled' });
    },
    onSuccess: (row) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['bank-transactions'] });
      toast.success(`${row.reference} reconciled to the bank transaction`);
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('tax_payments').delete().eq('id', id);
      if (error) throw new Error(friendlyError(error));
    },
    onSuccess: () => {
      invalidate();
      toast.success('Draft deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    orgId,
    userId: user?.id ?? null,
    payments,
    isLoading: paymentsQuery.isLoading,
    loadError: paymentsQuery.error ? friendlyError(paymentsQuery.error) : null,
    catalog,
    policy,
    accounts: accountsQuery.data ?? [],
    banks: banksQuery.data ?? [],
    personName,
    typeLabel: (row: Pick<MyPaymentRecord, 'payer_kind' | 'cra_payment_type'>) => typeLabel(catalog, row.payer_kind, row.cra_payment_type),
    allocationLabel: (row: Pick<MyPaymentRecord, 'payer_kind' | 'cra_payment_type' | 'cra_allocation'>) =>
      allocationLabel(catalog, row.payer_kind, row.cra_payment_type, row.cra_allocation),
    create,
    updateDraft,
    transition,
    review,
    approve,
    confirm,
    postJournal,
    attachReceipt,
    receiptUrl,
    findBankLines,
    reconcile,
    remove,
  };
}

export function useCraMyPaymentAudit(paymentId: string | null) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['cra-my-payment-audit', orgId, paymentId],
    enabled: !!orgId && !!paymentId,
    queryFn: async () => {
      const { data, error } = await db
        .from('cra_payment_audit_logs')
        .select('id, action, actor_id, created_at, before_data, after_data')
        .eq('organization_id', orgId)
        .eq('entity_type', 'cra_my_payment')
        .eq('entity_id', paymentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
}

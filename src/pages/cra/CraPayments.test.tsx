import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getLedger } from '@/lib/cra/store';
import { mergeCatalog } from '@/lib/cra/mypayment/catalog';
import { DEFAULT_POLICY } from '@/lib/cra/mypayment/workflow';
import CraPayments from './CraPayments';

const base = {
  organization_id: 'org', payer_kind: 'business', cra_payment_type: 'gst_hst', cra_allocation: 'gst_payment', business_name: 'Acme Ltd.',
  business_number: '123456782', program_account: '123456782RT0001', filing_period_label: 'October 2026', period_start: null, period_end: null,
  scheduled_for: '2026-11-20', bank_account_id: null, prepared_by: 'someone', reviewed_by: null, approved_by: null, confirmation_number: null,
  paid_at: null, journal_entry_id: null, bank_transaction_id: null, receipt_path: null, created_at: '2026-11-15T00:00:00Z', liability_account_id: null,
  notes: null, failure_reason: null, duplicate_override_reason: null, receipt_file_name: null, reconciled_at: null,
};
const payments = [
  { ...base, id: '1', reference: 'EF-CRA-000001', workflow_status: 'reconciled', amount: 5000, paid_at: '2026-11-01T12:00:00Z', confirmation_number: 'C1', journal_entry_id: 'je', receipt_path: 'org/x.pdf', receipt_file_name: 'x.pdf' },
  { ...base, id: '2', reference: 'EF-CRA-000002', workflow_status: 'awaiting_payment', amount: 1200, approved_by: 'boss' },
  { ...base, id: '3', reference: 'EF-CRA-000003', workflow_status: 'payment_failed', amount: 300, failure_reason: 'Card declined' },
];

vi.mock('@/components/cra/CraModule', () => ({
  CraModule: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <div><h1>{title}</h1>{actions}{children}</div>
  ),
}));

vi.mock('@/hooks/useCraTaxCentre', () => ({
  useCraTaxCentre: () => {
    const ledger = getLedger('page-org', 'Acme Ltd.');
    ledger.balances = { gst_hst: 2500, payroll: null, corporate_tax: 1601.65, total_owing: null, corporate_interim: null };
    return { ledger, actor: { role: 'finance_manager' }, orgName: 'Acme Ltd.', can: () => true };
  },
}));

vi.mock('@/hooks/useCraMyPayments', () => {
  const catalog = mergeCatalog([]);
  const m = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  return {
    useCraMyPayments: () => ({
      userId: 'me', payments, isLoading: false, loadError: null, catalog, policy: DEFAULT_POLICY, accounts: [], banks: [],
      personName: (id: string | null) => (id ? 'Team member' : '—'),
      typeLabel: () => 'GST/HST',
      allocationLabel: () => 'GST/HST payment',
      create: m, updateDraft: m, transition: m, review: m, approve: m, confirm: m, postJournal: m, attachReceipt: m, reconcile: m, remove: m,
      receiptUrl: vi.fn(), findBankLines: vi.fn().mockResolvedValue([]),
    }),
    useCraMyPaymentAudit: () => ({ isLoading: false, data: [{ id: 'a', action: 'status:awaiting_payment', actor_id: 'boss', created_at: '2026-11-15T00:00:00Z' }] }),
  };
});

vi.mock('@/hooks/useCraAccounts', () => ({ useCraAccounts: () => ({ accounts: [] }) }));
vi.mock('@/hooks/useCraRepresentativeSettings', () => ({ useCraRepresentativeSettings: () => ({ clients: [] }) }));

describe('CraPayments dashboard', () => {
  it('shows totals, outstanding balances, history and filters', () => {
    render(<MemoryRouter><CraPayments /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'CRA Payments' })).toBeInTheDocument();
    expect(screen.getAllByText('Pay now using CRA My Payment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('$4,101.65')).toBeInTheDocument();
    expect(screen.getByText('EF-CRA-000002')).toBeInTheDocument();
    expect(screen.getByText('Payment Failed')).toBeInTheDocument();
  });

  it('opens a payment awaiting payment with the CRA handoff checklist', () => {
    render(<MemoryRouter><CraPayments /></MemoryRouter>);
    fireEvent.click(screen.getByText('EF-CRA-000002'));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Enter these on CRA My Payment')).toBeInTheDocument();
    expect(within(sheet).getAllByText('123456782RT0001').length).toBeGreaterThan(0);
    expect(within(sheet).getByRole('button', { name: /Pay now using CRA My Payment/ })).toBeInTheDocument();
    expect(within(sheet).getByText('Status → Awaiting Payment')).toBeInTheDocument();
  });

  it('filters to failed payments from the KPI card', () => {
    render(<MemoryRouter><CraPayments /></MemoryRouter>);
    fireEvent.click(screen.getByText('Failed payments'));
    expect(screen.queryByText('EF-CRA-000001')).not.toBeInTheDocument();
    expect(screen.getByText('EF-CRA-000003')).toBeInTheDocument();
  });
});

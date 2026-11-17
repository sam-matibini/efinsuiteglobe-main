import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLedger, resetCraStoreForTests } from '@/lib/cra/store';
import { mergeCatalog } from '@/lib/cra/mypayment/catalog';
import { DEFAULT_POLICY, type PaymentPolicy } from '@/lib/cra/mypayment/workflow';
import { PaymentWizard } from './PaymentWizard';

const state: { policy: PaymentPolicy; payments: unknown[] } = { policy: DEFAULT_POLICY, payments: [] };
const create = vi.fn();
const approve = vi.fn();
const transition = vi.fn();

function ledger() {
  const l = getLedger('wizard-org', 'Acme Ltd.');
  l.profile.legalName = 'Acme Ltd.';
  l.profile.businessNumber = '123456782';
  l.accounts = [{ program: 'RT', reference: '0001', label: 'GST/HST' }];
  l.gst = { ...l.gst, periodStart: '2026-10-01', periodEnd: '2026-10-31', collected: 6500, itcs: 1500 };
  return l;
}

vi.mock('@/hooks/useCraTaxCentre', () => ({
  useCraTaxCentre: () => ({
    ledger: ledger(),
    actor: { email: 'cfo@acme.test', role: 'finance_manager', displayName: 'CFO' },
    orgId: 'wizard-org',
    orgName: 'Acme Ltd.',
    can: () => true,
  }),
}));

vi.mock('@/hooks/useCraAccounts', () => ({ useCraAccounts: () => ({ accounts: [] }) }));

vi.mock('@/hooks/useCraRepresentativeSettings', () => ({ useCraRepresentativeSettings: () => ({ clients: [] }) }));

vi.mock('@/hooks/useCraMyPayments', () => ({
  useCraMyPayments: () => ({
    userId: 'user-1',
    catalog: mergeCatalog([]),
    policy: state.policy,
    payments: state.payments,
    banks: [{ id: 'bank-1', name: 'Operating chequing', institution: null, account_number: '00001234', gl_account_id: 'gl-bank', currency: 'CAD' }],
    create: { mutateAsync: create },
    updateDraft: { mutateAsync: vi.fn() },
    approve: { mutateAsync: approve },
    transition: { mutateAsync: transition },
  }),
}));

const row = { id: 'p-1', reference: 'EF-CRA-000001', workflow_status: 'awaiting_authorization' };

async function walkToReview() {
  render(<PaymentWizard open onOpenChange={() => {}} />);
  fireEvent.click(screen.getByText('GST/HST'));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  fireEvent.click(screen.getByText('GST/HST payment'));
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  // Pre-filled from the Tax & CRA profile and the GST/HST position.
  await waitFor(() => expect(screen.getByDisplayValue('123456782RT0001')).toBeInTheDocument());
  expect(screen.getByDisplayValue('Acme Ltd.')).toBeInTheDocument();
  expect(screen.getByDisplayValue('5000.00')).toBeInTheDocument();
  expect(screen.getByDisplayValue('October 2026')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  await screen.findByText('CRA payment summary');
}

describe('PaymentWizard', () => {
  beforeEach(() => {
    resetCraStoreForTests();
    state.policy = DEFAULT_POLICY;
    state.payments = [];
    create.mockReset().mockResolvedValue(row);
    approve.mockReset().mockResolvedValue({ ...row, workflow_status: 'awaiting_payment' });
    transition.mockReset().mockResolvedValue({ row: { ...row, workflow_status: 'payment_initiated' } });
  });

  it('pre-fills, shows the summary, and sends for approval when duties are separated', async () => {
    await walkToReview();
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Modify Payment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and send for approval' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const input = create.mock.calls[0][0];
    expect(input.submit).toBe(true);
    expect(input.draft).toMatchObject({ typeKey: 'gst_hst', allocationKey: 'gst_payment', programAccount: '123456782RT0001', amount: '5000.00' });
    expect(approve).not.toHaveBeenCalled();
  });

  it('approves and opens CRA My Payment in one step when the preparer may approve', async () => {
    state.policy = { ...DEFAULT_POLICY, separate_duties: false };
    const tab = { opener: {}, closed: false, location: { replace: vi.fn() }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    await walkToReview();
    fireEvent.click(screen.getByRole('button', { name: /Confirm and Proceed to CRA/ }));
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith(expect.stringContaining('apps.cra-arc.gc.ca')));
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(tab.opener).toBeNull();
    expect(approve).toHaveBeenCalledWith('p-1');
    expect(transition).toHaveBeenCalledWith(expect.objectContaining({ id: 'p-1', to: 'payment_initiated' }));
    open.mockRestore();
  });

  it('asks why when the same payment already exists', async () => {
    state.payments = [{
      id: 'old', reference: 'EF-CRA-000007', workflow_status: 'payment_completed', payer_kind: 'business', cra_payment_type: 'gst_hst',
      cra_allocation: 'gst_payment', program_account: '123456782RT0001', business_name: 'Acme Ltd.', filing_period_label: 'October 2026',
      amount: 5000, created_at: new Date().toISOString(),
    }];
    render(<PaymentWizard open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByText('GST/HST'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByText('GST/HST payment'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Possible duplicate payment');
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.queryByText('CRA payment summary')).not.toBeInTheDocument();
    expect(screen.getByText(/Explain why/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/second instalment/), { target: { value: 'Second payment after reassessment' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('CRA payment summary');
  });
});

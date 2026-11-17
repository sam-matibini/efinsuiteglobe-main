import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CraPayrollTax from './CraPayrollTax';
import CraGstHst from './CraGstHst';

const startPayment = vi.fn().mockResolvedValue({ id: 'p1', reference: 'EF-CRA-000007' });
const updateReturn = vi.fn().mockResolvedValue({});
let linked = new Map<string, { id: string; reference: string; workflow_status: string; remittance_id: string | null; tax_return_id: string | null; confirmation_number: null }>();

vi.mock('@/components/cra/CraModule', () => ({
  CraModule: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <div><h1>{title}</h1>{actions}{children}</div>
  ),
}));
vi.mock('@/hooks/useCraTaxCentre', () => ({
  useCraTaxCentre: () => ({ can: () => true, ledger: { profile: { businessNumber: '725966758' } }, recordFiling: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useOrganization', () => ({ useCurrentOrganization: () => ({ organization: { id: 'org-1', name: 'Acme' } }) }));
vi.mock('@/hooks/useTaxReportPayments', () => ({
  useTaxReportPayments: () => ({ linkedByReport: linked, startPayment: { mutateAsync: startPayment, isPending: false } }),
}));
vi.mock('@/hooks/useRemittances', () => ({
  useRemittances: () => ({
    isLoading: false,
    remittances: [
      { id: 'rem-oct', remittance_period: '2026-10-01', due_date: '2026-11-16', status: 'pending', total_amount: 888.68, confirmation_number: null },
      { id: 'rem-sep', remittance_period: '2026-09-01', due_date: '2026-10-15', status: 'paid', total_amount: 833.13, confirmation_number: 'CRA-5566' },
    ],
  }),
}));
vi.mock('@/hooks/useSalesTax', () => ({
  useTaxReturns: () => ({
    isLoading: false,
    data: [
      { id: 'ret-q3', period_name: 'Q3 2026', period_start: '2026-07-01', period_end: '2026-09-30', due_date: '2099-10-31', tax_collected: 2000, tax_paid: 750, net_payable: 1250, status: 'draft', notes: null, payment_reference: null },
      { id: 'ret-q2', period_name: 'Q2 2026', period_start: '2026-04-01', period_end: '2026-06-30', due_date: '2026-07-31', tax_collected: 500, tax_paid: 900, net_payable: -400, status: 'filed', notes: 'CRA filing confirmation ABC12345 (filed on Represent a Client, 2026-07-20)', payment_reference: null },
    ],
  }),
  useUpdateTaxReturn: () => ({ mutateAsync: updateReturn }),
}));

function renderAt(element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/page']}>
      <Routes>
        <Route path="/page" element={element} />
        <Route path="/tax-cra/payments" element={<div>CRA Payments page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  linked = new Map();
  startPayment.mockClear();
  updateReturn.mockClear();
});

describe('Tax & CRA payroll page', () => {
  it('lists PD7A remittances and starts a linked CRA payment', async () => {
    renderAt(<CraPayrollTax />);
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText('CRA confirmation CRA-5566')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pay with CRA My Payment' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pay with CRA My Payment' }));
    await waitFor(() => expect(startPayment).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'pd7a', id: 'rem-oct', amount: 888.68, periodStart: '2026-10-01', periodEnd: '2026-10-31', periodLabel: 'October 2026', dueDate: '2026-11-16',
    })));
    expect(await screen.findByText('CRA Payments page')).toBeInTheDocument();
  });

  it('shows the linked CRA payment instead of a second pay button', () => {
    linked = new Map([['rem-oct', { id: 'p1', reference: 'EF-CRA-000007', workflow_status: 'awaiting_authorization', remittance_id: 'rem-oct', tax_return_id: null, confirmation_number: null }]]);
    renderAt(<CraPayrollTax />);
    expect(screen.getByText('EF-CRA-000007')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Authorization')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with CRA My Payment' })).not.toBeInTheDocument();
  });
});

describe('Tax & CRA GST/HST page', () => {
  it('lists returns, offers pay only when tax is owing, and shows the filing confirmation', () => {
    renderAt(<CraGstHst />);
    expect(screen.getByText('Q3 2026')).toBeInTheDocument();
    expect(screen.getByText('Filing ABC12345')).toBeInTheDocument();
    expect(screen.getByText('Refund')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pay' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'File on CRA' })).toHaveLength(1);
  });

  it('records a filing made on CRA against the return', async () => {
    renderAt(<CraGstHst />);
    fireEvent.click(screen.getByRole('button', { name: 'File on CRA' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Confirmation number'), { target: { value: 'CRA-998877' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record filing' }));
    await waitFor(() => expect(updateReturn).toHaveBeenCalled());
    const call = updateReturn.mock.calls[0][0];
    expect(call).toMatchObject({ id: 'ret-q3', organizationId: 'org-1', updates: { status: 'filed', filed_by: 'user-1' } });
    expect(call.updates.notes).toContain('CRA filing confirmation CRA-998877');
  });
});

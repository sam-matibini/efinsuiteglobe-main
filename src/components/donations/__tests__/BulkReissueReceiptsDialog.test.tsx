import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BulkReissueReceiptsDialog } from '../BulkReissueReceiptsDialog';
import type { DonationReceipt } from '@/types/donations';

// Mock the hooks
vi.mock('@/hooks/useDonations', () => ({
  useBulkReissueReceipts: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCurrencyFormatter', () => ({
  useCurrencyFormatter: () => ({
    formatWithSymbol: (v: number) => `$${v.toFixed(2)}`,
  }),
}));

const makeReceipt = (overrides: Partial<DonationReceipt> = {}): DonationReceipt => ({
  id: 'r-1',
  organization_id: 'org-1',
  receipt_number: 'REC-00001',
  donation_id: 'don-1',
  is_consolidated: false,
  charity_legal_name: 'Charity A',
  charity_bn: '123456789RR0001',
  charity_address: '123 Main St',
  donor_name: 'Alice',
  donor_address: '456 Elm St',
  date_of_donation: '2025-01-01',
  date_of_issue: '2025-01-05',
  location_issued: 'Ottawa',
  amount: 100,
  eligible_amount: 100,
  advantage_value: 0,
  advantage_description: null,
  status: 'issued',
  signatory_name: 'John',
  signatory_position: 'Director',
  cra_disclaimer: '',
  replaces_receipt_id: null,
  replaced_by_receipt_id: null,
  document_url: null,
  created_at: '',
  updated_at: '',
  created_by: null,
  issued_at: '',
  issued_by: null,
  cancelled_at: null,
  cancelled_by: null,
  cancellation_reason: null,
  is_locked: false,
  ...overrides,
});

function renderDialog(receipts: DonationReceipt[] = [makeReceipt()]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BulkReissueReceiptsDialog
        open={true}
        onOpenChange={vi.fn()}
        receipts={receipts}
        onComplete={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe('BulkReissueReceiptsDialog', () => {
  it('renders dialog title and description', () => {
    renderDialog();
    expect(screen.getByText(/Bulk Reissue/i)).toBeInTheDocument();
    expect(screen.getByText(/Reissue 1 selected receipt/i)).toBeInTheDocument();
  });

  it('shows receipt list with receipt number and donor name', () => {
    renderDialog([makeReceipt(), makeReceipt({ id: 'r-2', receipt_number: 'REC-00002', donor_name: 'Bob', amount: 200 })]);
    expect(screen.getByText('REC-00001')).toBeInTheDocument();
    expect(screen.getByText('REC-00002')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows total amount for selected receipts', () => {
    renderDialog([makeReceipt({ amount: 100 }), makeReceipt({ id: 'r-2', amount: 250 })]);
    expect(screen.getByText(/\$350\.00/)).toBeInTheDocument();
  });

  it('disables submit button when reason is empty', () => {
    renderDialog();
    const submitBtn = screen.getByRole('button', { name: /Reissue 1 Receipt/i });
    expect(submitBtn).toBeDisabled();
  });

  it('has correction fields for charity name, BN, address, signatory', () => {
    renderDialog();
    expect(screen.getByText(/Charity Legal Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Business Number/i)).toBeInTheDocument();
    expect(screen.getByText(/Charity Address/i)).toBeInTheDocument();
    expect(screen.getByText(/Signatory Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Signatory Position/i)).toBeInTheDocument();
  });
});

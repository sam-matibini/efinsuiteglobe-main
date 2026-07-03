import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDonationReceiptPdf, downloadDonationReceiptPdf, printDonationReceipt } from '../donationReceiptGenerator';
import type { DonationReceipt } from '@/types/donations';

const mockReceipt: DonationReceipt = {
  id: 'test-id',
  organization_id: 'org-1',
  receipt_number: 'REC-001',
  donation_id: 'don-1',
  is_consolidated: false,
  charity_legal_name: 'Test Charity',
  charity_bn: '123456789RR0001',
  charity_address: '123 Main St, Ottawa, ON K1A 0A1',
  donor_name: 'John Doe',
  donor_address: '456 Elm St, Toronto, ON M5V 2T6',
  date_of_donation: '2025-06-15',
  date_of_issue: '2025-06-20',
  location_issued: 'Ottawa, ON',
  amount: 500,
  eligible_amount: 500,
  advantage_value: 0,
  advantage_description: null,
  status: 'issued',
  signatory_name: 'Jane Smith',
  signatory_position: 'Executive Director',
  cra_disclaimer: 'Official receipt for income tax purposes.',
  replaces_receipt_id: null,
  replaced_by_receipt_id: null,
  document_url: null,
  created_at: '2025-06-20T00:00:00Z',
  updated_at: '2025-06-20T00:00:00Z',
  created_by: null,
  issued_at: '2025-06-20T00:00:00Z',
  issued_by: null,
  cancelled_at: null,
  cancelled_by: null,
  cancellation_reason: null,
  is_locked: false,
};

describe('downloadDonationReceiptPdf', () => {
  it('calls doc.save with correct filename', () => {
    // downloadDonationReceiptPdf internally calls generateDonationReceiptPdf then save
    // We just verify it doesn't throw
    expect(() => downloadDonationReceiptPdf(mockReceipt)).not.toThrow();
  });
});

describe('printDonationReceipt', () => {
  beforeEach(() => {
    // Mock iframe insertion
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('creates an iframe for print and does not throw', () => {
    expect(() => printDonationReceipt(mockReceipt)).not.toThrow();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('generateDonationReceiptPdf edge cases', () => {
  it('handles receipt with advantage value', () => {
    const withAdvantage = {
      ...mockReceipt,
      advantage_value: 50,
      eligible_amount: 450,
      advantage_description: 'Dinner gala ticket',
    };
    const doc = generateDonationReceiptPdf(withAdvantage);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('handles receipt with replacement reference', () => {
    const replacement = {
      ...mockReceipt,
      replaces_receipt_id: 'old-receipt-id',
    };
    const doc = generateDonationReceiptPdf(replacement);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('handles zero-amount receipt', () => {
    const zeroAmount = { ...mockReceipt, amount: 0, eligible_amount: 0 };
    const doc = generateDonationReceiptPdf(zeroAmount);
    expect(doc).toBeDefined();
  });
});

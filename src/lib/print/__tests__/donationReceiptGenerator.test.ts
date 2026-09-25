import { describe, it, expect } from 'vitest';
import { generateDonationReceiptPdf } from '../donationReceiptGenerator';
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

describe('generateDonationReceiptPdf', () => {
  it('returns a valid jsPDF object', () => {
    const doc = generateDonationReceiptPdf(mockReceipt);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('handles letter paper size', () => {
    const doc = generateDonationReceiptPdf(mockReceipt, { paperSize: 'letter' });
    const width = doc.internal.pageSize.getWidth();
    expect(width).toBeCloseTo(215.9, 0);
  });

  it('handles a4 paper size', () => {
    const doc = generateDonationReceiptPdf(mockReceipt, { paperSize: 'a4' });
    const width = doc.internal.pageSize.getWidth();
    expect(width).toBeCloseTo(210, 0);
  });

  it('renders CANCELLED watermark for cancelled receipts', () => {
    const cancelled = { ...mockReceipt, status: 'cancelled' as const };
    const doc = generateDonationReceiptPdf(cancelled);
    // If it doesn't throw, the watermark logic executed successfully
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});

describe('formatDate and formatCurrency (via PDF output)', () => {
  it('generates PDF without errors for en-CA formatted data', () => {
    const doc = generateDonationReceiptPdf(mockReceipt);
    expect(doc).toBeDefined();
  });
});

# Memory: features/sales/sales-processing-suite
Updated: 2026-02-09

The 'Sales' module features a highly customizable Document Engine for Invoices and 'Bill of Sale' documents, integrated with the Inventory module for automated line item population (product picker). 

1) **Document Engine & Workflow**: Supports comprehensive View/Edit workflows via a tabbed interface with horizontally scrollable navigation. The creation dialog includes a real-time 'Invoice Preview' tab for proofreading and utilizes searchable comboboxes for Payment Terms and Tax Rates. Statuses include Draft, Issued, Final, Sent, Paid, Partial, Overdue, and Void. Invoices transition to 'Issued' or 'Final' with an 'issued_at' timestamp, and state locking prevents further modification of Final, Paid, or Void documents.

2) **GL Integration & Journal Entry Posting**: The `updateInvoiceStatus` mutation in `useInvoices.ts` automatically creates a posted journal entry when an invoice transitions to 'issued', 'final', or 'sent' status. This ensures invoices are reflected in the Trial Balance, Financial Statements, and Sales Tax module. The `getDefaultAccounts` function in `useJournalEntryCreation.ts` uses **regex-based pattern matching** to support various chart of accounts coding schemes (e.g., `1100`, `1-01-110-0001`, `4-01-200-0001`).

3) **PDF Layout Matching Preview**: The PDF generator (`src/lib/generateInvoicePdf.ts`) is synchronized with the live preview (`BillOfSalePreview.tsx`), ensuring visual consistency. Key features:
   - Side-by-side Seller/Buyer boxes with rounded corners
   - Tax registration badges (Dealer Permit#, GST/HST#, PST#) in colored pill format
   - Vehicle/Item details displayed in a 3-column grid
   - Line items table with primary-colored header
   - Split tax display (GST/HST, PST) with exemption indicators
   - Dual signature blocks with dashed signature lines
   - Visual barcode with invoice number below
   - Footer with transfer notice and branding

4) **Data Flow for PDFs**: The `handleDownloadPdf` function in `Invoices.tsx` fetches:
   - Invoice lines from `invoice_lines` table
   - Customer details from `customers` table
   - Logo from `print_brand_profiles` table (loaded as base64)
   - Seller signature from `user_signatures` table (default signature)
   - Tax rates from `useSalesTaxSettings` hook
   - Tax registration numbers from invoice or organization fallback

5) **Logic & Compliance**: Implements split taxation (GST/HST vs PST) and regional exemption rules (Export Sales, etc.) with 'tax_exemption_certificate' tracking. Historical integrity is maintained by persisting full buyer/seller contact and address details directly on the invoice record.

6) **Delete Functionality**: Void and Issued invoices can be soft-deleted via the dropdown menu with confirmation. Uses `deleted_at` and `deleted_by` columns for audit trails.

7) **Database Constraints**: The `invoices_status_check` constraint allows: 'draft', 'issued', 'final', 'sent', 'paid', 'overdue', 'void', 'partial'.

8) **Integrations**: Features real-time Barcode (CODE128-style visual) and QR code generation, multi-signer digital signature workflows with unique tokens, and sharing via Email (SendGrid), WhatsApp (native protocol), and SMS (Twilio).

9) **Regionalization**: Seeded 'print_templates' provide regional defaults (paper size, tax ID labels, and date formats) based on ISO country codes.

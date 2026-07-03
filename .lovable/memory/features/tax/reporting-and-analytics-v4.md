# Memory: features/tax/reporting-and-analytics-v4
Updated: 2026-02-09

The Sales Tax module provides real-time 'Current Tax Balances' derived from General Ledger accounts, supporting comprehensive reporting for CRA GST/HST and provincial taxes (PST/QST) for Canadian organizations, as well as VAT and sales tax for international jurisdictions.

## Account Classification Logic
The system identifies tax accounts by name patterns:
- **Collected (Liability)**: Accounts containing 'GST/HST Payable', 'GST/HST Collected', 'VAT Payable', 'TVA Collectée'
- **Paid (Input Tax Credits)**: Accounts containing 'ITC', 'Input Tax', 'GST/HST Paid', 'TVA Déductible'
- **Provincial (PST/QST)**: Accounts containing 'PST' or 'QST' with 'Payable' or 'Collected'

This classification logic in both `TaxReportPreview` and `SalesTax.tsx` now properly recognizes:
- 'GST/HST Payable' as collected tax (liability)
- 'GST/HST Input Tax Credits (ITC)' as paid/deductible tax
- 'PST Payable' or 'QST Payable' as provincial tax

## Tax Summary Tab
The Tax Summary tab is fully activated with:
1. **Category Tabs** (Canada only): CRA GST/HST vs Provincial (PST/QST)
2. **Real-time GL Balances**: Cards showing Collected, Paid (ITCs), Net Payable, and Refund/Owing indicator
3. **Account Breakdown Table**: Detailed table showing all tax accounts with code, type badge, and balance
4. **Filed Returns Summary**: Annual summary from tax_returns table (when available)

## Tax Report Preview
The `TaxReportPreview` component enables users to preview and download detailed reports (Summary, Detailed Transactions, or Account Breakdown) with:
- 'Refund / Owing' line indicator with color coding
- 'Compare With' feature for period-over-period or year-over-year analysis
- PDF export with category-specific naming (gst-hst or pst prefix)
- Filter by tax category, date range, account type, and specific tax codes

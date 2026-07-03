# Memory: features/donation-management/core-architecture-v2
Updated: 2026-01-26

The Donation Management Module is a CRA and CPA Canada NPO-compliant system for managing charitable organizations.

## Routing & Navigation
- Route: `/donations` (protected, with PageWrapper)
- Sidebar: Heart icon under Payroll, before DocSign

## Core Database Schema (donation_* prefix)
- `donation_programs` - Charitable programs/activities with budgets
- `donation_funds` - Unrestricted/Restricted/Endowment funds with fund accounting
- `donation_campaigns` - Fundraising initiatives with goals and tracking
- `donations` - Individual donation transactions linked to donors (Customers)
- `donation_receipts` - CRA-compliant tax receipts with locking after issuance
- `donation_pledges` - Promised donations (not receipted until fulfilled)
- `donation_in_kind` - Non-cash gifts with FMV tracking
- `donation_designations` - Multi-program/fund allocation
- `donation_audit_logs` - Complete audit trail for CRA review
- `donor_preferences` - CASL/PIPEDA consent, receipt preferences

## CRA Compliance Features
1. **Split Receipting**: Eligible Amount = Donation Amount – Advantage Value
2. **Receipt Locking**: Receipts are locked after issuance (is_locked trigger)
3. **Sequential Numbering**: DON-XXXXX, REC-XXXXX, PLG-XXXXX patterns
4. **No Backdating**: Receipts cannot be issued before donation date
5. **Cancelled Receipt Retention**: Cancelled receipts retained for 6+ years
6. **Pledge Restriction**: No receipts until pledge is fulfilled

## Fund Accounting (CPA Canada Part III)
- Unrestricted: Revenue immediately
- Restricted: Deferred until used
- Endowment: Principal preserved
- Designated: Board-designated

## Key Hooks (src/hooks/useDonations.ts)
- useDonations, useCreateDonation, useConfirmDonation
- useDonationReceipts, useIssueReceipt
- useDonationPrograms, useDonationFunds, useDonationCampaigns
- useDonationPledges, useDonorPreferences, useDonationStats

## UI Components (src/components/donations/)
- RecordDonationDialog - Multi-field donation entry with split receipting
- IssueReceiptDialog - CRA-compliant receipt generation
- AddProgramDialog, AddFundDialog, AddCampaignDialog, AddPledgeDialog

## Integration Points
- Customers module: Donors linked via donor_id
- Banking module: bank_transaction_id for matching
- GL: journal_entry_id for double-entry posting
- Documents: document_url for receipt PDFs

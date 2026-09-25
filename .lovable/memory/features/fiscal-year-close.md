# Memory: features/fiscal-year-close
Updated: now

## Fiscal Year Close Mechanism - GAAP/IFRS/ASPE Compliant

The app now includes a **manual fiscal year close** feature that ensures the Balance Sheet equation (Assets = Liabilities + Equity) remains balanced across all periods.

### Fiscal Year Configuration
Organizations can configure their fiscal year end month via Settings (e.g., `fiscal_year_end_month = 9` for September). The system now respects this setting:
- For FY ending September (month 9): FY2024 runs Oct 1, 2023 to Sep 30, 2024
- For calendar year (month 12): FY2024 runs Jan 1, 2024 to Dec 31, 2024

### Problem Solved
Prior to this feature, unclosed fiscal years caused the Balance Sheet to be out of balance because:
- Temporary accounts (Income/Expense) accumulated activity across multiple years
- The net income from prior years was not transferred to Retained Earnings
- This caused a difference in the accounting equation equal to the pre-fiscal-year net income

### Schema Components
1. **`fiscal_year_closes` table**: Tracks closed fiscal years with audit trail
   - Records fiscal year, net income transferred, closing journal entry ID
   - RLS policies enforce organization-level access

2. **`close_fiscal_year()` function**: Performs the year-end close
   - Creates closing journal entries to zero out all income/expense accounts
   - Transfers net income/loss to Retained Earnings
   - Records the close for audit purposes
   - Recalculates all account balances

3. **`get_unclosed_fiscal_years()` function**: Returns prior years needing close
   - Uses organization's `fiscal_year_end_month` to calculate correct fiscal periods
   - Identifies years with transaction activity
   - Shows net income and closed status for each year

### UI Components
- **`useFiscalYearClose` hook**: Fetches unclosed years, close history, and performs close
- **`FiscalYearCloseDialog`**: Modal showing years needing close with "Close Year" action
- **Balance Sheet integration**: Warning banner when unclosed years cause imbalance

### Usage
1. Navigate to Balance Sheet
2. If out of balance due to unclosed years, a warning banner appears
3. Click "Fiscal Year Close" or "Close Year" button
4. Select the fiscal year to close and confirm
5. System creates closing journal entry and updates all balances

### GAAP Compliance
This follows standard year-end closing procedures per GAAP/IFRS/ASPE:
- All temporary accounts are closed to a permanent equity account (Retained Earnings)
- Closing entries are dated on the fiscal year end date
- Full audit trail maintained

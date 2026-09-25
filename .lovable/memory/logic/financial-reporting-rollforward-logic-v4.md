# Memory: logic/financial-reporting-rollforward-logic-v4
Updated: 2026-01-20

The financial reporting system (src/hooks/useFinancialReports.ts, src/hooks/useComparativeFinancialReports.ts) handles fiscal year closing entries (prefixed with 'CLOSE-') with conditional logic: closing entries are excluded from calculations only when their fiscal year matches the reporting period. This ensures 'Retained Earnings' correctly rolls forward prior year net income into the next year's opening balance while 'Current Year Earnings' isolates current period performance without double-counting. Period-specific date filtering is applied to temporary accounts to ensure 'Assets = Liabilities + Equity + Current Year Earnings' remains balanced.

## Zoho Books Verified Formula Implementation

### Shareholders' Equity Section Logic
**Formula for Retained Earnings rollforward:**
- **Opening RE (Year N)** = Opening RE (Year N-1) + Net Income (Year N-1)
- **Current Year Earnings** = Period-specific Net Income (from Income Statement)

### CLOSE-* Entry Handling (Critical Logic)
1. **Prior year closing entries ARE included in RE for subsequent years**
2. **Same year closing entries ARE EXCLUDED to prevent double-counting with Current Year Earnings**

Example: `CLOSE-2024` entry on 2024-12-31:
- **2024 Balance Sheet**: EXCLUDED (CYE shows 2024 P&L separately)
- **2025 Balance Sheet**: INCLUDED (it's part of 2025 opening RE)

### Temporary Account Handling
- Excludes ALL CLOSE-* entries when calculating Income Statement balances
- Calculates 'Current Year Earnings' using period-specific date range

### Balance Sheet Equation (GAAP/ASPE/IFRS Compliant)
```
Assets = Liabilities + Equity + Current Year Earnings
```
- Retained Earnings reflects cumulative prior closed years
- Current Year Earnings reflects only selected period's P&L

### DAPRO Trading Verified Values (Zoho Books Reference)
| Year | Common Stock | Retained Earnings (Opening) | Current Year Earnings | Total Equity |
|------|-------------|----------------------------|----------------------|--------------|
| 2024 | $100 | ($283,813) | ($20,743) | ($304,456) |
| 2025 | $100 | ($304,556) | $51,282.15 | ($253,173.85) |

**Rollforward Verification:**
- 2025 Opening RE = 2024 Opening RE + 2024 Net Income
- ($304,556) = ($283,813) + ($20,743) ✓

### Multi-Country/Localization Support
The financial reporting logic applies consistently across all supported countries (Canada, USA, Zambia, Kenya, Burundi) with:
- Currency formatting per `countryLocalizations.ts`
- Accounting standards per country (GAAP/ASPE for CA, GAAP for US, IFRS for others)
- Organization-level isolation via `organization_id` filtering

# Memory: compliance/canadian-asnpo-standards
Updated: now

Canadian ASNPO (Accounting Standards for Not-for-Profit Organizations) support includes specialized Chart of Accounts and automated terminology mapping (e.g., 'Statement of Operations', 'Statement of Changes in Net Assets') across all financial reports and the AI Compilation engine. When 'isNpoIndustry' is true, labels dynamically update to ensure consistent NPO branding and compliance. Terminology is localized by country code, defaulting to Canadian (CA) standards.

## ASNPO Compilation Report Terminology
All three compilation generators (generateCompilationPdfEnhanced.ts, generateCompilationPdf.ts, generateCompilationWord.ts) now detect `accounting_framework === 'ASNPO'` and apply a terminology map (`t` object) that replaces ASPE/for-profit terms:
- "Balance Sheet" → "Statement of Financial Position"
- "Statement of Income" → "Statement of Operations"
- "Statement of Retained Earnings" → "Statement of Changes in Net Assets"
- "Statement of Changes in Equity" → "Statement of Changes in Net Assets"
- "Shareholders' Equity" / "Equity" → "Net Assets"
- "Net Income" → "Excess (Deficiency) of Revenue over Expenses"
- "Current Year Earnings" → "Excess (Deficiency) of Revenue over Expenses"
- "Profit Before Tax" → "Excess (Deficiency) Before Other Items"
- "Common Shares" → "" (hidden — NPOs have no share capital)
- "Retained Earnings" → "Unrestricted Net Assets"
- "Share issuances" → "Contributions"
- "the company" → "the organization"
- Framework name: "Canadian accounting standards for not-for-profit organizations (ASNPO)"
- Compilation engagement report text references correct ASNPO statement names
- Equity account matching uses NPO terms (unrestricted net assets, accumulated surplus, unrestricted funds)

## ASNPO Statement of Changes in Net Assets (SOCE)
For ASNPO, the SOCE uses a simplified column structure:
- Column 1 (hidden): Share capital column is skipped entirely — NPOs have no share capital
- Column 2: "Unrestricted Net Assets" — all equity movements flow through this single column
- Column 3: "Total Net Assets" — mirrors the unrestricted column when no restricted funds exist
- The `commonShares` equity matcher is set to `undefined` for ASNPO to prevent double-counting
- The `retainedEarnings` matcher maps to "Unrestricted Net Assets" / "Accumulated Surplus" accounts
- Opening balances, contributions, excess/deficiency, and closing balances all flow through the unrestricted column

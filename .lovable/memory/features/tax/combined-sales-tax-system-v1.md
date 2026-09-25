# Memory: features/tax/combined-sales-tax-system-v1
Updated: now

The application implements a comprehensive Canadian split tax system supporting three tax models:

## Tax Models
- **GST_ONLY**: Alberta, NT, NU, YT (GST 5% only)
- **GST_PST**: BC, SK, MB, QC (GST 5% + PST/QST separately - requires separate GL posting)
- **HST**: ON, NB, NL, NS, PE (single combined tax)

## Core Design Principle
⚠️ **CRITICAL**: Taxes are always CALCULATED and POSTED separately. Combined rate is for DISPLAY only.

## Database Schema
- `jurisdictions.tax_model` - Identifies tax model per province (GST_ONLY, GST_PST, HST)
- `jurisdictions.requires_separate_pst_accounting` - Boolean flag for PST provinces
- `tax_types.tax_authority` - CRA vs Provincial vs Revenu Quebec
- `tax_codes.is_combined` - Marks combined display codes (GST+PST)
- `tax_codes.component_tax_codes` - JSONB array of component taxes
- `invoice_taxes` / `bill_taxes` / `expense_taxes` - Store split tax breakdown per document
- `combined_tax_rates` VIEW - Provides combined rate with breakdown for UI

## Key Files
- `src/lib/splitTaxCalculator.ts` - Core calculation engine with separate GST/PST computation
- `src/lib/taxCalculator.ts` - Global tax calculator (now integrates split tax for CA)
- `src/components/tax/SplitTaxDisplay.tsx` - UI component for split/combined tax display
- `src/components/tax/CombinedTaxRateCombobox.tsx` - Province selector with tax model badges
- `src/hooks/useCombinedTaxRates.ts` - Fetches from combined_tax_rates view

## Database Function
`calculate_split_taxes(amount, jurisdiction_code, is_inclusive)` - Returns JSONB with:
- taxable_amount, tax_model, jurisdiction_code
- total_tax, gross_amount, combined_rate
- taxes[] array with type, code, rate, amount, is_recoverable, authority

## UI Toggle
Organizations have `show_combined_tax_display` preference. When enabled, UI shows "Tax (12%)" instead of "GST 5% + PST 7%".

## Compliance
- GST/HST reported to CRA
- PST reported to provincial authority (except QST which goes to Revenu Québec)
- QST is recoverable (ITR), other PST is not (expense/capitalize)

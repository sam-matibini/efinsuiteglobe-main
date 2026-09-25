# Memory: features/reports/excel-export-formatting
Updated: 2026-01-20

Financial reports export to Excel with professional formatting:

## Excel Export Features
1. **Numeric Formatting**: Numbers use comma separators (`#,##0.00`) and are stored as actual numbers, not text
2. **Right Alignment**: All numeric columns are right-aligned in Excel
3. **Total Row Styling**: Total rows have borders above (thin) and below (double) for accounting presentation
4. **Section Headers**: Bold formatting for section headers
5. **Header Row**: Bold with background color and bottom border

## Implementation
- `src/lib/excelExport.ts`: Central utility for formatted Excel exports
- Parses formatted currency strings back to numbers
- Detects total rows based on keywords (Total, Net Income, Gross Profit, etc.)
- Applies XLSX cell styles for number formatting and alignment

## Files Using Formatted Export
- `src/components/reports/ReportActions.tsx` - Main export utility for all reports via ReportData interface
- `src/pages/CashFlow.tsx` - Uses exportToFormattedExcel
- `src/pages/GeneralLedger.tsx` - Custom export with number formatting applied

## Data Integrity
All exported amounts are read directly from the database via the financial reporting hooks:
- `useFinancialReports` - Current period data
- `useComparativeFinancialReports` - Comparative period data
- Account balances calculated using GAAP-compliant double-entry logic

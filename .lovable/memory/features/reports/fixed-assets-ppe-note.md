# Memory: features/reports/fixed-assets-ppe-note
Updated: 2026-01-25

## Property, Plant & Equipment Note in Compilation Report

The AI Compilation Report Generator now includes an automated Property, Plant & Equipment note (Note 8) that follows ASPE Section 3061 disclosure requirements.

### Features

1. **Automatic Asset Classification**: Assets are grouped by class (Land, Buildings, Equipment, Vehicles, Furniture & Fixtures, Computer Hardware, Machinery)

2. **ASPE-Compliant Table**: Displays:
   - Asset Class
   - Cost ($)
   - Accumulated Amortization ($)
   - Current Year Net Book Value ($)
   - Prior Year Net Book Value ($) (if comparative)

3. **Depreciation Methods Disclosure**: Lists depreciation methods and rates for each asset class:
   - Straight-line: Shows rate and useful life in years
   - Declining balance: Shows annual rate percentage

4. **Additions Note**: Automatically calculates and displays asset additions during the current and prior periods

5. **Impairment Disclosure**: Includes standard impairment note per ASPE 3063

### Data Source

- Fixed assets are fetched from `fixed_assets` table via `useFixedAssets` hook
- Data includes: acquisition_cost, accumulated_depreciation, depreciation_method, declining_rate, useful_life_months

### Implementation Files

- `src/lib/generateCompilationPdfEnhanced.ts`: PDF rendering of PPE note table
- `src/pages/AccountantDashboard.tsx`: `buildFixedAssetsNoteData()` function that aggregates fixed assets by class
- `src/lib/generateCompilationPdfEnhanced.ts`: `FixedAssetsNoteSection` and `FixedAssetNoteData` interfaces

### Sample Output Format

```
8. Property, Plant and Equipment

Property, plant, and equipment are recorded at cost. Amortization is provided over 
the estimated useful lives of the assets using the following methods and rates:

• Vehicles: 30% declining balance
• Equipment: 20% (5 years) straight-line
• Furniture & Fixtures: 10% (10 years) straight-line

Asset Class          Cost ($)    Accumulated     2025 Net       2024 Net
                                 Amortization    Book Value     Book Value
─────────────────────────────────────────────────────────────────────────
Vehicles              80,000        30,000         50,000         60,000
Equipment            250,000       100,000        150,000        120,000
Furniture & Fixtures  50,000        20,000         30,000         35,000
─────────────────────────────────────────────────────────────────────────
Total                380,000       150,000        230,000        215,000
═══════════════════════════════════════════════════════════════════════

During the year, the company acquired equipment with a total cost of $50,000 (2024: $20,000).

• Impairment: No impairment loss was recognized in the current year (2024: $nil).
```

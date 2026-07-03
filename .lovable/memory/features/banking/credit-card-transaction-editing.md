# Memory: features/banking/credit-card-transaction-editing
Updated: now

The credit card transactions module includes full edit, categorize, and post-to-GL functionality. Users can modify description, payee/payor, reference, category, and GL account directly via a dialog. The interface supports:

- **Entity Selection**: Toggle between Vendor, Customer, or Manual Entry modes with searchable dropdowns for vendors/customers
- **Quick Add**: Add new vendors/customers with full contact details (name, email, phone, address line 1 & 2, city, province, postal code, country) directly from the edit dialog
- **Tax Integration**: Searchable tax code selection with tax-inclusive/exclusive toggle and automated tax breakdown calculations
- **Unified GL Account**: Single GL account selector for both categorization and GL posting, ensuring consistent reporting
- **Scrollable Dialog**: Both bank and credit card edit dialogs use ScrollArea for long content with max-h-[65vh] to ensure usability on smaller screens
- **Actions**: "Save Changes" for updates only, or "Save & Post to GL" for immediate ledger integration

The vendor quick-add supports both Organization and Individual types. All quick-add dialogs include ScrollArea for long forms.

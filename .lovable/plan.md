## Goal
Make dropdown fields on the **Edit Employee** dialog searchable (type-to-filter), starting with the Employment tab shown in the screenshot and extending across the whole form.

## Approach
Introduce a reusable `SearchableSelect` component (built on the existing shadcn `Command` + `Popover` primitives) that keeps the same value/onChange API as the current `Select`, so swapping is a minimal edit. It will:
- Render a trigger identical in style to `SelectTrigger`
- Open a popover with a `CommandInput` search box, filtered `CommandItem` list, and empty state
- Support placeholder, disabled state, and `max-h-72` scroll

## Fields to convert in `src/components/employees/EditEmployeeDialog.tsx`
Employment tab:
- Job Site / Location (from `useJobSites`)
- State / Province (jurisdictions list)
- Employment Type
- Pay Frequency
- Status

Personal tab:
- Country / any locale selects present

Compensation tab:
- Currency selector, pay type / rate unit selects

Guarantors tab:
- Sex, Status, Relationship, State/Prov, Country selects inside `GuarantorForm.tsx`

Text `Input` fields (Job Title, Department, Hire Date, names, phone, addresses) stay as-is — they're already free-text and don't need a searchable control.

## Technical notes
- New file: `src/components/ui/searchable-select.tsx`
- Uses existing `@/components/ui/command` and `@/components/ui/popover`
- Preserves current form state shape — no changes to `formData` or save handlers
- Long lists (job sites, provinces, countries, Nigerian states) benefit most; short enums (4 options) still get consistent UX

## Out of scope
- No DB or business-logic changes
- No changes to Add Employee dialog unless you want it mirrored (say the word and I'll include it)

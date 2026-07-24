## Add Bulk Employee Upload to Dashboard Quick Actions

Add a new tile to the `QuickActionsGrid` on the Dashboard that links to `/payroll/employees/bulk-upload`.

### Changes

**`src/components/dashboard/QuickActionsGrid.tsx`**
- Add a new `QuickAction` entry:
  - Label: "Bulk Upload"
  - Icon: `Upload` (lucide-react)
  - Path: `/payroll/employees/bulk-upload`
  - Description: "Import employees"
  - Color: `bg-chart-4/10 text-chart-4 hover:bg-chart-4/20`
  - `requiredModules: ['payroll']`
  - `isAction: true` (hidden for read-only auditors)

### Notes
- Role gating (admin-only) is enforced on the destination page itself, so the tile stays visible to any payroll user; they'll see the gate if unauthorized. If you'd rather hide the tile entirely for non-admins, say the word and I'll add a role check in the filter.

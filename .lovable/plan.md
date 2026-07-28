## Goal
Make Divisions & Departments discoverable from Settings without duplicating logic.

## Changes

### 1. New wrapper component
`src/components/settings/DivisionsSettingsTab.tsx`
- Renders the existing `Divisions` page component (from `src/pages/Divisions.tsx`) inline.
- Adds a small header card with two shortcut buttons:
  - "Open full Divisions page" → `/divisions`
  - "Manage user access by division" → `/division-access`
- No business-logic changes; purely a settings-surface wrapper.

### 2. Settings.tsx integration
`src/pages/Settings.tsx`
- Import `Building2` icon and `DivisionsSettingsTab`.
- Add a new `<TabsTrigger value="divisions">` next to Organization (Divisions belong to org structure).
- Add matching `<TabsContent value="divisions">` that renders `<DivisionsSettingsTab />`.

### 3. No route, hook, DB, or permission changes
The existing `/divisions` and `/division-access` routes, `useDepartments` hook, and RLS remain untouched.

## Result
Users can go to **Settings → Divisions** to add/edit divisions (departments), toggle postings/active state, and jump to per-user division access — while the standalone `/divisions` page keeps working as before.
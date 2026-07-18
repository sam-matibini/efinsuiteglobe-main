# Optimize organization switching

## Goal
Switching organizations should feel instant: land on the dashboard, refresh org-scoped data, and skip the current full-app reload (`window.location.assign('/')`) that re-boots React, re-runs auth, re-parses bundles, and refetches everything from scratch.

## Approach
Keep the app mounted. Update the current-org state, invalidate React Query caches, and navigate to `/` via React Router.

### Changes

1. **`src/hooks/useOrganizationContext.tsx`**
   - Remove `window.location.assign('/')`.
   - Replace `queryClient.clear()` with `queryClient.invalidateQueries()` so cached UI (shadcn state, layout, user profile) stays warm while org-scoped queries refetch. `clear()` throws away everything including non-org data; `invalidateQueries` is enough because every org-scoped query already keys on `currentOrganization.id`.
   - Expose the switch as-is; navigation is handled by the caller so this hook stays router-agnostic.

2. **`src/components/layout/SearchableOrgSwitcher.tsx`** (the actual caller)
   - After `onSwitch(org)`, call `navigate('/')` from `react-router-dom`'s `useNavigate`. Only navigate if not already on `/` to avoid a redundant transition.

3. **Sanity check org-scoped query keys**
   - Quick pass over `src/hooks/**` to confirm queries that depend on the current org include `currentOrganization?.id` in their `queryKey`. Any that don't would show stale data after switch — those get the org id added to their key. (This is a targeted audit, not a rewrite.)

### Why this is faster
- No JS re-parse, no re-hydration, no re-auth round-trip, no re-fetch of already-cached global data (roles, feature flags, currencies, etc.).
- Only org-scoped queries refetch, which is what actually needs to change.
- Route transition to `/` is a client-side render, typically <100ms vs. a multi-second cold boot.

### Out of scope
- No changes to auth, routing structure, or the org data model.
- No visual changes to the switcher.

## Technical notes
- `queryClient.invalidateQueries()` with no filter invalidates every query, triggering refetch on mount/observe. That's the desired behavior here.
- Because `currentOrganization` lives in React state and every org-scoped query key includes its id, changing it already causes React Query to treat those as new queries — invalidation is belt-and-suspenders for any keys that were missed.
- `localStorage` write stays so a hard refresh restores the last-selected org.

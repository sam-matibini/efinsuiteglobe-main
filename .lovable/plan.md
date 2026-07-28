## Problem

The Divisions settings tab links to `/division-access`, but the route is registered as `/divisions/access` in `src/App.tsx`. Clicking the link lands on the 404 page.

## Fix

Update the `Link to` in `src/components/settings/DivisionsSettingsTab.tsx` from `/division-access` to `/divisions/access` to match the registered route.

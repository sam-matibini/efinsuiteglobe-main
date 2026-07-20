## Goal
Give each Financial Statement tab a distinct, subtle color identity so users can instantly recognize which statement they're viewing.

## Color mapping
| Statement | Color | Active bg | Active text | Bottom accent |
|---|---|---|---|---|
| Balance Sheet | Blue | `bg-blue-500/10` | `text-blue-700` / `dark:text-blue-400` | `border-blue-500` |
| Income Statement | Green | `bg-emerald-500/10` | `text-emerald-700` / `dark:text-emerald-400` | `border-emerald-500` |
| Cash Flow | Teal | `bg-teal-500/10` | `text-teal-700` / `dark:text-teal-400` | `border-teal-500` |
| Changes in Equity | Purple | `bg-violet-500/10` | `text-violet-700` / `dark:text-violet-400` | `border-violet-500` |

Inactive tabs remain neutral (`text-muted-foreground`, transparent bg) with hover raising to `text-foreground`. Active tabs get the tinted background, colored text, a 2px bottom accent border in the matching color, and a subtle shadow.

## File to update
`src/components/reports/ReportsTabs.tsx` — the shared statement navigator used by `/reports/balance-sheet`, `/reports/income-statement`, `/reports/cash-flow`, `/reports/changes-in-equity`.

## Implementation
1. Add a `colorClasses` map keyed by tab `id` returning `{ active, indicator }` Tailwind class strings for the four colors above.
2. In the `.map`, compose the button `className` from:
   - base layout classes (unchanged spacing/typography/radius),
   - active branch → `colorClasses[tab.id].active` + `border-b-2` + `colorClasses[tab.id].indicator` + `shadow-sm`,
   - inactive branch → existing `text-muted-foreground hover:text-foreground` + `border-b-2 border-transparent` (so height doesn't jump when the accent appears).
3. Keep the outer container (`bg-muted/50 rounded-lg p-1`) and tab order untouched — no layout, routing, or logic changes.
4. All colors go through Tailwind's built-in palette (blue/emerald/teal/violet) which already ship in the compiled CSS; no `tailwind.config.ts` or `index.css` edits required. Light + dark variants are handled via `dark:` prefixes for WCAG contrast.

## Out of scope
- Page headers, section headings, chart colors, and any other tab groups (Management Report tabs, Tax tabs, etc.).
- Layout, spacing, typography, or routing changes.
- Icons (current tabs have no icons; not adding any).

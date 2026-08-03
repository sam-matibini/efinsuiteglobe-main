## Goal

The Preview & Validate step should show **every** transaction in one continuous scrollable list — no 20-row page slices, no clipped table — so any row can be found and corrected before import.

## Current state (verified)

- `MappingPreviewDialog.tsx` paginates at `pageSize = 20` (`paginatedData = processedData.slice(...)`) and renders the table inside `<ScrollArea className="flex-1 min-h-0 h-[calc(100vh-350px)]">` inside a `max-h-[90vh]` dialog. The fixed `calc(100vh-350px)` fights the flex layout, so the visible window is short and the last rows sit under the footer (the screenshot shows only 8 of 16 rows).
- `EditableImportPreview.tsx` (used by `CreditCardImportDialog` and `UnifiedImportDialog`) caps its table at `max-h-[380px]`, which is a small window on a tall screen.

## The work

**1. `MappingPreviewDialog.tsx`**
- Drop the page-slicing: render all of `processedData` in one scroll region. Remove the Prev/Next/"Page X of Y" footer controls and the `currentPage`/`pageSize` state.
- Fix the scroll container: dialog becomes `h-[90vh]` with `flex flex-col`; the scroll region becomes `flex-1 min-h-0` with no fixed `calc()` height, so it grows to fill whatever space the header, stats bar and footer leave.
- Make the table header `sticky top-0` with a solid background so column labels stay visible while scrolling.
- Change the counter text to `Showing all N rows` (and keep the valid/errors/corrected badges as-is).
- Keep horizontal scrolling for wide statements (many mapped columns).

**2. `EditableImportPreview.tsx`**
- Replace the fixed `max-h-[380px]` with a viewport-relative cap (`max-h-[60vh]`) so both import dialogs show far more rows on normal screens, with sticky headers on the same pattern.

## Technical notes

- Pure presentation change: no change to `rowOverrides`, validation, type-flip, "apply to all matching rows", or what gets submitted on import.
- Row counts here are statement-sized (tens to a few hundred), so plain scrolling is fine — no virtualization needed.

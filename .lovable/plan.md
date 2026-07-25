## Goal

Show a loading indicator on the **Prepare & Send** button in `SigningWorkflow` while the eFinSign proxy call is in flight, so users get feedback that their document is being sent.

## Changes

**`src/components/docsign/SigningWorkflow.tsx`**

1. Add a local `isSending` state (`useState<boolean>(false)`).
2. Make `handleSend` async: set `isSending = true`, `await onComplete(recipients, placedFields, settings)`, then reset in a `finally` block. (The parent `handleSigningWorkflowComplete` in `DocSign.tsx` is already `async`, so awaiting it will resolve after the `efinsign-proxy` call completes.)
3. Update the footer **Prepare & Send** button to:
   - `disabled={!canSend || isSending}`
   - Swap the `Send` icon for a spinning `Loader2` when `isSending` is true.
   - Change the label to `Sending…` while pending.
4. Also disable the **Previous** button and the step-progress buttons in the header while `isSending` is true so the user can't navigate away mid-send.

## Out of scope

- No changes to `handleSigningWorkflowComplete` in `DocSign.tsx` or to the proxy — the existing toasts still fire on success/error.
- No changes to the other "Prepare & Send" entry points (dropdown menu, DocumentDetailDialog); those just open the workflow.

import { createContext, useCallback, useContext, useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface ConfirmOptions {
  title?: string;
  description?: React.ReactNode;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (onConfirm: () => void | Promise<void>, options?: ConfirmOptions) => void;

const ConfirmDeleteContext = createContext<ConfirmFn | null>(null);

interface DialogState extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDeleteProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DialogState>({
    open: false,
    onConfirm: () => {},
  });

  const confirm = useCallback<ConfirmFn>((onConfirm, options) => {
    setState({ open: true, onConfirm, ...options });
  }, []);

  return (
    <ConfirmDeleteContext.Provider value={confirm}>
      {children}
      <ConfirmDeleteDialog
        open={state.open}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
        title={state.title}
        description={state.description}
        itemName={state.itemName}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        onConfirm={state.onConfirm}
      />
    </ConfirmDeleteContext.Provider>
  );
}

export function useConfirmDelete(): ConfirmFn {
  const ctx = useContext(ConfirmDeleteContext);
  if (!ctx) {
    // Fallback: if provider not mounted, run immediately (fail-open to avoid breaking flows).
    return (onConfirm) => {
      void onConfirm();
    };
  }
  return ctx;
}

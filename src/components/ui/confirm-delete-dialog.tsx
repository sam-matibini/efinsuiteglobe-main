import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Delete this item?",
  description,
  itemName,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => (!loading ? onOpenChange(o) : null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? (
              <>
                {itemName ? (
                  <>
                    You are about to delete <span className="font-semibold text-foreground">{itemName}</span>. This action cannot be undone.
                  </>
                ) : (
                  <>This action cannot be undone.</>
                )}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ConfirmDeleteDialog;

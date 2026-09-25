import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteDocument } from '@/hooks/useDocuments';

interface DeleteDocumentDialogProps {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDocumentDialog({
  documentId,
  documentTitle,
  open,
  onOpenChange,
}: DeleteDocumentDialogProps) {
  const deleteDocument = useDeleteDocument();

  const handleDelete = async () => {
    try {
      await deleteDocument.mutateAsync(documentId);
      onOpenChange(false);
    } catch {
      // Error handled by the hook
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Document
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>"{documentTitle}"</strong>?
            <br /><br />
            This will permanently remove the document and all associated data including:
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>All signature fields and collected signatures</li>
              <li>Signer information and status</li>
              <li>Audit trail records</li>
              <li>Uploaded PDF files from storage</li>
            </ul>
            <br />
            <span className="text-destructive font-medium">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDocument.isPending}>Cancel</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleteDocument.isPending}
          >
            {deleteDocument.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete Document
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

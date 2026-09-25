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
import { useState } from 'react';

interface BulkDeleteDialogProps {
  documentIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkDeleteDialog({
  documentIds,
  open,
  onOpenChange,
  onSuccess,
}: BulkDeleteDialogProps) {
  const deleteDocument = useDeleteDocument();
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    setProgress(0);
    
    try {
      for (let i = 0; i < documentIds.length; i++) {
        await deleteDocument.mutateAsync(documentIds[i]);
        setProgress(i + 1);
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error handled by the hook
    } finally {
      setIsDeleting(false);
      setProgress(0);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete {documentIds.length} Document{documentIds.length > 1 ? 's' : ''}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{documentIds.length}</strong> selected document{documentIds.length > 1 ? 's' : ''}?
            <br /><br />
            This will permanently remove:
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>All signature fields and collected signatures</li>
              <li>Signer information and status</li>
              <li>Audit trail records</li>
              <li>Uploaded PDF files from storage</li>
            </ul>
            <br />
            <span className="text-destructive font-medium">This action cannot be undone.</span>
            
            {isDeleting && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm">Deleting... {progress} of {documentIds.length}</p>
                <div className="w-full bg-background rounded-full h-2 mt-2">
                  <div 
                    className="bg-destructive h-2 rounded-full transition-all" 
                    style={{ width: `${(progress / documentIds.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button 
            variant="destructive" 
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Delete {documentIds.length} Document{documentIds.length > 1 ? 's' : ''}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

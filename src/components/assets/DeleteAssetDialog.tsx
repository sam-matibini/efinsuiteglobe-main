import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useDeleteFixedAsset, FixedAsset } from '@/hooks/useFixedAssets';

interface DeleteAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
}

export function DeleteAssetDialog({ open, onOpenChange, asset }: DeleteAssetDialogProps) {
  const deleteAsset = useDeleteFixedAsset();

  const handleDelete = async () => {
    if (!asset) return;
    await deleteAsset.mutateAsync(asset.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Fixed Asset
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this asset? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {asset && (
          <div className="py-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Asset Number:</span>
              <span className="font-mono">{asset.asset_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{asset.name}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteAsset.isPending}>
            {deleteAsset.isPending ? 'Deleting...' : 'Delete Asset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: DeleteOrganizationDialogProps) {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText.trim() === organizationName.trim() && !isDeleting;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-organization', {
        body: {
          organization_id: organizationId,
          confirm_name: confirmText.trim(),
        },
      });

      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);

      toast.success('Organization deleted');

      try {
        localStorage.removeItem('current_organization_id');
      } catch (_) {
        // ignore
      }
      queryClient.clear();

      // Small delay so toast is visible before redirect
      setTimeout(() => {
        window.location.href = '/';
      }, 400);
    } catch (err: any) {
      console.error('Delete organization failed', err);
      toast.error(err?.message || 'Failed to delete organization');
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isDeleting) return;
        if (!next) setConfirmText('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Delete organization
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                This action is <strong>permanent</strong> and cannot be undone. Deleting{' '}
                <strong>{organizationName}</strong> will remove:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>All members and pending invitations</li>
                <li>The active subscription and enabled modules</li>
                <li>All associated financial records, documents, and history</li>
              </ul>
              <p>
                To confirm, type the organization name exactly:{' '}
                <span className="font-mono text-foreground">{organizationName}</span>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-org-name">Organization name</Label>
          <Input
            id="confirm-org-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={organizationName}
            disabled={isDeleting}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

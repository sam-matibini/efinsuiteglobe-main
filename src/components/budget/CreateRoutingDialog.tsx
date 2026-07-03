import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useProductionRoutings } from '@/hooks/useProductionData';
import { Layers } from 'lucide-react';

interface CreateRoutingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoutingDialog({ open, onOpenChange }: CreateRoutingDialogProps) {
  const { createRouting } = useProductionRoutings();

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      routing_name: '',
      routing_code: '',
      version: '1.0',
      is_active: true,
      notes: '',
    },
  });

  const onSubmit = async (data: any) => {
    try {
      await createRouting.mutateAsync({
        ...data,
        effective_from: new Date().toISOString().split('T')[0],
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create routing:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Create Production Routing
          </DialogTitle>
          <DialogDescription>
            Define labor steps, work centers, and production sequences
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="routing_name">Routing Name *</Label>
                <Input
                  id="routing_name"
                  {...register('routing_name', { required: 'Name is required' })}
                  placeholder="e.g., Widget Assembly Process"
                />
                {errors.routing_name && (
                  <p className="text-sm text-destructive">{errors.routing_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="routing_code">Routing Code *</Label>
                <Input
                  id="routing_code"
                  {...register('routing_code', { required: 'Code is required' })}
                  placeholder="e.g., RTG-001"
                />
                {errors.routing_code && (
                  <p className="text-sm text-destructive">{errors.routing_code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  {...register('version')}
                  placeholder="1.0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active routings can be used in production
                </p>
              </div>
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Add any notes about this routing..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRouting.isPending}>
              {createRouting.isPending ? 'Creating...' : 'Create Routing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

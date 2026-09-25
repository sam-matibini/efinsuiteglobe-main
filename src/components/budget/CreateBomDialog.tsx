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
import { useProductionBoms } from '@/hooks/useProductionData';
import { FileBox } from 'lucide-react';

interface CreateBomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBomDialog({ open, onOpenChange }: CreateBomDialogProps) {
  const { createBom } = useProductionBoms();

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      bom_name: '',
      bom_code: '',
      version: '1.0',
      yield_percentage: 100,
      standard_batch_size: 1,
      is_active: true,
      notes: '',
    },
  });

  const onSubmit = async (data: any) => {
    try {
      await createBom.mutateAsync({
        ...data,
        effective_from: new Date().toISOString().split('T')[0],
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create BoM:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBox className="h-5 w-5" />
            Create Bill of Materials
          </DialogTitle>
          <DialogDescription>
            Define a product structure with materials, components, and costs
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="bom_name">BoM Name *</Label>
                <Input
                  id="bom_name"
                  {...register('bom_name', { required: 'Name is required' })}
                  placeholder="e.g., Widget Assembly"
                />
                {errors.bom_name && (
                  <p className="text-sm text-destructive">{errors.bom_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bom_code">BoM Code *</Label>
                <Input
                  id="bom_code"
                  {...register('bom_code', { required: 'Code is required' })}
                  placeholder="e.g., BOM-001"
                />
                {errors.bom_code && (
                  <p className="text-sm text-destructive">{errors.bom_code.message}</p>
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

              <div className="space-y-2">
                <Label htmlFor="yield_percentage">Yield %</Label>
                <Input
                  id="yield_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  {...register('yield_percentage', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="standard_batch_size">Standard Batch Size</Label>
                <Input
                  id="standard_batch_size"
                  type="number"
                  min="1"
                  step="1"
                  {...register('standard_batch_size', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Only active BoMs can be used in production
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
                placeholder="Add any notes about this Bill of Materials..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBom.isPending}>
              {createBom.isPending ? 'Creating...' : 'Create BoM'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

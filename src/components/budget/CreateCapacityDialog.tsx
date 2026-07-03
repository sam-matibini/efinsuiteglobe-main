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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useProductionCapacity } from '@/hooks/useProductionData';
import { Gauge } from 'lucide-react';

interface CreateCapacityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCapacityDialog({ open, onOpenChange }: CreateCapacityDialogProps) {
  const { createCapacity } = useProductionCapacity();

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      facility_name: '',
      work_center: '',
      production_line: '',
      capacity_type: 'machine_hours' as const,
      available_capacity: 0,
      utilized_capacity: 0,
      period_start: new Date().toISOString().split('T')[0],
      period_end: '',
      shift_pattern: '',
      is_active: true,
    },
  });

  const onSubmit = async (data: any) => {
    try {
      // Calculate utilization percentage
      const utilizationPercentage = data.available_capacity > 0
        ? (data.utilized_capacity / data.available_capacity) * 100
        : 0;

      await createCapacity.mutateAsync({
        ...data,
        work_center: data.work_center || null,
        production_line: data.production_line || null,
        shift_pattern: data.shift_pattern || null,
        utilization_percentage: Math.round(utilizationPercentage * 100) / 100,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create capacity:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Add Production Capacity
          </DialogTitle>
          <DialogDescription>
            Track machine hours, labor hours, or production units
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="facility_name">Facility Name *</Label>
                <Input
                  id="facility_name"
                  {...register('facility_name', { required: 'Facility name is required' })}
                  placeholder="e.g., Main Plant, Warehouse A"
                />
                {errors.facility_name && (
                  <p className="text-sm text-destructive">{errors.facility_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_center">Work Center</Label>
                <Input
                  id="work_center"
                  {...register('work_center')}
                  placeholder="e.g., Assembly, Welding"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="production_line">Production Line</Label>
                <Input
                  id="production_line"
                  {...register('production_line')}
                  placeholder="e.g., Line 1, Line A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity_type">Capacity Type *</Label>
                <Select
                  value={watch('capacity_type')}
                  onValueChange={(v: any) => setValue('capacity_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="machine_hours">Machine Hours</SelectItem>
                    <SelectItem value="labor_hours">Labor Hours</SelectItem>
                    <SelectItem value="units">Units</SelectItem>
                    <SelectItem value="shifts">Shifts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shift_pattern">Shift Pattern</Label>
                <Input
                  id="shift_pattern"
                  {...register('shift_pattern')}
                  placeholder="e.g., 8x5, 24x7"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_capacity">Available Capacity *</Label>
                <Input
                  id="available_capacity"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('available_capacity', { 
                    required: 'Available capacity is required',
                    valueAsNumber: true 
                  })}
                />
                {errors.available_capacity && (
                  <p className="text-sm text-destructive">{errors.available_capacity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="utilized_capacity">Utilized Capacity</Label>
                <Input
                  id="utilized_capacity"
                  type="number"
                  min="0"
                  step="0.01"
                  {...register('utilized_capacity', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_start">Period Start *</Label>
                <Input
                  id="period_start"
                  type="date"
                  {...register('period_start', { required: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period_end">Period End *</Label>
                <Input
                  id="period_end"
                  type="date"
                  {...register('period_end', { required: true })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-xs text-muted-foreground">
                  Include in capacity planning
                </p>
              </div>
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCapacity.isPending}>
              {createCapacity.isPending ? 'Creating...' : 'Add Capacity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBudgetDetails } from '@/hooks/useBudgets';
import { SCENARIO_TYPE_CONFIG, type BudgetVersion, type ScenarioType } from '@/types/budget';
import { GitBranch } from 'lucide-react';

interface CreateScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  existingVersions: BudgetVersion[];
}

export function CreateScenarioDialog({
  open,
  onOpenChange,
  budgetId,
  existingVersions,
}: CreateScenarioDialogProps) {
  const { createVersion } = useBudgetDetails(budgetId);
  
  const nextVersionNumber = Math.max(...existingVersions.map(v => v.version_number), 0) + 1;

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      version_name: '',
      scenario_type: 'custom' as ScenarioType,
      description: '',
    },
  });

  const handleScenarioTypeChange = (type: ScenarioType) => {
    setValue('scenario_type', type);
    if (!watch('version_name')) {
      setValue('version_name', SCENARIO_TYPE_CONFIG[type]?.label || type);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      await createVersion.mutateAsync({
        ...data,
        version_number: nextVersionNumber,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create scenario:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Create Scenario Version
          </DialogTitle>
          <DialogDescription>
            Create a what-if scenario to model different budget outcomes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scenario_type">Scenario Type</Label>
              <Select
                value={watch('scenario_type')}
                onValueChange={handleScenarioTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SCENARIO_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version_name">Scenario Name *</Label>
              <Input
                id="version_name"
                {...register('version_name', { required: 'Name is required' })}
                placeholder="e.g., Q3 Demand Surge Analysis"
              />
              {errors.version_name && (
                <p className="text-sm text-destructive">{errors.version_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe the assumptions and parameters for this scenario..."
                rows={3}
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This will be version <strong>#{nextVersionNumber}</strong> of the budget.
                You can switch between versions to compare different scenarios.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createVersion.isPending}>
              {createVersion.isPending ? 'Creating...' : 'Create Scenario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

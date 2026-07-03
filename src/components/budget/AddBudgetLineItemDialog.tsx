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
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { useBudgetDetails } from '@/hooks/useBudgets';
import type { DbAccount } from '@/hooks/useAccounts';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';

interface AddBudgetLineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  accounts: DbAccount[];
}

export function AddBudgetLineItemDialog({
  open,
  onOpenChange,
  budgetId,
  accounts,
}: AddBudgetLineItemDialogProps) {
  const { createLineItem } = useBudgetDetails(budgetId);
  
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    defaultValues: {
      line_description: '',
      account_id: '',
      department_id: '' as string,
      period_1: 0,
      period_2: 0,
      period_3: 0,
      period_4: 0,
      period_5: 0,
      period_6: 0,
      period_7: 0,
      period_8: 0,
      period_9: 0,
      period_10: 0,
      period_11: 0,
      period_12: 0,
      notes: '',
    },
  });

  const onSubmit = async (data: any) => {
    try {
      await createLineItem.mutateAsync({
        ...data,
        account_id: data.account_id || null,
        department_id: data.department_id || null,
      });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add line item:', error);
    }
  };

  const handleDistributeEvenly = () => {
    const monthlyAmount = watch('period_1');
    for (let i = 2; i <= 12; i++) {
      setValue(`period_${i}` as any, monthlyAmount);
    }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Filter to postable accounts only
  const postableAccounts = accounts.filter(a => a.posting_allowed !== false && !a.is_header);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Budget Line Item</DialogTitle>
          <DialogDescription>
            Add a new line item to your budget with monthly amounts
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="line_description">Description *</Label>
                <Input
                  id="line_description"
                  {...register('line_description', { required: 'Description is required' })}
                  placeholder="e.g., Office Supplies, Consulting Fees"
                />
                {errors.line_description && (
                  <p className="text-sm text-destructive">{errors.line_description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_id">GL Account (Optional)</Label>
                <Select
                  value={watch('account_id')}
                  onValueChange={(v) => setValue('account_id', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Account</SelectItem>
                    {postableAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Division (Optional)</Label>
                <DivisionSelect
                  value={watch('department_id') || null}
                  onChange={(v) => setValue('department_id', v || '')}
                  placeholder="No division"
                />
              </div>

              <div className="col-span-2 flex items-end">
                <Button type="button" variant="outline" onClick={handleDistributeEvenly}>
                  Distribute January Amount Evenly
                </Button>
              </div>
            </div>

            {/* Monthly Amounts Grid */}
            <div className="space-y-2">
              <Label>Monthly Amounts</Label>
              <div className="grid grid-cols-6 gap-3">
                {MONTHS.map((month, index) => (
                  <div key={month} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{month}</Label>
                    <FormattedNumberInput
                      value={watch(`period_${index + 1}` as any)}
                      onChange={(value) => setValue(`period_${index + 1}` as any, value)}
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Add any notes about this line item..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLineItem.isPending}>
              {createLineItem.isPending ? 'Adding...' : 'Add Line Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

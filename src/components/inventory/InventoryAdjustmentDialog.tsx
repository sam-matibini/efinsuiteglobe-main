import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useInventoryItems, InventoryItem } from '@/hooks/useInventory';
import { useCreateInventoryAdjustment } from '@/hooks/useInventoryAdjustments';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

const adjustmentReasons = [
  { value: 'stock_count', label: 'Stock Count / Physical Inventory' },
  { value: 'damaged', label: 'Damaged Goods' },
  { value: 'expired', label: 'Expired Items' },
  { value: 'theft', label: 'Theft / Shrinkage' },
  { value: 'write_off', label: 'Write-Off' },
  { value: 'correction', label: 'Data Entry Correction' },
  { value: 'other', label: 'Other' },
] as const;

const lineSchema = z.object({
  item_id: z.string().min(1, 'Required'),
  quantity_on_hand: z.number(),
  quantity_counted: z.number().min(0, 'Must be 0 or greater'),
  unit_cost: z.number(),
});

const adjustmentSchema = z.object({
  adjustment_date: z.string().min(1, 'Required'),
  reason: z.string().min(1, 'Required'),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one item required'),
});

type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}

export function InventoryAdjustmentDialog({ open, onOpenChange, organizationId }: Props) {
  const { data: items = [] } = useInventoryItems(organizationId);
  const { data: accounts = [] } = useAccounts(organizationId);
  const createAdjustment = useCreateInventoryAdjustment(organizationId);
  const { organization } = useCurrentOrganization();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  // Find inventory adjustment expense account
  const adjustmentAccount = useMemo(() => 
    accounts.find(a => a.code === '5400' || a.name.toLowerCase().includes('inventory adjustment') || a.account_type === 'expense'),
    [accounts]
  );

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      adjustment_date: format(new Date(), 'yyyy-MM-dd'),
      reason: '',
      notes: '',
      lines: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const watchedLines = form.watch('lines');

  const addItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || fields.some(f => f.item_id === itemId)) return;

    append({
      item_id: item.id,
      quantity_on_hand: item.quantity_on_hand,
      quantity_counted: item.quantity_on_hand,
      unit_cost: item.cost_price,
    });
  };

  const totals = useMemo(() => {
    let totalIncrease = 0;
    let totalDecrease = 0;

    watchedLines.forEach((line) => {
      const diff = line.quantity_counted - line.quantity_on_hand;
      const value = Math.abs(diff) * line.unit_cost;
      if (diff > 0) totalIncrease += value;
      else if (diff < 0) totalDecrease += value;
    });

    return { totalIncrease, totalDecrease, netChange: totalIncrease - totalDecrease };
  }, [watchedLines]);

  const getItemById = (id: string) => items.find(i => i.id === id);

  const onSubmit = async (data: AdjustmentFormValues) => {
    // Filter out lines with no change
    const changedLines = data.lines.filter(line => line.quantity_counted !== line.quantity_on_hand);
    
    if (changedLines.length === 0) {
      form.setError('lines', { message: 'No quantity changes detected' });
      return;
    }

    await createAdjustment.mutateAsync({
      adjustment_date: data.adjustment_date,
      reason: data.reason,
      notes: data.notes,
      lines: changedLines.map((line, idx) => ({
        item_id: line.item_id,
        quantity_on_hand: line.quantity_on_hand,
        quantity_counted: line.quantity_counted,
        quantity_difference: line.quantity_counted - line.quantity_on_hand,
        unit_cost: line.unit_cost,
        total_adjustment: (line.quantity_counted - line.quantity_on_hand) * line.unit_cost,
        line_order: idx,
      })),
    });

    form.reset();
    onOpenChange(false);
  };

  const availableItems = items.filter(i => i.is_active && !fields.some(f => f.item_id === i.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inventory Adjustment</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adjustment Date</Label>
              <Input type="date" {...form.register('adjustment_date')} />
              {form.formState.errors.adjustment_date && (
                <p className="text-sm text-destructive">{form.formState.errors.adjustment_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select onValueChange={(v) => form.setValue('reason', v)} value={form.watch('reason')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  {adjustmentReasons.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.reason && (
                <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...form.register('notes')} placeholder="Additional notes about this adjustment..." rows={2} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Adjustment Lines</Label>
              <Select onValueChange={addItem} value="__placeholder__">
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Add item..." />
                </SelectTrigger>
                <SelectContent>
                  {availableItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.sku} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                Add items to adjust their quantities
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Adjustment</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const item = getItemById(field.item_id);
                    const counted = watchedLines[index]?.quantity_counted ?? field.quantity_counted;
                    const diff = counted - field.quantity_on_hand;
                    const adjustmentValue = diff * field.unit_cost;

                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <div className="font-mono text-sm">{item?.sku}</div>
                          <div className="text-muted-foreground text-sm">{item?.name}</div>
                        </TableCell>
                        <TableCell className="text-right">{field.quantity_on_hand}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="w-24 text-right ml-auto"
                            min={0}
                            {...form.register(`lines.${index}.quantity_counted`, { valueAsNumber: true })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {diff !== 0 && (
                            <Badge variant={diff > 0 ? 'default' : 'destructive'}>
                              {diff > 0 ? '+' : ''}{diff}
                            </Badge>
                          )}
                          {diff === 0 && <span className="text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(field.unit_cost)}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={adjustmentValue < 0 ? 'text-destructive' : adjustmentValue > 0 ? 'text-green-600' : ''}>
                            {adjustmentValue !== 0 ? (adjustmentValue > 0 ? '+' : '-') + formatCurrency(Math.abs(adjustmentValue)) : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {form.formState.errors.lines && (
              <p className="text-sm text-destructive">{form.formState.errors.lines.message}</p>
            )}
          </div>

          {fields.length > 0 && (
            <div className="flex justify-end gap-8 p-4 bg-muted/50 rounded-lg">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Increase</div>
                <div className="font-medium text-green-600">+{formatCurrency(totals.totalIncrease)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Decrease</div>
                <div className="font-medium text-destructive">-{formatCurrency(totals.totalDecrease)}</div>
              </div>
              <div className="text-right border-l pl-8">
                <div className="text-sm text-muted-foreground">Net Change</div>
                <div className={`font-bold text-lg ${totals.netChange < 0 ? 'text-destructive' : totals.netChange > 0 ? 'text-green-600' : ''}`}>
                  {totals.netChange >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totals.netChange))}
                </div>
              </div>
            </div>
          )}

          {totals.netChange < 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">A journal entry will be created to record the inventory write-down.</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAdjustment.isPending || fields.length === 0}>
              {createAdjustment.isPending ? 'Processing...' : 'Post Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

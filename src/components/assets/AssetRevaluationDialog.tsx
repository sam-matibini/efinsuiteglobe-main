import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { FixedAsset } from '@/hooks/useFixedAssets';
import { useCreateAssetRevaluation } from '@/hooks/useFixedAssetsRegister';

interface AssetRevaluationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
  formatCurrency: (value: number) => string;
}

export function AssetRevaluationDialog({ open, onOpenChange, asset, formatCurrency }: AssetRevaluationDialogProps) {
  const createRevaluation = useCreateAssetRevaluation();
  
  const [formData, setFormData] = useState({
    revaluation_type: 'revaluation',
    revaluation_date: format(new Date(), 'yyyy-MM-dd'),
    new_book_value: 0,
    appraiser_name: '',
    appraiser_reference: '',
    notes: '',
  });

  useEffect(() => {
    if (asset) {
      setFormData(prev => ({
        ...prev,
        new_book_value: asset.book_value,
      }));
    }
  }, [asset]);

  if (!asset) return null;

  const adjustmentAmount = formData.new_book_value - asset.book_value;
  const isImpairment = formData.revaluation_type === 'impairment' || adjustmentAmount < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createRevaluation.mutateAsync({
      asset_id: asset.id,
      revaluation_type: formData.revaluation_type,
      revaluation_date: formData.revaluation_date,
      old_book_value: asset.book_value,
      new_book_value: formData.new_book_value,
      adjustment_amount: adjustmentAmount,
      appraiser_name: formData.appraiser_name || null,
      appraiser_reference: formData.appraiser_reference || null,
      journal_entry_id: null, // Would be linked when GL posting is implemented
      notes: formData.notes || null,
      approved_by: null,
      approved_at: null,
      created_by: null,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isImpairment ? <TrendingDown className="h-5 w-5 text-red-500" /> : <TrendingUp className="h-5 w-5 text-green-500" />}
            Asset Revaluation / Impairment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{asset.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{asset.asset_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Current Book Value</p>
                  <p className="text-lg font-bold">{formatCurrency(asset.book_value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.revaluation_type} onValueChange={(v) => setFormData({ ...formData, revaluation_type: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="revaluation">Revaluation (Upward)</SelectItem>
                  <SelectItem value="impairment">Impairment (Downward)</SelectItem>
                  <SelectItem value="reversal">Impairment Reversal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input
                type="date"
                value={formData.revaluation_date}
                onChange={(e) => setFormData({ ...formData, revaluation_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>New Book Value</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.new_book_value}
              onChange={(e) => setFormData({ ...formData, new_book_value: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          {/* Adjustment Preview */}
          <Card className={adjustmentAmount !== 0 ? (adjustmentAmount > 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50') : ''}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Adjustment Amount</span>
                <div className="flex items-center gap-2">
                  {adjustmentAmount !== 0 && (
                    <Badge variant={adjustmentAmount > 0 ? 'default' : 'destructive'}>
                      {adjustmentAmount > 0 ? 'Increase' : 'Decrease'}
                    </Badge>
                  )}
                  <span className={`text-lg font-bold ${adjustmentAmount > 0 ? 'text-green-600' : adjustmentAmount < 0 ? 'text-red-600' : ''}`}>
                    {adjustmentAmount >= 0 ? '+' : ''}{formatCurrency(adjustmentAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isImpairment && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Impairment Recognition</p>
                <p className="text-amber-700">This will reduce the asset's carrying value and may require disclosure in financial statements per IFRS/ASPE.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Appraiser Name</Label>
              <Input
                value={formData.appraiser_name}
                onChange={(e) => setFormData({ ...formData, appraiser_name: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>Appraisal Reference</Label>
              <Input
                value={formData.appraiser_reference}
                onChange={(e) => setFormData({ ...formData, appraiser_reference: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Reason for revaluation..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createRevaluation.isPending || adjustmentAmount === 0}>
              {createRevaluation.isPending ? 'Recording...' : 'Record Revaluation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

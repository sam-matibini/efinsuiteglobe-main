import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { FixedAsset } from '@/hooks/useFixedAssets';
import { useCreateAssetDisposal, calculateDisposalGainLoss } from '@/hooks/useFixedAssetsRegister';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { format } from 'date-fns';

interface AssetDisposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
}

export function AssetDisposalDialog({ open, onOpenChange, asset }: AssetDisposalDialogProps) {
  const { organization } = useCurrentOrganization();
  const createDisposal = useCreateAssetDisposal();
  
  const [formData, setFormData] = useState({
    disposal_type: 'sale',
    disposal_date: format(new Date(), 'yyyy-MM-dd'),
    proceeds: 0,
    costs_of_disposal: 0,
    buyer_name: '',
    buyer_reference: '',
    notes: '',
  });

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const calculations = useMemo(() => {
    if (!asset) return null;
    return calculateDisposalGainLoss(
      asset.acquisition_cost,
      asset.accumulated_depreciation,
      formData.proceeds,
      formData.costs_of_disposal
    );
  }, [asset, formData.proceeds, formData.costs_of_disposal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !calculations) return;
    
    await createDisposal.mutateAsync({
      asset_id: asset.id,
      disposal_type: formData.disposal_type,
      disposal_date: formData.disposal_date,
      proceeds: formData.proceeds,
      costs_of_disposal: formData.costs_of_disposal,
      net_proceeds: calculations.netProceeds,
      book_value_at_disposal: calculations.bookValue,
      accumulated_dep_at_disposal: asset.accumulated_depreciation,
      gain_loss: calculations.gainLoss,
      final_depreciation_amount: 0, // Could calculate prorated depreciation
      buyer_name: formData.buyer_name || null,
      buyer_reference: formData.buyer_reference || null,
      approved_by: null,
      approved_at: null,
      journal_entry_id: null,
      depreciation_journal_entry_id: null,
      notes: formData.notes || null,
      created_by: null,
    });
    
    onOpenChange(false);
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Dispose Asset
          </DialogTitle>
          <DialogDescription>
            Record the disposal of {asset.name} ({asset.asset_number})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Asset Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Acquisition Cost:</span>
              <span className="font-medium">{formatCurrency(asset.acquisition_cost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accumulated Depreciation:</span>
              <span className="font-medium">{formatCurrency(asset.accumulated_depreciation)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="font-medium">Current Book Value:</span>
              <span className="font-bold">{formatCurrency(asset.book_value)}</span>
            </div>
          </div>

          {/* Disposal Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Disposal Type *</Label>
              <Select value={formData.disposal_type} onValueChange={(v) => setFormData({ ...formData, disposal_type: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="scrap">Scrap</SelectItem>
                  <SelectItem value="donation">Donation</SelectItem>
                  <SelectItem value="write_off">Write-Off</SelectItem>
                  <SelectItem value="trade_in">Trade-In</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Disposal Date *</Label>
              <Input 
                type="date" 
                value={formData.disposal_date} 
                onChange={(e) => setFormData({ ...formData, disposal_date: e.target.value })} 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proceeds</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0" 
                value={formData.proceeds} 
                onChange={(e) => setFormData({ ...formData, proceeds: parseFloat(e.target.value) || 0 })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Costs of Disposal</Label>
              <Input 
                type="number" 
                step="0.01" 
                min="0" 
                value={formData.costs_of_disposal} 
                onChange={(e) => setFormData({ ...formData, costs_of_disposal: parseFloat(e.target.value) || 0 })} 
              />
            </div>
          </div>

          {formData.disposal_type === 'sale' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buyer Name</Label>
                <Input 
                  value={formData.buyer_name} 
                  onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Buyer Reference</Label>
                <Input 
                  value={formData.buyer_reference} 
                  onChange={(e) => setFormData({ ...formData, buyer_reference: e.target.value })} 
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              value={formData.notes} 
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this disposal..."
            />
          </div>

          {/* Gain/Loss Calculation */}
          {calculations && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Disposal Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Proceeds:</span>
                  <span>{formatCurrency(calculations.netProceeds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Book Value:</span>
                  <span>{formatCurrency(calculations.bookValue)}</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {calculations.gainLoss >= 0 ? 'Gain on Disposal:' : 'Loss on Disposal:'}
                </span>
                <Badge 
                  variant={calculations.gainLoss >= 0 ? 'default' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  {calculations.gainLoss >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {formatCurrency(Math.abs(calculations.gainLoss))}
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={createDisposal.isPending}>
              {createDisposal.isPending ? 'Processing...' : 'Confirm Disposal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

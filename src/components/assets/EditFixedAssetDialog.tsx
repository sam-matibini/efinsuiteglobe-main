import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateFixedAsset, useFixedAssetCategories, FixedAsset } from '@/hooks/useFixedAssets';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';

interface EditFixedAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
}

export function EditFixedAssetDialog({ open, onOpenChange, asset }: EditFixedAssetDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: categories = [] } = useFixedAssetCategories(organization?.id);
  const { data: accounts = [] } = useAccounts(organization?.id);
  const updateAsset = useUpdateFixedAsset();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    asset_number: '',
    name: '',
    description: '',
    category_id: '',
    acquisition_date: '',
    acquisition_cost: 0,
    useful_life_months: '60',
    salvage_value: 0,
    depreciation_method: 'straight_line',
    declining_rate: '20',
    depreciation_start_date: '',
    half_year_convention: false,
    status: 'active',
    depreciation_account_id: '',
    accumulated_depreciation_account_id: '',
  });

  // Filter accounts for depreciation expense (expense accounts) - sorted by code
  const expenseAccounts = accounts
    .filter(a => a.account_type === 'expense' && a.is_active && a.posting_allowed !== false)
    .sort((a, b) => a.code.localeCompare(b.code));

  // Filter accounts for accumulated depreciation (contra-asset accounts) - all PPE contra accounts
  const accumulatedDepAccounts = accounts
    .filter(a => 
      a.account_type === 'asset' && 
      a.is_active && 
      !a.is_header &&
      a.posting_allowed !== false &&
      (a.normal_balance === 'credit' ||
       a.name.toLowerCase().includes('accum') || 
       a.name.toLowerCase().includes('depreciation') ||
       a.name.toLowerCase().includes('amortization'))
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  useEffect(() => {
    if (asset) {
      setFormData({
        asset_number: asset.asset_number,
        name: asset.name,
        description: asset.description || '',
        category_id: asset.category_id || '',
        acquisition_date: asset.acquisition_date,
        acquisition_cost: asset.acquisition_cost,
        useful_life_months: String(asset.useful_life_months || 60),
        salvage_value: asset.salvage_value,
        depreciation_method: asset.depreciation_method,
        declining_rate: String(asset.declining_rate || 20),
        depreciation_start_date: asset.depreciation_start_date || asset.acquisition_date,
        half_year_convention: asset.half_year_convention || false,
        status: asset.status,
        depreciation_account_id: asset.depreciation_account_id || '',
        accumulated_depreciation_account_id: asset.accumulated_depreciation_account_id || '',
      });
    }
  }, [asset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;

    // Validate depreciation start date is not before acquisition date
    if (formData.depreciation_start_date < formData.acquisition_date) {
      toast({ 
        title: 'Invalid Depreciation Start Date', 
        description: 'Depreciation start date cannot be before acquisition date.', 
        variant: 'destructive' 
      });
      return;
    }

    const usefulLifeMonths = Math.max(1, parseInt(formData.useful_life_months || '0', 10) || 0);
    const decliningRate = Math.max(1, Math.min(100, parseFloat(formData.declining_rate || '0') || 0));
    
    await updateAsset.mutateAsync({
      id: asset.id,
      asset_number: formData.asset_number,
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      acquisition_date: formData.acquisition_date,
      acquisition_cost: formData.acquisition_cost,
      useful_life_months: usefulLifeMonths,
      salvage_value: formData.salvage_value,
      depreciation_method: formData.depreciation_method,
      declining_rate: formData.depreciation_method === 'declining_balance' ? decliningRate : null,
      depreciation_start_date: formData.depreciation_start_date,
      status: formData.status,
      depreciation_account_id: formData.depreciation_account_id || null,
      accumulated_depreciation_account_id: formData.accumulated_depreciation_account_id || null,
    });
    
    onOpenChange(false);
  };

  // Include the current category even if inactive, plus all active categories
  const availableCategories = categories.filter(c => c.is_active || c.id === formData.category_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Fixed Asset</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Asset Number *</Label>
              <Input value={formData.asset_number} onChange={(e) => setFormData({ ...formData, asset_number: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Acquisition Date *</Label>
              <Input type="date" value={formData.acquisition_date} onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Acquisition Cost *</Label>
              <Input type="number" step="0.01" min="0" value={formData.acquisition_cost} onChange={(e) => setFormData({ ...formData, acquisition_cost: parseFloat(e.target.value) || 0 })} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category_id || "none"} onValueChange={(v) => setFormData({ ...formData, category_id: v === "none" ? "" : v })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="none">No Category</SelectItem>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="fully_depreciated">Fully Depreciated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Depreciation</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={formData.depreciation_method} onValueChange={(v) => setFormData({ ...formData, depreciation_method: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="straight_line">Straight-Line</SelectItem>
                    <SelectItem value="declining_balance">Declining Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Useful Life (Months)</Label>
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={formData.useful_life_months}
                  onChange={(e) => setFormData({ ...formData, useful_life_months: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Salvage Value</Label>
                <Input type="number" step="0.01" min="0" value={formData.salvage_value} onChange={(e) => setFormData({ ...formData, salvage_value: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Depreciation Start Date</Label>
                <Input 
                  type="date" 
                  value={formData.depreciation_start_date} 
                  min={formData.acquisition_date}
                  onChange={(e) => setFormData({ ...formData, depreciation_start_date: e.target.value })} 
                />
              </div>
              {formData.depreciation_method === 'declining_balance' && (
                <div className="space-y-2">
                  <Label>Declining Rate (%)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    inputMode="decimal"
                    value={formData.declining_rate}
                    onChange={(e) => setFormData({ ...formData, declining_rate: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Switch
                id="half_year"
                checked={formData.half_year_convention}
                onCheckedChange={(checked) => setFormData({ ...formData, half_year_convention: checked })}
              />
              <Label htmlFor="half_year" className="cursor-pointer">
                Half-Year Convention
                <span className="text-xs text-muted-foreground ml-2">(Apply 50% depreciation in first year)</span>
              </Label>
            </div>
          </div>

          {/* GL Accounts Section */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">GL Account Mapping</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depreciation Expense Account</Label>
                <Select 
                  value={formData.depreciation_account_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, depreciation_account_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select expense account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="none">No Account</SelectItem>
                    {expenseAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accumulated Depreciation Account</Label>
                <Select 
                  value={formData.accumulated_depreciation_account_id || "none"} 
                  onValueChange={(v) => setFormData({ ...formData, accumulated_depreciation_account_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select contra-asset account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="none">No Account</SelectItem>
                    {accumulatedDepAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              These accounts are used when running annual depreciation to create balanced journal entries.
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateAsset.isPending}>{updateAsset.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

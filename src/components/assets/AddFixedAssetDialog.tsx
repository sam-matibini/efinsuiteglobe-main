import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateFixedAsset, useFixedAssetCategories, useCreateFixedAssetCategory } from '@/hooks/useFixedAssets';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

interface AddFixedAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFixedAssetDialog({ open, onOpenChange }: AddFixedAssetDialogProps) {
  const lastDefaultsAppliedForCategory = useRef<string | null>(null);
  const { organization } = useCurrentOrganization();
  const { data: categories = [] } = useFixedAssetCategories(organization?.id);
  const createAsset = useCreateFixedAsset(organization?.id);
  const createCategory = useCreateFixedAssetCategory(organization?.id);
  
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [formData, setFormData] = useState({
    asset_number: '',
    name: '',
    description: '',
    serial_number: '',
    location: '',
    category_id: '',
    acquisition_date: format(new Date(), 'yyyy-MM-dd'),
    acquisition_cost: 0,
    acquisition_method: 'purchase',
    vendor_id: '',
    useful_life_months: '60',
    salvage_value: 0,
    depreciation_method: 'straight_line',
    declining_rate: '20',
    depreciation_start_date: format(new Date(), 'yyyy-MM-dd'),
    asset_account_id: '',
    depreciation_account_id: '',
    accumulated_depreciation_account_id: '',
    half_year_convention: false,
    notes: '',
  });

  // Apply category defaults once per category selection (avoid overwriting user edits)
  useEffect(() => {
    if (!formData.category_id) return;
    if (lastDefaultsAppliedForCategory.current === formData.category_id) return;

    const category = categories.find((c) => c.id === formData.category_id);
    if (!category) return;

    lastDefaultsAppliedForCategory.current = formData.category_id;
    setFormData((prev) => ({
      ...prev,
      useful_life_months: String(category.default_useful_life_months || 60),
      depreciation_method: category.default_depreciation_method || 'straight_line',
      declining_rate: String(category.default_declining_rate || 20),
    }));
  }, [formData.category_id, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const usefulLifeMonths = Math.max(1, parseInt(formData.useful_life_months || '0', 10) || 0);
    const decliningRate = Math.max(1, Math.min(100, parseFloat(formData.declining_rate || '0') || 0));
    
    await createAsset.mutateAsync({
      ...formData,
      useful_life_months: usefulLifeMonths,
      category_id: formData.category_id || null,
      vendor_id: formData.vendor_id || null,
      asset_account_id: formData.asset_account_id || null,
      depreciation_account_id: formData.depreciation_account_id || null,
      accumulated_depreciation_account_id: formData.accumulated_depreciation_account_id || null,
      declining_rate: formData.depreciation_method === 'declining_balance' ? decliningRate : null,
    });
    
    onOpenChange(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const result = await createCategory.mutateAsync({ name: newCategoryName.trim() });
    setFormData({ ...formData, category_id: result.id });
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  const availableCategories = categories.filter((c) => c.is_active || c.id === formData.category_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Fixed Asset</DialogTitle>
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
              {showAddCategory ? (
                <div className="flex gap-2">
                  <Input 
                    value={newCategoryName} 
                    onChange={(e) => setNewCategoryName(e.target.value)} 
                    placeholder="Category name"
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={handleAddCategory} disabled={createCategory.isPending}>
                    Add
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddCategory(false)}>
                    ✕
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={formData.category_id || "none"} onValueChange={(v) => setFormData({ ...formData, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger className="flex-1 bg-background"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                      <SelectItem value="none">No Category</SelectItem>
                      {availableCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={() => setShowAddCategory(true)} title="Add new category">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
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

            {formData.depreciation_method === 'declining_balance' && (
              <div className="grid grid-cols-3 gap-4 mt-4">
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
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <Switch
                id="half_year_add"
                checked={formData.half_year_convention}
                onCheckedChange={(checked) => setFormData({ ...formData, half_year_convention: checked })}
              />
              <Label htmlFor="half_year_add" className="cursor-pointer">
                Half-Year Convention
                <span className="text-xs text-muted-foreground ml-2">(Apply 50% depreciation in first year)</span>
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createAsset.isPending}>{createAsset.isPending ? 'Creating...' : 'Create Asset'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateFixedAsset, useFixedAssetCategories, useCreateFixedAssetCategory } from '@/hooks/useFixedAssets';
import { useCCAClasses } from '@/hooks/useFixedAssetsRegister';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { format } from 'date-fns';
import { Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SearchableGLAccountSelect } from '@/components/banking/SearchableGLAccountSelect';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AddFixedAssetDialogEnhancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFixedAssetDialogEnhanced({ open, onOpenChange }: AddFixedAssetDialogEnhancedProps) {
  const { organization } = useCurrentOrganization();
  const { data: categories = [] } = useFixedAssetCategories(organization?.id);
  const { data: ccaClasses = [] } = useCCAClasses(organization?.id, organization?.country_id || undefined);
  const createAsset = useCreateFixedAsset(organization?.id);
  const createCategory = useCreateFixedAssetCategory(organization?.id);
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('basic');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const lastDefaultsAppliedForCategory = useRef<string | null>(null);

  // Predefined asset categories with defaults
  const predefinedCategories = [
    { name: 'Land', useful_life: 0, method: 'none', cca_class: '' },
    { name: 'Buildings', useful_life: 480, method: 'straight_line', cca_class: '1' },
    { name: 'Building Improvements', useful_life: 180, method: 'straight_line', cca_class: '1' },
    { name: 'Machinery & Equipment', useful_life: 120, method: 'straight_line', cca_class: '8' },
    { name: 'Computer Hardware', useful_life: 36, method: 'straight_line', cca_class: '50' },
    { name: 'Computer Software', useful_life: 36, method: 'straight_line', cca_class: '12' },
    { name: 'Furniture & Fixtures', useful_life: 84, method: 'straight_line', cca_class: '8' },
    { name: 'Office Equipment', useful_life: 60, method: 'straight_line', cca_class: '8' },
    { name: 'Vehicles', useful_life: 60, method: 'declining_balance', cca_class: '10' },
    { name: 'Passenger Vehicles', useful_life: 60, method: 'declining_balance', cca_class: '10.1' },
    { name: 'Leasehold Improvements', useful_life: 120, method: 'straight_line', cca_class: '13' },
    { name: 'Tools & Dies', useful_life: 60, method: 'straight_line', cca_class: '12' },
    { name: 'Manufacturing Equipment', useful_life: 120, method: 'straight_line', cca_class: '43' },
    { name: 'Clean Energy Equipment', useful_life: 240, method: 'straight_line', cca_class: '43.1' },
  ];

  const handleSelectPredefinedCategory = async (predefined: typeof predefinedCategories[0]) => {
    // Check if category already exists
    const existing = categories.find(c => c.name.toLowerCase() === predefined.name.toLowerCase());
    if (existing) {
      setFormData(prev => ({ ...prev, category_id: existing.id }));
      return;
    }
    // Create new category with predefined defaults
    const result = await createCategory.mutateAsync({
      name: predefined.name,
      default_useful_life_months: predefined.useful_life,
      default_depreciation_method: predefined.method,
    });
    setFormData(prev => ({ 
      ...prev, 
      category_id: result.id,
      useful_life_months: String(predefined.useful_life || 60),
      depreciation_method: predefined.method === 'none' ? 'straight_line' : predefined.method,
      cca_class: predefined.cca_class,
    }));
  };
  
  const [formData, setFormData] = useState({
    // Basic Info
    asset_number: '',
    name: '',
    description: '',
    category_id: '',
    // Identification
    serial_number: '',
    barcode: '',
    location: '',
    cost_center: '',
    // Acquisition
    acquisition_date: format(new Date(), 'yyyy-MM-dd'),
    acquisition_cost: 0,
    acquisition_method: 'purchase',
    vendor_id: '',
    invoice_number: '',
    // Book Depreciation
    useful_life_months: '60',
    salvage_value: 0,
    depreciation_method: 'straight_line',
    declining_rate: '20',
    depreciation_start_date: format(new Date(), 'yyyy-MM-dd'),
    half_year_convention: false,
    // Tax Depreciation (CCA)
    cca_class: '',
    cca_rate: '',
    // Compliance
    warranty_expiry_date: '',
    insurance_policy_ref: '',
    insurance_expiry_date: '',
    asset_condition: 'good',
    ownership_status: 'owned',
    funding_source: '',
    notes: '',
    // GL Accounts
    asset_account_id: '',
    depreciation_account_id: '',
    accumulated_depreciation_account_id: '',
    offset_account_id: '',
  });

  // Apply category defaults once per category selection
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
      cca_class: (category as any).default_cca_class || '',
      cca_rate: String((category as any).default_cca_rate || ''),
    }));
  }, [formData.category_id, categories]);

  // Apply CCA class defaults
  useEffect(() => {
    if (!formData.cca_class) return;
    const ccaClass = ccaClasses.find(c => c.class_number === formData.cca_class);
    if (ccaClass) {
      setFormData(prev => ({
        ...prev,
        cca_rate: String(ccaClass.rate),
      }));
    }
  }, [formData.cca_class, ccaClasses]);

  const handleAIClassify = async () => {
    if (!formData.name && !formData.description) {
      toast({ title: 'Enter asset name or description first', variant: 'destructive' });
      return;
    }

    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-asset-classify', {
        body: { 
          name: formData.name,
          description: formData.description,
          acquisition_cost: formData.acquisition_cost,
        }
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          cca_class: data.cca_class || prev.cca_class,
          useful_life_months: data.useful_life_months ? String(data.useful_life_months) : prev.useful_life_months,
          depreciation_method: data.depreciation_method || prev.depreciation_method,
        }));
        toast({ 
          title: 'AI Classification Complete', 
          description: `Suggested CCA Class ${data.cca_class} with ${data.useful_life_months} month useful life`
        });
      }
    } catch (error: any) {
      toast({ title: 'Classification failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsClassifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate depreciation start date is not before acquisition date
    if (formData.depreciation_start_date < formData.acquisition_date) {
      toast({ 
        title: 'Invalid Depreciation Start Date', 
        description: 'Depreciation start date cannot be before acquisition date.', 
        variant: 'destructive' 
      });
      return;
    }

    if (!formData.asset_account_id) {
      setActiveTab('gl');
      toast({
        title: 'Asset GL Account required',
        description: 'Select the Balance Sheet asset account so the acquisition can post to the GL.',
        variant: 'destructive',
      });
      return;
    }
    if (formData.acquisition_cost > 0 && !formData.offset_account_id) {
      setActiveTab('gl');
      toast({
        title: 'Offset (Credit) account required',
        description: 'Select the account paying for the asset (e.g. Cash / Bank / Opening Balance Equity).',
        variant: 'destructive',
      });
      return;
    }

    const usefulLifeMonths = Math.max(1, parseInt(formData.useful_life_months || '60', 10) || 60);
    const decliningRate = Math.max(1, Math.min(100, parseFloat(formData.declining_rate || '20') || 20));
    
    await createAsset.mutateAsync({
      asset_number: formData.asset_number,
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      acquisition_date: formData.acquisition_date,
      acquisition_cost: formData.acquisition_cost,
      acquisition_method: formData.acquisition_method,
      useful_life_months: usefulLifeMonths,
      salvage_value: formData.salvage_value,
      depreciation_method: formData.depreciation_method,
      declining_rate: formData.depreciation_method === 'declining_balance' ? decliningRate : null,
      depreciation_start_date: formData.depreciation_start_date,
      vendor_id: formData.vendor_id || null,
      serial_number: formData.serial_number || null,
      location: formData.location || null,
      notes: formData.notes || null,
      asset_account_id: formData.asset_account_id || null,
      depreciation_account_id: formData.depreciation_account_id || null,
      accumulated_depreciation_account_id: formData.accumulated_depreciation_account_id || null,
      offset_account_id: formData.offset_account_id || null,
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Fixed Asset</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
              <TabsTrigger value="tax">Tax (CCA)</TabsTrigger>
              <TabsTrigger value="gl">GL Accounts</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
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

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
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
                <div className="col-span-3 space-y-2">
                  <Label>Category</Label>
                  {showAddCategory ? (
                    <div className="flex gap-2">
                      <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" autoFocus />
                      <Button type="button" size="sm" onClick={handleAddCategory} disabled={createCategory.isPending}>Add</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddCategory(false)}>✕</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Select value={formData.category_id || "none"} onValueChange={(v) => setFormData({ ...formData, category_id: v === "none" ? "" : v })}>
                          <SelectTrigger className="flex-1 bg-background"><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent className="bg-popover z-50 max-h-60">
                            <SelectItem value="none">No Category</SelectItem>
                            {availableCategories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="icon" variant="outline" onClick={() => setShowAddCategory(true)}><Plus className="h-4 w-4" /></Button>
                      </div>
                      {categories.length === 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Quick select a standard category:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {predefinedCategories.map((cat) => (
                              <Button
                                key={cat.name}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleSelectPredefinedCategory(cat)}
                                disabled={createCategory.isPending}
                              >
                                {cat.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Barcode / Tag</Label>
                  <Input value={formData.barcode} onChange={(e) => setFormData({ ...formData, barcode: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Department / Cost Center</Label>
                  <Input value={formData.cost_center} onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="depreciation" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={formData.depreciation_method} onValueChange={(v) => setFormData({ ...formData, depreciation_method: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="straight_line">Straight-Line</SelectItem>
                      <SelectItem value="declining_balance">Declining Balance</SelectItem>
                      <SelectItem value="units_of_production">Units of Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Useful Life (Months)</Label>
                  <Input type="number" min="1" inputMode="numeric" value={formData.useful_life_months} onChange={(e) => setFormData({ ...formData, useful_life_months: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Salvage Value</Label>
                  <Input type="number" step="0.01" min="0" value={formData.salvage_value} onChange={(e) => setFormData({ ...formData, salvage_value: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              {formData.depreciation_method === 'declining_balance' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Declining Rate (%)</Label>
                    <Input type="number" min="1" max="100" inputMode="decimal" value={formData.declining_rate} onChange={(e) => setFormData({ ...formData, declining_rate: e.target.value })} />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Depreciation Start Date</Label>
                <Input type="date" value={formData.depreciation_start_date} onChange={(e) => setFormData({ ...formData, depreciation_start_date: e.target.value })} className="max-w-xs" />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Switch id="half_year_add" checked={formData.half_year_convention} onCheckedChange={(checked) => setFormData({ ...formData, half_year_convention: checked })} />
                <Label htmlFor="half_year_add" className="cursor-pointer">
                  Half-Year Convention <span className="text-xs text-muted-foreground ml-2">(Apply 50% depreciation in first year)</span>
                </Label>
              </div>
            </TabsContent>

            <TabsContent value="tax" className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-medium">Tax Depreciation</h4>
                  <p className="text-sm text-muted-foreground">
                    {ccaClasses.length > 0 
                      ? `${ccaClasses.length} tax depreciation classes available for your jurisdiction`
                      : 'Configure tax depreciation settings for your organization'}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleAIClassify} disabled={isClassifying}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isClassifying ? 'Classifying...' : 'AI Classify'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tax Depreciation Class</Label>
                  <Select value={formData.cca_class || "none"} onValueChange={(v) => setFormData({ ...formData, cca_class: v === "none" ? "" : v })}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Select tax class" /></SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-60">
                      <SelectItem value="none">Not Applicable</SelectItem>
                      {ccaClasses.map((c) => (
                        <SelectItem key={c.id} value={c.class_number}>
                          {c.class_number} - {c.description} ({c.rate}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CCA Rate (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={formData.cca_rate} onChange={(e) => setFormData({ ...formData, cca_rate: e.target.value })} disabled={!!formData.cca_class} />
                </div>
              </div>

              {formData.cca_class && (
                <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                  {ccaClasses.find(c => c.class_number === formData.cca_class)?.half_year_rule && (
                    <p>✓ Half-year rule applies (50% CCA in year of acquisition)</p>
                  )}
                  <p>✓ Declining balance method for tax purposes</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="gl" className="space-y-4 mt-4">
              <Alert>
                <AlertDescription className="text-sm">
                  These accounts drive posting to the General Ledger. The acquisition posts
                  <strong> DR Asset Account</strong> / <strong>CR Offset (Credit) Account</strong> on save,
                  making the asset appear on the Trial Balance and Balance Sheet. Depreciation accounts
                  are used when the periodic depreciation is run.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Asset Account (Balance Sheet) *</Label>
                <SearchableGLAccountSelect
                  value={formData.asset_account_id}
                  onValueChange={(id) => setFormData({ ...formData, asset_account_id: id })}
                  placeholder="e.g. Property, Plant & Equipment"
                />
              </div>

              <div className="space-y-2">
                <Label>Offset / Credit Account *</Label>
                <SearchableGLAccountSelect
                  value={formData.offset_account_id}
                  onValueChange={(id) => setFormData({ ...formData, offset_account_id: id })}
                  placeholder="e.g. Cash, Bank, Accounts Payable, Opening Balance Equity"
                />
                <p className="text-xs text-muted-foreground">
                  The account that funded the purchase — Cash/Bank for a paid purchase, AP for a vendor bill,
                  or Opening Balance Equity when loading historical assets.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Depreciation Expense Account</Label>
                  <SearchableGLAccountSelect
                    value={formData.depreciation_account_id}
                    onValueChange={(id) => setFormData({ ...formData, depreciation_account_id: id })}
                    placeholder="Expense account"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Accumulated Depreciation Account</Label>
                  <SearchableGLAccountSelect
                    value={formData.accumulated_depreciation_account_id}
                    onValueChange={(id) => setFormData({ ...formData, accumulated_depreciation_account_id: id })}
                    placeholder="Contra-asset account"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Asset Condition</Label>
                  <Select value={formData.asset_condition} onValueChange={(v) => setFormData({ ...formData, asset_condition: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ownership Status</Label>
                  <Select value={formData.ownership_status} onValueChange={(v) => setFormData({ ...formData, ownership_status: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="owned">Owned</SelectItem>
                      <SelectItem value="leased">Leased</SelectItem>
                      <SelectItem value="rented">Rented</SelectItem>
                      <SelectItem value="financed">Financed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Warranty Expiry</Label>
                  <Input type="date" value={formData.warranty_expiry_date} onChange={(e) => setFormData({ ...formData, warranty_expiry_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Insurance Expiry</Label>
                  <Input type="date" value={formData.insurance_expiry_date} onChange={(e) => setFormData({ ...formData, insurance_expiry_date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Policy Reference</Label>
                  <Input value={formData.insurance_policy_ref} onChange={(e) => setFormData({ ...formData, insurance_policy_ref: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Funding Source</Label>
                  <Input value={formData.funding_source} onChange={(e) => setFormData({ ...formData, funding_source: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createAsset.isPending}>{createAsset.isPending ? 'Creating...' : 'Create Asset'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Barcode, Package, MapPin, Factory, Settings, Plus, Check, ChevronsUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BarcodeGenerator } from './BarcodeGenerator';
import { useCreateInventoryItem, useInventoryCategories, useCreateInventoryCategory } from '@/hooks/useInventory';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { cn } from '@/lib/utils';

interface AdvancedInventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdvancedInventoryItemDialog({ open, onOpenChange }: AdvancedInventoryItemDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: categories = [] } = useInventoryCategories(organization?.id);
  const { data: accounts = [] } = useAccounts(organization?.id);
  const createItem = useCreateInventoryItem(organization?.id);
  const createCategory = useCreateInventoryCategory(organization?.id);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    unit_of_measure: 'each',
    cost_price: 0,
    selling_price: 0,
    quantity_on_hand: 0,
    reorder_point: 0,
    reorder_quantity: 0,
    inventory_account_id: '',
    cogs_account_id: '',
    income_account_id: '',
    is_taxable: true,
    is_active: true,
    tax_rate: 13,
    // Advanced fields
    valuation_method: 'fifo',
    min_order_quantity: 1,
    max_stock_level: '',
    lead_time_days: 0,
    safety_stock: 0,
    weight: '',
    weight_unit: 'kg',
    dimensions_length: '',
    dimensions_width: '',
    dimensions_height: '',
    dimensions_unit: 'cm',
    bin_location: '',
    manufacturer: '',
    manufacturer_part_number: '',
    warranty_months: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: any = {
      sku: formData.sku,
      name: formData.name,
      description: formData.description || null,
      category_id: formData.category_id || null,
      unit_of_measure: formData.unit_of_measure,
      cost_price: formData.cost_price,
      selling_price: formData.selling_price,
      quantity_on_hand: formData.quantity_on_hand,
      reorder_point: formData.reorder_point,
      reorder_quantity: formData.reorder_quantity,
      inventory_account_id: formData.inventory_account_id || null,
      cogs_account_id: formData.cogs_account_id || null,
      income_account_id: formData.income_account_id || null,
      is_taxable: formData.is_taxable,
      is_active: formData.is_active,
      tax_rate: formData.tax_rate,
      valuation_method: formData.valuation_method,
      min_order_quantity: formData.min_order_quantity,
      max_stock_level: formData.max_stock_level ? parseInt(formData.max_stock_level) : null,
      lead_time_days: formData.lead_time_days,
      safety_stock: formData.safety_stock,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      weight_unit: formData.weight_unit,
      dimensions_length: formData.dimensions_length ? parseFloat(formData.dimensions_length) : null,
      dimensions_width: formData.dimensions_width ? parseFloat(formData.dimensions_width) : null,
      dimensions_height: formData.dimensions_height ? parseFloat(formData.dimensions_height) : null,
      dimensions_unit: formData.dimensions_unit,
      bin_location: formData.bin_location || null,
      manufacturer: formData.manufacturer || null,
      manufacturer_part_number: formData.manufacturer_part_number || null,
      warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
    };
    
    await createItem.mutateAsync(submitData);
    onOpenChange(false);
    // Reset form
    setFormData({
      sku: '', name: '', description: '', category_id: '', unit_of_measure: 'each',
      cost_price: 0, selling_price: 0, quantity_on_hand: 0, reorder_point: 0, reorder_quantity: 0,
      inventory_account_id: '', cogs_account_id: '', income_account_id: '',
      is_taxable: true, is_active: true, tax_rate: 13, valuation_method: 'fifo',
      min_order_quantity: 1, max_stock_level: '', lead_time_days: 0, safety_stock: 0,
      weight: '', weight_unit: 'kg', dimensions_length: '', dimensions_width: '', dimensions_height: '',
      dimensions_unit: 'cm', bin_location: '', manufacturer: '', manufacturer_part_number: '', warranty_months: '',
    });
  };

  const assetAccounts = accounts.filter(a => a.account_type === 'asset');
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense');
  const incomeAccounts = accounts.filter(a => a.account_type === 'income');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Add Inventory Item
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Stock</TabsTrigger>
              <TabsTrigger value="physical">Physical</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="sku" 
                      value={formData.sku} 
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })} 
                      required 
                      className="font-mono"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setBarcodeDialogOpen(true)}>
                      <Barcode className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.category_id
                          ? categories.find(cat => cat.id === formData.category_id)?.name || 'Select'
                          : 'Select category'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search or add category..." 
                          value={newCategoryName}
                          onValueChange={setNewCategoryName}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {newCategoryName.trim() && (
                              <Button
                                variant="ghost"
                                className="w-full justify-start gap-2"
                                onClick={async () => {
                                  const result = await createCategory.mutateAsync({ name: newCategoryName.trim() });
                                  setFormData({ ...formData, category_id: result.id });
                                  setNewCategoryName('');
                                  setCategoryOpen(false);
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Create "{newCategoryName.trim()}"
                              </Button>
                            )}
                            {!newCategoryName.trim() && <span className="text-sm text-muted-foreground p-2">No categories found</span>}
                          </CommandEmpty>
                          <CommandGroup>
                            {categories.map((cat) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setFormData({ ...formData, category_id: cat.id });
                                  setCategoryOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.category_id === cat.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {cat.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                        {newCategoryName.trim() && categories.length > 0 && !categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()) && (
                          <div className="p-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start gap-2"
                              onClick={async () => {
                                const result = await createCategory.mutateAsync({ name: newCategoryName.trim() });
                                setFormData({ ...formData, category_id: result.id });
                                setNewCategoryName('');
                                setCategoryOpen(false);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Create "{newCategoryName.trim()}"
                            </Button>
                          </div>
                        )}
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Unit of Measure</Label>
                  <Select value={formData.unit_of_measure} onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="each">Each</SelectItem>
                      <SelectItem value="kg">Kilogram</SelectItem>
                      <SelectItem value="lb">Pound</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="case">Case</SelectItem>
                      <SelectItem value="pallet">Pallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valuation Method</Label>
                  <Select value={formData.valuation_method} onValueChange={(value) => setFormData({ ...formData, valuation_method: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fifo">FIFO</SelectItem>
                      <SelectItem value="lifo">LIFO</SelectItem>
                      <SelectItem value="weighted_average">Weighted Average</SelectItem>
                      <SelectItem value="specific_identification">Specific ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cost Price</Label>
                  <Input type="number" step="0.01" min="0" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price</Label>
                  <Input type="number" step="0.01" min="0" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2"><Settings className="w-4 h-4" /> Stock Management</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Initial Qty</Label>
                    <Input type="number" min="0" value={formData.quantity_on_hand} onChange={(e) => setFormData({ ...formData, quantity_on_hand: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Reorder Point</Label>
                    <Input type="number" min="0" value={formData.reorder_point} onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Reorder Qty</Label>
                    <Input type="number" min="0" value={formData.reorder_quantity} onChange={(e) => setFormData({ ...formData, reorder_quantity: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Safety Stock</Label>
                    <Input type="number" min="0" value={formData.safety_stock} onChange={(e) => setFormData({ ...formData, safety_stock: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label>Min Order Qty</Label>
                    <Input type="number" min="1" value={formData.min_order_quantity} onChange={(e) => setFormData({ ...formData, min_order_quantity: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Stock Level</Label>
                    <Input type="number" min="0" value={formData.max_stock_level} onChange={(e) => setFormData({ ...formData, max_stock_level: e.target.value })} placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Time (days)</Label>
                    <Input type="number" min="0" value={formData.lead_time_days} onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <Label>Taxable</Label>
                  <p className="text-sm text-muted-foreground">Apply sales tax to this item</p>
                </div>
                <Switch checked={formData.is_taxable} onCheckedChange={(checked) => setFormData({ ...formData, is_taxable: checked })} />
              </div>
            </TabsContent>

            <TabsContent value="physical" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Bin Location</Label>
                  <Input value={formData.bin_location} onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })} placeholder="e.g., A-1-3" />
                </div>
                <div className="space-y-2">
                  <Label>Warranty (months)</Label>
                  <Input type="number" min="0" value={formData.warranty_months} onChange={(e) => setFormData({ ...formData, warranty_months: e.target.value })} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Weight</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" step="0.01" min="0" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} placeholder="Weight" />
                  <Select value={formData.weight_unit} onValueChange={(v) => setFormData({ ...formData, weight_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="lb">Pounds (lb)</SelectItem>
                      <SelectItem value="oz">Ounces (oz)</SelectItem>
                      <SelectItem value="g">Grams (g)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Dimensions (L x W x H)</h4>
                <div className="grid grid-cols-4 gap-4">
                  <Input type="number" step="0.01" value={formData.dimensions_length} onChange={(e) => setFormData({ ...formData, dimensions_length: e.target.value })} placeholder="Length" />
                  <Input type="number" step="0.01" value={formData.dimensions_width} onChange={(e) => setFormData({ ...formData, dimensions_width: e.target.value })} placeholder="Width" />
                  <Input type="number" step="0.01" value={formData.dimensions_height} onChange={(e) => setFormData({ ...formData, dimensions_height: e.target.value })} placeholder="Height" />
                  <Select value={formData.dimensions_unit} onValueChange={(v) => setFormData({ ...formData, dimensions_unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cm">cm</SelectItem>
                      <SelectItem value="in">inches</SelectItem>
                      <SelectItem value="m">meters</SelectItem>
                      <SelectItem value="ft">feet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-1"><Factory className="w-4 h-4" /> Manufacturer</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Manufacturer</Label>
                    <Input value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>MPN (Part Number)</Label>
                    <Input value={formData.manufacturer_part_number} onChange={(e) => setFormData({ ...formData, manufacturer_part_number: e.target.value })} />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="accounts" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Map this item to GL accounts for automated journal entries.</p>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Inventory Account (Asset)</Label>
                  <Select value={formData.inventory_account_id} onValueChange={(value) => setFormData({ ...formData, inventory_account_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select asset account" /></SelectTrigger>
                    <SelectContent>{assetAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>COGS Account (Expense)</Label>
                  <Select value={formData.cogs_account_id} onValueChange={(value) => setFormData({ ...formData, cogs_account_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select expense account" /></SelectTrigger>
                    <SelectContent>{expenseAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Income Account</Label>
                  <Select value={formData.income_account_id} onValueChange={(value) => setFormData({ ...formData, income_account_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select income account" /></SelectTrigger>
                    <SelectContent>{incomeAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createItem.isPending}>{createItem.isPending ? 'Creating...' : 'Create Item'}</Button>
          </DialogFooter>
        </form>

        <BarcodeGenerator open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen} initialValue={formData.sku} onBarcodeGenerated={(v) => setFormData({ ...formData, sku: v })} />
      </DialogContent>
    </Dialog>
  );
}

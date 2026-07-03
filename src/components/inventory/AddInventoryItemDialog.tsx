import { useState } from 'react';
import { Barcode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BarcodeGenerator } from './BarcodeGenerator';
import { useCreateInventoryItem, useInventoryCategories } from '@/hooks/useInventory';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';

interface AddInventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddInventoryItemDialog({ open, onOpenChange }: AddInventoryItemDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: categories = [] } = useInventoryCategories(organization?.id);
  const { data: accounts = [] } = useAccounts();
  const createItem = useCreateInventoryItem(organization?.id);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createItem.mutateAsync({
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
    });
    
    onOpenChange(false);
    setFormData({
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
    });
  };

  const handleBarcodeGenerated = (value: string) => {
    setFormData({ ...formData, sku: value });
  };
  const assetAccounts = accounts.filter(a => a.account_type === 'asset');
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense');
  const incomeAccounts = accounts.filter(a => a.account_type === 'income');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Inventory Item</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => setBarcodeDialogOpen(true)}
                  title="Generate barcode"
                >
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
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit of Measure</Label>
              <Select value={formData.unit_of_measure} onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price</Label>
              <Input id="cost_price" type="number" step="0.01" min="0" value={formData.cost_price} onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling_price">Selling Price</Label>
              <Input id="selling_price" type="number" step="0.01" min="0" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">GL Account Mapping</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Inventory Account</Label>
                <Select value={formData.inventory_account_id} onValueChange={(value) => setFormData({ ...formData, inventory_account_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{assetAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>COGS Account</Label>
                <Select value={formData.cogs_account_id} onValueChange={(value) => setFormData({ ...formData, cogs_account_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{expenseAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Income Account</Label>
                <Select value={formData.income_account_id} onValueChange={(value) => setFormData({ ...formData, income_account_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{incomeAccounts.map((acc) => (<SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_taxable">Taxable</Label>
              <p className="text-sm text-muted-foreground">Apply sales tax</p>
            </div>
            <Switch id="is_taxable" checked={formData.is_taxable} onCheckedChange={(checked) => setFormData({ ...formData, is_taxable: checked })} />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createItem.isPending}>{createItem.isPending ? 'Creating...' : 'Create Item'}</Button>
          </DialogFooter>
        </form>

        {/* Barcode Generator Dialog */}
        <BarcodeGenerator
          open={barcodeDialogOpen}
          onOpenChange={setBarcodeDialogOpen}
          initialValue={formData.sku}
          onBarcodeGenerated={handleBarcodeGenerated}
        />
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { Barcode, Package, MapPin, Factory, Settings, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BarcodeGenerator } from './BarcodeGenerator';
import { useUpdateInventoryItem, useDeleteInventoryItem, useInventoryCategories, type InventoryItem } from '@/hooks/useInventory';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';

interface EditInventoryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
}

export function EditInventoryItemDialog({ open, onOpenChange, item }: EditInventoryItemDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: categories = [] } = useInventoryCategories(organization?.id);
  const { data: accounts = [] } = useAccounts(organization?.id);
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
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

  useEffect(() => {
    if (item) {
      setFormData({
        sku: item.sku,
        name: item.name,
        description: item.description || '',
        category_id: item.category_id || '',
        unit_of_measure: item.unit_of_measure,
        cost_price: item.cost_price,
        selling_price: item.selling_price,
        quantity_on_hand: item.quantity_on_hand,
        reorder_point: item.reorder_point || 0,
        reorder_quantity: item.reorder_quantity || 0,
        inventory_account_id: item.inventory_account_id || '',
        cogs_account_id: item.cogs_account_id || '',
        income_account_id: item.income_account_id || '',
        is_taxable: item.is_taxable,
        is_active: item.is_active,
        tax_rate: item.tax_rate || 13,
      });
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    await updateItem.mutateAsync({
      id: item.id,
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
  };

  const handleDelete = async () => {
    if (!item) return;
    await deleteItem.mutateAsync(item.id);
    onOpenChange(false);
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
            Edit Inventory Item
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Stock</TabsTrigger>
              <TabsTrigger value="accounts">Accounts</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-sku"
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
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">Item is available for transactions</p>
                </div>
                <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity on Hand</Label>
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

          <DialogFooter className="flex justify-between sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{item?.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={updateItem.isPending}>{updateItem.isPending ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </DialogFooter>
        </form>

        <BarcodeGenerator open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen} initialValue={formData.sku} onBarcodeGenerated={(v) => setFormData({ ...formData, sku: v })} />
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, ArrowDownRight, ClipboardCheck, Upload, Calculator, TrendingUp, Package, AlertTriangle, Pencil } from 'lucide-react';
import { useInventoryItems, useInventoryTransactions, type InventoryItem } from '@/hooks/useInventory';
import { useInventoryAdjustments } from '@/hooks/useInventoryAdjustments';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { AddInventoryItemDialog } from '@/components/inventory/AddInventoryItemDialog';
import { AdvancedInventoryItemDialog } from '@/components/inventory/AdvancedInventoryItemDialog';
import { ReceiveInventoryDialog } from '@/components/inventory/ReceiveInventoryDialog';
import { InventoryAdjustmentDialog } from '@/components/inventory/InventoryAdjustmentDialog';
import { BulkUploadInventoryDialog } from '@/components/inventory/BulkUploadInventoryDialog';
import { InventoryValuationPanel } from '@/components/inventory/InventoryValuationPanel';
import { EditInventoryItemDialog } from '@/components/inventory/EditInventoryItemDialog';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const isReadOnly = useIsReadOnly();
  const [showAdvancedAddDialog, setShowAdvancedAddDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showAdjustmentDialog, setShowAdjustmentDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const { organization } = useCurrentOrganization();
  
  const { data: items = [], isLoading } = useInventoryItems(organization?.id);
  const { data: transactions = [] } = useInventoryTransactions(organization?.id);
  const { data: adjustments = [] } = useInventoryAdjustments(organization?.id);

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

  const filteredItems = useMemo(() => items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, item) => sum + (item.quantity_on_hand * item.cost_price), 0);
    const lowStockCount = items.filter(i => i.quantity_on_hand <= (i.reorder_point || 0) && i.is_active).length;
    const outOfStockCount = items.filter(i => i.quantity_on_hand === 0 && i.is_active).length;
    const totalQty = items.reduce((sum, item) => sum + item.quantity_on_hand, 0);
    return {
      totalItems: items.length,
      totalValue,
      totalQty,
      lowStockCount,
      outOfStockCount,
    };
  }, [items]);

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground">Advanced inventory tracking with valuation</p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkUploadDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />Bulk Upload
            </Button>
            <Button variant="outline" onClick={() => setShowAdjustmentDialog(true)}>
              <ClipboardCheck className="h-4 w-4 mr-2" />Adjustment
            </Button>
            <Button variant="outline" onClick={() => setShowReceiveDialog(true)}>
              <ArrowDownRight className="h-4 w-4 mr-2" />Receive
            </Button>
            <Button onClick={() => setShowAdvancedAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />Add Item
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1"><Package className="w-4 h-4" /> Total Items</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalQty.toLocaleString()}</div></CardContent>
        </Card>
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Total Value</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalValue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{stats.lowStockCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Out of Stock</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{stats.outOfStockCount}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="valuation"><Calculator className="w-4 h-4 mr-1" /> Valuation</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
        </TabsList>
        
        <TabsContent value="items" className="space-y-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-sm" /></div>
          
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Status</TableHead>{!isReadOnly && <TableHead className="w-10"></TableHead>}</TableRow></TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? <TableRow><TableCell colSpan={isReadOnly ? 6 : 7} className="text-center py-8">No items</TableCell></TableRow> : filteredItems.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => !isReadOnly && setEditItem(item)}>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{item.quantity_on_hand}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost_price)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.quantity_on_hand * item.cost_price)}</TableCell>
                    <TableCell>{item.quantity_on_hand <= (item.reorder_point || 0) ? <Badge variant="secondary" className="bg-amber-100 text-amber-800">Low</Badge> : <Badge variant="secondary" className="bg-green-100 text-green-800">In Stock</Badge>}</TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditItem(item); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="valuation">
          <InventoryValuationPanel organizationId={organization?.id} />
        </TabsContent>
        
        <TabsContent value="transactions">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions</TableCell>
                    </TableRow>
                  ) : (
                    transactions.slice(0, 50).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{format(parseLocalDate(tx.transaction_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {tx.transaction_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{tx.reference || '-'}</TableCell>
                        <TableCell className="text-right">{tx.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.total_cost)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustments">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No adjustments</TableCell>
                    </TableRow>
                  ) : (
                    adjustments.map((adj: any) => (
                      <TableRow key={adj.id}>
                        <TableCell>{format(new Date(adj.adjustment_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-mono">{adj.adjustment_number}</TableCell>
                        <TableCell className="capitalize">{adj.reason.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={adj.status === 'posted' ? 'default' : 'secondary'}>
                            {adj.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{adj.notes || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddInventoryItemDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      <AdvancedInventoryItemDialog open={showAdvancedAddDialog} onOpenChange={setShowAdvancedAddDialog} />
      <ReceiveInventoryDialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog} />
      <InventoryAdjustmentDialog open={showAdjustmentDialog} onOpenChange={setShowAdjustmentDialog} organizationId={organization?.id} />
      <BulkUploadInventoryDialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog} />
      <EditInventoryItemDialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)} item={editItem} />
    </div>
  );
}

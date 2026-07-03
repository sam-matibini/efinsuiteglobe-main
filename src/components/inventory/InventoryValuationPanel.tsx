import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Package, FileText } from 'lucide-react';
import { useInventoryItems, useInventoryLots, InventoryItem, InventoryLot } from '@/hooks/useInventory';
import { useCreateInventoryValuation, useInventoryValuations } from '@/hooks/useInventoryValuations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface InventoryValuationPanelProps {
  organizationId?: string;
}

type ValuationMethod = 'fifo' | 'lifo' | 'weighted_average' | 'specific_identification';

export function InventoryValuationPanel({ organizationId }: InventoryValuationPanelProps) {
  const [selectedMethod, setSelectedMethod] = useState<ValuationMethod>('fifo');
  const { data: items = [] } = useInventoryItems(organizationId);
  const { data: lots = [] } = useInventoryLots();
  const { data: valuations = [] } = useInventoryValuations(organizationId);
  const createValuation = useCreateInventoryValuation();
  const { organization } = useCurrentOrganization();

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const valuationResults = useMemo(() => {
    return items.map(item => {
      const itemLots = lots.filter(l => l.item_id === item.id && l.quantity_remaining > 0)
        .sort((a, b) => parseLocalDate(a.received_date).getTime() - parseLocalDate(b.received_date).getTime());
      
      let value = 0;
      const qty = item.quantity_on_hand;

      if (selectedMethod === 'fifo') {
        // FIFO: Use oldest lots first
        let remaining = qty;
        for (const lot of itemLots) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, lot.quantity_remaining);
          value += take * lot.unit_cost;
          remaining -= take;
        }
        // If no lots, use cost_price
        if (itemLots.length === 0) value = qty * item.cost_price;
      } else if (selectedMethod === 'lifo') {
        // LIFO: Use newest lots first
        const reversedLots = [...itemLots].reverse();
        let remaining = qty;
        for (const lot of reversedLots) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, lot.quantity_remaining);
          value += take * lot.unit_cost;
          remaining -= take;
        }
        if (itemLots.length === 0) value = qty * item.cost_price;
      } else if (selectedMethod === 'weighted_average') {
        // Weighted average: total value / total quantity
        const itemAny = item as any;
        const avgCost = itemAny.average_cost || item.cost_price;
        value = qty * avgCost;
      } else {
        // Specific identification - use actual lot values
        value = itemLots.reduce((sum, lot) => sum + (lot.quantity_remaining * lot.unit_cost), 0);
      }

      return {
        item,
        quantity: qty,
        value,
        unitCost: qty > 0 ? value / qty : item.cost_price,
        lotsCount: itemLots.length,
      };
    });
  }, [items, lots, selectedMethod]);

  const totals = useMemo(() => ({
    items: valuationResults.length,
    quantity: valuationResults.reduce((sum, r) => sum + r.quantity, 0),
    value: valuationResults.reduce((sum, r) => sum + r.value, 0),
  }), [valuationResults]);

  const handleRecordValuation = async () => {
    if (!organizationId) return;
    
    await createValuation.mutateAsync({
      organization_id: organizationId,
      valuation_date: new Date().toISOString().split('T')[0],
      total_items: totals.items,
      total_quantity: totals.quantity,
      total_value: totals.value,
      valuation_method: selectedMethod,
      notes: null,
      created_by: null,
    });
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat(locale, { style: 'currency', currency: localization.currency }).format(amount);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="w-4 h-4" /> Total Items
            </CardDescription>
            <CardTitle className="text-2xl">{totals.items}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Quantity</CardDescription>
            <CardTitle className="text-2xl">{totals.quantity.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> Total Value ({selectedMethod.toUpperCase()})
            </CardDescription>
            <CardTitle className="text-2xl text-primary">{formatCurrency(totals.value)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg. Unit Cost</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(totals.quantity > 0 ? totals.value / totals.quantity : 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Inventory Valuation
              </CardTitle>
              <CardDescription>Calculate inventory value using different costing methods</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedMethod} onValueChange={(v) => setSelectedMethod(v as ValuationMethod)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fifo">FIFO (First-In, First-Out)</SelectItem>
                  <SelectItem value="lifo">LIFO (Last-In, First-Out)</SelectItem>
                  <SelectItem value="weighted_average">Weighted Average</SelectItem>
                  <SelectItem value="specific_identification">Specific Identification</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleRecordValuation} disabled={createValuation.isPending}>
                <FileText className="h-4 w-4 mr-2" />
                Record Valuation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty on Hand</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-center">Lots</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {valuationResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No inventory items
                  </TableCell>
                </TableRow>
              ) : (
                valuationResults.map(({ item, quantity, value, unitCost, lotsCount }) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{item.sku}</TableCell>
                    <TableCell className="text-right">{quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(unitCost)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(value)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{lotsCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Valuation History */}
      {valuations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Valuation History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuations.slice(0, 10).map((val) => (
                  <TableRow key={val.id}>
                    <TableCell>{format(new Date(val.valuation_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{val.valuation_method.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{val.total_items}</TableCell>
                    <TableCell className="text-right">{val.total_quantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(val.total_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

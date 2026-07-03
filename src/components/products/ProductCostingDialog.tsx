import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Percent, Calculator, Layers } from 'lucide-react';
import { useUpdateProductService, ProductService } from '@/hooks/useProductsServices';
import { useCostAllocations, useCreateCostAllocation } from '@/hooks/useCostAllocations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface ProductCostingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductService | null;
  organizationId?: string;
}

export function ProductCostingDialog({ open, onOpenChange, product, organizationId }: ProductCostingDialogProps) {
  const updateMutation = useUpdateProductService();
  const { data: allocations = [] } = useCostAllocations(organizationId, product?.id);
  const createAllocation = useCreateCostAllocation();
  const { organization } = useCurrentOrganization();

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const [formData, setFormData] = useState({
    cost_method: 'standard',
    standard_cost: '',
    labor_cost: '',
    material_cost: '',
    overhead_cost: '',
    selling_price: '',
    min_selling_price: '',
    margin_percent: '',
    markup_percent: '',
    max_discount_percent: '100',
    commission_percent: '',
    billable_rate: '',
    internal_rate: '',
    pricing_tier: 'standard',
  });

  const [newAllocation, setNewAllocation] = useState({
    cost_type: 'direct_labor',
    description: '',
    amount: '',
    allocation_method: 'fixed',
    allocation_rate: '',
  });

  useEffect(() => {
    if (product && open) {
      const p = product as any;
      setFormData({
        cost_method: p.cost_method || 'standard',
        standard_cost: p.standard_cost?.toString() || '',
        labor_cost: p.labor_cost?.toString() || '',
        material_cost: p.material_cost?.toString() || '',
        overhead_cost: p.overhead_cost?.toString() || '',
        selling_price: p.selling_price?.toString() || '',
        min_selling_price: p.min_selling_price?.toString() || '',
        margin_percent: p.margin_percent?.toString() || '',
        markup_percent: p.markup_percent?.toString() || '',
        max_discount_percent: p.max_discount_percent?.toString() || '100',
        commission_percent: p.commission_percent?.toString() || '',
        billable_rate: p.billable_rate?.toString() || '',
        internal_rate: p.internal_rate?.toString() || '',
        pricing_tier: p.pricing_tier || 'standard',
      });
    }
  }, [product, open]);

  // Calculate derived values
  const calculations = useMemo(() => {
    const laborCost = parseFloat(formData.labor_cost) || 0;
    const materialCost = parseFloat(formData.material_cost) || 0;
    const overheadCost = parseFloat(formData.overhead_cost) || 0;
    const totalCost = laborCost + materialCost + overheadCost;
    const sellingPrice = parseFloat(formData.selling_price) || 0;
    
    const grossProfit = sellingPrice - totalCost;
    const marginPercent = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
    const markupPercent = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;

    return {
      totalCost,
      grossProfit,
      marginPercent,
      markupPercent,
    };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    await updateMutation.mutateAsync({
      id: product.id,
      cost_method: formData.cost_method,
      standard_cost: formData.standard_cost ? parseFloat(formData.standard_cost) : null,
      labor_cost: formData.labor_cost ? parseFloat(formData.labor_cost) : null,
      material_cost: formData.material_cost ? parseFloat(formData.material_cost) : null,
      overhead_cost: formData.overhead_cost ? parseFloat(formData.overhead_cost) : null,
      selling_price: parseFloat(formData.selling_price) || product.selling_price,
      min_selling_price: formData.min_selling_price ? parseFloat(formData.min_selling_price) : null,
      margin_percent: formData.margin_percent ? parseFloat(formData.margin_percent) : null,
      markup_percent: formData.markup_percent ? parseFloat(formData.markup_percent) : null,
      max_discount_percent: formData.max_discount_percent ? parseFloat(formData.max_discount_percent) : null,
      commission_percent: formData.commission_percent ? parseFloat(formData.commission_percent) : null,
      billable_rate: formData.billable_rate ? parseFloat(formData.billable_rate) : null,
      internal_rate: formData.internal_rate ? parseFloat(formData.internal_rate) : null,
      pricing_tier: formData.pricing_tier,
    } as any);

    onOpenChange(false);
  };

  const handleAddAllocation = async () => {
    if (!organizationId || !product) return;

    await createAllocation.mutateAsync({
      organization_id: organizationId,
      product_service_id: product.id,
      cost_type: newAllocation.cost_type as any,
      description: newAllocation.description || null,
      amount: parseFloat(newAllocation.amount) || 0,
      allocation_method: newAllocation.allocation_method as any,
      allocation_rate: newAllocation.allocation_rate ? parseFloat(newAllocation.allocation_rate) : null,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: null,
      is_active: true,
    });

    setNewAllocation({ cost_type: 'direct_labor', description: '', amount: '', allocation_method: 'fixed', allocation_rate: '' });
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat(locale, { style: 'currency', currency: localization.currency }).format(amount);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Costing & Pricing: {product.name}
          </DialogTitle>
          <DialogDescription>Configure cost breakdown and pricing strategy</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="costing">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="costing">Cost Breakdown</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="allocations">Cost Allocations</TabsTrigger>
            </TabsList>

            <TabsContent value="costing" className="space-y-4 mt-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Cost</CardDescription>
                    <CardTitle className="text-xl text-blue-700">{formatCurrency(calculations.totalCost)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-2">
                    <CardDescription>Gross Profit</CardDescription>
                    <CardTitle className="text-xl text-green-700">{formatCurrency(calculations.grossProfit)}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1"><Percent className="w-3 h-3" /> Margin</CardDescription>
                    <CardTitle className="text-xl">{calculations.marginPercent.toFixed(1)}%</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Markup</CardDescription>
                    <CardTitle className="text-xl">{calculations.markupPercent.toFixed(1)}%</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cost Method</Label>
                  <Select value={formData.cost_method} onValueChange={(v) => setFormData({ ...formData, cost_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Costing</SelectItem>
                      <SelectItem value="actual">Actual Costing</SelectItem>
                      <SelectItem value="average">Average Costing</SelectItem>
                      <SelectItem value="fifo">FIFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Standard Cost</Label>
                  <Input type="number" step="0.01" value={formData.standard_cost} onChange={(e) => setFormData({ ...formData, standard_cost: e.target.value })} placeholder="0.00" />
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2"><Layers className="w-4 h-4" /> Cost Components</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Labor Cost</Label>
                    <Input type="number" step="0.01" value={formData.labor_cost} onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Material Cost</Label>
                    <Input type="number" step="0.01" value={formData.material_cost} onChange={(e) => setFormData({ ...formData, material_cost: e.target.value })} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Overhead Cost</Label>
                    <Input type="number" step="0.01" value={formData.overhead_cost} onChange={(e) => setFormData({ ...formData, overhead_cost: e.target.value })} placeholder="0.00" />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Selling Price *</Label>
                  <Input type="number" step="0.01" value={formData.selling_price} onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Selling Price</Label>
                  <Input type="number" step="0.01" value={formData.min_selling_price} onChange={(e) => setFormData({ ...formData, min_selling_price: e.target.value })} placeholder="Floor price" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Discount %</Label>
                  <Input type="number" step="0.01" max="100" value={formData.max_discount_percent} onChange={(e) => setFormData({ ...formData, max_discount_percent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Commission %</Label>
                  <Input type="number" step="0.01" max="100" value={formData.commission_percent} onChange={(e) => setFormData({ ...formData, commission_percent: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Pricing Tier</Label>
                  <Select value={formData.pricing_tier} onValueChange={(v) => setFormData({ ...formData, pricing_tier: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="economy">Economy</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {product.type === 'service' && (
                <div className="border rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Service Rates</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Billable Rate (per hour)</Label>
                      <Input type="number" step="0.01" value={formData.billable_rate} onChange={(e) => setFormData({ ...formData, billable_rate: e.target.value })} placeholder="Client rate" />
                    </div>
                    <div className="space-y-2">
                      <Label>Internal Rate (per hour)</Label>
                      <Input type="number" step="0.01" value={formData.internal_rate} onChange={(e) => setFormData({ ...formData, internal_rate: e.target.value })} placeholder="Internal cost" />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="allocations" className="space-y-4 mt-4">
              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Add Cost Allocation</h4>
                <div className="grid grid-cols-4 gap-3">
                  <Select value={newAllocation.cost_type} onValueChange={(v) => setNewAllocation({ ...newAllocation, cost_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct_labor">Direct Labor</SelectItem>
                      <SelectItem value="direct_material">Direct Material</SelectItem>
                      <SelectItem value="overhead">Overhead</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="variable">Variable</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={newAllocation.description} onChange={(e) => setNewAllocation({ ...newAllocation, description: e.target.value })} placeholder="Description" />
                  <Input type="number" step="0.01" value={newAllocation.amount} onChange={(e) => setNewAllocation({ ...newAllocation, amount: e.target.value })} placeholder="Amount" />
                  <Button type="button" onClick={handleAddAllocation} disabled={createAllocation.isPending}>Add</Button>
                </div>
              </div>

              {allocations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Current Allocations</h4>
                  {allocations.map((alloc) => (
                    <div key={alloc.id} className="flex items-center justify-between border rounded p-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{alloc.cost_type.replace('_', ' ')}</Badge>
                        <span className="text-sm">{alloc.description || 'No description'}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(alloc.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

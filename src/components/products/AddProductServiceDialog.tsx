import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateProductService } from '@/hooks/useProductsServices';
import { useAccounts } from '@/hooks/useAccounts';
import { useTaxCodes } from '@/hooks/useSalesTax';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Package, Wrench, Check, ChevronsUpDown, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddProductServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'product' | 'service';
}

export function AddProductServiceDialog({
  open,
  onOpenChange,
  defaultType = 'product',
}: AddProductServiceDialogProps) {
  const { organization } = useCurrentOrganization();
  const createMutation = useCreateProductService();
  const { data: accounts = [] } = useAccounts(organization?.id);
  const { data: taxCodes = [] } = useTaxCodes(organization?.id);

  const [type, setType] = useState<'product' | 'service'>(defaultType);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('each');
  const [isTaxable, setIsTaxable] = useState(true);
  const [selectedTaxCodeId, setSelectedTaxCodeId] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [taxCodeOpen, setTaxCodeOpen] = useState(false);
  const [incomeAccountOpen, setIncomeAccountOpen] = useState(false);
  const [expenseAccountOpen, setExpenseAccountOpen] = useState(false);

  // Get selected tax code details
  const selectedTaxCode = useMemo(() => {
    return taxCodes.find(tc => tc.id === selectedTaxCodeId);
  }, [taxCodes, selectedTaxCodeId]);

  const incomeAccounts = accounts.filter(a => a.account_type === 'income' && !a.is_header);
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense' && !a.is_header);

  const selectedIncomeAccount = useMemo(() => {
    return incomeAccounts.find(a => a.id === incomeAccountId);
  }, [incomeAccounts, incomeAccountId]);

  const selectedExpenseAccount = useMemo(() => {
    return expenseAccounts.find(a => a.id === expenseAccountId);
  }, [expenseAccounts, expenseAccountId]);

  const resetForm = () => {
    setType(defaultType);
    setName('');
    setSku('');
    setDescription('');
    setSellingPrice('');
    setCostPrice('');
    setUnitOfMeasure('each');
    setIsTaxable(true);
    setSelectedTaxCodeId('');
    setTaxRate('');
    setIncomeAccountId('');
    setExpenseAccountId('');
    setCategory('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !name || !sellingPrice) return;

    await createMutation.mutateAsync({
      organization_id: organization.id,
      type,
      name,
      sku: sku || undefined,
      description: description || undefined,
      selling_price: parseFloat(sellingPrice),
      cost_price: costPrice ? parseFloat(costPrice) : undefined,
      unit_of_measure: unitOfMeasure,
      is_taxable: isTaxable,
      tax_rate: selectedTaxCode ? selectedTaxCode.rate : (taxRate ? parseFloat(taxRate) : undefined),
      income_account_id: incomeAccountId || undefined,
      expense_account_id: expenseAccountId || undefined,
      category: category || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product or Service</DialogTitle>
          <DialogDescription>
            Create a new product or service for invoicing and sales.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={type} onValueChange={(v) => setType(v as 'product' | 'service')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="product" className="gap-2">
                <Package className="w-4 h-4" />
                Product
              </TabsTrigger>
              <TabsTrigger value="service" className="gap-2">
                <Wrench className="w-4 h-4" />
                Service
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Products are physical items that you sell. They can be tracked in inventory.
              </p>
            </TabsContent>
            <TabsContent value="service" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Services are intangible offerings like consulting, labor, or subscriptions.
              </p>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'product' ? 'Widget Pro' : 'Consulting Hour'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Code</Label>
              <Input
                id="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="WIDGET-001"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price *</Label>
              <Input
                id="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitOfMeasure">Unit</Label>
              <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="hour">Hour</SelectItem>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="lb">Pound</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="case">Case</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Electronics, Professional Services"
            />
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Tax Settings
            </h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="taxable">Taxable</Label>
              <Switch
                id="taxable"
                checked={isTaxable}
                onCheckedChange={setIsTaxable}
              />
            </div>
            {isTaxable && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tax Code</Label>
                  <Popover open={taxCodeOpen} onOpenChange={setTaxCodeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={taxCodeOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedTaxCode
                          ? `${selectedTaxCode.code} - ${selectedTaxCode.name}`
                          : "Select tax code..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-background z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Search tax codes..." />
                        <CommandList>
                          <CommandEmpty>No tax code found.</CommandEmpty>
                          <CommandGroup>
                            {taxCodes.map((tc) => (
                              <CommandItem
                                key={tc.id}
                                value={`${tc.code} ${tc.name}`}
                                onSelect={() => {
                                  setSelectedTaxCodeId(tc.id === selectedTaxCodeId ? '' : tc.id);
                                  setTaxRate(tc.rate.toString());
                                  setTaxCodeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedTaxCodeId === tc.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{tc.code}</span>
                                  <span className="text-muted-foreground ml-2">{tc.name}</span>
                                </div>
                                <span className="text-muted-foreground">{tc.rate}%</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {!selectedTaxCode && (
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">Or enter custom tax rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="13.00"
                    />
                  </div>
                )}
                {selectedTaxCode && (
                  <p className="text-sm text-muted-foreground">
                    Tax rate: {selectedTaxCode.rate}% ({selectedTaxCode.jurisdiction || 'General'})
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 space-y-4">
            <h4 className="font-medium">GL Account Mapping</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Income Account</Label>
                <Popover open={incomeAccountOpen} onOpenChange={setIncomeAccountOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={incomeAccountOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedIncomeAccount
                        ? `${selectedIncomeAccount.code} - ${selectedIncomeAccount.name}`
                        : "Select income account..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search income accounts..." />
                      <CommandList>
                        <CommandEmpty>No account found.</CommandEmpty>
                        <CommandGroup>
                          {incomeAccounts.map((account) => (
                            <CommandItem
                              key={account.id}
                              value={`${account.code} ${account.name}`}
                              onSelect={() => {
                                setIncomeAccountId(account.id === incomeAccountId ? '' : account.id);
                                setIncomeAccountOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  incomeAccountId === account.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-mono text-xs mr-2">{account.code}</span>
                              <span className="truncate">{account.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Expense/COGS Account</Label>
                <Popover open={expenseAccountOpen} onOpenChange={setExpenseAccountOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={expenseAccountOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedExpenseAccount
                        ? `${selectedExpenseAccount.code} - ${selectedExpenseAccount.name}`
                        : "Select expense account..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search expense accounts..." />
                      <CommandList>
                        <CommandEmpty>No account found.</CommandEmpty>
                        <CommandGroup>
                          {expenseAccounts.map((account) => (
                            <CommandItem
                              key={account.id}
                              value={`${account.code} ${account.name}`}
                              onSelect={() => {
                                setExpenseAccountId(account.id === expenseAccountId ? '' : account.id);
                                setExpenseAccountOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  expenseAccountId === account.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-mono text-xs mr-2">{account.code}</span>
                              <span className="truncate">{account.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : `Create ${type === 'product' ? 'Product' : 'Service'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

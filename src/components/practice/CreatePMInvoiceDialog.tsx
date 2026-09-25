import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, parseLocalDate } from '@/lib/utils';
import { 
  usePMClients, 
  usePMEngagements, 
  useUnbilledTimeEntries,
  useCreatePMInvoice,
  type PMInvoiceInput,
} from '@/hooks/usePracticeManagement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useProductsServices } from '@/hooks/useProductsServices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CombinedTaxRateCombobox } from '@/components/tax/CombinedTaxRateCombobox';


const formSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  engagement_id: z.string().optional(),
  invoice_date: z.date(),
  due_date: z.date(),
  tax_rate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface InvoiceLine {
  id: string;
  time_entry_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_type: 'service' | 'time' | 'expense' | 'fixed_fee' | 'retainer' | 'adjustment';
  product_service_id?: string;
  tax_jurisdiction?: string;
  tax_rate?: number;
}

// Searchable combobox for selecting a product/service or typing a custom description
function DescriptionCombobox({
  value,
  productServiceId,
  productsServices,
  onChange,
}: {
  value: string;
  productServiceId?: string;
  productsServices: { id: string; name: string; selling_price: number; type: string; category: string | null }[];
  onChange: (description: string, ps: { id: string; selling_price: number; type: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return productsServices;
    const term = search.toLowerCase();
    return productsServices.filter(
      ps => ps.name.toLowerCase().includes(term) || ps.category?.toLowerCase().includes(term)
    );
  }, [search, productsServices]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start font-normal h-9 text-xs truncate"
        >
          <span className="truncate">{value || 'Select item...'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 z-50" align="start">
        <div className="border-b px-3 py-2">
          <Input
            placeholder="Search products & services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[200px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">No items found</p>
          ) : (
            filtered.map((ps) => (
              <button
                key={ps.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                onClick={() => {
                  onChange(ps.name, ps);
                  setSearch('');
                  setOpen(false);
                }}
              >
                <div>
                  <div className="font-medium">{ps.name}</div>
                  {ps.category && <div className="text-xs text-muted-foreground">{ps.category}</div>}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">${ps.selling_price.toFixed(2)}</span>
              </button>
            ))
          )}
        </div>
        {/* Allow custom description */}
        {search && !filtered.some(ps => ps.name.toLowerCase() === search.toLowerCase()) && (
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm border-t hover:bg-accent text-primary"
            onClick={() => {
              onChange(search, null);
              setSearch('');
              setOpen(false);
            }}
          >
            Use "{search}" as custom description
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface CreatePMInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePMInvoiceDialog({ open, onOpenChange }: CreatePMInvoiceDialogProps) {
  const { data: clients } = usePMClients();
  const createInvoice = useCreatePMInvoice();
  const { formatWithSymbol } = useCurrencyFormatter();
  const { organization } = useCurrentOrganization();
  const { data: productsServices = [] } = useProductsServices(organization?.id);
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<Set<string>>(new Set());

  const { data: engagements } = usePMEngagements(selectedClientId || undefined);
  const { data: unbilledEntries } = useUnbilledTimeEntries(selectedClientId || undefined, selectedEngagementId || undefined);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: '',
      engagement_id: '',
      invoice_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      tax_rate: 0,
      notes: '',
      terms: 'Payment due within 30 days.',
    },
  });

  // Reset engagement when client changes
  useEffect(() => {
    if (selectedClientId) {
      form.setValue('engagement_id', '');
      setSelectedEngagementId(null);
      setSelectedTimeEntries(new Set());
    }
  }, [selectedClientId, form]);

  // Calculate totals
  const subtotal = useMemo(() => 
    lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0), 
    [lines]
  );

  const taxAmount = useMemo(() =>
    lines.reduce((sum, line) => {
      const lineTotal = line.quantity * line.unit_price;
      return sum + lineTotal * ((line.tax_rate || 0) / 100);
    }, 0),
    [lines]
  );
  const total = subtotal + taxAmount;

  const handleAddTimeEntriesToInvoice = () => {
    if (!unbilledEntries) return;

    const newLines: InvoiceLine[] = [];
    unbilledEntries.forEach(entry => {
      if (selectedTimeEntries.has(entry.id)) {
        newLines.push({
          id: `te-${entry.id}`,
          time_entry_id: entry.id,
          description: `${entry.task?.name || entry.engagement?.name || 'Time Entry'} - ${entry.description || format(parseLocalDate(entry.entry_date), 'MMM d, yyyy')}`,
          quantity: entry.hours,
          unit_price: entry.billing_rate || entry.engagement?.hourly_rate || 0,
          line_type: 'time',
        });
      }
    });

    setLines(prev => [...prev, ...newLines]);
    setSelectedTimeEntries(new Set());
  };

  const handleAddManualLine = () => {
    setLines(prev => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        description: '',
        quantity: 1,
        unit_price: 0,
        line_type: 'service',
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setLines(prev => prev.filter(line => line.id !== id));
  };

  const handleUpdateLine = (id: string, field: keyof InvoiceLine, value: string | number) => {
    setLines(prev => prev.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
  };

  const toggleTimeEntry = (entryId: string) => {
    setSelectedTimeEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const onSubmit = async (data: FormData) => {
    if (lines.length === 0) {
      return;
    }

    const input: PMInvoiceInput = {
      client_id: data.client_id,
      engagement_id: data.engagement_id || undefined,
      invoice_date: format(data.invoice_date, 'yyyy-MM-dd'),
      due_date: format(data.due_date, 'yyyy-MM-dd'),
      tax_rate: data.tax_rate || 0,
      notes: data.notes,
      terms: data.terms,
      lines: lines.map(line => ({
        time_entry_id: line.time_entry_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        line_type: line.line_type,
      })),
    };

    await createInvoice.mutateAsync(input);
    form.reset();
    setLines([]);
    setSelectedClientId(null);
    setSelectedEngagementId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Client Invoice</DialogTitle>
          <DialogDescription>
            Generate an invoice from unbilled time entries or add manual line items.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client & Engagement Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedClientId(value);
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        {clients?.filter(c => c.status === 'active').map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="engagement_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Engagement (Optional)</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        const actualValue = value === 'all' ? '' : value;
                        field.onChange(actualValue);
                        setSelectedEngagementId(actualValue || null);
                      }} 
                      value={field.value || 'all'}
                      disabled={!selectedClientId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All engagements" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="all">All Engagements</SelectItem>
                        {engagements?.map((eng) => (
                          <SelectItem key={eng.id} value={eng.id}>
                            {eng.name} ({eng.engagement_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Unbilled Time Entries */}
            {selectedClientId && unbilledEntries && unbilledEntries.length > 0 && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Unbilled Time Entries</h4>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleAddTimeEntriesToInvoice}
                    disabled={selectedTimeEntries.size === 0}
                  >
                    Add Selected ({selectedTimeEntries.size})
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unbilledEntries.map((entry) => {
                        // Skip entries already added as lines
                        if (lines.some(l => l.time_entry_id === entry.id)) return null;
                        const rate = entry.billing_rate || entry.engagement?.hourly_rate || 0;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedTimeEntries.has(entry.id)}
                                onCheckedChange={() => toggleTimeEntry(entry.id)}
                              />
                            </TableCell>
                            <TableCell>{format(parseLocalDate(entry.entry_date), 'MMM d')}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {entry.task?.name || entry.description || entry.engagement?.name}
                            </TableCell>
                            <TableCell className="text-right">{entry.hours.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{formatWithSymbol(rate)}</TableCell>
                            <TableCell className="text-right">{formatWithSymbol(entry.hours * rate)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Invoice Lines */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Invoice Lines</h4>
                <Button type="button" variant="outline" size="sm" onClick={handleAddManualLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No line items. Add unbilled time entries above or add a manual line.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-28">Price</TableHead>
                      <TableHead className="w-40">Tax Rate</TableHead>
                      <TableHead className="w-28 text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>
                          <DescriptionCombobox
                            value={line.description}
                            productServiceId={line.product_service_id}
                            productsServices={productsServices}
                            onChange={(desc, ps) => {
                              setLines(prev => prev.map(l => l.id === line.id ? {
                                ...l,
                                description: desc,
                                product_service_id: ps?.id,
                                unit_price: ps?.selling_price ?? l.unit_price,
                                line_type: ps?.type === 'product' ? 'expense' : 'service',
                              } : l));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.25"
                            min="0"
                            value={line.quantity}
                            onChange={(e) => handleUpdateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unit_price}
                            onChange={(e) => handleUpdateLine(line.id, 'unit_price', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <CombinedTaxRateCombobox
                            value={line.tax_jurisdiction}
                            onValueChange={(code, option) => {
                              setLines(prev => prev.map(l => l.id === line.id ? {
                                ...l,
                                tax_jurisdiction: code || undefined,
                                tax_rate: option?.combinedRate ?? 0,
                              } : l));
                            }}
                            placeholder="No tax"
                            className="h-9 text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatWithSymbol(line.quantity * line.unit_price)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Totals */}
              {lines.length > 0 && (
                <div className="mt-4 flex flex-col items-end gap-1 border-t pt-4">
                  <div className="flex justify-between w-48">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatWithSymbol(subtotal)}</span>
                  </div>
                  {taxAmount > 0 && (
                    <div className="flex justify-between w-48">
                      <span className="text-muted-foreground">Tax:</span>
                      <span>{formatWithSymbol(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between w-48 font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatWithSymbol(total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes & Terms */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes for the client..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Payment due within 30 days." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createInvoice.isPending || lines.length === 0}>
                {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

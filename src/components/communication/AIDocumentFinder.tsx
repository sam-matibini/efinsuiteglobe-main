import { useState } from 'react';
import { Search, FileText, Receipt, FileSpreadsheet, Sparkles, Loader2, ExternalLink, Paperclip, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

export type DocResultType = 'invoice' | 'bill_of_sale' | 'bill' | 'paystub';

export interface DocumentResult {
  id: string;
  type: DocResultType;
  title: string;
  description: string;
  date: string;
  amount?: number;
  party?: string;
  status?: string;
  // for paystubs
  employeeId?: string;
  // for navigation
  url?: string;
}

interface AIDocumentFinderProps {
  onAttachDocument?: (doc: DocumentResult) => Promise<void> | void;
  isAttaching?: boolean;
}

type DateRange = 'all' | '7d' | '30d' | '90d' | '365d';
type TypeFilter = 'all' | DocResultType;

const sinceISO = (range: DateRange): string | null => {
  if (range === 'all') return null;
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[range];
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

export function AIDocumentFinder({ onAttachDocument, isAttaching }: AIDocumentFinderProps) {
  const { currentOrganization } = useOrganizationContext();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('90d');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DocumentResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);

  const getIcon = (type: DocResultType) => {
    switch (type) {
      case 'invoice': return <Receipt className="w-5 h-5 text-emerald-500" />;
      case 'bill_of_sale': return <Car className="w-5 h-5 text-purple-500" />;
      case 'bill': return <FileText className="w-5 h-5 text-amber-500" />;
      case 'paystub': return <FileSpreadsheet className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleSearch = async (overrides?: { type?: TypeFilter; q?: string }) => {
    const effectiveType = overrides?.type ?? typeFilter;
    const effectiveQ = overrides?.q ?? query;

    if (!currentOrganization?.id) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const since = sinceISO(dateRange);
      const q = effectiveQ.trim();
      const out: DocumentResult[] = [];

      const wantInvoice = effectiveType === 'all' || effectiveType === 'invoice' || effectiveType === 'bill_of_sale';
      const wantBill = effectiveType === 'all' || effectiveType === 'bill';
      const wantPaystub = effectiveType === 'all' || effectiveType === 'paystub';

      // Invoices (+ bill of sales)
      if (wantInvoice) {
        let qb: any = supabase
          .from('invoices')
          .select('id, invoice_number, invoice_date, total, status, document_title, customer:customers(name, email)')
          .eq('organization_id', currentOrganization.id)
          .is('deleted_at', null)
          .order('invoice_date', { ascending: false })
          .limit(50);
        if (since) qb = qb.gte('invoice_date', since);
        if (q) qb = qb.or(`invoice_number.ilike.%${q}%,document_title.ilike.%${q}%`);

        const { data: invoices } = await qb;
        (invoices || []).forEach((inv: any) => {
          const isBoS = (inv.document_title || '').toLowerCase().includes('bill of sale');
          const t: DocResultType = isBoS ? 'bill_of_sale' : 'invoice';
          if (effectiveType !== 'all' && effectiveType !== t) return;
          // Customer-name filter (post-fetch since it's a relation)
          if (q && !inv.invoice_number?.toLowerCase().includes(q.toLowerCase())
              && !(inv.document_title || '').toLowerCase().includes(q.toLowerCase())
              && !(inv.customer?.name || '').toLowerCase().includes(q.toLowerCase())) {
            return;
          }
          out.push({
            id: inv.id,
            type: t,
            title: `${isBoS ? 'Bill of Sale' : 'Invoice'} ${inv.invoice_number}`,
            description: inv.customer?.name || 'Unknown customer',
            date: inv.invoice_date,
            amount: Number(inv.total) || 0,
            party: inv.customer?.name,
            status: inv.status,
            url: `/invoices?focus=${inv.id}`,
          });
        });
      }

      // Bills
      if (wantBill) {
        let qb: any = supabase
          .from('bills')
          .select('id, bill_number, bill_date, total, status, vendor:vendors(name)')
          .eq('organization_id', currentOrganization.id)
          .is('deleted_at', null)
          .order('bill_date', { ascending: false })
          .limit(50);
        if (since) qb = qb.gte('bill_date', since);
        if (q) qb = qb.or(`bill_number.ilike.%${q}%`);

        const { data: bills } = await qb;
        (bills || []).forEach((b: any) => {
          if (q && !b.bill_number?.toLowerCase().includes(q.toLowerCase())
              && !(b.vendor?.name || '').toLowerCase().includes(q.toLowerCase())) {
            return;
          }
          out.push({
            id: b.id,
            type: 'bill',
            title: `Bill ${b.bill_number}`,
            description: b.vendor?.name || 'Unknown vendor',
            date: b.bill_date,
            amount: Number(b.total) || 0,
            party: b.vendor?.name,
            status: b.status,
            url: `/bills?focus=${b.id}`,
          });
        });
      }

      // Paystubs (join pay_runs + employees)
      if (wantPaystub) {
        const { data: payRuns } = await supabase
          .from('pay_runs')
          .select('id, pay_period_start, pay_period_end, pay_date, status')
          .eq('organization_id', currentOrganization.id)
          .in('status', ['approved', 'paid'])
          .order('pay_date', { ascending: false })
          .limit(40);

        const filteredRuns = (payRuns || []).filter((pr: any) => {
          if (since && pr.pay_date < since) return false;
          return true;
        });

        if (filteredRuns.length) {
          const runIds = filteredRuns.map((p: any) => p.id);
          const { data: stubs } = await supabase
            .from('pay_stubs')
            .select('id, pay_run_id, employee_id, gross_pay, net_pay, employees:employees(first_name, last_name, employee_number)')
            .in('pay_run_id', runIds)
            .limit(200);

          const runMap = new Map(filteredRuns.map((r: any) => [r.id, r]));
          (stubs || []).forEach((s: any) => {
            const run: any = runMap.get(s.pay_run_id);
            if (!run) return;
            const emp = s.employees || {};
            const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Employee';
            if (q && !fullName.toLowerCase().includes(q.toLowerCase())
                && !(emp.employee_number || '').toLowerCase().includes(q.toLowerCase())) {
              return;
            }
            out.push({
              id: s.id,
              type: 'paystub',
              title: `Paystub — ${fullName}`,
              description: `Period ${run.pay_period_start} → ${run.pay_period_end}`,
              date: run.pay_date,
              amount: Number(s.net_pay) || 0,
              party: fullName,
              status: run.status,
              employeeId: s.employee_id,
              url: `/payroll/employees/${s.employee_id}`,
            });
          });
        }
      }

      // Sort by date desc
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      setResults(out);

      if (out.length === 0) toast.info('No documents found');
    } catch (err) {
      console.error('Document search error:', err);
      toast.error('Failed to search documents');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAttach = async (doc: DocumentResult) => {
    if (!onAttachDocument) return;
    setAttachingId(doc.id);
    try {
      await onAttachDocument(doc);
    } finally {
      setAttachingId(null);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="bg-accent/5 rounded-lg p-3 border border-accent/20">
        <div className="flex items-center gap-2 text-accent font-medium mb-2">
          <Sparkles className="w-4 h-4" />
          Find &amp; attach documents
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Search invoices, bills of sale, vendor bills and employee paystubs to attach instantly.
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Number, customer/vendor/employee name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v as TypeFilter); handleSearch({ type: v as TypeFilter }); }}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="bill_of_sale">Bills of Sale</SelectItem>
              <SelectItem value="bill">Bills</SelectItem>
              <SelectItem value="paystub">Paystubs</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="365d">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => handleSearch()} disabled={isSearching}>
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mb-3 opacity-50" />
                  <p className="font-medium">No documents found</p>
                  <p className="text-sm">Try a different search or expand the date range</p>
                </div>
              ) : (
                <div className="divide-y">
                  {results.map((doc) => (
                    <div key={`${doc.type}-${doc.id}`} className="p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted shrink-0">{getIcon(doc.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{doc.title}</span>
                            {typeof doc.amount === 'number' && (
                              <span className="text-sm font-semibold text-emerald-600 shrink-0">
                                {formatCurrency(doc.amount)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{new Date(doc.date).toLocaleDateString()}</span>
                            {doc.status && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{doc.status}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {doc.url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Open in new tab"
                              onClick={() => window.open(doc.url, '_blank', 'noopener')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={attachingId === doc.id || isAttaching}
                            onClick={() => handleAttach(doc)}
                            className="gap-1"
                          >
                            {attachingId === doc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Paperclip className="w-3.5 h-3.5" />
                            )}
                            Attach
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

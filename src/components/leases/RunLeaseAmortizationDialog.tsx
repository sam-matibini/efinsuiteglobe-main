import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Play, RefreshCw, Calendar, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLeases, Lease, LeasePaymentSchedule } from '@/hooks/useLeases';
import { useBatchLeasePaymentPosting } from '@/hooks/useLeaseGL';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RunLeaseAmortizationDialog({ open, onOpenChange }: Props) {
  const { organization } = useCurrentOrganization();
  const { data: leases = [], isLoading: leasesLoading, refetch: refetchLeases } = useLeases();
  const batchPost = useBatchLeasePaymentPosting();
  
  const [periodDate, setPeriodDate] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  
  // Get all payment schedules for active leases
  const activeLeases = useMemo(() => 
    leases.filter(l => l.status === 'active'),
    [leases]
  );
  
  // Calculate period range
  const periodStart = useMemo(() => {
    const [y, m] = periodDate.split('-').map(Number);
    return startOfMonth(new Date(y, m - 1, 1));
  }, [periodDate]);
  const periodEnd = useMemo(() => endOfMonth(periodStart), [periodStart]);
  
  // Find payments due in the selected period across all leases
  const [allPayments, setAllPayments] = useState<Array<{ lease: Lease; payment: LeasePaymentSchedule }>>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  
  // Load payments when period changes
  const loadPaymentsForPeriod = async () => {
    if (!organization?.id) return;
    
    setLoadingPayments(true);
    try {
      // supabase is now statically imported at the top
      
      // Fetch all scheduled payments for active leases within the period
      const { data: payments, error } = await supabase
        .from('lease_payment_schedule')
        .select('*')
        .in('lease_id', activeLeases.map(l => l.id))
        .eq('status', 'scheduled')
        .gte('payment_date', format(periodStart, 'yyyy-MM-dd'))
        .lte('payment_date', format(periodEnd, 'yyyy-MM-dd'))
        .order('payment_date');
      
      if (error) throw error;
      
      // Map payments to their leases
      const paymentWithLeases = (payments || []).map(payment => {
        const lease = activeLeases.find(l => l.id === payment.lease_id);
        return lease ? { lease, payment: payment as LeasePaymentSchedule } : null;
      }).filter(Boolean) as Array<{ lease: Lease; payment: LeasePaymentSchedule }>;
      
      setAllPayments(paymentWithLeases);
      
      // Auto-select all payments with proper GL mapping
      const validPaymentIds = paymentWithLeases
        .filter(({ lease }) => 
          lease.lease_liability_account_id && 
          lease.interest_expense_account_id
        )
        .map(({ payment }) => payment.id);
      setSelectedPayments(new Set(validPaymentIds));
      
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast.error('Failed to load payment schedules');
    } finally {
      setLoadingPayments(false);
    }
  };
  
  // Load payments on open or period change
  useMemo(() => {
    if (open && activeLeases.length > 0) {
      loadPaymentsForPeriod();
    }
  }, [open, periodDate, activeLeases.length]);
  
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
  
  const togglePayment = (paymentId: string) => {
    const newSelected = new Set(selectedPayments);
    if (newSelected.has(paymentId)) {
      newSelected.delete(paymentId);
    } else {
      newSelected.add(paymentId);
    }
    setSelectedPayments(newSelected);
  };
  
  const toggleAll = () => {
    if (selectedPayments.size === allPayments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(allPayments.map(({ payment }) => payment.id)));
    }
  };
  
  const selectedPaymentsList = allPayments.filter(({ payment }) => selectedPayments.has(payment.id));
  
  const totals = useMemo(() => ({
    totalPayments: selectedPaymentsList.reduce((s, { payment }) => s + payment.payment_amount, 0),
    totalInterest: selectedPaymentsList.reduce((s, { payment }) => s + payment.interest_amount, 0),
    totalPrincipal: selectedPaymentsList.reduce((s, { payment }) => s + payment.principal_amount, 0),
    totalDepreciation: selectedPaymentsList.reduce((s, { payment }) => s + payment.depreciation_amount, 0),
  }), [selectedPaymentsList]);
  
  const handleRunAmortization = async () => {
    if (!organization?.id || selectedPaymentsList.length === 0) return;
    
    try {
      const result = await batchPost.mutateAsync({
        organizationId: organization.id,
        leases: selectedPaymentsList.map(({ lease }) => lease),
        payments: selectedPaymentsList,
        periodDate: periodEnd,
      });
      
      if (result.success.length > 0 && result.failed.length === 0) {
        onOpenChange(false);
      }
      
      // Refresh the payments list
      loadPaymentsForPeriod();
      refetchLeases();
      
    } catch {
      // Error handled by mutation
    }
  };
  
  const hasAccountMappingIssues = allPayments.some(({ lease }) => 
    !lease.lease_liability_account_id || !lease.interest_expense_account_id
  );
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Run Lease Amortization
          </DialogTitle>
          <DialogDescription>
            Post lease payments, interest expense, and ROU asset depreciation to the General Ledger
          </DialogDescription>
        </DialogHeader>
        
        {/* Period Selection */}
        <div className="flex items-center gap-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="period">Period</Label>
          </div>
          <Input
            id="period"
            type="month"
            value={periodDate}
            onChange={(e) => setPeriodDate(e.target.value)}
            className="w-48"
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={loadPaymentsForPeriod}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
          </div>
        </div>
        
        {/* Account Mapping Warning */}
        {hasAccountMappingIssues && (
          <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing GL Account Mappings</AlertTitle>
            <AlertDescription>
              Some leases don't have GL accounts mapped. Please configure the lease to enable GL posting.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Payments Table */}
        <ScrollArea className="flex-1 min-h-0">
          {leasesLoading || loadingPayments ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : allPayments.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Payments Due</h3>
              <p className="text-sm text-muted-foreground">
                No scheduled lease payments found for {format(periodStart, 'MMMM yyyy')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedPayments.size === allPayments.length && allPayments.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Lease</TableHead>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Depreciation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPayments.map(({ lease, payment }) => {
                  const hasMappingIssue = !lease.lease_liability_account_id || !lease.interest_expense_account_id;
                  return (
                    <TableRow key={payment.id} className={hasMappingIssue ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPayments.has(payment.id)}
                          onCheckedChange={() => togglePayment(payment.id)}
                          disabled={hasMappingIssue}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lease.name}</p>
                          <p className="text-xs text-muted-foreground">{lease.lease_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>#{payment.payment_number}</TableCell>
                      <TableCell>{format(parseISO(payment.payment_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.payment_amount)}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(payment.interest_amount)}
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {formatCurrency(payment.principal_amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(payment.depreciation_amount)}
                      </TableCell>
                      <TableCell>
                        {hasMappingIssue ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="w-3 h-3" />
                            No GL Map
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Scheduled</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
        
        {/* Summary */}
        {selectedPaymentsList.length > 0 && (
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg mt-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Payments</p>
              <p className="font-semibold">{formatCurrency(totals.totalPayments)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest Expense</p>
              <p className="font-semibold text-destructive">{formatCurrency(totals.totalInterest)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Principal</p>
              <p className="font-semibold text-primary">{formatCurrency(totals.totalPrincipal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Depreciation</p>
              <p className="font-semibold">{formatCurrency(totals.totalDepreciation)}</p>
            </div>
          </div>
        )}
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRunAmortization}
            disabled={selectedPaymentsList.length === 0 || batchPost.isPending}
            className="gap-2"
          >
            {batchPost.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Post {selectedPaymentsList.length} Payment(s) to GL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

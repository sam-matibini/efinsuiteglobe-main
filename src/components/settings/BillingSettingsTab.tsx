import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, ExternalLink, Loader2, Receipt, RefreshCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceRow {
  id: string;
  number: string | null;
  created: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
}

interface PaymentMethodInfo {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency?.toUpperCase()}`;
  }
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  trialing: 'secondary',
  past_due: 'destructive',
  canceled: 'outline',
  incomplete: 'destructive',
  paid: 'default',
  open: 'secondary',
  void: 'outline',
  uncollectible: 'destructive',
  draft: 'outline',
};

export function BillingSettingsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  const { subscription, plan, isLoading: subLoading, planTier } = useSubscription();
  const orgId = currentOrganization?.id;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelFeedback, setCancelFeedback] = useState('');
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [portalLoading, setPortalLoading] = useState<'manage' | 'card' | null>(null);

  const hasStripeCustomer = !!(subscription as any)?.stripe_customer_id;

  const { data: pmData, isLoading: pmLoading } = useQuery({
    queryKey: ['billing-payment-method', orgId],
    enabled: !!orgId && hasStripeCustomer,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'get-payment-method', organizationId: orgId },
      });
      if (error) throw error;
      return (data?.paymentMethod as PaymentMethodInfo | null) ?? null;
    },
  });

  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ['billing-invoices', orgId],
    enabled: !!orgId && hasStripeCustomer,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'list-invoices', organizationId: orgId },
      });
      if (error) throw error;
      return (data?.invoices as InvoiceRow[]) ?? [];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'manage-subscription',
          organizationId: orgId,
          subscriptionAction: 'cancel',
          immediate: cancelImmediate,
          reason: cancelReason || null,
          feedback: cancelFeedback || null,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Cancel failed');
    },
    onSuccess: () => {
      toast.success(
        cancelImmediate
          ? 'Subscription canceled immediately.'
          : 'Subscription will cancel at the end of the current period.'
      );
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      setCancelOpen(false);
      setCancelReason('');
      setCancelFeedback('');
      setCancelImmediate(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to cancel'),
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'manage-subscription', organizationId: orgId, subscriptionAction: 'reactivate' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Reactivate failed');
    },
    onSuccess: () => {
      toast.success('Subscription reactivated.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to reactivate'),
  });

  const openPortal = async (which: 'manage' | 'card') => {
    if (!orgId) return;
    setPortalLoading(which);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'create-billing-portal-session',
          organizationId: orgId,
          returnUrl: `${window.location.origin}/settings?tab=billing`,
          portalFlow: which === 'card' ? 'payment_method_update' : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success || !data?.url) throw new Error(data?.error || 'Could not open portal');
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || 'Failed to open billing portal');
    } finally {
      setPortalLoading(null);
    }
  };

  if (subLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const cancelAtPeriodEnd = (subscription as any)?.cancel_at_period_end;
  const periodEnd = (subscription as any)?.current_period_end;
  const billingCycle = subscription?.billing_cycle;
  const price = plan
    ? billingCycle === 'yearly'
      ? plan.price_yearly
      : plan.price_monthly
    : 0;

  return (
    <div className="space-y-6">
      {/* Current subscription */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Current Subscription</h2>
            <p className="text-sm text-muted-foreground">
              Manage your plan, billing cycle, and cancellation.
            </p>
          </div>
          {subscription && (
            <Badge variant={STATUS_VARIANT[subscription.status] ?? 'secondary'}>
              {subscription.status}
            </Badge>
          )}
        </div>

        {!subscription ? (
          <div className="rounded-md border border-dashed p-6 text-center space-y-3">
            <p className="text-muted-foreground">No active subscription for this organization.</p>
            <Button onClick={() => navigate('/subscription/checkout')}>
              Choose a plan
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Plan</p>
                <p className="font-medium">{plan?.name || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Price</p>
                <p className="font-medium">
                  ${price}/{billingCycle === 'yearly' ? 'yr' : 'mo'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Billing cycle</p>
                <p className="font-medium capitalize">{billingCycle || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}
                </p>
                <p className="font-medium">
                  {periodEnd ? new Date(periodEnd).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>

            {cancelAtPeriodEnd && (
              <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                Your subscription is set to cancel at the end of the current period.
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate('/subscription/checkout')}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Change plan
              </Button>
              {cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                >
                  {reactivateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reactivate
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel subscription
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Payment method */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Payment Method</h2>
            <p className="text-sm text-muted-foreground">
              Update the card used for future subscription charges.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => openPortal('card')}
            disabled={!hasStripeCustomer || portalLoading === 'card'}
          >
            {portalLoading === 'card' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4 mr-2" />
            )}
            Update card
          </Button>
        </div>
        {!hasStripeCustomer ? (
          <p className="text-sm text-muted-foreground">No payment method on file yet.</p>
        ) : pmLoading ? (
          <Skeleton className="h-6 w-64" />
        ) : pmData ? (
          <div className="flex items-center gap-3 text-sm">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <span className="capitalize font-medium">{pmData.brand}</span>
            <span>•••• {pmData.last4}</span>
            <span className="text-muted-foreground">
              exp {String(pmData.exp_month).padStart(2, '0')}/{String(pmData.exp_year).slice(-2)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No card on file.</p>
        )}
      </Card>

      {/* Invoices */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Billing History</h2>
            <p className="text-sm text-muted-foreground">
              Download past invoices or manage billing directly on Stripe.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => openPortal('manage')}
            disabled={!hasStripeCustomer || portalLoading === 'manage'}
          >
            {portalLoading === 'manage' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4 mr-2" />
            )}
            Manage on Stripe
          </Button>
        </div>
        {!hasStripeCustomer ? (
          <p className="text-sm text-muted-foreground">No billing history yet.</p>
        ) : invLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Receipt className="w-6 h-6 mx-auto mb-2" />
            No invoices yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Invoice</th>
                  <th className="py-2 font-medium">Amount</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Download</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="py-2">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td className="py-2 font-mono text-xs">{inv.number || inv.id}</td>
                    <td className="py-2">
                      {formatMoney(inv.amount_paid || inv.amount_due, inv.currency)}
                    </td>
                    <td className="py-2">
                      <Badge variant={STATUS_VARIANT[inv.status] ?? 'outline'} className="capitalize">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {inv.invoice_pdf ? (
                        <a
                          href={inv.invoice_pdf}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until{' '}
              {periodEnd ? new Date(periodEnd).toLocaleDateString() : 'the end of the current period'}
              , then it will be canceled. You can reactivate any time before that date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancelMutation.mutate();
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BillingSettingsTab;

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { deriveTierFromName, PLAN_MODULE_ACCESS, PLAN_TIER_ORDER, PLAN_TIER_LABELS, type PlanTier } from '@/config/planModuleAccess';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Check, CreditCard, Loader2, Tag, X } from 'lucide-react';
import { toast } from 'sonner';

interface PricingPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_employees: number | null;
  features: string[] | null;
  is_active: boolean;
  sort_order: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  tier?: string | null;
  country_id?: string | null;
  currency?: string | null;
}

interface ProrationPreview {
  currency: string;
  amount_due_today: number;
  next_invoice_total: number;
  next_invoice_date: number | null;
  period_end: number | null;
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency?.toUpperCase() || ''}`;
  }
}

function formatDate(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SubscriptionCheckout() {
  const { organization } = useCurrentOrganization();
  const { isAdmin } = useAuth();
  const { userCount, employeeCount } = useUsageLimits();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightTier = searchParams.get('plan');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Change-plan dialog state
  const [changePlan, setChangePlan] = useState<PricingPlan | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<ProrationPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    label: string;
    percent_off?: number | null;
    amount_off?: number | null;
    currency?: string | null;
    duration?: string | null;
    duration_in_months?: number | null;
    adminDiscountActive?: boolean;
  } | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['active-pricing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as PricingPlan[];
    },
  });

  const { data: currentSub } = useQuery({
    queryKey: ['current-subscription', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, pricing_plans(name)')
        .eq('organization_id', organization.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const isTrialing = currentSub?.status === 'trialing';
  const trialEnd = isTrialing ? (currentSub as any)?.current_period_end : null;

  // Detect whether org has an admin-applied discount (per-org or global) to hide the promo field
  const { data: adminDiscountActive } = useQuery({
    queryKey: ['admin-discount-active', organization?.id, currentSub?.id],
    queryFn: async () => {
      if (!organization?.id) return false;
      const nowIso = new Date().toISOString();
      const sub: any = currentSub;
      const orgActive = !!(sub && Number(sub.discount_percent) > 0 &&
        sub.stripe_coupon_id &&
        (!sub.discount_expires_at || sub.discount_expires_at > nowIso));
      if (orgActive) return true;
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'subscription.global_discount')
        .maybeSingle();
      const gd: any = data?.setting_value || {};
      return !!(Number(gd.percent) > 0 && gd.stripe_coupon_id &&
        (!gd.expires_at || new Date(gd.expires_at) > new Date()));
    },
    enabled: !!organization?.id,
  });

  const applyPromoCode = async () => {
    if (!promoInput.trim() || !organization?.id) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'validate-promotion-code',
          code: promoInput.trim(),
          organizationId: organization.id,
        },
      });
      if (error) throw error;
      if (data?.adminDiscountActive) {
        setPromoError('A discount is already applied by your administrator.');
        return;
      }
      if (!data?.success || !data?.valid) {
        setPromoError(data?.error || 'Code not valid');
        return;
      }
      const c = data.coupon || {};
      const disc = c.percent_off
        ? `${c.percent_off}% off`
        : c.amount_off
          ? `${((c.amount_off as number) / 100).toFixed(2)} ${(c.currency || '').toUpperCase()} off`
          : 'Discount';
      const dur = c.duration === 'repeating'
        ? ` — first ${c.duration_in_months} months`
        : c.duration === 'forever'
          ? ' — forever'
          : ' — first payment';
      const applied = {
        id: data.promotion_code_id,
        code: data.code,
        label: `${disc}${dur}`,
        percent_off: c.percent_off != null ? Number(c.percent_off) : null,
        amount_off: c.amount_off != null ? Number(c.amount_off) : null,
        currency: c.currency ?? null,
        duration: c.duration ?? null,
        duration_in_months: c.duration_in_months != null ? Number(c.duration_in_months) : null,
      };
      console.log('[promo] applied', applied, 'raw coupon:', c);
      setAppliedPromo(applied);
      toast.success(`Promo code ${data.code} applied`);
    } catch (err: any) {
      setPromoError(err.message || 'Could not validate code');
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const openStripeCheckout = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'create-checkout-session',
          planId,
          billingCycle,
          organizationId: organization!.id,
          promotionCodeId: appliedPromo?.id,
          successUrl: `${window.location.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/subscription/checkout`,
        },
      });
      if (error) throw error;
      if (data?.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data?.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleSubscribe = async (plan: PricingPlan) => {
    if (!organization?.id) {
      toast.error('Please select an organization first');
      return;
    }
    // If already on an active/trialing sub, switch plan with proration preview
    if (currentSub && (currentSub as any).stripe_subscription_id) {
      setChangePlan(plan);
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('stripe-integration', {
          body: {
            action: 'preview-plan-change',
            organizationId: organization.id,
            newPlanId: plan.id,
            billingCycle,
          },
        });
        if (error) throw error;
        if (data?.success) {
          setPreview(data.preview);
        } else {
          setPreviewError(data?.error || 'Could not load proration preview');
        }
      } catch (err: any) {
        setPreviewError(err.message || 'Could not load proration preview');
      } finally {
        setPreviewLoading(false);
      }
      return;
    }
    // Otherwise send to Stripe Checkout
    await openStripeCheckout(plan.id);
  };

  const confirmChangePlan = async () => {
    if (!organization?.id || !changePlan) return;
    setConfirmLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'manage-subscription',
          subscriptionAction: 'change-plan',
          organizationId: organization.id,
          newPlanId: changePlan.id,
          billingCycle,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Switched to ${changePlan.name}`);
        setChangePlan(null);
        setPreview(null);
        await queryClient.invalidateQueries({ queryKey: ['current-subscription'] });
      } else {
        toast.error(data?.error || 'Failed to change plan');
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setConfirmLoading(false);
    }
  };

  // Downgrade impact analysis
  const currentTier = deriveTierFromName((currentSub as any)?.pricing_plans?.name);
  const newTier = changePlan ? (changePlan.tier as PlanTier | null) || deriveTierFromName(changePlan.name) : null;
  const isDowngrade =
    !!currentTier && !!newTier &&
    PLAN_TIER_ORDER.indexOf(newTier) < PLAN_TIER_ORDER.indexOf(currentTier);

  const lostModules = (isDowngrade && currentTier && newTier)
    ? PLAN_MODULE_ACCESS[currentTier].filter(m => !PLAN_MODULE_ACCESS[newTier].includes(m))
    : [];

  const newMaxUsers = changePlan?.max_users ?? null;
  const newMaxEmployees = changePlan?.max_employees ?? null;
  const usersOverLimit = isDowngrade && newMaxUsers !== null && userCount > newMaxUsers;
  const employeesOverLimit = isDowngrade && newMaxEmployees !== null && employeeCount > newMaxEmployees;
  const hasImpact = isDowngrade && (lostModules.length > 0 || usersOverLimit || employeesOverLimit);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          {organization ? `Subscribing for ${organization.name}` : 'Select a plan to get started'}
        </p>
        {!currentSub && (
          <Badge variant="secondary" className="mt-2">
            🎉 Start with a 14-day free trial — no charge until it ends
          </Badge>
        )}
        {currentSub && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <Badge variant="secondary">
              Current plan: {(currentSub as any).pricing_plans?.name || 'Unknown'}
            </Badge>
            {isTrialing && trialEnd && (
              <Badge variant="outline">
                Trial ends {formatDate(Math.floor(new Date(trialEnd).getTime() / 1000))}
              </Badge>
            )}
            {(currentSub as any).cancel_at_period_end && (
              <Badge variant="destructive">Cancels at period end</Badge>
            )}
          </div>
        )}
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant={billingCycle === 'monthly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </Button>
        <Button
          variant={billingCycle === 'yearly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setBillingCycle('yearly')}
        >
          Yearly
          <Badge variant="secondary" className="ml-2 text-xs">Save up to 20%</Badge>
        </Button>
      </div>

      {/* Promo code */}
      {!adminDiscountActive && !currentSub && (
        <div className="max-w-md mx-auto">
          {appliedPromo ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <div>
                  <div className="font-medium">{appliedPromo.code}</div>
                  <div className="text-xs text-muted-foreground">{appliedPromo.label}</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={removePromoCode}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Have a promo code?"
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value); setPromoError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyPromoCode(); }}
                  disabled={promoLoading}
                />
                <Button
                  variant="outline"
                  onClick={applyPromoCode}
                  disabled={promoLoading || !promoInput.trim()}
                >
                  {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              {promoError && <p className="text-xs text-destructive">{promoError}</p>}
            </div>
          )}
        </div>
      )}



      <div className="grid md:grid-cols-3 gap-6">
        {plans
          ?.filter((plan) => {
            const tier = (plan.tier || deriveTierFromName(plan.name)) as string;
            if (tier === 'office_use' && !isAdmin) return false;
            return true;
          })
          .map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const isCurrentPlan = currentSub?.plan_id === plan.id;
            const priceReady = billingCycle === 'monthly'
              ? !!plan.stripe_price_id_monthly
              : !!plan.stripe_price_id_yearly;
            const planTier = (plan.tier || deriveTierFromName(plan.name)) as string;
            const isHighlighted = highlightTier && planTier === highlightTier;
            const hasActiveSub = !!currentSub && !!(currentSub as any).stripe_subscription_id;
            const ctaLabel = hasActiveSub ? 'Switch to this plan' : 'Subscribe';

            return (
              <Card key={plan.id} className={`relative flex flex-col ${isCurrentPlan ? 'border-primary ring-2 ring-primary/20' : ''} ${isHighlighted ? 'border-primary ring-2 ring-primary/40' : ''}`}>
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Current Plan
                  </Badge>
                )}
                {isHighlighted && !isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Recommended
                  </Badge>
                )}

                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {(() => {
                      const basePrice = Number(price) || 0;
                      let discounted = basePrice;
                      if (appliedPromo?.percent_off) {
                        discounted = Math.max(0, basePrice * (1 - Number(appliedPromo.percent_off) / 100));
                      } else if (appliedPromo?.amount_off) {
                        discounted = Math.max(0, basePrice - Number(appliedPromo.amount_off) / 100);
                      }
                      const hasDiscount = !!appliedPromo && discounted < basePrice;
                      const fmt = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2);
                      return (
                        <>
                          <div className="text-3xl font-bold flex items-baseline gap-2 flex-wrap">
                            {hasDiscount && (
                              <span className="text-lg font-normal text-muted-foreground line-through">
                                ${fmt(basePrice)}
                              </span>
                            )}
                            <span className={hasDiscount ? 'text-primary' : ''}>
                              ${fmt(discounted)}
                              <span className="text-sm font-normal text-muted-foreground">
                                /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                              </span>
                            </span>
                          </div>
                          {hasDiscount && (
                            <p className="text-xs text-primary mt-1">
                              With {appliedPromo!.code}
                              {appliedPromo!.duration === 'repeating' && appliedPromo!.duration_in_months
                                ? ` for first ${appliedPromo!.duration_in_months} months`
                                : appliedPromo!.duration === 'once'
                                  ? ' on first payment'
                                  : appliedPromo!.duration === 'forever'
                                    ? ' forever'
                                    : ''}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    {billingCycle === 'yearly' && (
                      <p className="text-sm text-muted-foreground">
                        Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)}/year
                      </p>
                    )}
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {(plan.features || []).map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className="w-full mt-4"
                    disabled={isCurrentPlan || loadingPlanId === plan.id || !priceReady}
                    onClick={() => handleSubscribe(plan)}
                  >
                    {loadingPlanId === plan.id ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : !priceReady ? (
                      'Not available yet'
                    ) : (
                      <><CreditCard className="w-4 h-4 mr-2" /> {ctaLabel}</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Change-plan confirmation dialog with proration preview */}
      <Dialog
        open={!!changePlan}
        onOpenChange={(open) => {
          if (!open && !confirmLoading) {
            setChangePlan(null);
            setPreview(null);
            setPreviewError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to {changePlan?.name}?</DialogTitle>
            <DialogDescription>
              Review the prorated charges before confirming the plan change.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {previewLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Calculating proration…
              </div>
            )}

            {previewError && (
              <div className="text-sm text-destructive">{previewError}</div>
            )}

            {preview && !previewLoading && (
              <div className="rounded-md border p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing cycle</span>
                  <span className="font-medium capitalize">{billingCycle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {preview.amount_due_today < 0 ? 'Credit applied today' : 'Due today (prorated)'}
                  </span>
                  <span className="font-semibold">
                    {formatMoney(Math.abs(preview.amount_due_today), preview.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next invoice total</span>
                  <span className="font-medium">
                    {formatMoney(preview.next_invoice_total, preview.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Next invoice on</span>
                  <span className="font-medium">
                    {formatDate(preview.next_invoice_date || preview.period_end)}
                  </span>
                </div>
                {isTrialing && (
                  <p className="text-xs text-muted-foreground pt-1">
                    You're still in your free trial — proration applies once the trial ends.
                  </p>
                )}
              </div>
            )}

            {hasImpact && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2 text-sm">
                <p className="font-medium text-destructive">
                  Downgrading from {currentTier ? PLAN_TIER_LABELS[currentTier] : 'current plan'} to{' '}
                  {newTier ? PLAN_TIER_LABELS[newTier] : changePlan?.name} — heads up:
                </p>
                {lostModules.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1">Modules you'll lose access to:</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                      {lostModules.map(m => (
                        <li key={m} className="capitalize">{m.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {usersOverLimit && (
                  <p className="text-xs text-destructive">
                    ⚠ You have {userCount} users but the new plan allows only {newMaxUsers}. You won't be able to add more until you're under the limit.
                  </p>
                )}
                {employeesOverLimit && (
                  <p className="text-xs text-destructive">
                    ⚠ You have {employeeCount} employees but the new plan allows only {newMaxEmployees}.
                  </p>
                )}
              </div>
            )}
          </div>


          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangePlan(null);
                setPreview(null);
                setPreviewError(null);
              }}
              disabled={confirmLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmChangePlan}
              disabled={confirmLoading || previewLoading || !!previewError}
            >
              {confirmLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Switching…</>
              ) : (
                'Confirm switch'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

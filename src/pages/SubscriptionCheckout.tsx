import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, Loader2 } from 'lucide-react';
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
}

export default function SubscriptionCheckout() {
  const { organization } = useCurrentOrganization();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

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

  const handleSubscribe = async (planId: string) => {
    if (!organization?.id) {
      toast.error('Please select an organization first');
      return;
    }
    setLoadingPlanId(planId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: {
          action: 'create-checkout-session',
          planId,
          billingCycle,
          organizationId: organization.id,
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
        {currentSub && (
          <Badge variant="secondary" className="mt-2">
            Current plan: {(currentSub as any).pricing_plans?.name || 'Unknown'}
          </Badge>
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

      <div className="grid md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
          const isCurrentPlan = currentSub?.plan_id === plan.id;
          const priceReady = billingCycle === 'monthly' ? !!plan.stripe_price_id_monthly : !!plan.stripe_price_id_yearly;

          return (
            <Card key={plan.id} className={`relative flex flex-col ${isCurrentPlan ? 'border-primary ring-2 ring-primary/20' : ''}`}>
              {isCurrentPlan && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Current Plan
                </Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-3xl font-bold">
                    ${price}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
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
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {loadingPlanId === plan.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...</>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : !priceReady ? (
                    'Not available yet'
                  ) : (
                    <><CreditCard className="w-4 h-4 mr-2" /> Subscribe</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

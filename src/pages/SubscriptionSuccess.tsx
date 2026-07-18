import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';

interface VerifyResponse {
  success: boolean;
  status?: 'complete' | 'open' | 'expired';
  payment_status?: string;
  subscription_status?: string | null;
  plan_name?: string | null;
  current_period_end?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  error?: string;
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (amount == null || !currency) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refetch: refetchSubscription } = useSubscription();
  const sessionId = searchParams.get('session_id');

  const { data, isLoading, isError, refetch } = useQuery<VerifyResponse>({
    queryKey: ['verify-checkout-session', sessionId],
    enabled: !!sessionId,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-integration', {
        body: { action: 'verify-checkout-session', sessionId },
      });
      if (error) throw error;
      return data as VerifyResponse;
    },
  });

  const isComplete = data?.success && data.status === 'complete';

  useEffect(() => {
    if (isComplete) {
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void refetchSubscription();
    }
  }, [isComplete, queryClient, refetchSubscription]);

  if (!sessionId) {
    return <MismatchCard onRetry={() => navigate('/subscription/checkout')} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle className="text-2xl">Confirming your subscription…</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please wait while we verify your checkout with Stripe.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data?.success || !isComplete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">We couldn't confirm this checkout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {data?.status === 'open'
                ? 'Your checkout is still pending. Complete payment to activate your subscription.'
                : data?.status === 'expired'
                ? 'This checkout session has expired. Please start a new one.'
                : data?.error || 'The subscription could not be verified.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => refetch()}>Retry</Button>
              <Button variant="outline" onClick={() => navigate('/subscription/checkout')}>
                Back to plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = formatAmount(data.amount_total, data.currency);
  const nextBilling = data.current_period_end
    ? new Date(data.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Subscription Activated!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {data.plan_name
              ? `You're now on the ${data.plan_name} plan.`
              : 'Your subscription has been successfully set up.'}
          </p>
          {(amount || nextBilling) && (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
              {amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Charged today</span>
                  <span className="font-medium">{amount}</span>
                </div>
              )}
              {nextBilling && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {data.subscription_status === 'trialing' ? 'Trial ends' : 'Next billing date'}
                  </span>
                  <span className="font-medium">{nextBilling}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
            <Button variant="outline" onClick={() => navigate('/settings')}>View Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MismatchCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Missing checkout session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            No Stripe checkout session was found in the URL. If you just completed payment, please return from Stripe using the confirmation link.
          </p>
          <Button onClick={onRetry}>Back to plans</Button>
        </CardContent>
      </Card>
    </div>
  );
}

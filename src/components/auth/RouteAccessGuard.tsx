import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import { useSubscription } from '@/hooks/useSubscription';
import { getRequiredModuleForPath } from '@/config/routeModuleMap';
import { MODULE_DISPLAY_NAMES } from '@/config/roleModuleAccess';
import { PLAN_TIER_LABELS, minimumPlanForModule } from '@/config/planModuleAccess';

/**
 * Enforces module / role / subscription access for the current route.
 * If the user pastes a deep-link URL they don't have access to, this
 * renders an Access Denied page instead of the target page.
 *
 * Admin routes are gated by <AdminRoute/> and skip this guard.
 * Auth is enforced upstream by <ProtectedRoute/>.
 */
export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { currentOrganization, isLoading: orgLoading } = useOrganizationContext();
  const {
    isModuleEnabled,
    isModuleInCurrentPlan,
    userRole,
    isLoading: modulesLoading,
  } = useEnabledModules();
  const { isActive, isLoading: subLoading, planTier } = useSubscription();

  const requiredModule = getRequiredModuleForPath(location.pathname);

  // Global admins bypass all checks.
  if (isAdmin) return <>{children}</>;

  // Routes with no module requirement (dashboard, settings, subscription, etc.)
  if (!requiredModule) return <>{children}</>;

  // Wait until org + module + subscription context finish hydrating.
  if (orgLoading || modulesLoading || subLoading) return <>{children}</>;

  // No organization context yet — let the page's own empty-state handle it.
  if (!currentOrganization) return <>{children}</>;

  const roleOrModuleBlocked = !isModuleEnabled(requiredModule);
  const planBlocked = !isModuleInCurrentPlan(requiredModule);
  const subscriptionBlocked = !isActive;

  if (!roleOrModuleBlocked && !planBlocked && !subscriptionBlocked) {
    return <>{children}</>;
  }

  // Determine the reason to show
  let title = 'Access denied';
  let description: React.ReactNode = 'You do not have access to this page.';
  let showUpgrade = false;
  let upgradePlan: string | null = null;

  if (subscriptionBlocked) {
    title = 'Subscription required';
    description = (
      <>
        An active subscription is required to view{' '}
        <strong>{MODULE_DISPLAY_NAMES[requiredModule]}</strong>.
      </>
    );
    showUpgrade = true;
    upgradePlan = minimumPlanForModule(requiredModule);
  } else if (planBlocked) {
    const minPlan = minimumPlanForModule(requiredModule);
    title = 'Upgrade required';
    description = (
      <>
        <strong>{MODULE_DISPLAY_NAMES[requiredModule]}</strong> is available on the{' '}
        <strong>{PLAN_TIER_LABELS[minPlan]}</strong> plan and above.
        {planTier && (
          <>
            {' '}
            Your current plan: <strong>{PLAN_TIER_LABELS[planTier]}</strong>.
          </>
        )}
      </>
    );
    showUpgrade = true;
    upgradePlan = minPlan;
  } else if (roleOrModuleBlocked) {
    // Either the org has the module disabled, or the user's role doesn't grant it.
    title = 'No access to this module';
    description = (
      <>
        Your role ({userRole}) does not have access to{' '}
        <strong>{MODULE_DISPLAY_NAMES[requiredModule]}</strong>, or this module is disabled for{' '}
        <strong>{currentOrganization.name}</strong>. Contact an organization administrator to
        request access.
      </>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="pt-2">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Button>
          {showUpgrade && upgradePlan && (
            <Button onClick={() => navigate(`/subscription/checkout?plan=${upgradePlan}`)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade plan
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

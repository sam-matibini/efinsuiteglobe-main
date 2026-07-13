import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Sparkles, Check } from 'lucide-react';
import { ModuleCode } from '@/hooks/useEnabledModules';
import { MODULE_DISPLAY_NAMES } from '@/config/roleModuleAccess';
import {
  PLAN_MODULE_ACCESS,
  PLAN_TIER_LABELS,
  PlanTier,
  minimumPlanForModule,
} from '@/config/planModuleAccess';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredModule?: ModuleCode | null;
  featureLabel?: string;
  currentPlanTier: PlanTier;
}

export function SubscriptionUpgradeModal({
  open,
  onOpenChange,
  requiredModule,
  featureLabel,
  currentPlanTier,
}: Props) {
  const navigate = useNavigate();
  const requiredPlan: PlanTier = requiredModule
    ? minimumPlanForModule(requiredModule)
    : 'professional';

  const planModules = PLAN_MODULE_ACCESS[requiredPlan];
  const featureName =
    featureLabel ||
    (requiredModule ? MODULE_DISPLAY_NAMES[requiredModule] : 'This feature');

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/subscription/checkout?plan=${requiredPlan}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Upgrade to {PLAN_TIER_LABELS[requiredPlan]}
          </DialogTitle>
          <DialogDescription className="text-center">
            <strong>{featureName}</strong> is available on the{' '}
            {PLAN_TIER_LABELS[requiredPlan]} plan and above.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                {PLAN_TIER_LABELS[requiredPlan]}
              </span>
            </div>
            <Badge variant="secondary">Recommended</Badge>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {planModules.slice(0, 6).map((code) => (
              <li key={code} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{MODULE_DISPLAY_NAMES[code]}</span>
              </li>
            ))}
            {planModules.length > 6 && (
              <li className="text-xs italic pl-6">
                +{planModules.length - 6} more modules
              </li>
            )}
          </ul>
        </div>

        <div className="text-xs text-center text-muted-foreground">
          Your current plan:{' '}
          <span className="font-medium">{PLAN_TIER_LABELS[currentPlanTier]}</span>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade}>
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

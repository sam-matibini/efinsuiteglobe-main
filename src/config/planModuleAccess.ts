import { ModuleCode } from '@/hooks/useEnabledModules';

export type PlanTier = 'office_use' | 'starter' | 'professional' | 'enterprise';

/**
 * Modules included per plan tier.
 * Office Use is an admin-only demo tier with full access.
 */
export const PLAN_MODULE_ACCESS: Record<PlanTier, ModuleCode[]> = {
  office_use: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'banking', 'reporting', 'payroll', 'treasury',
    'fixed_assets', 'budgeting', 'inventory', 'docsign',
    'communication', 'leases', 'practice_management',
    'donations', 'accountant_dashboard',
  ],
  starter: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'banking', 'reporting', 'payroll', 'treasury',
  ],
  professional: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'banking', 'reporting', 'payroll', 'treasury',
    'fixed_assets', 'budgeting', 'inventory', 'docsign',
    'communication', 'leases',
  ],
  enterprise: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'banking', 'reporting', 'payroll', 'treasury',
    'fixed_assets', 'budgeting', 'inventory', 'docsign',
    'communication', 'leases', 'practice_management',
    'donations', 'accountant_dashboard',
  ],
};

export const PLAN_TIER_ORDER: PlanTier[] = [
  'office_use', 'starter', 'professional', 'enterprise',
];

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  office_use: 'Office Use',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export function isModuleInPlan(moduleCode: ModuleCode, planTier: string): boolean {
  const tier = (PLAN_MODULE_ACCESS as Record<string, ModuleCode[]>)[planTier];
  return tier ? tier.includes(moduleCode) : false;
}

/** Returns the lowest paid plan tier that includes the given module. */
export function minimumPlanForModule(moduleCode: ModuleCode): PlanTier {
  for (const tier of ['starter', 'professional', 'enterprise'] as PlanTier[]) {
    if (PLAN_MODULE_ACCESS[tier].includes(moduleCode)) return tier;
  }
  return 'enterprise';
}

/** Next paid tier above the given tier (or 'professional' as a default upgrade target). */
export function nextTierAbove(current: PlanTier | null): PlanTier {
  const order: PlanTier[] = ['starter', 'professional', 'enterprise'];
  if (!current || current === 'office_use') return 'professional';
  const idx = order.indexOf(current);
  if (idx < 0) return 'professional';
  return order[Math.min(idx + 1, order.length - 1)];
}

/** Best-effort derivation of a plan tier from a plan name. */
export function deriveTierFromName(name?: string | null): PlanTier | null {
  const n = (name || '').toLowerCase();
  if (n.includes('office')) return 'office_use';
  if (n.includes('enterprise')) return 'enterprise';
  if (n.includes('professional') || n.includes('pro')) return 'professional';
  if (n.includes('starter')) return 'starter';
  return null;
}

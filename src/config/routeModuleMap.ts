import type { ModuleCode } from '@/hooks/useEnabledModules';

/**
 * Ordered list of route-prefix → required module mappings.
 * The first entry whose prefix matches the current pathname wins,
 * so more specific prefixes must come before more generic ones.
 *
 * Paths not covered here are considered "always accessible" for
 * signed-in users (e.g. dashboard, settings, subscription pages,
 * public utilities). Admin routes are gated separately by AdminRoute.
 */
const ROUTE_MODULE_MAP: Array<{ prefix: string; module: ModuleCode }> = [
  // Sales — AR
  { prefix: '/sales', module: 'accounts_receivable' },

  // Purchases — AP
  { prefix: '/purchases', module: 'accounts_payable' },

  // Banking
  { prefix: '/banking/settlements', module: 'banking' },
  { prefix: '/banking', module: 'banking' },

  // Treasury / Banking-payments
  { prefix: '/treasury', module: 'treasury' },
  { prefix: '/banking-payments', module: 'treasury' },
  { prefix: '/m/treasury', module: 'treasury' },
  { prefix: '/intl/sepa', module: 'treasury' },

  // Accounting / GL
  { prefix: '/accounts', module: 'general_ledger' },
  { prefix: '/journal-entries', module: 'general_ledger' },
  { prefix: '/ledger', module: 'general_ledger' },
  { prefix: '/detailed-ledger', module: 'general_ledger' },
  { prefix: '/trial-balance', module: 'general_ledger' },
  { prefix: '/exchange-rates', module: 'general_ledger' },
  { prefix: '/finance/revaluation', module: 'general_ledger' },
  { prefix: '/divisions', module: 'general_ledger' },

  // Sales tax lives under GL access
  { prefix: '/tax', module: 'general_ledger' },
  { prefix: '/intl/uk-vat', module: 'general_ledger' },
  { prefix: '/intl/eu-oss', module: 'general_ledger' },

  // Reporting — accountant/practice sub-routes checked first
  { prefix: '/reports/accountant', module: 'accountant_dashboard' },
  { prefix: '/reports/practice-management', module: 'accountant_dashboard' },
  { prefix: '/reports', module: 'reporting' },

  // Inventory / Assets / Leases
  { prefix: '/inventory', module: 'inventory' },
  { prefix: '/fixed-assets', module: 'fixed_assets' },
  { prefix: '/leases', module: 'leases' },

  // Budgets
  { prefix: '/budgets', module: 'budgeting' },

  // Payroll
  { prefix: '/payroll', module: 'payroll' },

  // Donations
  { prefix: '/donations', module: 'donations' },

  // DocSign
  { prefix: '/docsign', module: 'docsign' },

  // Communication
  { prefix: '/communication', module: 'communication' },

  // Firm / practice
  { prefix: '/firm', module: 'practice_management' },
];

/**
 * Resolve the ModuleCode required to access a given pathname.
 * Returns null when no gating applies (dashboard, settings, subscription, etc.).
 */
export function getRequiredModuleForPath(pathname: string): ModuleCode | null {
  // Sort matched by longest prefix so nested overrides win regardless of array order.
  let best: { prefix: string; module: ModuleCode } | null = null;
  for (const entry of ROUTE_MODULE_MAP) {
    if (pathname === entry.prefix || pathname.startsWith(entry.prefix + '/')) {
      if (!best || entry.prefix.length > best.prefix.length) {
        best = entry;
      }
    }
  }
  return best?.module ?? null;
}

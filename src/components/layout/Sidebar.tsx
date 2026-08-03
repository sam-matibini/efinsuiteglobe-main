import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  BarChart3, 
  ShoppingCart, 
  Package, 
  Landmark, 
  Receipt, 
  Users, 
  Settings, 
  ChevronDown,
  Building2,
  List,
  Calculator,
  FileSpreadsheet,
  CreditCard,
  PiggyBank,
  ArrowLeftRight,
  ClipboardList,
  UserCheck,
  Clock,
  DollarSign,
  TrendingUp,
  Shield,
  UserPlus,
  ShieldCheck,
  Sparkles,
  FileSignature,
  MessageSquare,
  Layers,
  Wallet,
  Factory,
  Heart,
  Briefcase,
  CalendarDays,
  AlertTriangle,
  History,
  Send,
  MapPin,
  Globe,
  Scale,
  Link2,
  Lock,
} from 'lucide-react';
import { SubscriptionUpgradeModal } from '@/components/SubscriptionUpgradeModal';
import type { PlanTier } from '@/config/planModuleAccess';

import { cn } from '@/lib/utils';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { usePayrollLocalization } from '@/hooks/usePayrollLocalization';
import { useEnabledModules, ModuleCode } from '@/hooks/useEnabledModules';
import { useCountryScope, normalizeCountryCode } from '@/hooks/useCountryFilter';
import { isChildVisibleForCountry, getCountryModuleFlags } from '@/config/countryModuleMap';

import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { SearchableOrgSwitcher } from '@/components/layout/SearchableOrgSwitcher';
import logo from '@/assets/efinsuite-logo.png';

interface NavItem {
  label: string;
  icon: React.ElementType;
  href?: string;
  children?: { label: string; href: string; icon: React.ElementType; hideForReadOnly?: boolean; hideForNonCA?: boolean; restrictToCountries?: string[] }[];
  /** Module codes required for this nav item to be visible */
  requiredModules?: ModuleCode[];
  /** Hide this nav item when user is in read-only (auditor) mode */
  hideForReadOnly?: boolean;
  /** Restrict this nav item to specific roles only */
  allowedRoles?: string[];
}

// Navigation items with module requirements
const getNavigation = (payrollLabels: { taxSlips: string; separationDoc: string; remittances: string }): NavItem[] => [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { 
    label: 'Sales', 
    icon: ShoppingCart,
    requiredModules: ['accounts_receivable'],
    children: [
      { label: 'Products & Services', href: '/sales/products', icon: Package },
      { label: 'Customers', href: '/sales/customers', icon: Users },
      { label: 'Quotes', href: '/sales/quotes', icon: FileText },
      { label: 'Invoices', href: '/sales/invoices', icon: Receipt },
      { label: 'Recurring Invoices', href: '/sales/recurring', icon: ArrowLeftRight },
      { label: 'Credit Notes', href: '/sales/credit-notes', icon: FileSpreadsheet },
      { label: 'Payments', href: '/sales/payments', icon: CreditCard },
    ]
  },
  { 
    label: 'Purchases', 
    icon: Package,
    requiredModules: ['accounts_payable'],
    children: [
      { label: 'Vendors', href: '/purchases/vendors', icon: Building2 },
      { label: 'Purchase Orders', href: '/purchases/orders', icon: ClipboardList },
      { label: 'Bills', href: '/purchases/bills', icon: ClipboardList },
      { label: 'Recurring Bills', href: '/purchases/recurring', icon: ArrowLeftRight },
      { label: 'Vendor Credits', href: '/purchases/credits', icon: FileSpreadsheet },
      { label: 'Expense Claims', href: '/purchases/expense-claims', icon: Receipt },
      { label: 'Direct Expenses', href: '/purchases/expenses', icon: DollarSign },
      { label: 'Payments', href: '/purchases/payments', icon: CreditCard },
      { label: 'Approvals', href: '/purchases/approvals', icon: ClipboardList },
    ]
  },
  { 
    label: 'Inventory', 
    icon: Package, 
    href: '/inventory',
    requiredModules: ['inventory'],
  },
  { 
    label: 'Banking', 
    icon: Landmark,
    requiredModules: ['banking'],
    children: [
      { label: 'Accounts', href: '/banking/accounts', icon: PiggyBank },
      
      { label: 'Credit Cards', href: '/banking/credit-cards', icon: CreditCard },
      { label: 'Transactions', href: '/banking/transactions', icon: ArrowLeftRight },
      { label: 'AI Rules', href: '/banking/rules', icon: Sparkles, hideForReadOnly: true },
      { label: 'Bank Reconciliation', href: '/banking/reconciliation', icon: Shield },
      { label: 'CC Reconciliation', href: '/banking/credit-cards/reconcile', icon: CreditCard },
      { label: 'Reconciliation History', href: '/banking/reconciliation-history', icon: FileSpreadsheet },
      { label: 'Settlement Reconciliation', href: '/banking/settlements', icon: Wallet },
      { label: 'Sales Tax Audit', href: '/banking/tax-audit', icon: AlertTriangle },
    ]
  },
  {
    label: 'eFinconnect',
    icon: Send,
    requiredModules: ['treasury'],
    children: [
      { label: 'Dashboard', href: '/banking-payments', icon: LayoutDashboard },
      { label: 'CRA Payments', href: '/banking-payments/cra-payments', icon: Receipt, hideForNonCA: true },
      { label: 'AP Payments', href: '/treasury/ap-payments', icon: CreditCard },
      { label: 'Payroll Payments', href: '/treasury/payroll-payments', icon: Users },
      { label: 'Scheduled', href: '/banking-payments/scheduled', icon: Receipt },
      { label: 'Payment History', href: '/banking-payments/history', icon: Receipt },
      { label: 'Payment Links', href: '/banking-payments/payment-links', icon: Receipt },
      { label: 'Payout Routing', href: '/banking-payments/payout-routing', icon: Link2 },

      { label: 'Approvals', href: '/treasury/approvals', icon: UserCheck },
      { label: 'CRA Accounts', href: '/banking-payments/cra-accounts', icon: Settings, hideForReadOnly: true, hideForNonCA: true },
      { label: 'Settings', href: '/treasury/settings', icon: Settings, hideForReadOnly: true },
    ],
  },
  { 
    label: 'Accounting', 
    icon: BookOpen,
    requiredModules: ['general_ledger'],
    children: [
      { label: 'Chart of Accounts', href: '/accounts', icon: FileSpreadsheet },
      { label: 'Journal Entries', href: '/journal-entries', icon: FileText },
      { label: 'General Ledger', href: '/ledger', icon: BookOpen },
      { label: 'Detailed Ledger', href: '/detailed-ledger', icon: List },
      { label: 'Trial Balance', href: '/trial-balance', icon: BarChart3 },
      { label: 'Exchange Rates', href: '/exchange-rates', icon: BarChart3 },
      { label: 'FX Revaluation', href: '/finance/revaluation', icon: BarChart3 },
      { label: 'Divisions', href: '/divisions', icon: Layers },
      { label: 'Cost Allocations', href: '/divisions/allocations', icon: BarChart3 },
      { label: 'Division Access', href: '/divisions/access', icon: Layers },
    ]
  },
  { 
    label: 'Financial Reports', 
    icon: TrendingUp,
    requiredModules: ['reporting'],
    children: [
      { label: 'Balance Sheet', href: '/reports/balance-sheet', icon: FileSpreadsheet },
      { label: 'Income Statement', href: '/reports/income-statement', icon: BarChart3 },
      { label: 'Cash Flow', href: '/reports/cash-flow', icon: DollarSign },
      { label: 'Changes in Equity', href: '/reports/changes-in-equity', icon: BarChart3 },
      { label: 'Consolidated Statements', href: '/reports/consolidated', icon: Layers },
      { label: 'Management Report', href: '/reports/management', icon: TrendingUp },
      { label: 'FX Gain / Loss', href: '/reports/fx-gain-loss', icon: ArrowLeftRight },
      { label: 'Multi-Currency TB', href: '/reports/multi-currency-trial-balance', icon: BarChart3 },
      { label: 'Reports Centre', href: '/reports', icon: FileText },
    ]
  },
  { 
    label: 'Fixed Assets', 
    icon: Building2, 
    href: '/fixed-assets',
    requiredModules: ['fixed_assets'],
  },
  { 
    label: 'Leases', 
    icon: Landmark, 
    href: '/leases',
    requiredModules: ['leases'],
  },
  { 
    label: 'Sales Tax', 
    icon: Receipt, 
    requiredModules: ['general_ledger'],
    children: [
      { label: 'Tax Center', href: '/tax', icon: Receipt },
      { label: 'Setup Wizard', href: '/tax/setup', icon: Sparkles },
      { label: 'Filing Periods', href: '/tax/filing-periods', icon: CalendarDays },
      { label: 'Exceptions', href: '/tax/exceptions', icon: AlertTriangle },
      { label: 'Audit Trail', href: '/tax/audit-trail', icon: History },
      { label: 'Advanced Reports', href: '/tax/reports', icon: BarChart3 },
      { label: 'E-File Returns', href: '/tax/e-file', icon: Send, hideForReadOnly: true },
      { label: 'Address Tax (US)', href: '/tax/address-tax', icon: MapPin, restrictToCountries: ['US'] },
      { label: 'UK VAT (MTD)', href: '/intl/uk-vat', icon: Globe, restrictToCountries: ['GB'] },
      { label: 'EU VAT (OSS)', href: '/tax/eu-vat', icon: Globe, restrictToCountries: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'] },
      { label: 'Nigeria Tax Engine', href: '/tax/nigeria', icon: Globe, restrictToCountries: ['NG'] },
      { label: 'Tax Provisioning', href: '/tax/provision', icon: Scale },
      { label: 'Withholding Tax', href: '/tax/withholding', icon: Receipt },
    ],
  },
  { 
    label: 'Budgets', 
    icon: Wallet,
    requiredModules: ['budgeting'],
    children: [
      { label: 'Budget Management', href: '/budgets', icon: Wallet },
      { label: 'Production Budgets', href: '/budgets/production', icon: Factory },
      { label: 'Variance Analysis', href: '/budgets/variance', icon: BarChart3 },
      { label: 'AI Forecasting', href: '/budgets/ai-forecast', icon: Sparkles },
    ]
  },
  { 
    label: 'Payroll', 
    icon: Users,
    requiredModules: ['payroll'],
    children: [
      { label: 'Employees', href: '/payroll/employees', icon: UserCheck },
      { label: 'Onboarding', href: '/payroll/employees/onboarding', icon: UserPlus, hideForReadOnly: true },
      { label: 'Timesheets', href: '/payroll/timesheets', icon: Clock },
      { label: 'Self-Service', href: '/payroll/self-service', icon: Users, hideForReadOnly: true },
      { label: 'Pay Runs', href: '/payroll/runs', icon: DollarSign },
      { label: payrollLabels.remittances, href: '/payroll/remittances', icon: Receipt },
      { label: payrollLabels.taxSlips, href: '/payroll/tax-slips', icon: FileText },
      { label: payrollLabels.separationDoc, href: '/payroll/roe', icon: ClipboardList },
      { label: 'Reports', href: '/payroll/reports', icon: FileSpreadsheet },
    ]
  },
  { 
    label: 'Donations', 
    icon: Heart, 
    href: '/donations',
    requiredModules: ['donations'],
  },
  { 
    label: 'Accountant Dashboard', 
    icon: Calculator, 
    requiredModules: ['accountant_dashboard'],
    children: [
      { label: 'Dashboard', href: '/reports/accountant', icon: Calculator },
      { label: 'Practice Management', href: '/reports/practice-management', icon: Briefcase },
    ]
  },
  { 
    label: 'DocSign', 
    icon: FileSignature, 
    href: '/docsign',
    requiredModules: ['docsign'],
  },
  { 
    label: 'Communication', 
    icon: MessageSquare, 
    href: '/communication',
    requiredModules: ['communication'],
  },
  { label: 'Settings', icon: Settings, href: '/settings', allowedRoles: ['owner', 'admin'] },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { 
    currentOrganization: currentOrg, 
    organizations, 
    isLoading: orgsLoading, 
    switchOrganization 
  } = useOrganizationContext();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const { sidebarLabels } = usePayrollLocalization();
  const { isModuleEnabled, isModuleInCurrentPlan, isLoading: modulesLoading, isReadOnly, userRole, planTier } = useEnabledModules();
  const { country: scopedCountry } = useCountryScope();
  const countryCode = scopedCountry ?? normalizeCountryCode(currentOrg?.country ?? null) ?? 'CA';
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; module?: ModuleCode; label?: string }>({ open: false });

  // Generate navigation with localized payroll labels
  const baseNavigation = useMemo(() => getNavigation(sidebarLabels), [sidebarLabels]);

  // Filter navigation based on enabled modules and read-only status.
  // Items whose module is enabled by role/org but NOT included in the current plan
  // stay visible with `locked: true` so users see everything and get an upgrade prompt.
  const navigation = useMemo(() => {
    return baseNavigation
      .map(item => {
        if (item.allowedRoles && !item.allowedRoles.includes(userRole)) return null;
        if (isReadOnly && item.hideForReadOnly) return null;
        if (modulesLoading) return { ...item, locked: false as boolean };
        if (!item.requiredModules || item.requiredModules.length === 0) {
          return { ...item, locked: false as boolean };
        }
        const enabled = item.requiredModules.some(code => isModuleEnabled(code));
        if (!enabled) return null;
        const inPlan = item.requiredModules.some(code => isModuleInCurrentPlan(code));
        return { ...item, locked: !inPlan };
      })
      .filter((x): x is NavItem & { locked: boolean } => x !== null)
      .map(item => {
        if (!item.children) return item;
        let children = item.children;
        if (isReadOnly) children = children.filter(child => !child.hideForReadOnly);
        children = children.filter(child => isChildVisibleForCountry(child, countryCode));
        return { ...item, children };
      });
  }, [baseNavigation, isModuleEnabled, isModuleInCurrentPlan, modulesLoading, isReadOnly, userRole, countryCode]);


  // Auto-expand parent groups when navigating to child routes
  useEffect(() => {
    const activeParents = navigation
      .filter(item => item.children?.some(child => location.pathname === child.href))
      .map(item => item.label);
    
    if (activeParents.length > 0) {
      setExpandedItems(prev => {
        const newExpanded = [...prev];
        activeParents.forEach(parent => {
          if (!newExpanded.includes(parent)) {
            newExpanded.push(parent);
          }
        });
        return newExpanded;
      });
    }
  }, [location.pathname, navigation]);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href?: string, children?: NavItem['children']) => {
    if (href) return location.pathname === href;
    if (children) return children.some(child => location.pathname === child.href);
    return false;
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo & Org Switcher */}
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
            <img src={logo} alt="efinsuite Globe" className="w-14 h-14 object-contain" />
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">efinsuite Globe</h1>
                <p className="text-xs text-sidebar-muted">Accounting Platform</p>
              </div>
            )}
          </div>
          
          {!collapsed && (
            <SearchableOrgSwitcher
              currentOrg={currentOrg}
              organizations={organizations}
              isLoading={orgsLoading}
              onSwitch={switchOrganization}
              onCreateNew={() => setCreateOrgOpen(true)}
              filterCountry={scopedCountry}

            />
          )}
          
          <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
          {navigation.map((item) => {
            const locked = item.locked;
            const lockedModule = locked ? item.requiredModules?.[0] : undefined;
            const openUpgrade = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setUpgradeModal({ open: true, module: lockedModule, label: item.label });
            };
            return (
            <div key={item.label}>
              {item.href ? (
                locked ? (
                  <button
                    onClick={openUpgrade}
                    className={cn("nav-item w-full opacity-70 hover:opacity-100")}
                    title={`Upgrade to unlock ${item.label}`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      </>
                    )}
                  </button>
                ) : (
                  <Link
                    to={item.href}
                    className={cn(
                      "nav-item",
                      isActive(item.href) && "nav-item-active"
                    )}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              ) : (
                <>
                  <button
                    onClick={locked ? openUpgrade : () => toggleExpand(item.label)}
                    className={cn(
                      "nav-item w-full justify-between",
                      isActive(undefined, item.children) && "text-sidebar-primary",
                      locked && "opacity-70 hover:opacity-100"
                    )}
                    title={locked ? `Upgrade to unlock ${item.label}` : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
                    </div>
                    {!collapsed && (
                      locked ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform",
                          expandedItems.includes(item.label) && "rotate-180"
                        )} />
                      )
                    )}
                  </button>
                  {!locked && !collapsed && expandedItems.includes(item.label) && item.children && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                      {item.children.map(child => (
                        <Link
                          key={child.href}
                          to={child.href}
                          className={cn(
                            "nav-item text-sm",
                            location.pathname === child.href && "nav-item-active"
                          )}
                        >
                          <child.icon className="w-4 h-4" />
                          <span>{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            );
          })}

          
          {/* Admin Section - Only visible for admins */}
          {isAdmin && (
            <>
              <div className="my-3 border-t border-sidebar-border" />
              <Link
                to="/admin"
                className={cn(
                  "nav-item bg-warning/10 hover:bg-warning/20 text-warning",
                  location.pathname.startsWith('/admin') && "nav-item-active bg-warning/20"
                )}
              >
                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Admin Panel</span>}
              </Link>
            </>
          )}
        </nav>
      </div>

      <SubscriptionUpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal((s) => ({ ...s, open }))}
        requiredModule={upgradeModal.module}
        featureLabel={upgradeModal.label}
        currentPlanTier={planTier as PlanTier}
      />
    </aside>
  );
}


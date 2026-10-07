import { ModuleCode } from '@/hooks/useEnabledModules';

/**
 * Role-based module access control matrix
 * 
 * Defines which modules each organization role can access.
 * Based on accounting best practices and separation of duties:
 * - Payroll staff cannot access sales/AR data
 * - Sales/member roles cannot access payroll
 * - Auditors get read-only access to everything
 * - Finance managers get full financial module access
 */

export type OrgRole = 
  | 'owner'
  | 'admin'
  | 'finance_manager'
  | 'accountant'
  | 'payroll_officer'
  | 'auditor'
  | 'member';

export const ROLE_MODULE_ACCESS: Record<OrgRole, ModuleCode[]> = {
  // Full access to all modules
  owner: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'practice_management', 'donations', 'inventory',
    'reporting', 'docsign', 'communication', 'accountant_dashboard', 'treasury', 'cra_tax',
  ],

  // Full access to all modules
  admin: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'practice_management', 'donations', 'inventory',
    'reporting', 'docsign', 'communication', 'accountant_dashboard', 'treasury', 'cra_tax',
  ],

  // Full financial access including Treasury
  finance_manager: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'donations', 'inventory', 'reporting', 'docsign', 'communication', 'treasury', 'cra_tax',
  ],

  // Core accounting — can view and initiate Treasury payments
  accountant: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'banking', 'fixed_assets', 'leases', 'budgeting',
    'reporting', 'docsign', 'communication', 'accountant_dashboard', 'treasury', 'cra_tax',
  ],

  // Payroll-focused — Treasury access for source-deduction remittances only
  payroll_officer: [
    'payroll', 'reporting', 'communication', 'treasury', 'cra_tax',
  ],

  // Read-only across all modules for audit purposes (incl. Treasury)
  auditor: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'donations', 'inventory', 'reporting', 'accountant_dashboard', 'treasury', 'cra_tax',
  ],

  // Basic member — limited to communication and document signing
  member: [
    'docsign', 'communication',
  ],
};

/**
 * Human-readable descriptions of module access per role
 */
export const ROLE_MODULE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full access to all modules and settings',
  admin: 'Full access to all modules and settings',
  finance_manager: 'Full financial access including GL, AP, AR, Payroll, Banking, Treasury, Assets, Budgets, Inventory & Reporting',
  accountant: 'Core accounting + Treasury: GL, AP, AR, Banking, Treasury, Assets, Budgets & Reporting. No payroll access.',
  payroll_officer: 'Payroll processing, source-deduction Treasury remittance & related reporting.',
  auditor: 'Read-only access across all financial modules (including Treasury) for audit & compliance review.',
  member: 'Basic access: Document signing & communication only.',
};

const ROLE_ALIASES: Record<string, OrgRole> = {
  owner: 'owner',
  admin: 'admin',
  administrator: 'admin',
  finance_manager: 'finance_manager',
  finance_mgr: 'finance_manager',
  cfo: 'finance_manager',
  accountant: 'accountant',
  bookkeeper: 'accountant',
  book_keeper: 'accountant',
  payroll_officer: 'payroll_officer',
  payroll: 'payroll_officer',
  auditor: 'auditor',
  auditor_read_only: 'auditor',
  viewer: 'auditor',
  read_only: 'auditor',
  readonly: 'auditor',
  member: 'member',
};

/**
 * Map stored role text onto the access matrix.
 * Labels such as "Finance Manager" and "Admin" are the same roles as the
 * snake_case values saved by the team editor.
 */
export function normalizeOrgRole(role: string | null | undefined): OrgRole {
  const key = (role ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return ROLE_ALIASES[key] ?? 'member';
}

/**
 * Get the modules accessible by a given role
 */
export function getModulesForRole(role: string): ModuleCode[] {
  return ROLE_MODULE_ACCESS[normalizeOrgRole(role)];
}

/**
 * Check if a role has access to a specific module
 */
export function roleHasModuleAccess(role: string, moduleCode: ModuleCode): boolean {
  const allowedModules = getModulesForRole(role);
  return allowedModules.includes(moduleCode);
}

/**
 * Get human-readable module names for display
 */
export const MODULE_DISPLAY_NAMES: Record<ModuleCode, string> = {
  general_ledger: 'General Ledger',
  accounts_payable: 'Accounts Payable',
  accounts_receivable: 'Accounts Receivable',
  payroll: 'Payroll',
  banking: 'Banking',
  fixed_assets: 'Fixed Assets',
  leases: 'Leases',
  budgeting: 'Budgeting',
  practice_management: 'Practice Management',
  donations: 'Donations',
  inventory: 'Inventory',
  reporting: 'Reporting',
  docsign: 'Document Signing',
  communication: 'Communication',
  accountant_dashboard: 'Accountant Dashboard',
  treasury: 'Treasury Management',
  cra_tax: 'CRA Tax & Remittance',
};

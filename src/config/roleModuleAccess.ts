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
    'reporting', 'docsign', 'communication', 'accountant_dashboard', 'treasury',
  ],

  // Full access to all modules
  admin: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'practice_management', 'donations', 'inventory',
    'reporting', 'docsign', 'communication', 'accountant_dashboard', 'treasury',
  ],

  // Full financial access including Treasury
  finance_manager: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'donations', 'inventory', 'reporting', 'docsign', 'communication', 'treasury',
  ],

  // Core accounting — can view and initiate Treasury payments
  accountant: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'banking', 'fixed_assets', 'leases', 'budgeting',
    'reporting', 'docsign', 'communication', 'accountant_dashboard', 'treasury',
  ],

  // Payroll-focused — Treasury access for source-deduction remittances only
  payroll_officer: [
    'payroll', 'reporting', 'communication', 'treasury',
  ],

  // Read-only across all modules for audit purposes (incl. Treasury)
  auditor: [
    'general_ledger', 'accounts_payable', 'accounts_receivable',
    'payroll', 'banking', 'fixed_assets', 'leases', 'budgeting',
    'donations', 'inventory', 'reporting', 'accountant_dashboard', 'treasury',
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

/**
 * Get the modules accessible by a given role
 */
export function getModulesForRole(role: string): ModuleCode[] {
  return ROLE_MODULE_ACCESS[role as OrgRole] || ROLE_MODULE_ACCESS.member;
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
};

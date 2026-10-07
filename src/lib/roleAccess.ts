import type { ModuleCode } from '@/hooks/useEnabledModules';
import { normalizeOrgRole, roleHasModuleAccess } from '@/config/roleModuleAccess';

export interface OrgModuleRow {
  code?: string | null;
  is_enabled?: boolean | null;
}

const CORE_MODULES: ModuleCode[] = [
  'general_ledger',
  'accounts_payable',
  'accounts_receivable',
  'banking',
  'reporting',
  'treasury',
  'leases',
];

function rowEnabled(row: OrgModuleRow | undefined): boolean {
  return !!row && row.is_enabled !== false;
}

/**
 * Whether this role may open a module.
 * An unset module flag counts as on. An explicit disable still wins.
 * A catalog that simply never received a row for a role-granted module
 * does not hide that module. An empty catalog stays on the core set.
 */
export function isModuleEnabledForRole(
  role: string | null | undefined,
  code: ModuleCode,
  orgModules: OrgModuleRow[] | null | undefined,
): boolean {
  const normalized = normalizeOrgRole(role);
  if (!roleHasModuleAccess(normalized, code)) return false;

  if (!orgModules || orgModules.length === 0) {
    if (code === 'cra_tax') return true;
    return CORE_MODULES.includes(code);
  }

  if (code === 'cra_tax') {
    return orgModules.some(
      (row) =>
        row.is_enabled !== false &&
        (row.code === 'cra_tax' ||
          row.code === 'general_ledger' ||
          row.code === 'payroll' ||
          row.code === 'treasury'),
    );
  }

  const row = orgModules.find((entry) => entry.code === code);
  const assets = orgModules.find((entry) => entry.code === 'fixed_assets');
  if (code === 'leases' && rowEnabled(assets)) return true;
  if (row) return row.is_enabled !== false;
  if (code === 'leases') return false;
  return true;
}

export function isReadOnlyOrgRole(role: string | null | undefined): boolean {
  return normalizeOrgRole(role) === 'auditor';
}

/** Create, edit, and post actions inside a module this role can open. */
export function canCreateInModule(
  role: string | null | undefined,
  code: ModuleCode,
  orgModules: OrgModuleRow[] | null | undefined,
): boolean {
  if (isReadOnlyOrgRole(role)) return false;
  return isModuleEnabledForRole(role, code, orgModules);
}

/**
 * Open a module page. Platform admins keep their existing bypass.
 * A role that already includes the module is not stopped by a missing
 * subscription row or an unmapped plan name. An explicit module disable
 * still closes the page.
 */
export function canOpenModule(input: {
  isPlatformAdmin?: boolean;
  role: string | null | undefined;
  module: ModuleCode | null;
  orgModules?: OrgModuleRow[] | null;
}): boolean {
  if (input.isPlatformAdmin) return true;
  if (!input.module) return true;
  return isModuleEnabledForRole(input.role, input.module, input.orgModules);
}

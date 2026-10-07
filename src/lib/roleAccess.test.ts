import { describe, expect, it } from 'vitest';
import { getModulesForRole } from '@/config/roleModuleAccess';
import { canCreateInModule, canOpenModule, isReadOnlyOrgRole } from './roleAccess';

const partialCatalog = [
  { code: 'general_ledger', is_enabled: true },
  { code: 'banking', is_enabled: true },
];

describe('role create access', () => {
  it('treats Admin and Finance Manager labels as full invoice access', () => {
    expect(getModulesForRole('Admin')).toContain('accounts_receivable');
    expect(getModulesForRole('Finance Manager')).toContain('accounts_receivable');
    expect(canCreateInModule('admin', 'accounts_receivable', partialCatalog)).toBe(true);
    expect(canCreateInModule('Finance Manager', 'accounts_receivable', partialCatalog)).toBe(true);
    expect(canCreateInModule('finance_manager', 'accounts_receivable', partialCatalog)).toBe(true);
    expect(canCreateInModule('accountant', 'accounts_receivable', partialCatalog)).toBe(true);
    expect(canCreateInModule('bookkeeper', 'accounts_receivable', partialCatalog)).toBe(true);
  });

  it('keeps a null enabled flag and a missing plan from hiding invoices', () => {
    const catalog = [
      { code: 'accounts_receivable', is_enabled: null },
      { code: 'banking', is_enabled: true },
    ];
    expect(canCreateInModule('admin', 'accounts_receivable', catalog)).toBe(true);
    expect(
      canOpenModule({
        role: 'finance_manager',
        module: 'accounts_receivable',
        orgModules: catalog,
      }),
    ).toBe(true);
  });

  it('still blocks creates the role does not grant', () => {
    expect(canCreateInModule('member', 'accounts_receivable', partialCatalog)).toBe(false);
    expect(canCreateInModule('payroll_officer', 'accounts_receivable', partialCatalog)).toBe(false);
    expect(canOpenModule({ role: 'member', module: 'accounts_receivable', orgModules: partialCatalog })).toBe(false);
    expect(isReadOnlyOrgRole('auditor')).toBe(true);
    expect(isReadOnlyOrgRole('viewer')).toBe(true);
    expect(canCreateInModule('auditor', 'accounts_receivable', partialCatalog)).toBe(false);
    expect(canOpenModule({ role: 'auditor', module: 'accounts_receivable', orgModules: partialCatalog })).toBe(true);
  });

  it('keeps an empty module catalog on the core set', () => {
    expect(canCreateInModule('admin', 'accounts_receivable', [])).toBe(true);
    expect(canCreateInModule('admin', 'practice_management', [])).toBe(false);
    expect(canCreateInModule('admin', 'practice_management', partialCatalog)).toBe(true);
  });

  it('honors an explicit module switch off', () => {
    const catalog = [{ code: 'accounts_receivable', is_enabled: false }];
    expect(canCreateInModule('admin', 'accounts_receivable', catalog)).toBe(false);
    expect(canOpenModule({ role: 'owner', module: 'accounts_receivable', orgModules: catalog })).toBe(false);
  });
});

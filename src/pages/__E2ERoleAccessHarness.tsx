/**
 * E2E-only page for role create access.
 * Registered at /__e2e__/role-access when served with VITE_E2E=1.
 */
import { useMemo, useState } from 'react';
import { canCreateInModule, canOpenModule } from '@/lib/roleAccess';

const ROLES = ['Admin', 'Finance Manager', 'accountant', 'auditor', 'member'] as const;

const catalog = [
  { code: 'general_ledger', is_enabled: true },
  { code: 'banking', is_enabled: true },
  { code: 'accounts_receivable', is_enabled: null as boolean | null },
];

export default function E2ERoleAccessHarness() {
  const [role, setRole] = useState<(typeof ROLES)[number]>('Admin');
  const open = useMemo(
    () => canOpenModule({ role, module: 'accounts_receivable', orgModules: catalog }),
    [role],
  );
  const create = useMemo(
    () => canCreateInModule(role, 'accounts_receivable', catalog),
    [role],
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#f4f6fb', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>Invoices</h1>
      <p data-testid="role-access-role">Role: {role}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {ROLES.map((option) => (
          <button key={option} type="button" onClick={() => setRole(option)}>
            {option}
          </button>
        ))}
      </div>
      {open ? (
        <div>
          <p data-testid="role-access-open">Accounts Receivable is open</p>
          {create ? (
            <button type="button" data-testid="new-invoice">New Invoice</button>
          ) : (
            <p data-testid="role-access-readonly">Read-only. New Invoice is hidden.</p>
          )}
        </div>
      ) : (
        <p data-testid="role-access-denied">No access to Accounts Receivable</p>
      )}
    </div>
  );
}

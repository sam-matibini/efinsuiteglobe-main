import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectiveCapabilities } from '@/lib/cra/engine';
import { getLedger, resetCraStoreForTests } from '@/lib/cra/store';
import CraDashboard from './CraDashboard';
import CraAuthorizations from './CraAuthorizations';
import CraRemittances from './CraRemittances';

vi.mock('@/hooks/useCraTaxCentre', () => ({
  useCraTaxCentre: () => {
    const ledger = getLedger('render-org', 'ABC Manufacturing Ltd.');
    const capabilities = effectiveCapabilities('finance_manager', ledger.accessCeiling);
    return {
      ledger,
      actor: { email: 'cfo@company.com', role: 'finance_manager', displayName: 'CFO' },
      orgId: 'render-org',
      orgName: 'ABC Manufacturing Ltd.',
      country: 'CA',
      isLoading: false,
      capabilities,
      can: (cap: string) => capabilities.includes(cap as never),
      connection: {
        representativeName: 'eFinTax Advisors Ltd.',
        representativeId: null,
        efileName: 'eFinTax EFILE',
        efileConfigured: false,
        efileNumberConfigured: false,
        cdeConfigured: false,
        nombaConfigured: false,
        loaded: true,
      },
      refresh: vi.fn(),
      saveProfile: vi.fn(),
      saveAccessCeiling: vi.fn(),
      requestAuthorization: vi.fn(),
      sendInstructions: vi.fn(),
      recordClientConfirmation: vi.fn(),
      noteStillPending: vi.fn(),
      revokeAuthorization: vi.fn(),
      reviewGst: vi.fn(),
      reviewPayroll: vi.fn(),
      prepareT2: vi.fn(),
      submitEfile: vi.fn(),
      acknowledgeEfile: vi.fn(),
      createPayment: vi.fn(),
      approvePayment: vi.fn(),
      releasePayment: vi.fn(),
      pollPayment: vi.fn(),
      recordConfirmation: vi.fn(),
      recordException: vi.fn(),
      markNoticeRead: vi.fn(),
    };
  },
}));

function renderAt(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('CRA Tax & Remittance screens', () => {
  beforeEach(() => {
    resetCraStoreForTests();
  });

  it('shows the organization tax centre and enrolled balances', () => {
    renderAt(<CraDashboard />);
    expect(screen.getByRole('heading', { name: 'Tax & CRA' })).toBeInTheDocument();
    expect(screen.getAllByText('ABC Manufacturing Ltd.').length).toBeGreaterThan(0);
    expect(screen.getByText('Business number not on file')).toBeInTheDocument();
    expect(screen.queryByText(/\$12,450\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$8,250\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$4,200\.00/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Not returned by CRA').length).toBeGreaterThan(0);
    expect(screen.getByText('CRA has not returned account balances.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pay CRA' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'File return' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sales tax reporting' })).toHaveAttribute('href', '/tax');
    expect(screen.getByText(/They are not CRA account balances/)).toBeInTheDocument();
    expect(screen.getByText(/does not store CRA passwords/)).toBeInTheDocument();
  });

  it('shows the representative authorization without a password field', () => {
    renderAt(<CraAuthorizations />);
    expect(screen.getByRole('heading', { name: 'CRA authorizations' })).toBeInTheDocument();
    expect(screen.getAllByText(/eFinTax Advisors Ltd\./).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/eFinTax EFILE/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not configured/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/R7EFS184/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request CRA authorization' })).toBeInTheDocument();
  });

  it('lists no remittances until a payment is prepared', () => {
    renderAt(<CraRemittances />);
    expect(screen.getByRole('heading', { name: 'Tax remittances' })).toBeInTheDocument();
    expect(screen.getByText(/No CRA payments yet/)).toBeInTheDocument();
    expect(screen.queryByText('EFS-CRA-00001246')).not.toBeInTheDocument();
    expect(screen.queryByText('EFS-CRA-00001245')).not.toBeInTheDocument();
    expect(screen.queryByText('CRA-123456789')).not.toBeInTheDocument();
  });
});

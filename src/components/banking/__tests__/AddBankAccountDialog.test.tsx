import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddBankAccountDialog } from '../AddBankAccountDialog';
import { CreateVirtualAccountDialog } from '@/components/virtual-accounts/CreateVirtualAccountDialog';
import { COUNTRY_LOCALIZATIONS, getAvailableCurrencies } from '@/data/countryLocalizations';

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrganization: () => ({
    organization: {
      id: 'org-1',
      country: 'Nigeria',
      currency: 'NGN',
    },
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      email: 'sam@efintax.biz',
      user_metadata: { first_name: 'Sam', last_name: 'Matibini' },
    },
  }),
}));

vi.mock('@/hooks/useVirtualAccounts', () => ({
  useVirtualAccounts: () => ({
    create: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  Element.prototype.scrollIntoView = vi.fn();
});

const glAccounts = [
  { id: 'gl-1', code: '1010', name: 'Operating Bank', account_type: 'asset', is_header: false, is_active: true },
];

describe('Add Bank Account dialogs', () => {
  it('lists every localized country in the Add Bank Account country picker', async () => {
    render(
      <AddBankAccountDialog
        open
        onOpenChange={() => {}}
        glAccounts={glAccounts}
        onSubmit={async () => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add Bank Account' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: /country/i }));

    expect(await screen.findByPlaceholderText('Search countries...')).toBeInTheDocument();

    for (const loc of Object.values(COUNTRY_LOCALIZATIONS)) {
      expect(screen.getByText(loc.name)).toBeInTheDocument();
    }
  });

  it('lists every localized currency in the Add Bank Account currency picker', async () => {
    render(
      <AddBankAccountDialog
        open
        onOpenChange={() => {}}
        glAccounts={glAccounts}
        onSubmit={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: /currency/i }));
    expect(await screen.findByPlaceholderText('Search currencies...')).toBeInTheDocument();

    for (const curr of getAvailableCurrencies()) {
      expect(screen.getByText(curr.code)).toBeInTheDocument();
    }
  });

  it('shows country, all currencies, and KYC fields on Create Virtual Account', async () => {
    render(<CreateVirtualAccountDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Create Virtual Account' })).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Sam');
    expect(screen.getByLabelText('Last name')).toHaveValue('Matibini');
    expect(screen.getByLabelText('Email')).toHaveValue('sam@efintax.biz');
    expect(screen.getByText(/BVN or NIN/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('combobox', { name: /country/i }));
    expect(await screen.findByText('Nigeria')).toBeInTheDocument();
    expect(screen.getByText('Canada')).toBeInTheDocument();
    expect(screen.getByText('Ghana')).toBeInTheDocument();
  });
});

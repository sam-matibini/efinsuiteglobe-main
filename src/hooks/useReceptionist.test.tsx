import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const request = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useOrganization', () => ({
  useCurrentOrganization: () => ({ organization: { id: 'org-1', name: 'Acme' }, isLoading: false }),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: [] }),
}));

vi.mock('@/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [
      {
        id: 'hub-1',
        name: 'Bank of Canada',
        email: 'edalsan@gmail.com',
        phone: null,
        cell_phone: '6135550100',
        company: 'Bank of Canada',
        is_active: true,
      },
    ],
  }),
}));

vi.mock('@/integrations/supabase/client', () => {
  const result = Promise.resolve({ data: [], error: { message: 'unavailable' } });
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => result,
    then: result.then.bind(result),
  };
  return { supabase: { from: () => chain } };
});

vi.mock('@/lib/receptionist/client', () => ({
  receptionistRequest: (...args: unknown[]) => request(...args),
}));

import { useReceptionist } from './useReceptionist';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useReceptionist', () => {
  it('still opens a desk when the stored receptionist is missing', async () => {
    request.mockResolvedValue({ ok: false, error: 'The receptionist table is not available.' });
    const { result } = renderHook(() => useReceptionist(), { wrapper });

    expect(result.current.org?.organizationId).toBe('org-1');
    expect(result.current.org?.receptionists.length).toBeGreaterThan(0);
    expect(result.current.analytics?.calls).toBe(0);
    expect(result.current.directory.contacts.map((contact) => contact.name)).toContain('Bank of Canada');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(request).toHaveBeenCalledWith('state', expect.objectContaining({ organizationId: 'org-1' }));
    expect(result.current.org?.organizationId).toBe('org-1');
  });
});

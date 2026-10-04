import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCustomers } from '@/hooks/useCustomers';
import { useContacts } from '@/hooks/useContacts';
import { useVendors } from '@/hooks/useVendors';
import { receptionistRequest } from '@/lib/receptionist/client';
import { mergeDirectoryContacts } from '@/lib/receptionist/sharedContacts';
import { emptyDirectory, emptyReceptionOrg, receptionAnalytics } from '@/lib/receptionist/engine';
import type { Directory, ReceptionOrg } from '@/lib/receptionist/types';
import { toast } from 'sonner';

export function useReceptionist() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const organizationId = organization?.id ?? '';
  const queryClient = useQueryClient();
  const { customers } = useCustomers();
  const { vendors } = useVendors();
  const { contacts: sharedContacts } = useContacts();

  const state = useQuery({
    queryKey: ['ai-receptionist', organizationId],
    enabled: !!organizationId,
    queryFn: async () => receptionistRequest('state', { organizationId }),
  });

  const invoices = useQuery({
    queryKey: ['ai-receptionist-invoices', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('customer_id, balance_due, currency, deleted_at')
        .eq('organization_id', organizationId);
      if (error) return [];
      return data ?? [];
    },
  });

  const payDate = useQuery({
    queryKey: ['ai-receptionist-pay-date', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('pay_runs')
        .select('pay_date')
        .eq('organization_id', organizationId)
        .gte('pay_date', today)
        .order('pay_date', { ascending: true })
        .limit(1);
      if (error || !data?.[0]) return null;
      return data[0].pay_date;
    },
  });

  const directory = useMemo<Directory>(() => {
    const balances = new Map<string, { count: number; balance: number; currency: string }>();
    for (const invoice of invoices.data ?? []) {
      if (invoice.deleted_at || Number(invoice.balance_due) <= 0) continue;
      const current = balances.get(invoice.customer_id) ?? { count: 0, balance: 0, currency: invoice.currency || 'CAD' };
      current.count += 1;
      current.balance += Number(invoice.balance_due);
      balances.set(invoice.customer_id, current);
    }
    const customerContacts = customers.map((customer) => {
      const open = balances.get(customer.id);
      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        openInvoiceCount: open?.count ?? 0,
        openBalance: open?.balance ?? 0,
        currency: open?.currency ?? customer.default_currency ?? 'CAD',
      };
    });
    return {
      contacts: mergeDirectoryContacts(
        customerContacts,
        [
          ...sharedContacts
            .filter((contact) => contact.is_active)
            .map((contact) => ({
              id: contact.id,
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              cell_phone: contact.cell_phone,
              company: contact.company,
            })),
          ...vendors
            .filter((vendor) => vendor.is_active)
            .map((vendor) => ({
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
              phone: vendor.phone,
              company: vendor.name,
            })),
        ],
      ),
      nextPayDate: payDate.data ?? null,
    };
  }, [customers, invoices.data, payDate.data, sharedContacts, vendors]);

  const loadedOrg = (state.data?.org as ReceptionOrg | undefined) ?? null;
  const org = useMemo(() => {
    if (loadedOrg) return loadedOrg;
    if (organizationId) return emptyReceptionOrg(organizationId);
    return null;
  }, [loadedOrg, organizationId]);
  const voiceReady = state.data?.voiceReady === true;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['ai-receptionist', organizationId] });
  };

  const mutate = useMutation({
    mutationFn: async (input: { action: string; body?: Record<string, unknown> }) => {
      const result = await receptionistRequest(input.action, {
        organizationId,
        directory: directory.contacts.length ? directory : emptyDirectory(),
        ...(input.body ?? {}),
      });
      if (result.ok === false) throw new Error(String(result.error ?? 'The receptionist could not complete that request.'));
      return result;
    },
    onSuccess: async (result) => {
      if (typeof result.error === 'string' && result.error) toast.message(result.error);
      if (result.org) queryClient.setQueryData(['ai-receptionist', organizationId], result);
      else await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    organization,
    orgLoading,
    isLoading: orgLoading || (!!organizationId && state.isLoading),
    org,
    voiceReady,
    directory,
    analytics: org ? receptionAnalytics(org) : null,
    pending: mutate.isPending,
    refresh,
    talk: (text: string) => mutate.mutateAsync({ action: 'talk', body: { text } }),
    saveSettings: (settings: Record<string, unknown>) => mutate.mutateAsync({ action: 'save-settings', body: { settings } }),
    saveLists: (lists: Record<string, unknown>) => mutate.mutateAsync({ action: 'replace-lists', body: lists }),
    runTool: (name: string, parameters: Record<string, unknown>) => mutate.mutateAsync({ action: 'tool', body: { name, parameters } }),
    syncAgent: () => mutate.mutateAsync({ action: 'sync' }),
    startSession: () => mutate.mutateAsync({ action: 'session' }),
  };
}

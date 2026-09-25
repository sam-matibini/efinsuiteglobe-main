import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface DetailedLedgerFilters {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  costCenterIds?: string[];
  departmentIds?: string[];
  projectIds?: string[];
  fundIds?: string[];
  locationIds?: string[];
  vendorIds?: string[];
  customerIds?: string[];
  taxCodeIds?: string[];
  sourceModules?: string[];
  amountMin?: number;
  amountMax?: number;
  currency?: string;
  searchTerm?: string;
}

export interface LedgerEntry {
  journal_entry_id: string;
  line_id: string;
  txn_date: string;
  posting_period: string;
  source_module: string;
  reference_no: string;
  entry_description: string;
  line_memo: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  debit: number;
  credit: number;
  net_amount: number;
  running_balance?: number;
  cost_center_id: string | null;
  cost_center_code: string | null;
  cost_center_name: string | null;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  project_id: string | null;
  project_code: string | null;
  project_name: string | null;
  fund_id: string | null;
  fund_code: string | null;
  fund_name: string | null;
  location_id: string | null;
  location_code: string | null;
  location_name: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  tax_code_id: string | null;
  tax_code: string | null;
  tax_rate: number | null;
  currency: string;
  exchange_rate: number;
  base_debit: number;
  base_credit: number;
  source_document_type: string | null;
  source_document_id: string | null;
}

export interface AccountRunningBalance {
  txn_date: string;
  journal_entry_id: string;
  reference_no: string;
  description: string;
  debit: number;
  credit: number;
  net_amount: number;
  running_balance: number;
}

// Fetch detailed ledger data with multi-dimensional filtering
export function useDetailedLedger(filters: DetailedLedgerFilters) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['detailed-ledger', organization?.id, filters],
    queryFn: async () => {
      if (!organization?.id) return [];

      // Build the query using journal entries and lines with all joins
      let query = supabase
        .from('journal_entries')
        .select(`
          id,
          organization_id,
          entry_date,
          reference,
          description,
          status,
          journal_type,
          created_by,
          created_at,
          journal_entry_lines (
            id,
            account_id,
            debit,
            credit,
            description,
            cost_center_id,
            department_id,
            project_id,
            fund_id,
            location_id,
            vendor_id,
            customer_id,
            tax_code_id,
            source_document_type,
            source_document_id,
            currency,
            exchange_rate,
            base_currency_debit,
            base_currency_credit,
            accounts!inner (
              id,
              code,
              name,
              account_type,
              normal_balance
            )
          )
        `)
        .eq('organization_id', organization.id)
        .eq('status', 'posted')
        .order('entry_date', { ascending: true });

      // Apply date filters
      if (filters.startDate) {
        query = query.gte('entry_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('entry_date', filters.endDate);
      }

      const { data: entries, error } = await query;
      if (error) throw error;

      // Fetch dimension data for display
      const [
        { data: costCenters },
        { data: departments },
        { data: projects },
        { data: funds },
        { data: locations },
        { data: vendors },
        { data: customers },
        { data: taxCodes }
      ] = await Promise.all([
        supabase.from('cost_centers').select('id, code, name').eq('organization_id', organization.id),
        supabase.from('departments').select('id, code, name').eq('organization_id', organization.id),
        supabase.from('projects').select('id, code, name').eq('organization_id', organization.id),
        supabase.from('funds').select('id, code, name').eq('organization_id', organization.id),
        supabase.from('locations').select('id, code, name').eq('organization_id', organization.id),
        supabase.from('vendors').select('id, name').eq('organization_id', organization.id),
        supabase.from('customers').select('id, name').eq('organization_id', organization.id),
        supabase.from('tax_codes').select('id, code, rate').eq('organization_id', organization.id)
      ]);

      // Build lookup maps
      const ccMap = new Map(costCenters?.map(c => [c.id, c]) || []);
      const deptMap = new Map(departments?.map(d => [d.id, d]) || []);
      const projMap = new Map(projects?.map(p => [p.id, p]) || []);
      const fundMap = new Map(funds?.map(f => [f.id, f]) || []);
      const locMap = new Map(locations?.map(l => [l.id, l]) || []);
      const vendorMap = new Map(vendors?.map(v => [v.id, v]) || []);
      const customerMap = new Map(customers?.map(c => [c.id, c]) || []);
      const taxMap = new Map(taxCodes?.map(t => [t.id, t]) || []);

      // Flatten entries to ledger rows
      const ledgerEntries: LedgerEntry[] = [];
      for (const entry of entries || []) {
        for (const line of entry.journal_entry_lines || []) {
          const account = (line as any).accounts;
          const cc = line.cost_center_id ? ccMap.get(line.cost_center_id) : null;
          const dept = line.department_id ? deptMap.get(line.department_id) : null;
          const proj = line.project_id ? projMap.get(line.project_id) : null;
          const fund = line.fund_id ? fundMap.get(line.fund_id) : null;
          const loc = line.location_id ? locMap.get(line.location_id) : null;
          const vendor = line.vendor_id ? vendorMap.get(line.vendor_id) : null;
          const customer = line.customer_id ? customerMap.get(line.customer_id) : null;
          const tax = line.tax_code_id ? taxMap.get(line.tax_code_id) : null;

          const ledgerEntry: LedgerEntry = {
            journal_entry_id: entry.id,
            line_id: line.id,
            txn_date: entry.entry_date,
            posting_period: entry.entry_date.substring(0, 7),
            source_module: entry.journal_type || 'manual',
            reference_no: entry.reference,
            entry_description: entry.description || '',
            line_memo: line.description,
            account_id: account.id,
            account_code: account.code,
            account_name: account.name,
            account_type: account.account_type,
            normal_balance: account.normal_balance,
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            net_amount: (Number(line.debit) || 0) - (Number(line.credit) || 0),
            cost_center_id: line.cost_center_id,
            cost_center_code: cc?.code || null,
            cost_center_name: cc?.name || null,
            department_id: line.department_id,
            department_code: dept?.code || null,
            department_name: dept?.name || null,
            project_id: line.project_id,
            project_code: proj?.code || null,
            project_name: proj?.name || null,
            fund_id: line.fund_id,
            fund_code: fund?.code || null,
            fund_name: fund?.name || null,
            location_id: line.location_id,
            location_code: loc?.code || null,
            location_name: loc?.name || null,
            vendor_id: line.vendor_id,
            vendor_name: vendor?.name || null,
            customer_id: line.customer_id,
            customer_name: customer?.name || null,
            tax_code_id: line.tax_code_id,
            tax_code: tax?.code || null,
            tax_rate: tax?.rate || null,
            currency: line.currency || 'CAD',
            exchange_rate: Number(line.exchange_rate) || 1,
            base_debit: Number(line.base_currency_debit) || Number(line.debit) || 0,
            base_credit: Number(line.base_currency_credit) || Number(line.credit) || 0,
            source_document_type: line.source_document_type,
            source_document_id: line.source_document_id
          };

          // Apply additional filters
          if (filters.accountIds?.length && !filters.accountIds.includes(account.id)) continue;
          if (filters.costCenterIds?.length && !filters.costCenterIds.includes(line.cost_center_id || '')) continue;
          if (filters.departmentIds?.length && !filters.departmentIds.includes(line.department_id || '')) continue;
          if (filters.projectIds?.length && !filters.projectIds.includes(line.project_id || '')) continue;
          if (filters.fundIds?.length && !filters.fundIds.includes(line.fund_id || '')) continue;
          if (filters.locationIds?.length && !filters.locationIds.includes(line.location_id || '')) continue;
          if (filters.vendorIds?.length && !filters.vendorIds.includes(line.vendor_id || '')) continue;
          if (filters.customerIds?.length && !filters.customerIds.includes(line.customer_id || '')) continue;
          if (filters.taxCodeIds?.length && !filters.taxCodeIds.includes(line.tax_code_id || '')) continue;
          if (filters.sourceModules?.length && !filters.sourceModules.includes(entry.journal_type || 'manual')) continue;
          if (filters.amountMin !== undefined && Math.abs(ledgerEntry.net_amount) < filters.amountMin) continue;
          if (filters.amountMax !== undefined && Math.abs(ledgerEntry.net_amount) > filters.amountMax) continue;
          if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            const searchable = [
              ledgerEntry.reference_no,
              ledgerEntry.entry_description,
              ledgerEntry.line_memo,
              ledgerEntry.account_name,
              ledgerEntry.vendor_name,
              ledgerEntry.customer_name
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchable.includes(term)) continue;
          }

          ledgerEntries.push(ledgerEntry);
        }
      }

      return ledgerEntries;
    },
    enabled: !!organization?.id
  });
}

// Fetch running balance for a specific account
export function useAccountRunningBalance(accountId: string | null, startDate?: string, endDate?: string) {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['account-running-balance', organization?.id, accountId, startDate, endDate],
    queryFn: async () => {
      if (!organization?.id || !accountId) return [];

      const { data, error } = await supabase.rpc('get_account_running_balance', {
        p_organization_id: organization.id,
        p_account_id: accountId,
        p_start_date: startDate || null,
        p_end_date: endDate || null
      });

      if (error) throw error;
      return data as AccountRunningBalance[];
    },
    enabled: !!organization?.id && !!accountId
  });
}

// Fetch dimension options for filters
export function useLedgerDimensions() {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['ledger-dimensions', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return null;

      const [
        { data: costCenters },
        { data: departments },
        { data: projects },
        { data: funds },
        { data: locations },
        { data: vendors },
        { data: customers },
        { data: taxCodes },
        { data: accounts }
      ] = await Promise.all([
        supabase.from('cost_centers').select('id, code, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('departments').select('id, code, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('projects').select('id, code, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('funds').select('id, code, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('locations').select('id, code, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('vendors').select('id, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('customers').select('id, name').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('tax_codes').select('id, code, name, rate').eq('organization_id', organization.id).eq('is_active', true),
        supabase.from('accounts').select('id, code, name, account_type').eq('organization_id', organization.id).eq('is_active', true).eq('is_header', false)
      ]);

      return {
        costCenters: costCenters || [],
        departments: departments || [],
        projects: projects || [],
        funds: funds || [],
        locations: locations || [],
        vendors: vendors || [],
        customers: customers || [],
        taxCodes: taxCodes || [],
        accounts: accounts || [],
        sourceModules: ['manual', 'sales', 'purchase', 'payroll', 'bank', 'adjustment', 'depreciation']
      };
    },
    enabled: !!organization?.id
  });
}

// Hook to manage saved filter presets
export function useSavedFilters() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  const saveFilter = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: DetailedLedgerFilters }) => {
      // Store in localStorage for now - could be moved to database
      const key = `ledger-filter-${organization?.id}-${name}`;
      localStorage.setItem(key, JSON.stringify(filters));
      return { name, filters };
    },
    onSuccess: () => {
      toast.success('Filter saved');
      queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
    }
  });

  const loadFilters = () => {
    const prefix = `ledger-filter-${organization?.id}-`;
    const saved: { name: string; filters: DetailedLedgerFilters }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const name = key.replace(prefix, '');
        const filters = JSON.parse(localStorage.getItem(key) || '{}');
        saved.push({ name, filters });
      }
    }
    return saved;
  };

  const deleteFilter = (name: string) => {
    const key = `ledger-filter-${organization?.id}-${name}`;
    localStorage.removeItem(key);
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
    toast.success('Filter deleted');
  };

  return { saveFilter, loadFilters, deleteFilter };
}

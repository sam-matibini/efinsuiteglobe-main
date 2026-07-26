import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SalesTaxSettings {
  id: string;
  organization_id: string;
  filing_frequency: string;
  gst_number: string | null;
  pst_number: string | null;
  qst_number: string | null;
  hst_number: string | null;
  default_tax_code: string;
  collect_gst: boolean;
  collect_pst: boolean;
  collect_hst: boolean;
  collect_vat: boolean;
  collect_sales_tax: boolean;
  gst_rate: number;
  pst_rate: number;
  hst_rate: number;
  vat_rate: number;
  sales_tax_rate: number;
  vat_number: string | null;
  sales_tax_number: string | null;
  province: string;
  gst_collected_account_id: string | null;
  gst_paid_account_id: string | null;
  pst_collected_account_id: string | null;
  pst_paid_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxCode {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  rate: number;
  jurisdiction: string | null;
  tax_type: string;
  is_recoverable: boolean;
  is_compound: boolean;
  is_active: boolean;
  gl_collected_account_id: string | null;
  gl_paid_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxReturn {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  period_name: string;
  due_date: string;
  tax_collected: number;
  tax_paid: number;
  net_payable: number;
  adjustments: number;
  status: 'draft' | 'filed' | 'paid';
  filed_at: string | null;
  filed_by: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

// Sales Tax Settings Hooks
export function useSalesTaxSettings(organizationId?: string) {
  return useQuery({
    queryKey: ['sales-tax-settings', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('sales_tax_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (error) throw error;
      return data as SalesTaxSettings | null;
    },
    enabled: !!organizationId,
  });
}

export function useUpsertSalesTaxSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, settings }: { 
      organizationId: string; 
      settings: Partial<Omit<SalesTaxSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'>> 
    }) => {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('sales_tax_settings')
        .select('id')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('sales_tax_settings')
          .update(settings)
          .eq('organization_id', organizationId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('sales_tax_settings')
          .insert({ ...settings, organization_id: organizationId })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-tax-settings', organizationId] });
      toast.success('Sales tax settings saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });
}
// Helper function to generate a deterministic UUID from a code string
// This ensures derived tax codes have valid UUIDs that are consistent across sessions
function generateDeterministicUuid(prefix: string, code: string): string {
  // Create a simple hash-based UUID v5-like format using organization ID as namespace
  const combined = `${prefix}-${code}`;
  
  // Simple hash function to create deterministic hex string
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x12345678;
  let h4 = 0x87654321;
  
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 668265263);
    h4 = Math.imul(h4 ^ ch, 374761393);
  }
  
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  
  // Combine into hex strings
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((h1 ^ h2 ^ h3) >>> 0).toString(16).padStart(8, '0');
  
  // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36 chars total)
  // 8-4-4-4-12 format
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-8${hex3.slice(1, 4)}-${hex3.slice(4)}${hex4}`;
}

// Tax Codes Hooks - fetches from tax_codes table OR derives from sales_tax_settings
// Includes all standard Canadian tax codes for CRA ETA place-of-supply compliance
export function useTaxCodes(organizationId?: string, countryCode?: string) {
  return useQuery({
    queryKey: ['tax-codes', organizationId, countryCode],
    queryFn: async () => {
      if (!organizationId) return [];
      
      // First try to get explicit tax codes
      const { data: taxCodes, error: taxCodesError } = await supabase
        .from('tax_codes')
        .select('*')
        .eq('organization_id', organizationId)
        .order('code');
      
      if (taxCodesError) throw taxCodesError;
      
      // If we have explicit tax codes, use them
      if (taxCodes && taxCodes.length > 0) {
        return taxCodes as TaxCode[];
      }
      
      // Otherwise, derive tax codes from sales_tax_settings
      const { data: settings, error: settingsError } = await supabase
        .from('sales_tax_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      
      if (settingsError) throw settingsError;
      
      const now = new Date().toISOString();
      const cc = (countryCode || 'CA').toUpperCase();

      // Country-specific derivation for non-Canadian jurisdictions
      if (cc !== 'CA' && cc !== 'US') {
        const mk = (
          key: string,
          code: string,
          name: string,
          rate: number,
          tax_type: string,
          is_recoverable: boolean,
          jurisdiction: string | null = null,
        ): TaxCode => ({
          id: generateDeterministicUuid(organizationId, key),
          organization_id: organizationId,
          code,
          name,
          rate,
          jurisdiction,
          tax_type,
          is_recoverable,
          is_compound: false,
          is_active: true,
          gl_collected_account_id: settings?.gst_collected_account_id || null,
          gl_paid_account_id: settings?.gst_paid_account_id || null,
          created_at: now,
          updated_at: now,
        });

        const list: TaxCode[] = [
          mk('exempt', 'E', 'Exempt', 0, 'exempt', false),
        ];

        switch (cc) {
          case 'ZM':
            list.push(
              mk('zm-vat',    'VAT',    'VAT - Standard Rated',        16,  'VAT',        true,  'Federal'),
              mk('zm-vat-zr', 'VAT-ZR', 'VAT - Zero Rated (Exports)',  0,   'zero-rated', true,  'Federal'),
              mk('zm-vat-ex', 'VAT-EX', 'VAT - Exempt Supplies',        0,   'exempt',     false, 'Federal'),
              mk('zm-ipl',    'IPL',    'Insurance Premium Levy',       5,   'levy',       false, 'Federal'),
              mk('zm-tl',     'TL',     'Tourism Levy',                 1.5, 'levy',       false, 'Federal'),
            );
            break;
          case 'KE':
            list.push(
              mk('ke-vat',    'VAT',    'VAT - Standard Rated',        16, 'VAT',        true,  'Federal'),
              mk('ke-vat-zr', 'VAT-ZR', 'VAT - Zero Rated (Exports)',  0,  'zero-rated', true,  'Federal'),
              mk('ke-vat-ex', 'VAT-EX', 'VAT - Exempt Supplies',        0,  'exempt',     false, 'Federal'),
            );
            break;
          case 'NG':
            list.push(
              mk('ng-vat',     'VAT',          'VAT - Standard Rated',                 7.5, 'VAT',        true,  'Federal'),
              mk('ng-vat-zr',  'VAT-ZR',       'VAT - Zero Rated (Exports)',           0,   'zero-rated', true,  'Federal'),
              mk('ng-vat-ex',  'VAT-EX',       'VAT - Exempt Supplies',                0,   'exempt',     false, 'Federal'),
              mk('ng-wht-c',   'WHT-CONTRACT', 'Withholding Tax - Contracts/Supplies', 5,   'WHT',        false, 'Federal'),
              mk('ng-wht-p',   'WHT-PROF',     'Withholding Tax - Professional Fees',  10,  'WHT',        false, 'Federal'),
            );
            break;
          case 'BI':
            list.push(
              mk('bi-tva',    'TVA',    'TVA - Taux Standard',      18, 'VAT',        true,  'Federal'),
              mk('bi-tva-zr', 'TVA-ZR', 'TVA - Taux Zéro (Exports)', 0,  'zero-rated', true,  'Federal'),
              mk('bi-tva-ex', 'TVA-EX', 'TVA - Exonérée',            0,  'exempt',     false, 'Federal'),
            );
            break;
          case 'GB':
            list.push(
              mk('gb-vat-std', 'VAT-STD', 'VAT - Standard Rate', 20, 'VAT',        true,  'Federal'),
              mk('gb-vat-red', 'VAT-RED', 'VAT - Reduced Rate',   5, 'VAT',        true,  'Federal'),
              mk('gb-vat-zr',  'VAT-ZR',  'VAT - Zero Rated',     0, 'zero-rated', true,  'Federal'),
              mk('gb-vat-ex',  'VAT-EX',  'VAT - Exempt',         0, 'exempt',     false, 'Federal'),
            );
            break;
          default:
            // Generic single-rate VAT fallback for other non-CA/US countries
            list.push(
              mk('gen-vat',    'VAT',    'VAT - Standard Rated',       (settings?.gst_rate as number) || 0, 'VAT',        true,  'Federal'),
              mk('gen-vat-zr', 'VAT-ZR', 'VAT - Zero Rated (Exports)', 0,                                   'zero-rated', true,  'Federal'),
              mk('gen-vat-ex', 'VAT-EX', 'VAT - Exempt Supplies',       0,                                   'exempt',     false, 'Federal'),
            );
        }

        list.push({
          id: generateDeterministicUuid(organizationId, 'out-of-scope'),
          organization_id: organizationId,
          code: 'O/S',
          name: 'Out of Scope',
          rate: 0,
          jurisdiction: null,
          tax_type: 'out-of-scope',
          is_recoverable: false,
          is_compound: false,
          is_active: true,
          gl_collected_account_id: null,
          gl_paid_account_id: null,
          created_at: now,
          updated_at: now,
        });

        return list;
      }

      // Build derived tax codes - include all standard Canadian taxes for place-of-supply
      const derivedCodes: TaxCode[] = [];
      

      
      // Add Exempt/None option
      derivedCodes.push({
        id: generateDeterministicUuid(organizationId, 'exempt'),
        organization_id: organizationId,
        code: 'E',
        name: 'Exempt',
        rate: 0,
        jurisdiction: null,
        tax_type: 'exempt',
        is_recoverable: false,
        is_compound: false,
        is_active: true,
        gl_collected_account_id: null,
        gl_paid_account_id: null,
        created_at: now,
        updated_at: now,
      });

      // Always add GST (Federal - 5%)
      derivedCodes.push({
        id: generateDeterministicUuid(organizationId, 'gst'),
        organization_id: organizationId,
        code: 'GST',
        name: 'GST - Federal',
        rate: settings?.gst_rate || 5,
        jurisdiction: 'Federal',
        tax_type: 'GST',
        is_recoverable: true,
        is_compound: false,
        is_active: true,
        gl_collected_account_id: settings?.gst_collected_account_id || null,
        gl_paid_account_id: settings?.gst_paid_account_id || null,
        created_at: now,
        updated_at: now,
      });

      // Always add HST options for place-of-supply (selling to HST provinces)
      // HST uses the same GL accounts as GST since HST is federal + provincial combined
      // HST 13% - Ontario
      derivedCodes.push({
        id: generateDeterministicUuid(organizationId, 'hst-13'),
        organization_id: organizationId,
        code: 'HST-ON',
        name: 'HST - Ontario',
        rate: 13,
        jurisdiction: 'ON',
        tax_type: 'HST',
        is_recoverable: true,
        is_compound: false,
        is_active: true,
        // HST uses the GST accounts since it's administered by CRA
        gl_collected_account_id: settings?.gst_collected_account_id || null,
        gl_paid_account_id: settings?.gst_paid_account_id || null,
        created_at: now,
        updated_at: now,
      });

      // HST 15% - Atlantic provinces (NB, NL, NS, PE)
      derivedCodes.push({
        id: generateDeterministicUuid(organizationId, 'hst-15'),
        organization_id: organizationId,
        code: 'HST-ATL',
        name: 'HST - Atlantic (NB, NL, NS, PE)',
        rate: 15,
        jurisdiction: 'Atlantic',
        tax_type: 'HST',
        is_recoverable: true,
        is_compound: false,
        is_active: true,
        // HST uses the GST accounts since it's administered by CRA
        gl_collected_account_id: settings?.gst_collected_account_id || null,
        gl_paid_account_id: settings?.gst_paid_account_id || null,
        created_at: now,
        updated_at: now,
      });

      // Add PST/QST based on settings or defaults
      if (settings?.collect_pst && settings.pst_rate > 0) {
        const isQC = settings.province === 'QC';
        derivedCodes.push({
          id: generateDeterministicUuid(organizationId, 'pst'),
          organization_id: organizationId,
          code: isQC ? 'QST' : 'PST',
          name: isQC ? `QST - Quebec` : `PST - ${settings.province || 'Provincial'}`,
          rate: settings.pst_rate,
          jurisdiction: settings.province,
          tax_type: isQC ? 'QST' : 'PST',
          is_recoverable: isQC,
          is_compound: false,
          is_active: true,
          gl_collected_account_id: settings.pst_collected_account_id,
          gl_paid_account_id: settings.pst_paid_account_id,
          created_at: now,
          updated_at: now,
        });
        
      // Add combined GST+PST/QST option with component breakdown
        const combinedRate = (settings.gst_rate || 5) + settings.pst_rate;
        derivedCodes.push({
          id: generateDeterministicUuid(organizationId, 'gst-pst'),
          organization_id: organizationId,
          code: isQC ? 'GST+QST' : 'GST+PST',
          name: isQC ? `GST+QST Combined (${combinedRate}%)` : `GST+PST Combined (${combinedRate}%)`,
          rate: combinedRate,
          jurisdiction: settings.province,
          tax_type: isQC ? 'GST+QST' : 'GST+PST',
          is_recoverable: true, // GST portion is recoverable, PST may not be
          is_compound: false,
          is_active: true,
          // Combined-code single GL accounts intentionally null — callers MUST use component_taxes
          // for posting so PST routes to its own non-recoverable account, not the GST ITC.
          gl_collected_account_id: null,
          gl_paid_account_id: null,
          created_at: now,
          updated_at: now,
          // Component breakdown for split posting — each component carries its own GL accounts.
          // @ts-ignore - Extended field for split tax support
          component_taxes: [
            {
              code: 'GST',
              rate: settings.gst_rate || 5,
              isRecoverable: true,
              authority: 'CRA',
              glCollectedAccountId: settings.gst_collected_account_id,
              glPaidAccountId: settings.gst_paid_account_id,
            },
            {
              code: isQC ? 'QST' : `PST-${settings.province}`,
              rate: settings.pst_rate,
              isRecoverable: isQC,
              authority: isQC ? 'Revenu Quebec' : 'Provincial',
              glCollectedAccountId: settings.pst_collected_account_id,
              // Quebec QST is recoverable like GST → routes to GST ITC if no separate QST asset account.
              // For other provinces, PST is non-recoverable and MUST use the dedicated PST Paid expense account.
              glPaidAccountId: settings.pst_paid_account_id,
            },
          ],
        });
      }

      // Add common PST rates for place-of-supply if not already present
      const hasPST = derivedCodes.some(c => c.code === 'PST');
      if (!hasPST) {
        // BC PST 7%
        derivedCodes.push({
          id: generateDeterministicUuid(organizationId, 'pst-bc'),
          organization_id: organizationId,
          code: 'PST-BC',
          name: 'PST - British Columbia',
          rate: 7,
          jurisdiction: 'BC',
          tax_type: 'PST',
          is_recoverable: false,
          is_compound: false,
          is_active: true,
          // PST uses PST accounts from settings
          gl_collected_account_id: settings?.pst_collected_account_id || null,
          gl_paid_account_id: settings?.pst_paid_account_id || null,
          created_at: now,
          updated_at: now,
        });

        // SK PST 6%
        derivedCodes.push({
          id: generateDeterministicUuid(organizationId, 'pst-sk'),
          organization_id: organizationId,
          code: 'PST-SK',
          name: 'PST - Saskatchewan',
          rate: 6,
          jurisdiction: 'SK',
          tax_type: 'PST',
          is_recoverable: false,
          is_compound: false,
          is_active: true,
          gl_collected_account_id: settings?.pst_collected_account_id || null,
          gl_paid_account_id: settings?.pst_paid_account_id || null,
          created_at: now,
          updated_at: now,
        });

        // MB PST 7%
        derivedCodes.push({
          id: generateDeterministicUuid(organizationId, 'pst-mb'),
          organization_id: organizationId,
          code: 'PST-MB',
          name: 'PST - Manitoba',
          rate: 7,
          jurisdiction: 'MB',
          tax_type: 'PST',
          is_recoverable: false,
          is_compound: false,
          is_active: true,
          gl_collected_account_id: settings?.pst_collected_account_id || null,
          gl_paid_account_id: settings?.pst_paid_account_id || null,
          created_at: now,
          updated_at: now,
        });

        // QST 9.975% (Quebec - recoverable like GST)
        derivedCodes.push({
          id: generateDeterministicUuid(organizationId, 'qst'),
          organization_id: organizationId,
          code: 'QST',
          name: 'QST - Quebec',
          rate: 9.975,
          jurisdiction: 'QC',
          tax_type: 'QST',
          is_recoverable: true, // QST is recoverable unlike other PST
          is_compound: false,
          is_active: true,
          // QST uses PST accounts from settings (or separate QST accounts if configured)
          gl_collected_account_id: settings?.pst_collected_account_id || null,
          gl_paid_account_id: settings?.pst_paid_account_id || null,
          created_at: now,
          updated_at: now,
        });
      }

      // Zero-rated for exports
      derivedCodes.push({
        id: generateDeterministicUuid(organizationId, 'zero'),
        organization_id: organizationId,
        code: 'Z',
        name: 'Zero-rated (Exports)',
        rate: 0,
        jurisdiction: null,
        tax_type: 'zero-rated',
        is_recoverable: true,
        is_compound: false,
        is_active: true,
        gl_collected_account_id: null,
        gl_paid_account_id: null,
        created_at: now,
        updated_at: now,
      });

      // Out of Scope
      derivedCodes.push({
        id: generateDeterministicUuid(organizationId, 'out-of-scope'),
        organization_id: organizationId,
        code: 'O/S',
        name: 'Out of Scope',
        rate: 0,
        jurisdiction: null,
        tax_type: 'out-of-scope',
        is_recoverable: false,
        is_compound: false,
        is_active: true,
        gl_collected_account_id: null,
        gl_paid_account_id: null,
        created_at: now,
        updated_at: now,
      });
      
      return derivedCodes;
    },
    enabled: !!organizationId,
  });
}

export function useCreateTaxCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, taxCode }: {
      organizationId: string;
      taxCode: Omit<TaxCode, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
    }) => {
      const { data, error } = await supabase
        .from('tax_codes')
        .insert({ ...taxCode, organization_id: organizationId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['tax-codes', organizationId] });
      toast.success('Tax code created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create tax code: ${error.message}`);
    },
  });
}

export function useUpdateTaxCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, organizationId, updates }: {
      id: string;
      organizationId: string;
      updates: Partial<TaxCode>;
    }) => {
      const { data, error } = await supabase
        .from('tax_codes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error(
          'Update returned no rows — the tax code may not belong to the current organization or access is blocked.'
        );
      }
      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['tax-codes', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['tax-exceptions', organizationId] });
      toast.success('Tax code updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update tax code: ${error.message}`);
    },
  });
}

export function useDeleteTaxCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, organizationId }: { id: string; organizationId: string }) => {
      const { error } = await supabase
        .from('tax_codes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['tax-codes', organizationId] });
      toast.success('Tax code deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete tax code: ${error.message}`);
    },
  });
}

// Tax Returns Hooks
export function useTaxReturns(organizationId?: string) {
  return useQuery({
    queryKey: ['tax-returns', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('tax_returns')
        .select('*')
        .eq('organization_id', organizationId)
        .order('period_end', { ascending: false });
      
      if (error) throw error;
      return data as TaxReturn[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateTaxReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, taxReturn }: {
      organizationId: string;
      taxReturn: Omit<TaxReturn, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
    }) => {
      const { data, error } = await supabase
        .from('tax_returns')
        .insert({ ...taxReturn, organization_id: organizationId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['tax-returns', organizationId] });
      toast.success('Tax return created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create tax return: ${error.message}`);
    },
  });
}

export function useUpdateTaxReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, organizationId, updates }: {
      id: string;
      organizationId: string;
      updates: Partial<TaxReturn>;
    }) => {
      const { data, error } = await supabase
        .from('tax_returns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['tax-returns', organizationId] });
      toast.success('Tax return updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update tax return: ${error.message}`);
    },
  });
}

// Canadian province tax rates helper - now includes tax model and PST recoverability
export const PROVINCE_TAX_RATES: Record<string, { 
  gst: number; 
  pst: number; 
  hst: number; 
  type: 'HST' | 'GST+PST' | 'GST';
  pstRecoverable: boolean;
  pstAuthority: string;
}> = {
  AB: { gst: 5, pst: 0, hst: 0, type: 'GST', pstRecoverable: false, pstAuthority: '' },
  BC: { gst: 5, pst: 7, hst: 0, type: 'GST+PST', pstRecoverable: false, pstAuthority: 'BC Ministry of Finance' },
  MB: { gst: 5, pst: 7, hst: 0, type: 'GST+PST', pstRecoverable: false, pstAuthority: 'Manitoba Finance' },
  NB: { gst: 0, pst: 0, hst: 15, type: 'HST', pstRecoverable: true, pstAuthority: 'CRA' },
  NL: { gst: 0, pst: 0, hst: 15, type: 'HST', pstRecoverable: true, pstAuthority: 'CRA' },
  NS: { gst: 0, pst: 0, hst: 15, type: 'HST', pstRecoverable: true, pstAuthority: 'CRA' },
  NT: { gst: 5, pst: 0, hst: 0, type: 'GST', pstRecoverable: false, pstAuthority: '' },
  NU: { gst: 5, pst: 0, hst: 0, type: 'GST', pstRecoverable: false, pstAuthority: '' },
  ON: { gst: 0, pst: 0, hst: 13, type: 'HST', pstRecoverable: true, pstAuthority: 'CRA' },
  PE: { gst: 0, pst: 0, hst: 15, type: 'HST', pstRecoverable: true, pstAuthority: 'CRA' },
  QC: { gst: 5, pst: 9.975, hst: 0, type: 'GST+PST', pstRecoverable: true, pstAuthority: 'Revenu Québec' },
  SK: { gst: 5, pst: 6, hst: 0, type: 'GST+PST', pstRecoverable: false, pstAuthority: 'Saskatchewan Finance' },
  YT: { gst: 5, pst: 0, hst: 0, type: 'GST', pstRecoverable: false, pstAuthority: '' },
};

/**
 * Get combined tax rate for a province (for display purposes only)
 * @param province Province code (ON, BC, MB, etc.)
 * @returns Combined rate number
 */
export function getCombinedTaxRate(province: string): number {
  const rates = PROVINCE_TAX_RATES[province];
  if (!rates) return 5; // Default to GST only
  
  if (rates.type === 'HST') return rates.hst;
  return rates.gst + rates.pst;
}

/**
 * Check if province requires separate PST accounting
 */
export function requiresSeparatePstAccounting(province: string): boolean {
  const rates = PROVINCE_TAX_RATES[province];
  return rates?.type === 'GST+PST';
}

export const PROVINCES = [
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'ON', name: 'Ontario' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'YT', name: 'Yukon' },
];

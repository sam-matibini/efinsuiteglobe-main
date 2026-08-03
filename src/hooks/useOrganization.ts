import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  owner_id: string | null;
  stripe_customer_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  country_id: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  legal_name: string | null;
  business_number: string | null;
  industry: string | null;
  fiscal_year_end_month: number | null;
  currency: string | null;
  accounting_method: string | null;
  // Tax registration numbers
  dealer_permit_number: string | null;
  gst_hst_number: string | null;
  pst_number: string | null;
  // Tax exemption defaults
  default_tax_exempt: boolean | null;
  tax_exemption_certificate: string | null;
  // Invoice settings
  invoice_prefix: string | null;
  invoice_next_number: number | null;
  invoice_default_terms: number | null;
  invoice_default_notes: string | null;
  invoice_footer: string | null;
  invoice_show_logo: boolean | null;
  invoice_show_payment_instructions: boolean | null;
  invoice_payment_instructions: string | null;
  invoice_logo_url: string | null;
  // Payment method settings
  invoice_enable_online_payments: boolean | null;
  invoice_credit_card_enabled: boolean | null;
  invoice_ach_enabled: boolean | null;
  invoice_interac_enabled: boolean | null;
  invoice_cc_instructions: string | null;
  invoice_ach_institution: string | null;
  invoice_ach_account_name: string | null;
  invoice_ach_account_number: string | null;
  invoice_ach_transit_number: string | null;
  invoice_etransfer_email: string | null;
  invoice_stripe_account_id: string | null;
  invoice_cc_payment_url: string | null;
  // Invoice template customization
  invoice_primary_color: string | null;
  invoice_secondary_color: string | null;
  invoice_accent_style: string | null;
  invoice_font_family: string | null;
  invoice_header_alignment: string | null;
  invoice_template_style: string | null;
  invoice_template_type: string | null;
  invoice_custom_title: string | null;
  invoice_date_format: string | null;
  invoice_show_line_numbers: boolean | null;
  invoice_show_quantity_column: boolean | null;
  invoice_show_rate_column: boolean | null;
  invoice_show_tax_column: boolean | null;
  invoice_payment_methods: string | null;
  invoice_deletion_allowed_statuses: string[] | null;
  // Payroll
  payroll_account_number: string | null;
  // Nature of Operations (Note 2)
  incorporation_jurisdiction: string | null;
  principal_activities: string | null;
  // Document-specific logo preferences
  receipt_show_logo: boolean | null;
  receipt_logo_url: string | null;
  payroll_show_logo: boolean | null;
  payroll_logo_url: string | null;
  statement_show_logo: boolean | null;
  statement_logo_url: string | null;
  // Security / Compliance
  primary_country_id: string | null;
  primary_jurisdiction_id: string | null;
  accounting_standard: string | null;
  default_accounting_framework: string | null;
  ai_setup_completed: boolean | null;
  ai_setup_completed_at: string | null;
  two_factor_required: boolean | null;
  session_timeout_minutes: number | null;
  audit_logging_enabled: boolean | null;
  lock_closed_periods: boolean | null;
  require_adjustment_approval: boolean | null;
  // Communication preferences
  preferred_comm_channel: string | null;
  sms_enabled: boolean | null;
  whatsapp_enabled: boolean | null;
  email_enabled: boolean | null;
  voice_enabled: boolean | null;
  // Localization
  date_format: string | null;
  number_format: string | null;
  time_format: string | null;
  timezone: string | null;
  locale: string | null;
  language: string | null;
  localization_synced_at: string | null;
  // DocSign
  docsign_enabled: boolean | null;
  docsign_logo_url: string | null;
  docsign_primary_color: string | null;
  docsign_secondary_color: string | null;
  docsign_email_header_html: string | null;
  docsign_email_footer_html: string | null;
  docsign_default_reminder_days: number[] | null;
  docsign_default_expiration_days: number | null;
  docsign_retention_days: number | null;
  docsign_auto_delete_expired: boolean | null;
  docsign_require_decline_reason: boolean | null;
  docsign_allow_in_person_signing: boolean | null;
  docsign_allow_bulk_send: boolean | null;
  // Feature toggles
  show_combined_tax_display: boolean | null;
  allow_invoice_deletion: boolean | null;
  ai_sheets_enabled: boolean | null;
  ai_sheets_preferences: string | null;
  created_at: string;
  updated_at: string;
}

export function useUserOrganizations() {
  const { user, isAdmin } = useAuth();
  
  return useQuery({
    queryKey: ['organizations', user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      
      // Global admins can see ALL organizations
      if (isAdmin) {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data as Organization[];
      }
      
      // Regular users only see organizations they belong to (via RLS)
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Organization[];
    },
    enabled: !!user,
  });
}

export function useCurrentOrganization() {
  // Try to use the context first (preferred method)
  // Falls back to localStorage-based selection for backward compatibility
  const { data: organizations, isLoading } = useUserOrganizations();
  
  // Get the organization ID from localStorage (set by org switcher)
  const savedOrgId = typeof window !== 'undefined' 
    ? localStorage.getItem('current_organization_id') 
    : null;
  
  // Find the saved organization or default to first
  const organization = savedOrgId 
    ? organizations?.find(org => org.id === savedOrgId) || organizations?.[0] || null
    : organizations?.[0] || null;
  
  return {
    organization,
    isLoading,
  };
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ name, industry, country_id, currency, country_name, country_code, bvn_or_nin }: { 
      name: string; 
      industry?: string;
      country_id?: string;
      currency?: string;
      country_name?: string;
      country_code?: string;
      bvn_or_nin?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      // Create URL-safe slug: remove special chars, collapse spaces, add timestamp for uniqueness
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars (periods, commas, etc.)
        .replace(/\s+/g, '-')          // Replace spaces with hyphens
        .replace(/-+/g, '-')           // Collapse multiple hyphens
        .replace(/^-|-$/g, '');        // Trim leading/trailing hyphens
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
      
      // Create organization - use country in address for compliance detection
      const insertData: Record<string, unknown> = {
        name,
        owner_id: user.id,
        slug: uniqueSlug,
        industry: industry || null,
        currency: currency || 'USD',
        country: country_name || country_code || null, // Set address country for AI detection
      };
      
      // Add country_id if provided
      if (country_id) {
        insertData.country_id = country_id;
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert(insertData as any)
        .select()
        .single();
      
      if (orgError) throw orgError;
      
      // Add user as member with 'owner' role
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'owner',
        });
      
      if (memberError) throw memberError;
      
      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organization created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create organization: ${error.message}`);
    },
  });
}

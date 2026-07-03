import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface CompilationReport {
  id: string;
  organization_id: string;
  fiscal_year: string;
  fiscal_year_end: string;
  status: 'draft' | 'in_progress' | 'completed' | 'issued';
  report_date: string;
  prepared_by: string | null;
  issued_at: string | null;
  notes: string[];
  selected_note_templates: string[];
  custom_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Enhanced CSRS 4200 fields
  report_type: string | null;
  reporting_period_type: string | null;
  period_start_date: string | null;
  engagement_letter_date: string | null;
  management_responsibility_acknowledged: boolean | null;
  firm_name: string | null;
  firm_address: string | null;
  client_address: string | null;
  preparer_license_number: string | null;
  statement_types: string[] | null;
  comparative_period_end: string | null;
  basis_of_accounting: string | null;
  restriction_notice: string | null;
  currency: string | null;
  // New fields for professional credentials and branding
  additional_qualifications: string[] | null;
  accountant_logo_url: string | null;
  accountant_signature_url: string | null;
  accounting_framework: 'ASPE' | 'IFRS' | 'ASNPO' | null;
}

export interface CreateCompilationInput {
  fiscal_year: string;
  fiscal_year_end: string;
  report_date: string;
  prepared_by?: string;
  selected_note_templates: string[];
  custom_notes?: string;
  // Enhanced fields
  report_type?: string;
  reporting_period_type?: string;
  period_start_date?: string;
  engagement_letter_date?: string;
  management_responsibility_acknowledged?: boolean;
  firm_name?: string;
  firm_address?: string;
  client_address?: string;
  preparer_license_number?: string;
  statement_types?: string[];
  comparative_period_end?: string;
  basis_of_accounting?: string;
  restriction_notice?: string;
  currency?: string;
  // New fields for professional credentials and branding
  additional_qualifications?: string[];
  accountant_logo_url?: string;
  accountant_signature_url?: string;
  accounting_framework?: 'ASPE' | 'IFRS' | 'ASNPO';
}

export interface UpdateCompilationInput {
  id: string;
  status?: CompilationReport['status'];
  prepared_by?: string;
  notes?: string[];
  selected_note_templates?: string[];
  custom_notes?: string;
  // Enhanced fields
  report_type?: string;
  reporting_period_type?: string;
  period_start_date?: string;
  engagement_letter_date?: string;
  management_responsibility_acknowledged?: boolean;
  firm_name?: string;
  firm_address?: string;
  client_address?: string;
  preparer_license_number?: string;
  statement_types?: string[];
  comparative_period_end?: string;
  basis_of_accounting?: string;
  restriction_notice?: string;
  currency?: string;
  issued_at?: string;
  // New fields for professional credentials and branding
  additional_qualifications?: string[];
  accountant_logo_url?: string;
  accountant_signature_url?: string;
  accounting_framework?: 'ASPE' | 'IFRS' | 'ASNPO';
}

export function useCompilationReports() {
  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id;

  return useQuery({
    queryKey: ['compilation-reports', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('compilation_reports')
        .select('*')
        .eq('organization_id', organizationId)
        .order('fiscal_year', { ascending: false });

      if (error) throw error;

      return (data || []).map(report => ({
        ...report,
        notes: Array.isArray(report.notes) ? report.notes : [],
        selected_note_templates: Array.isArray(report.selected_note_templates) 
          ? report.selected_note_templates 
          : [],
        statement_types: Array.isArray(report.statement_types)
          ? report.statement_types
          : ['balance_sheet', 'income_statement', 'retained_earnings', 'cash_flow'],
      })) as CompilationReport[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateCompilationReport() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (input: CreateCompilationInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('compilation_reports')
        .insert({
          organization_id: organization.id,
          fiscal_year: input.fiscal_year,
          fiscal_year_end: input.fiscal_year_end,
          report_date: input.report_date,
          prepared_by: input.prepared_by || null,
          selected_note_templates: input.selected_note_templates,
          custom_notes: input.custom_notes || null,
          notes: [],
          status: 'draft',
          created_by: userData?.user?.id || null,
          // Enhanced fields
          report_type: input.report_type || 'compilation',
          reporting_period_type: input.reporting_period_type || 'annual',
          period_start_date: input.period_start_date || null,
          engagement_letter_date: input.engagement_letter_date || null,
          management_responsibility_acknowledged: input.management_responsibility_acknowledged || false,
          firm_name: input.firm_name || null,
          firm_address: input.firm_address || null,
          client_address: input.client_address || null,
          preparer_license_number: input.preparer_license_number || null,
          statement_types: input.statement_types || ['balance_sheet', 'income_statement', 'retained_earnings', 'cash_flow'],
          comparative_period_end: input.comparative_period_end || null,
          basis_of_accounting: input.basis_of_accounting || 'ASPE',
          restriction_notice: input.restriction_notice || null,
          currency: input.currency || 'CAD',
          // New fields
          additional_qualifications: input.additional_qualifications || [],
          accountant_logo_url: input.accountant_logo_url || null,
          accountant_signature_url: input.accountant_signature_url || null,
          accounting_framework: input.accounting_framework || 'ASPE',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compilation-reports'] });
      toast.success('Compilation report created successfully');
    },
    onError: (error) => {
      console.error('Error creating compilation report:', error);
      toast.error('Failed to create compilation report');
    },
  });
}

export function useUpdateCompilationReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCompilationInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('compilation_reports')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compilation-reports'] });
      toast.success('Compilation report updated');
    },
    onError: (error) => {
      console.error('Error updating compilation report:', error);
      toast.error('Failed to update compilation report');
    },
  });
}

export function useDeleteCompilationReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('compilation_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compilation-reports'] });
      toast.success('Compilation report deleted');
    },
    onError: (error) => {
      console.error('Error deleting compilation report:', error);
      toast.error('Failed to delete compilation report');
    },
  });
}

export function useIssueCompilationReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('compilation_reports')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compilation-reports'] });
      toast.success('Compilation report issued successfully');
    },
    onError: (error) => {
      console.error('Error issuing compilation report:', error);
      toast.error('Failed to issue compilation report');
    },
  });
}

// ASPE Note Templates - Comprehensive based on CPA Canada standards
export const aspeNoteTemplates = [
  { id: 'basis', title: '1. Basis of Presentation', template: 'These financial statements have been prepared in accordance with Canadian accounting standards for private enterprises (ASPE).', category: 'required' },
  { id: 'nature_operations', title: '2. Nature of Operations', template: 'The Company is incorporated under the {{incorporation_jurisdiction}} and is engaged in {{principal_activities}}.', category: 'required' },
  { id: 'significant_policies', title: '3. Significant Accounting Policies', template: 'The following is a summary of significant accounting policies used in the preparation of these financial statements.', category: 'required' },
  { id: 'revenue', title: 'Revenue Recognition', template: 'Revenue is recognized when goods are delivered or services are rendered, collection is reasonably assured, and the amount can be reliably measured. Revenue from the sale of goods is recognized when the significant risks and rewards of ownership are transferred to the customer.', category: 'policies' },
  { id: 'inventory', title: 'Inventory', template: 'Inventory is valued at the lower of cost and net realizable value. Cost is determined using the weighted average cost method. Net realizable value is the estimated selling price in the ordinary course of business less estimated costs of completion and selling costs.', category: 'policies' },
  { id: 'ppe', title: 'Property, Plant & Equipment', template: 'Property, plant and equipment are stated at cost less accumulated depreciation. Depreciation is provided using the following methods and rates:\n• Buildings: 4% declining balance\n• Automotive equipment: 30% declining balance\n• Computer equipment: 55% declining balance\n• Office furniture: 20% declining balance', category: 'policies' },
  { id: 'financial_instruments', title: 'Financial Instruments', template: "Financial instruments are initially recorded at fair value and subsequently measured at cost or amortized cost, unless management has elected to measure the item at fair value. The Company's financial instruments consist of cash, accounts receivable, accounts payable, and amounts due to shareholders. Unless otherwise noted, it is management's opinion that the Company is not exposed to significant interest, currency, or credit risks arising from these financial instruments. The fair values of these financial instruments approximate their carrying values due to their short-term nature.", category: 'policies' },
  { id: 'income_taxes', title: 'Income Taxes', template: 'The Company uses the taxes payable method of accounting for income taxes. Under this method, current income tax expense is calculated on the basis of the tax laws enacted at the balance sheet date. No provision is made for future income taxes.', category: 'policies' },
  { id: 'related', title: 'Related Party Transactions', template: 'Related party transactions are measured at the exchange amount, which is the amount of consideration established and agreed to by the related parties. The Company has amounts due to shareholders that are unsecured, non-interest bearing, and have no fixed terms of repayment. These transactions are in the normal course of operations.', category: 'disclosure' },
  { id: 'revenue_breakdown', title: 'Revenue Breakdown', template: 'The Company generates revenue from the following streams during the reporting period. Revenue is disaggregated by major product line or service category.', category: 'disclosure' },
  { id: 'finance_lease', title: 'Finance Lease Obligations', template: 'The Company has finance lease obligations for certain assets. Lease liabilities are measured at the present value of future lease payments, discounted at the interest rate implicit in the lease. The current portion represents principal payments due within the next twelve months, with the remainder classified as long-term liabilities.', category: 'disclosure' },
  { id: 'commitments', title: 'Commitments', template: 'The Company has the following commitments as at the balance sheet date.', category: 'disclosure' },
  { id: 'contingencies', title: 'Contingencies', template: 'There are no contingent liabilities that require disclosure as at the balance sheet date.', category: 'disclosure' },
  { id: 'going_concern', title: 'Going Concern', template: 'These financial statements have been prepared on a going concern basis which assumes the company will continue in operation for the foreseeable future and will be able to realize its assets and discharge its liabilities in the normal course of business.', category: 'disclosure' },
  { id: 'subsequent', title: 'Subsequent Events', template: 'Management has evaluated subsequent events through the date these financial statements were issued and has determined that no material events have occurred that would require adjustment or disclosure.', category: 'disclosure' },
  { id: 'comparative', title: 'Comparative Figures', template: 'Comparative figures presented are for the prior reporting period. Certain comparative figures have been reclassified to conform to the current year presentation.', category: 'disclosure' },
  { id: 'uncertainty', title: 'Measurement Uncertainty', template: 'The preparation of financial statements in conformity with ASPE requires management to make estimates and assumptions that affect the reported amounts of assets and liabilities and disclosure of contingent assets and liabilities at the date of the financial statements and the reported amounts of revenues and expenses during the reporting period. Actual results could differ from those estimates.', category: 'disclosure' },
];

// Framework-aware note templates
export type AccountingFramework = 'ASPE' | 'ASNPO' | 'IFRS';

export function getFrameworkNoteTemplates(framework: AccountingFramework = 'ASPE') {
  if (framework === 'ASPE') return aspeNoteTemplates;

  const entity = framework === 'ASNPO' ? 'The Organization' : 'The Entity';
  const entityLower = framework === 'ASNPO' ? 'the organization' : 'the entity';
  const frameworkName = framework === 'ASNPO'
    ? 'Canadian accounting standards for not-for-profit organizations (ASNPO)'
    : 'International Financial Reporting Standards (IFRS)';
  const frameworkShort = framework;
  const dateRef = framework === 'ASNPO' ? 'statement of financial position date' : 'reporting date';

  const templates = [
    { id: 'basis', title: '1. Basis of Presentation', template: `These financial statements have been prepared in accordance with ${frameworkName}.`, category: 'required' },
    { id: 'nature_operations', title: '2. Nature of Operations', template: `${entity} is incorporated under the {{incorporation_jurisdiction}} and is engaged in {{principal_activities}}.`, category: 'required' },
    { id: 'significant_policies', title: '3. Significant Accounting Policies', template: `The following is a summary of significant accounting policies used in the preparation of these financial statements.`, category: 'required' },
  ];

  // Revenue
  if (framework === 'ASNPO') {
    templates.push({ id: 'revenue', title: 'Revenue Recognition', template: `${entity} follows the deferral method of accounting for contributions. Restricted contributions are recognized as revenue in the year in which the related expenses are incurred. Unrestricted contributions are recognized as revenue when received or receivable if the amount to be received can be reasonably estimated and collection is reasonably assured. Revenue from services is recognized when services are rendered and collection is reasonably assured. Government grants are recognized as revenue when the conditions for eligibility have been met.`, category: 'policies' });
  } else {
    templates.push({ id: 'revenue', title: 'Revenue Recognition', template: `${entity} recognizes revenue in accordance with IFRS 15 Revenue from Contracts with Customers using the five-step model: (1) identify the contract, (2) identify performance obligations, (3) determine the transaction price, (4) allocate the transaction price, and (5) recognize revenue when or as performance obligations are satisfied. Revenue is measured at the fair value of the consideration received or receivable, net of returns, trade discounts, and volume rebates.`, category: 'policies' });
  }

  // Inventory
  templates.push({ id: 'inventory', title: 'Inventory', template: `Inventory is valued at the lower of cost and net realizable value. Cost is determined using the weighted average cost method. Net realizable value is the estimated selling price in the ordinary course of business less estimated costs of completion and selling costs.`, category: 'policies' });

  // PPE
  if (framework === 'IFRS') {
    templates.push({ id: 'ppe', title: 'Property, Plant & Equipment', template: `Property, plant and equipment are measured at cost less accumulated depreciation and impairment losses in accordance with IAS 16. Depreciation is calculated on a straight-line basis over the estimated useful lives of the assets. The residual values, useful lives, and methods of depreciation are reviewed at each financial year end and adjusted prospectively, if appropriate.`, category: 'policies' });
  } else {
    templates.push({ id: 'ppe', title: 'Property, Plant & Equipment', template: `Property, plant and equipment are stated at cost less accumulated depreciation. Depreciation is provided over the estimated useful lives of the assets using the following methods and rates:\n• Buildings: 4% declining balance\n• Automotive equipment: 30% declining balance\n• Computer equipment: 55% declining balance\n• Office furniture: 20% declining balance`, category: 'policies' });
  }

  // Financial Instruments
  if (framework === 'IFRS') {
    templates.push({ id: 'financial_instruments', title: 'Financial Instruments', template: `Financial instruments are classified and measured in accordance with IFRS 9 Financial Instruments. Financial assets are classified at initial recognition as measured at amortized cost, fair value through other comprehensive income (FVOCI), or fair value through profit or loss (FVTPL). Financial liabilities are measured at amortized cost unless designated at FVTPL. ${entity}'s financial instruments consist of cash and cash equivalents, trade receivables, trade payables, and borrowings. The fair values of short-term financial instruments approximate their carrying values due to their short-term nature.`, category: 'policies' });
  } else {
    templates.push({ id: 'financial_instruments', title: 'Financial Instruments', template: `Financial instruments are initially recorded at fair value and subsequently measured at cost or amortized cost, unless management has elected to measure the item at fair value. ${entity}'s financial instruments consist of cash, accounts receivable, accounts payable, and amounts due to related parties. Unless otherwise noted, it is management's opinion that ${entity} is not exposed to significant interest, currency, or credit risks arising from these financial instruments. The fair values of these financial instruments approximate their carrying values due to their short-term nature.`, category: 'policies' });
  }

  // Income Taxes
  if (framework === 'ASNPO') {
    templates.push({ id: 'income_taxes', title: 'Tax-Exempt Status', template: `${entity} is a registered charity and is exempt from income taxes under Section 149(1) of the Income Tax Act (Canada). Accordingly, no provision for income taxes has been made in these financial statements.`, category: 'policies' });
  } else {
    templates.push({ id: 'income_taxes', title: 'Income Taxes', template: `${entity} accounts for income taxes using the deferred tax method in accordance with IAS 12 Income Taxes. Deferred tax assets and liabilities are recognized for the future tax consequences attributable to differences between the financial statement carrying amounts of existing assets and liabilities and their respective tax bases. Deferred tax assets and liabilities are measured using enacted or substantively enacted tax rates expected to apply to taxable income in the years in which those temporary differences are expected to be recovered or settled.`, category: 'policies' });
  }

  // Related Party Transactions
  if (framework === 'ASNPO') {
    templates.push({ id: 'related', title: 'Related Party Transactions', template: `Related party transactions are measured at the exchange amount, which is the amount of consideration established and agreed to by the related parties. ${entity} has amounts due to board members and related parties that are unsecured, non-interest bearing, and have no fixed terms of repayment. These transactions are in the normal course of operations.`, category: 'disclosure' });
  } else {
    templates.push({ id: 'related', title: 'Related Party Transactions', template: `Related party transactions are disclosed in accordance with IAS 24 Related Party Disclosures. Transactions with related parties are measured at the exchange amount, which is the amount of consideration established and agreed to by the related parties. ${entity} has transactions with key management personnel and related entities in the normal course of operations.`, category: 'disclosure' });
  }

  // Revenue Breakdown
  templates.push({ id: 'revenue_breakdown', title: 'Revenue Breakdown', template: `${entity} generates revenue from the following streams during the reporting period. Revenue is disaggregated by major ${framework === 'ASNPO' ? 'program or funding source' : 'product line or service category'}.`, category: 'disclosure' });

  // Finance Lease
  if (framework === 'IFRS') {
    templates.push({ id: 'finance_lease', title: 'Lease Obligations', template: `${entity} recognizes right-of-use assets and lease liabilities in accordance with IFRS 16 Leases. Right-of-use assets are measured at cost less accumulated depreciation and impairment losses. Lease liabilities are measured at the present value of future lease payments, discounted using the incremental borrowing rate. Short-term leases and leases of low-value assets are recognized as expenses on a straight-line basis over the lease term.`, category: 'disclosure' });
  } else {
    templates.push({ id: 'finance_lease', title: 'Finance Lease Obligations', template: `${entity} has finance lease obligations for certain assets. Lease liabilities are measured at the present value of future lease payments, discounted at the interest rate implicit in the lease. The current portion represents principal payments due within the next twelve months, with the remainder classified as long-term liabilities.`, category: 'disclosure' });
  }

  // Commitments, Contingencies, Going Concern, Subsequent, Comparative, Uncertainty
  templates.push({ id: 'commitments', title: 'Commitments', template: `${entity} has the following commitments as at the ${dateRef}.`, category: 'disclosure' });
  templates.push({ id: 'contingencies', title: 'Contingencies', template: `There are no contingent liabilities that require disclosure as at the ${dateRef}.`, category: 'disclosure' });
  templates.push({ id: 'going_concern', title: 'Going Concern', template: `These financial statements have been prepared on a going concern basis which assumes ${entityLower} will continue in operation for the foreseeable future and will be able to realize its assets and discharge its liabilities in the normal course of business.`, category: 'disclosure' });
  templates.push({ id: 'subsequent', title: 'Subsequent Events', template: `Management has evaluated subsequent events through the date these financial statements were issued and has determined that no material events have occurred that would require adjustment or disclosure.`, category: 'disclosure' });
  templates.push({ id: 'comparative', title: 'Comparative Figures', template: `Comparative figures presented are for the prior reporting period. Certain comparative figures have been reclassified to conform to the current year presentation.`, category: 'disclosure' });
  templates.push({ id: 'uncertainty', title: 'Measurement Uncertainty', template: `The preparation of financial statements in conformity with ${frameworkShort} requires management to make estimates and assumptions that affect the reported amounts of assets and liabilities and disclosure of contingent assets and liabilities at the date of the financial statements and the reported amounts of revenues and expenses during the reporting period. Actual results could differ from those estimates.`, category: 'disclosure' });

  return templates;
}

// Engagement Checklist - Based on CPA Canada CSRS 4200
export const engagementChecklistData = [
  { 
    section: 'Engagement Acceptance', 
    items: [
      { id: 'ea-1', text: 'Obtain engagement letter signed by management' },
      { id: 'ea-2', text: 'Assess management integrity and competence' },
      { id: 'ea-3', text: 'Confirm understanding of intended use of statements' },
      { id: 'ea-4', text: 'Verify no conflict of interest exists' },
      { id: 'ea-5', text: 'Confirm appropriate financial reporting framework (ASPE)' }
    ]
  },
  { 
    section: 'Planning', 
    items: [
      { id: 'pl-1', text: 'Obtain knowledge of client business and industry' },
      { id: 'pl-2', text: 'Identify applicable financial reporting framework (ASPE)' },
      { id: 'pl-3', text: 'Discuss significant accounting policies with management' },
      { id: 'pl-4', text: 'Understand nature and volume of transactions' },
      { id: 'pl-5', text: 'Identify related parties and related party transactions' }
    ]
  },
  { 
    section: 'Compilation Procedures', 
    items: [
      { id: 'cp-1', text: 'Compile financial statements from management information' },
      { id: 'cp-2', text: 'Read financial statements for obvious material misstatements' },
      { id: 'cp-3', text: 'Ensure arithmetical accuracy' },
      { id: 'cp-4', text: 'Verify proper account classification per ASPE' },
      { id: 'cp-5', text: 'Ensure consistency with prior periods' }
    ]
  },
  { 
    section: 'Documentation', 
    items: [
      { id: 'dc-1', text: 'Document sources of compiled information' },
      { id: 'dc-2', text: 'Prepare notes to financial statements per ASPE' },
      { id: 'dc-3', text: 'Obtain management representation letter' },
      { id: 'dc-4', text: 'Document significant matters and resolutions' },
      { id: 'dc-5', text: 'Maintain working paper file for engagement' }
    ]
  },
  { 
    section: 'Reporting', 
    items: [
      { id: 'rp-1', text: 'Prepare compilation engagement report (Notice to Reader)' },
      { id: 'rp-2', text: 'Ensure proper dating and signing per CSRS 4200' },
      { id: 'rp-3', text: 'Include restriction on use if applicable' },
      { id: 'rp-4', text: 'Issue final compilation report package' },
      { id: 'rp-5', text: 'Provide copy to management and maintain file copy' }
    ]
  }
];

// Resolve note template placeholders with organization data
export interface NoteTemplateContext {
  incorporation_jurisdiction?: string | null;
  principal_activities?: string | null;
}

export function resolveNoteTemplate(template: string, context: NoteTemplateContext): string {
  return template
    .replace('{{incorporation_jurisdiction}}', context.incorporation_jurisdiction || '[jurisdiction]')
    .replace('{{principal_activities}}', context.principal_activities || '[description of principal business activities]');
}

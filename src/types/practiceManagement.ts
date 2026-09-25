// Practice Management Module Types

export type ClientRiskRating = 'low' | 'medium' | 'high';
export type ClientStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type EngagementStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type BillingType = 'fixed' | 'hourly' | 'retainer' | 'hybrid';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'billed';
export type PMInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type PMStaffRole = 'partner' | 'manager' | 'senior' | 'staff' | 'intern' | 'contractor';

export interface PMClient {
  id: string;
  organization_id: string;
  legal_name: string;
  trading_name?: string | null;
  country: string;
  tax_id?: string | null;
  industry?: string | null;
  client_type: string;
  risk_rating: ClientRiskRating;
  status: ClientStatus;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  kyc_verified_at?: string | null;
  aml_verified_at?: string | null;
  onboarded_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PMClientOrganization {
  id: string;
  client_id: string;
  linked_org_id?: string | null;
  relationship_type: string;
  created_at: string;
}

export interface PMService {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  country: string;
  default_billing_type: BillingType;
  default_rate?: number | null;
  estimated_hours?: number | null;
  sla_days?: number | null;
  is_recurring: boolean;
  recurrence_pattern?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PMEngagement {
  id: string;
  organization_id: string;
  client_id: string;
  service_id?: string | null;
  engagement_number: string;
  name: string;
  description?: string | null;
  service_type: string;
  fiscal_year?: number | null;
  start_date: string;
  end_date?: string | null;
  billing_type: BillingType;
  fixed_fee?: number | null;
  hourly_rate?: number | null;
  retainer_amount?: number | null;
  budget_hours?: number | null;
  status: EngagementStatus;
  partner_id?: string | null;
  manager_id?: string | null;
  engagement_letter_url?: string | null;
  engagement_letter_signed_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: PMClient;
  service?: PMService;
}

export interface PMTaskTemplate {
  id: string;
  organization_id: string;
  service_id?: string | null;
  name: string;
  description?: string | null;
  estimated_hours?: number | null;
  priority: TaskPriority;
  order_index: number;
  dependency_template_id?: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
}

export interface PMTask {
  id: string;
  organization_id: string;
  engagement_id: string;
  template_id?: string | null;
  name: string;
  description?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_hours?: number | null;
  actual_hours: number;
  dependency_task_id?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  engagement?: PMEngagement;
  assigned_user?: { email: string };
}

export interface PMTimeEntry {
  id: string;
  organization_id: string;
  engagement_id: string;
  task_id?: string | null;
  user_id: string;
  entry_date: string;
  hours: number;
  description?: string | null;
  is_billable: boolean;
  billing_rate?: number | null;
  status: TimeEntryStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  invoice_id?: string | null;
  timer_started_at?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  engagement?: PMEngagement;
  task?: PMTask;
}

export interface PMInvoice {
  id: string;
  organization_id: string;
  client_id: string;
  engagement_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  period_start?: string | null;
  period_end?: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  status: PMInvoiceStatus;
  notes?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: PMClient;
  engagement?: PMEngagement;
  lines?: PMInvoiceLine[];
}

export interface PMInvoiceLine {
  id: string;
  invoice_id: string;
  time_entry_id?: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  line_order: number;
  created_at: string;
}

export interface PMComplianceDeadline {
  id: string;
  organization_id: string;
  client_id: string;
  engagement_id?: string | null;
  filing_type: string;
  country: string;
  jurisdiction?: string | null;
  fiscal_year?: number | null;
  due_date: string;
  extended_due_date?: string | null;
  filed_at?: string | null;
  confirmation_number?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: PMClient;
  engagement?: PMEngagement;
}

export interface PMAIInsight {
  id: string;
  organization_id: string;
  insight_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  title: string;
  description?: string | null;
  severity: string;
  recommended_action?: string | null;
  is_dismissed: boolean;
  dismissed_by?: string | null;
  dismissed_at?: string | null;
  created_at: string;
}

// Dashboard KPI types
export interface PMDashboardKPIs {
  totalClients: number;
  activeEngagements: number;
  openTasks: number;
  overdueTasks: number;
  unbilledHours: number;
  unbilledAmount: number;
  revenueThisMonth: number;
  upcomingDeadlines: number;
  staffUtilization: number;
  clientsAtRisk: number;
}

// Form input types
export interface PMClientInput {
  legal_name: string;
  trading_name?: string;
  country: string;
  tax_id?: string;
  industry?: string;
  client_type: string;
  risk_rating: ClientRiskRating;
  status: ClientStatus;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  notes?: string;
}

export interface PMEngagementInput {
  client_id: string;
  service_id?: string;
  name: string;
  description?: string;
  service_type: string;
  fiscal_year?: number;
  start_date: string;
  end_date?: string;
  billing_type: BillingType;
  fixed_fee?: number;
  hourly_rate?: number;
  retainer_amount?: number;
  budget_hours?: number;
  partner_id?: string;
  manager_id?: string;
  notes?: string;
}

export interface PMTaskInput {
  engagement_id: string;
  name: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  priority: TaskPriority;
  estimated_hours?: number;
  dependency_task_id?: string;
  notes?: string;
}

export interface PMTimeEntryInput {
  engagement_id: string;
  task_id?: string;
  entry_date: string;
  hours: number;
  description?: string;
  is_billable: boolean;
  billing_rate?: number;
}

// Service categories
export const PM_SERVICE_CATEGORIES = [
  { value: 'audit', label: 'Audit & Assurance' },
  { value: 'tax', label: 'Tax Services' },
  { value: 'bookkeeping', label: 'Bookkeeping' },
  { value: 'payroll', label: 'Payroll Services' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'compliance', label: 'Compliance' },
] as const;

// Client types
export const PM_CLIENT_TYPES = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'individual', label: 'Individual' },
  { value: 'npo', label: 'Non-Profit Organization' },
  { value: 'trust', label: 'Trust' },
  { value: 'partnership', label: 'Partnership' },
] as const;

// Industry categories
export const PM_INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail', label: 'Retail' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'construction', label: 'Construction' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'education', label: 'Education' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'other', label: 'Other' },
] as const;

// Filing types by country
export const PM_FILING_TYPES: Record<string, { value: string; label: string }[]> = {
  CA: [
    { value: 'T2', label: 'T2 Corporate Tax' },
    { value: 'T1', label: 'T1 Personal Tax' },
    { value: 'HST', label: 'HST/GST Return' },
    { value: 'T4', label: 'T4 Slips' },
    { value: 'T5', label: 'T5 Slips' },
    { value: 'T3', label: 'T3 Trust Return' },
    { value: 'NR4', label: 'NR4 Non-Resident' },
    { value: 'WSIB', label: 'WSIB Premium' },
    { value: 'EHT', label: 'Employer Health Tax' },
  ],
  US: [
    { value: '1120', label: 'Form 1120 Corporate' },
    { value: '1040', label: 'Form 1040 Personal' },
    { value: '1065', label: 'Form 1065 Partnership' },
    { value: '941', label: 'Form 941 Payroll' },
    { value: 'W2', label: 'W-2 Wage Statements' },
    { value: '1099', label: '1099 Forms' },
  ],
  ZM: [
    { value: 'ITF', label: 'Income Tax Filing' },
    { value: 'VAT', label: 'VAT Return' },
    { value: 'PAYE', label: 'PAYE Return' },
    { value: 'NAPSA', label: 'NAPSA Contribution' },
  ],
  KE: [
    { value: 'CIT', label: 'Corporate Income Tax' },
    { value: 'VAT', label: 'VAT Return' },
    { value: 'PAYE', label: 'PAYE Return' },
    { value: 'WHT', label: 'Withholding Tax' },
  ],
  BI: [
    { value: 'IRS', label: 'Impôt sur le Revenu' },
    { value: 'TVA', label: 'TVA Return' },
    { value: 'IPR', label: 'IPR Payroll' },
  ],
};

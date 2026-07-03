// Donation Management Module Types - CRA & NPO Compliant

export type DonationType = 'cash' | 'cheque' | 'credit_card' | 'e_transfer' | 'securities' | 'in_kind' | 'payroll_deduction' | 'wire_transfer';

export type DonationStatus = 'draft' | 'confirmed' | 'cancelled' | 'refunded';

export type ReceiptStatus = 'draft' | 'issued' | 'cancelled' | 'replaced';

export type FundType = 'unrestricted' | 'restricted' | 'endowment' | 'designated';

export type PledgeStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'cancelled' | 'written_off';

export type DonorType = 'individual' | 'corporation' | 'foundation' | 'government' | 'anonymous';

export interface DonationProgram {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  gl_revenue_account_id: string | null;
  gl_expense_account_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DonationFund {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  fund_type: FundType;
  restriction_terms: string | null;
  target_amount: number | null;
  current_balance: number;
  is_active: boolean;
  gl_account_id: string | null;
  deferred_revenue_account_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface DonationCampaign {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  goal_amount: number | null;
  raised_amount: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  program_id: string | null;
  fund_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Donation {
  id: string;
  organization_id: string;
  donation_number: string;
  donor_id: string;
  date_received: string;
  amount: number;
  currency: string;
  donation_type: DonationType;
  program_id: string | null;
  fund_id: string | null;
  campaign_id: string | null;
  pledge_id: string | null;
  eligible_amount: number;
  advantage_value: number;
  advantage_description: string | null;
  receipt_issued: boolean;
  receipt_id: string | null;
  bank_transaction_id: string | null;
  journal_entry_id: string | null;
  status: DonationStatus;
  notes: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  // Joined fields
  donor?: {
    id: string;
    name: string;
    email: string | null;
    address_line1: string | null;
    city: string | null;
    province: string | null;
    postal_code: string | null;
  };
  program?: { id: string; name: string; code: string };
  fund?: { id: string; name: string; code: string };
  campaign?: { id: string; name: string; code: string };
}

export interface DonationReceiptItem {
  id: string;
  receipt_id: string;
  donation_id: string;
  date_received: string;
  amount: number;
  eligible_amount: number;
  advantage_value: number;
  donation_type: string;
  created_at: string;
}

export interface DonationReceipt {
  id: string;
  organization_id: string;
  receipt_number: string;
  donation_id: string | null;
  is_consolidated: boolean;
  charity_legal_name: string;
  charity_bn: string;
  charity_address: string;
  donor_name: string;
  donor_address: string;
  date_of_donation: string;
  date_of_issue: string;
  location_issued: string | null;
  amount: number;
  eligible_amount: number;
  advantage_value: number;
  advantage_description: string | null;
  status: ReceiptStatus;
  signatory_name: string | null;
  signatory_position: string | null;
  cra_disclaimer: string;
  replaces_receipt_id: string | null;
  replaced_by_receipt_id: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  issued_at: string | null;
  issued_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  is_locked: boolean;
  // Consolidated receipt line items
  items?: DonationReceiptItem[];
}

export interface DonationPledge {
  id: string;
  organization_id: string;
  pledge_number: string;
  donor_id: string;
  pledge_date: string;
  total_amount: number;
  fulfilled_amount: number;
  remaining_amount: number;
  currency: string;
  program_id: string | null;
  fund_id: string | null;
  campaign_id: string | null;
  payment_frequency: string | null;
  expected_start_date: string | null;
  expected_end_date: string | null;
  status: PledgeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined fields
  donor?: { id: string; name: string };
}

export interface DonationInKind {
  id: string;
  donation_id: string;
  description: string;
  category: string | null;
  quantity: number;
  fair_market_value: number;
  appraisal_date: string | null;
  appraised_by: string | null;
  appraisal_document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonorPreferences {
  id: string;
  customer_id: string;
  donor_type: DonorType;
  receipt_preference: string;
  is_anonymous: boolean;
  casl_consent: boolean;
  casl_consent_date: string | null;
  pipeda_consent: boolean;
  communication_preferences: {
    email: boolean;
    mail: boolean;
    phone: boolean;
  };
  recognition_level: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonationAuditLog {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  details: Record<string, unknown> | null;
  performed_at: string;
  performed_by: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

// Input types for creating/updating

export interface CreateDonationInput {
  donor_id: string;
  date_received: string;
  amount: number;
  donation_type: DonationType;
  program_id?: string;
  fund_id?: string;
  campaign_id?: string;
  pledge_id?: string;
  advantage_value?: number;
  advantage_description?: string;
  notes?: string;
  memo?: string;
}

export interface UpdateDonationInput {
  donor_id?: string;
  date_received?: string;
  amount?: number;
  donation_type?: DonationType;
  program_id?: string | null;
  fund_id?: string | null;
  campaign_id?: string | null;
  advantage_value?: number;
  advantage_description?: string | null;
  eligible_amount?: number;
  notes?: string | null;
}

export interface CreateProgramInput {
  code: string;
  name: string;
  description?: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  gl_revenue_account_id?: string;
  gl_expense_account_id?: string;
}

export interface CreateFundInput {
  code: string;
  name: string;
  description?: string;
  fund_type: FundType;
  restriction_terms?: string;
  target_amount?: number;
  gl_account_id?: string;
  deferred_revenue_account_id?: string;
}

export interface CreateCampaignInput {
  code: string;
  name: string;
  description?: string;
  goal_amount?: number;
  start_date: string;
  end_date?: string;
  program_id?: string;
  fund_id?: string;
}

export interface CreatePledgeInput {
  donor_id: string;
  pledge_date: string;
  total_amount: number;
  program_id?: string;
  fund_id?: string;
  campaign_id?: string;
  payment_frequency?: string;
  expected_start_date?: string;
  expected_end_date?: string;
  notes?: string;
}

export interface UpdateProgramInput {
  code?: string;
  name?: string;
  description?: string | null;
  budget?: number;
  start_date?: string | null;
  end_date?: string | null;
  gl_revenue_account_id?: string | null;
  gl_expense_account_id?: string | null;
  is_active?: boolean;
}

export interface UpdatePledgeInput {
  donor_id?: string;
  pledge_date?: string;
  total_amount?: number;
  program_id?: string | null;
  fund_id?: string | null;
  campaign_id?: string | null;
  payment_frequency?: string | null;
  expected_start_date?: string | null;
  expected_end_date?: string | null;
  notes?: string | null;
}

export interface IssueReceiptInput {
  donation_id: string;
  charity_legal_name: string;
  charity_bn: string;
  charity_address: string;
  donor_name: string;
  donor_address: string;
  location_issued?: string;
  signatory_name?: string;
  signatory_position?: string;
}

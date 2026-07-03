// Phase 15: Withholding Tax Engine — Types

export type WhtSlipType = '1099-NEC' | '1099-MISC' | 'T4A' | 'T5' | 'NR4' | 'WHT-CERT';
export type WhtTinType = 'SSN' | 'EIN' | 'ITIN' | 'SIN' | 'BN' | 'FOREIGN';
export type WhtTaxFormType = 'W-9' | 'W-8BEN' | 'W-8BEN-E' | 'NR301' | 'NONE';
export type WhtSlipStatus = 'draft' | 'issued' | 'filed' | 'amended' | 'voided';
export type WhtRemittanceStatus = 'open' | 'pending' | 'remitted' | 'reconciled';
export type WhtTransactionStatus = 'recorded' | 'reversed' | 'adjusted';

export interface WhtRegime {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  country_code: string;
  authority: string;
  slip_type: WhtSlipType;
  default_rate: number;
  threshold_cents: number;
  box_code: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface WhtVendorProfile {
  id: string;
  organization_id: string;
  vendor_id: string;
  regime_id: string | null;
  tin_type: WhtTinType | null;
  tin_last4: string | null;
  legal_name: string | null;
  tax_form_type: WhtTaxFormType | null;
  tax_form_received_date: string | null;
  tax_form_expiry_date: string | null;
  treaty_country: string | null;
  treaty_rate: number | null;
  is_exempt: boolean;
  exempt_reason: string | null;
  ytd_paid_cents: number;
  ytd_withheld_cents: number;
  notes: string | null;
}

export interface WhtTransaction {
  id: string;
  organization_id: string;
  vendor_id: string;
  regime_id: string | null;
  source_type: string;
  source_id: string | null;
  transaction_date: string;
  tax_year: number;
  gross_amount_cents: number;
  withheld_amount_cents: number;
  net_amount_cents: number;
  applied_rate: number;
  currency_code: string;
  journal_entry_id: string | null;
  status: WhtTransactionStatus;
  notes: string | null;
}

export interface WhtSlip {
  id: string;
  organization_id: string;
  vendor_id: string;
  regime_id: string | null;
  tax_year: number;
  slip_type: WhtSlipType;
  slip_number: string | null;
  box_amounts: Record<string, number>;
  total_paid_cents: number;
  total_withheld_cents: number;
  recipient_tin_last4: string | null;
  recipient_name: string | null;
  recipient_address: Record<string, unknown> | null;
  status: WhtSlipStatus;
  issued_date: string | null;
  filed_date: string | null;
  filing_reference: string | null;
  notes: string | null;
}

export interface WhtRemittance {
  id: string;
  organization_id: string;
  regime_id: string | null;
  period_start: string;
  period_end: string;
  due_date: string;
  total_withheld_cents: number;
  remitted_amount_cents: number;
  remittance_date: string | null;
  reference_number: string | null;
  status: WhtRemittanceStatus;
  journal_entry_id: string | null;
  notes: string | null;
}

export interface WhtComputation {
  grossCents: number;
  rate: number;
  withheldCents: number;
  netCents: number;
  belowThreshold: boolean;
  exempt: boolean;
  reason: string;
}

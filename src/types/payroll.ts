// Payroll & HR Types for CRA-compliant Canadian payroll

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated' | 'onboarding';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary';
export type PayFrequency = 'weekly' | 'bi_weekly' | 'semi_monthly' | 'monthly';
export type ProvinceCode = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';
export type PayRunStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled';
export type OnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type RoEReasonCode = 'A' | 'B' | 'D' | 'E' | 'F' | 'G' | 'H' | 'J' | 'K' | 'M' | 'N' | 'P' | 'Z';

export interface Employee {
  id: string;
  organization_id?: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  sin_encrypted?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province: ProvinceCode;
  mailing_province?: string;
  postal_code?: string;
  country?: string;
  hire_date: string;
  termination_date?: string;
  employment_type: EmploymentType;
  status: EmployeeStatus;
  department?: string;
  job_title?: string;
  manager_id?: string;
  pay_frequency: PayFrequency;
  annual_salary?: number;
  hourly_rate?: number;
  bank_institution?: string;
  bank_transit?: string;
  bank_account?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeTD1 {
  id: string;
  employee_id: string;
  tax_year: number;
  form_type: string;
  basic_personal_amount: number;
  age_amount?: number;
  pension_income_amount?: number;
  tuition_amount?: number;
  disability_amount?: number;
  spouse_amount?: number;
  caregiver_amount?: number;
  dependant_amount?: number;
  canada_employment_amount?: number;
  other_credits?: number;
  total_claim_amount: number;
  additional_tax_deduction?: number;
  reduce_tax_deduction?: boolean;
  non_resident?: boolean;
  ai_suggested?: boolean;
  ai_confidence?: number;
  signed_date?: string;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  employee_id: string;
  task_name: string;
  task_category: 'documents' | 'training' | 'setup' | 'compliance';
  description?: string;
  status: OnboardingStatus;
  due_date?: string;
  completed_date?: string;
  assigned_to?: string;
  notes?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PayRun {
  id: string;
  organization_id?: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: PayRunStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer_contributions: number;
  employee_count: number;
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PayStub {
  id: string;
  pay_run_id: string;
  employee_id: string;
  regular_hours: number;
  overtime_hours: number;
  vacation_hours: number;
  sick_hours: number;
  regular_earnings: number;
  overtime_earnings: number;
  vacation_pay: number;
  bonus: number;
  commission: number;
  other_earnings: number;
  gross_pay: number;
  federal_tax: number;
  provincial_tax: number;
  cpp_contribution: number;
  ei_premium: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  cpp_employer: number;
  ei_employer: number;
  ytd_gross: number;
  ytd_cpp: number;
  ytd_ei: number;
  ytd_federal_tax: number;
  ytd_provincial_tax: number;
  created_at: string;
}

export interface TaxSlip {
  id: string;
  employee_id: string;
  tax_year: number;
  slip_type: 'T4' | 'T4A';
  employer_name?: string;
  employer_bn?: string;
  employer_address?: string;
  employer_account_number?: string;
  province_of_employment?: string;
  employment_code?: string;
  exempt_cpp?: boolean;
  exempt_ei?: boolean;
  exempt_ppip?: boolean;
  dental_benefits_code?: string;
  box_14_employment_income: number;
  box_16_cpp_contributions: number;
  box_16a_cpp2_contributions: number;
  box_17_cpp2_contributions: number;
  box_17a_qpp2_contributions: number;
  box_18_ei_premiums: number;
  box_20_rpp_contributions: number;
  box_22_income_tax_deducted: number;
  box_24_ei_insurable_earnings: number;
  box_26_cpp_pensionable_earnings: number;
  box_44_union_dues: number;
  box_46_charitable_donations: number;
  box_52_pension_adjustment: number;
  box_55_ppip_premiums: number;
  box_56_ppip_insurable_earnings: number;
  other_info: Record<string, number>;
  notes?: string;
  status: 'draft' | 'issued' | 'amended' | 'cancelled';
  issued_date?: string;
  created_at: string;
  updated_at: string;
}

export interface RoERecord {
  id: string;
  employee_id: string;
  roe_serial?: string;
  reason_code: RoEReasonCode;
  first_day_worked: string;
  last_day_paid: string;
  final_pay_period_end?: string;
  total_insurable_hours: number;
  total_insurable_earnings: number;
  pay_period_type: PayFrequency;
  insurable_earnings_by_period: number[];
  vacation_pay: number;
  statutory_holiday_pay: number;
  other_monies: Record<string, number>;
  comments?: string;
  recall_date?: string;
  recall_code?: string;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Remittance {
  id: string;
  organization_id?: string;
  remittance_period: string;
  due_date: string;
  total_cpp_employee: number;
  total_cpp_employer: number;
  total_ei_employee: number;
  total_ei_employer: number;
  total_federal_tax: number;
  total_provincial_tax: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'overdue';
  paid_date?: string;
  confirmation_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ROE Reason Codes with descriptions
export const ROE_REASON_CODES: Record<RoEReasonCode, string> = {
  'A': 'Shortage of work',
  'B': 'Strike or lockout',
  'D': 'Illness or injury',
  'E': 'Quit',
  'F': 'Maternity',
  'G': 'Retirement',
  'H': 'Work-sharing',
  'J': 'Apprentice training',
  'K': 'Other',
  'M': 'Dismissal',
  'N': 'Leave of absence',
  'P': 'Parental',
  'Z': 'Compassionate care/Family caregiver'
};

export const PROVINCE_NAMES: Record<ProvinceCode, string> = {
  'AB': 'Alberta',
  'BC': 'British Columbia',
  'MB': 'Manitoba',
  'NB': 'New Brunswick',
  'NL': 'Newfoundland and Labrador',
  'NS': 'Nova Scotia',
  'NT': 'Northwest Territories',
  'NU': 'Nunavut',
  'ON': 'Ontario',
  'PE': 'Prince Edward Island',
  'QC': 'Quebec',
  'SK': 'Saskatchewan',
  'YT': 'Yukon'
};

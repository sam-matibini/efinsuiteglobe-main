/**
 * Country-driven eFinconnect (Treasury) configuration.
 *
 * Single source of truth for which payment rails, tax payees, and dashboard
 * action cards are shown per country. Keyed by ISO alpha-2 country code as
 * stored in `public.countries.code`.
 *
 * Adding a new country = add one entry here — no UI changes required.
 */

import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight, Send, Landmark, CreditCard, Receipt, Link as LinkIcon,
  Clock, Building2, Users, Banknote, Wallet,
} from 'lucide-react';

export type RailId =
  | 'ach' | 'wire' | 'eft' | 'interac'
  | 'nibss_nip' | 'nibss_neft' | 'rtgs'
  | 'sepa' | 'faster_payments'
  | 'internal' | 'cheque' | 'manual';

export interface RailDefinition {
  id: RailId;
  label: string;
  description: string;
  deliveryEstimate: string;
  /** bank_accounts column that flips this rail on (if any) */
  bankAccountFlag?: 'stripe_bank_account_id' | 'paysafe_eft_enabled' | 'is_nibss_enabled' | 'is_rtgs_enabled';
}

export interface DashboardActionDef {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  deliveryEstimate?: string;
  external?: boolean;
}

export interface TaxPayeeDef {
  code: string;              // stable ID e.g. 'NRS-VAT'
  label: string;             // human-facing
  authority: string;         // e.g. 'NRS' | 'CRA' | 'IRS'
  taxType: string;           // links to tax_payments.payment_type / ng_tax_definitions.tax_type
  liabilityCodePrefix?: string[];  // GL account code prefixes for JE mapping
  liabilityKeywords?: string[];
}

export interface CountryTreasuryConfig {
  countryCode: string;
  displayName: string;
  defaultCurrency: string;

  rails: RailDefinition[];
  taxPayees: TaxPayeeDef[];

  sections: {
    bills: DashboardActionDef[];
    taxRemittances: DashboardActionDef[];
    transfers: DashboardActionDef[];
    payments: DashboardActionDef[];
    governance: DashboardActionDef[];
  };
}

// ---------------------------------------------------------------------------
// Canada (default / existing behavior)
// ---------------------------------------------------------------------------
const CA: CountryTreasuryConfig = {
  countryCode: 'CA',
  displayName: 'Canada',
  defaultCurrency: 'CAD',
  rails: [
    { id: 'ach', label: 'Stripe ACH', description: 'Draw funds via Stripe ACH', deliveryEstimate: '1–3 business days', bankAccountFlag: 'stripe_bank_account_id' },
    { id: 'eft', label: 'EFT (Paysafe)', description: 'Canadian EFT rail', deliveryEstimate: '1–2 business days', bankAccountFlag: 'paysafe_eft_enabled' },
    { id: 'interac', label: 'Interac e-Transfer', description: 'Instant to any Canadian bank', deliveryEstimate: 'Minutes' },
    { id: 'wire', label: 'Wire', description: 'Same-day domestic or international wire', deliveryEstimate: 'Same day' },
    { id: 'cheque', label: 'Cheque', description: 'Printed cheque run', deliveryEstimate: '5–7 business days' },
    { id: 'internal', label: 'Between accounts', description: 'Own-account transfer', deliveryEstimate: 'Instant' },
  ],
  taxPayees: [
    { code: 'CRA-PD7A', label: 'CRA Source Deductions (PD7A)', authority: 'CRA', taxType: 'source_deductions', liabilityCodePrefix: ['2-2', '2-20', '2-21'] },
    { code: 'CRA-GST',  label: 'GST/HST Remittance',           authority: 'CRA', taxType: 'gst_hst',            liabilityCodePrefix: ['2-3', '2-30'] },
    { code: 'CRA-CIT',  label: 'Corporate Income Tax',         authority: 'CRA', taxType: 'corporate_tax',      liabilityCodePrefix: ['2-4', '2-40'] },
  ],
  sections: {
    bills: [
      { title: 'Pay bills', description: 'Pay bills easily from anywhere with your phone, tablet, or computer.', to: '/treasury/ap-payments', icon: CreditCard },
    ],
    taxRemittances: [
      { title: 'Pay business taxes', description: 'File and pay your Federal and Provincial government business taxes.', to: '/treasury/tax-payments', icon: Receipt, external: true },
      { title: 'CRA Remittance Centre', description: 'Payroll, GST/HST, corporate tax and scheduled CRA remittances.', to: '/banking-payments/cra-remittance', icon: Landmark },
      { title: 'Provincial Remittances', description: 'Revenu Québec, WSIB, WCB, EHT and PST/RST filings.', to: '/banking-payments/provincial', icon: Building2 },
    ],
    transfers: [
      { title: 'Transfer between accounts', description: 'Pay your credit card or transfer money between your accounts.', to: '/banking/transfers', icon: ArrowLeftRight },
      { title: 'Interac e-Transfer', description: 'Send and request money from anyone with a Canadian bank account.', to: '/banking-payments/payment-links', icon: Send, deliveryEstimate: 'Minutes' },
      { title: 'Bank deposit', description: 'Send money directly to a bank account with International Money Transfer.', to: '/banking-payments/scheduled', icon: Landmark, deliveryEstimate: 'Up to 5 business days' },
      { title: 'Cash pickup', description: 'Send money to an agent location with Western Union.', to: '/banking-payments/scheduled', icon: Send, deliveryEstimate: '2–4 hours' },
    ],
    payments: [
      { title: 'Payment links', description: 'Create shareable pay-me links for customers.', to: '/banking-payments/payment-links', icon: LinkIcon },
      { title: 'Stripe Connect payouts', description: 'Route settlements to connected accounts and sub-merchants.', to: '/banking-payments/stripe-connect', icon: LinkIcon },
      { title: 'Scheduled payments', description: 'View and manage upcoming outbound payments.', to: '/banking-payments/scheduled', icon: Clock },
    ],
    governance: [],
  },
};

// ---------------------------------------------------------------------------
// United States
// ---------------------------------------------------------------------------
const US: CountryTreasuryConfig = {
  ...CA,
  countryCode: 'US',
  displayName: 'United States',
  defaultCurrency: 'USD',
  rails: [
    { id: 'ach', label: 'ACH', description: 'US ACH credit/debit', deliveryEstimate: '1–2 business days', bankAccountFlag: 'stripe_bank_account_id' },
    { id: 'wire', label: 'Wire (Fedwire)', description: 'Same-day domestic wire', deliveryEstimate: 'Same day' },
    { id: 'cheque', label: 'Check', description: 'Printed check run', deliveryEstimate: '5–7 business days' },
    { id: 'internal', label: 'Between accounts', description: 'Own-account transfer', deliveryEstimate: 'Instant' },
  ],
  taxPayees: [
    { code: 'IRS-941',  label: 'IRS Form 941 (Payroll)',       authority: 'IRS',   taxType: 'source_deductions', liabilityCodePrefix: ['2-2'] },
    { code: 'IRS-CIT',  label: 'IRS Corporate Income Tax',      authority: 'IRS',   taxType: 'corporate_tax',     liabilityCodePrefix: ['2-4'] },
    { code: 'STATE-SUT', label: 'State Sales & Use Tax',        authority: 'State', taxType: 'gst_hst',           liabilityCodePrefix: ['2-3'] },
  ],
  sections: {
    ...CA.sections,
    bills: [
      { title: 'Pay bills', description: 'Pay vendor invoices via ACH, wire, or check.', to: '/treasury/ap-payments', icon: CreditCard },
    ],
    taxRemittances: [
      { title: 'Pay business taxes', description: 'File and pay Federal and State taxes.', to: '/treasury/tax-payments', icon: Receipt, external: true },
      { title: 'US Remittance Centre', description: 'IRS Form 941, sales-tax nexus, and state payroll filings.', to: '/banking-payments/us-remittance', icon: Landmark },
    ],
    transfers: [
      { title: 'Transfer between accounts', description: 'Move money between your accounts.', to: '/banking/transfers', icon: ArrowLeftRight },
      { title: 'ACH transfer', description: 'Send money to a US bank account via ACH.', to: '/banking-payments/scheduled', icon: Landmark, deliveryEstimate: '1–2 business days' },
      { title: 'Wire transfer', description: 'Send a same-day domestic or international wire.', to: '/banking-payments/scheduled', icon: Send, deliveryEstimate: 'Same day' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Nigeria
// ---------------------------------------------------------------------------
const NG: CountryTreasuryConfig = {
  countryCode: 'NG',
  displayName: 'Nigeria',
  defaultCurrency: 'NGN',
  rails: [
    { id: 'nibss_nip',  label: 'NIBSS Instant (NIP)', description: 'Instant transfers to any Nigerian bank via NIBSS.',    deliveryEstimate: 'Instant',    bankAccountFlag: 'is_nibss_enabled' },
    { id: 'nibss_neft', label: 'NEFT',                description: 'NIBSS Electronic Funds Transfer.',                    deliveryEstimate: 'T+1',        bankAccountFlag: 'is_nibss_enabled' },
    { id: 'rtgs',       label: 'CBN RTGS',            description: 'Real-Time Gross Settlement for high-value payments.', deliveryEstimate: 'Same day',   bankAccountFlag: 'is_rtgs_enabled' },
    { id: 'internal',   label: 'Between accounts',    description: 'Own-account transfer',                                 deliveryEstimate: 'Instant' },
    { id: 'cheque',     label: 'Cheque',              description: 'Printed cheque',                                       deliveryEstimate: '3–5 business days' },
  ],
  taxPayees: [
    { code: 'NRS-VAT',      label: 'NRS — Value Added Tax',            authority: 'NRS',   taxType: 'vat',      liabilityCodePrefix: ['2-3'], liabilityKeywords: ['vat'] },
    { code: 'NRS-WHT',      label: 'NRS — Withholding Tax',            authority: 'NRS',   taxType: 'wht',      liabilityCodePrefix: ['2-2'], liabilityKeywords: ['withholding', 'wht'] },
    { code: 'NRS-CIT',      label: 'NRS — Companies Income Tax',       authority: 'NRS',   taxType: 'cit',      liabilityCodePrefix: ['2-4'], liabilityKeywords: ['corporate', 'income tax'] },
    { code: 'NRS-PAYE-FCT', label: 'NRS — PAYE (FCT residents)',       authority: 'NRS',   taxType: 'paye',     liabilityCodePrefix: ['2-2'], liabilityKeywords: ['paye'] },
    { code: 'SIRS-PAYE',     label: 'State IRS — PAYE',                  authority: 'SIRS',   taxType: 'paye',     liabilityCodePrefix: ['2-2'], liabilityKeywords: ['paye'] },
    { code: 'PENCOM',        label: 'National Pension Commission',        authority: 'PenCom', taxType: 'pension',  liabilityCodePrefix: ['2-2'], liabilityKeywords: ['pension'] },
    { code: 'NHF',           label: 'National Housing Fund',              authority: 'FMBN',   taxType: 'nhf',      liabilityCodePrefix: ['2-2'], liabilityKeywords: ['nhf', 'housing'] },
    { code: 'NSITF',         label: 'Nigeria Social Insurance Trust Fund', authority: 'NSITF', taxType: 'nsitf',    liabilityCodePrefix: ['2-2'], liabilityKeywords: ['nsitf'] },
    { code: 'ITF',           label: 'Industrial Training Fund',           authority: 'ITF',    taxType: 'itf',      liabilityCodePrefix: ['2-2'], liabilityKeywords: ['itf', 'training'] },
  ],
  sections: {
    bills: [
      { title: 'Pay bills', description: 'Pay vendor invoices via NIP, NEFT, or RTGS.', to: '/treasury/ap-payments', icon: CreditCard },
      { title: 'Pay salaries (NIBSS)', description: 'Batch salary payout via NIBSS Instant.', to: '/treasury/payroll-payments', icon: Users, deliveryEstimate: 'Instant' },
    ],
    taxRemittances: [
      { title: 'Pay NRS taxes', description: 'Remit VAT, WHT, CIT and PAYE to the Nigeria Revenue Service.', to: '/tax/nigeria?tab=remittances&authority=NRS', icon: Receipt },
      { title: 'Pay State (SIRS) taxes', description: 'Remit PAYE to the State Internal Revenue Service.', to: '/tax/nigeria?tab=remittances&authority=SIRS', icon: Building2 },
      { title: 'Pay pension & NHF', description: 'Remit PenCom, NHF, NSITF and ITF contributions.', to: '/tax/nigeria?tab=remittances&authority=PenCom', icon: Wallet },
    ],
    transfers: [
      { title: 'Transfer between accounts', description: 'Move money between your own bank accounts.', to: '/banking/transfers', icon: ArrowLeftRight },
      { title: 'NIBSS Instant (NIP)', description: 'Send funds to any Nigerian bank account instantly.', to: '/banking-payments/scheduled', icon: Send, deliveryEstimate: 'Instant' },
      { title: 'NEFT', description: 'Standard NIBSS Electronic Funds Transfer.', to: '/banking-payments/scheduled', icon: Banknote, deliveryEstimate: 'T+1' },
      { title: 'CBN RTGS', description: 'High-value real-time gross settlement.', to: '/banking-payments/scheduled', icon: Landmark, deliveryEstimate: 'Same day' },
    ],
    payments: [
      { title: 'Payment links', description: 'Create shareable pay-me links for customers.', to: '/banking-payments/payment-links', icon: LinkIcon },
      { title: 'Scheduled payments', description: 'View and manage upcoming outbound payments.', to: '/banking-payments/scheduled', icon: Clock },
    ],
    governance: [],
  },
};

// ---------------------------------------------------------------------------
// Zambia
// ---------------------------------------------------------------------------
const ZM: CountryTreasuryConfig = {
  countryCode: 'ZM',
  displayName: 'Zambia',
  defaultCurrency: 'ZMW',
  rails: [
    { id: 'interac', label: 'ZIPSS Instant', description: 'Zambia Interbank Payment & Settlement — instant to any Zambian bank.', deliveryEstimate: 'Instant' },
    { id: 'ach',     label: 'EFT (DDACC)',   description: 'Direct Debit & Credit Clearing — standard bank transfer.',            deliveryEstimate: 'T+1' },
    { id: 'wire',    label: 'BoZ RTGS',      description: 'Bank of Zambia Real-Time Gross Settlement for high-value payments.', deliveryEstimate: 'Same day' },
    { id: 'manual',  label: 'Mobile Money',  description: 'MTN MoMo / Airtel Money payouts.',                                   deliveryEstimate: 'Instant' },
    { id: 'internal',label: 'Between accounts', description: 'Own-account transfer',                                             deliveryEstimate: 'Instant' },
    { id: 'cheque',  label: 'Cheque',        description: 'Printed cheque',                                                     deliveryEstimate: '3–5 business days' },
  ],
  taxPayees: [
    { code: 'ZRA-VAT',      label: 'ZRA — Value Added Tax',        authority: 'ZRA',   taxType: 'vat',              liabilityCodePrefix: ['2-3'], liabilityKeywords: ['vat'] },
    { code: 'ZRA-PAYE',     label: 'ZRA — PAYE',                    authority: 'ZRA',   taxType: 'paye',             liabilityCodePrefix: ['2-2'], liabilityKeywords: ['paye'] },
    { code: 'ZRA-WHT',      label: 'ZRA — Withholding Tax',         authority: 'ZRA',   taxType: 'wht',              liabilityCodePrefix: ['2-2'], liabilityKeywords: ['withholding', 'wht'] },
    { code: 'ZRA-CIT',      label: 'ZRA — Company Income Tax',      authority: 'ZRA',   taxType: 'cit',              liabilityCodePrefix: ['2-4'], liabilityKeywords: ['corporate', 'income tax'] },
    { code: 'ZRA-TOT',      label: 'ZRA — Turnover Tax',            authority: 'ZRA',   taxType: 'turnover_tax',     liabilityCodePrefix: ['2-4'], liabilityKeywords: ['turnover'] },
    { code: 'NAPSA',        label: 'NAPSA — Pension Contributions', authority: 'NAPSA', taxType: 'pension',          liabilityCodePrefix: ['2-2'], liabilityKeywords: ['napsa', 'pension'] },
    { code: 'NHIMA',        label: 'NHIMA — National Health Insurance', authority: 'NHIMA', taxType: 'health_insurance', liabilityCodePrefix: ['2-2'], liabilityKeywords: ['nhima', 'health'] },
  ],
  sections: {
    bills: [
      { title: 'Pay bills', description: 'Pay vendor invoices via ZIPSS, EFT, RTGS or Mobile Money.', to: '/treasury/ap-payments', icon: CreditCard },
      { title: 'Pay ZRA taxes', description: 'Remit VAT, PAYE, WHT and CIT to the Zambia Revenue Authority.', to: '/treasury/tax-payments', icon: Receipt },
      { title: 'Pay NAPSA & NHIMA', description: 'Remit pension and health insurance contributions.', to: '/treasury/tax-payments', icon: Wallet },
      { title: 'Pay salaries', description: 'Batch salary payout via ZIPSS or EFT.', to: '/treasury/payroll-payments', icon: Users, deliveryEstimate: 'Instant' },
    ],
    transfers: [
      { title: 'Transfer between accounts', description: 'Move money between your own bank accounts.', to: '/banking/transfers', icon: ArrowLeftRight },
      { title: 'ZIPSS Instant', description: 'Send funds to any Zambian bank account instantly.', to: '/banking-payments/scheduled', icon: Send, deliveryEstimate: 'Instant' },
      { title: 'EFT (DDACC)', description: 'Standard Direct Debit & Credit Clearing transfer.', to: '/banking-payments/scheduled', icon: Banknote, deliveryEstimate: 'T+1' },
      { title: 'BoZ RTGS', description: 'High-value real-time gross settlement.', to: '/banking-payments/scheduled', icon: Landmark, deliveryEstimate: 'Same day' },
      { title: 'Mobile Money', description: 'Send to MTN MoMo or Airtel Money wallets.', to: '/banking-payments/scheduled', icon: Send, deliveryEstimate: 'Instant' },
    ],
    payments: [
      { title: 'Payment links', description: 'Create shareable pay-me links for customers.', to: '/banking-payments/payment-links', icon: LinkIcon },
      { title: 'Scheduled payments', description: 'View and manage upcoming outbound payments.', to: '/banking-payments/scheduled', icon: Clock },
    ],
    governance: [],
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
const REGISTRY: Record<string, CountryTreasuryConfig> = { CA, US, NG, ZM };

export function getCountryTreasuryConfig(code?: string | null): CountryTreasuryConfig {
  if (!code) return CA;
  return REGISTRY[code.toUpperCase()] ?? CA;
}

export function listSupportedCountries(): CountryTreasuryConfig[] {
  return Object.values(REGISTRY);
}


/**
 * CRA My Payment categories, mirrored from CRA's "What you can and can't pay" list.
 * The built-in list can be renamed, extended or hidden per organization through
 * cra_payment_catalog_overrides, so a change on CRA's side needs no code release.
 */

export type PayerKind = 'individual' | 'business';

/** Program identifier CRA uses for the account. SIN = the individual's own SIN, entered on CRA's site only. */
export type ProgramCode = 'RT' | 'RP' | 'RC' | 'RZ' | 'RD' | 'RE' | 'SY' | 'RG' | 'XR' | 'SIN' | 'NONE';

/** Values allowed in tax_payments.payment_type. */
export type RegisterPaymentType = 'gst_hst' | 'source_deductions' | 'corporate_tax' | 'other';

export interface CraAllocation {
  key: string;
  label: string;
  /** Instalments are prepayments; everything else settles an assessed or self-assessed balance. */
  kind?: 'balance' | 'instalment' | 'return_and_payment' | 'interim' | 'remittance';
}

export interface CraPaymentType {
  key: string;
  payerKind: PayerKind;
  label: string;
  program: ProgramCode;
  registerType: RegisterPaymentType;
  allocations: CraAllocation[];
  /** Words used to find the matching liability account in the chart of accounts. */
  liabilityHints: string[];
  /** Where eFinsuite can pre-fill the amount and period. */
  prefill?: 'gst' | 'payroll' | 'corporate';
  custom?: boolean;
}

const balance = (label = 'Balance owing'): CraAllocation => ({ key: 'balance_owing', label, kind: 'balance' });
const instalment = (label = 'Instalment'): CraAllocation => ({ key: 'instalment', label, kind: 'instalment' });

export const MY_PAYMENT_URL = 'https://apps.cra-arc.gc.ca/ebci/fppp/mypymnt/pub/ntr.action?request_locale=en_CA';
export const MY_PAYMENT_INFO_URL = 'https://www.canada.ca/en/revenue-agency/services/e-services/payment-save-time-pay-online.html';
export const REPRESENT_A_CLIENT_URL = 'https://www.canada.ca/en/revenue-agency/services/e-services/represent-a-client.html';

export const BUILT_IN_CATALOG: CraPaymentType[] = [
  // ----- Individuals -----
  {
    key: 't1', payerKind: 'individual', label: 'Individual income tax (T1)', program: 'SIN', registerType: 'other',
    allocations: [balance('Amount owing on a return'), instalment('Instalment payment')],
    liabilityHints: ['personal income tax', 'income tax payable'],
  },
  {
    key: 'benefits_repayment', payerKind: 'individual', label: 'Benefits and credits repayment', program: 'SIN', registerType: 'other',
    allocations: [{ key: 'benefit_repayment', label: 'Benefit or credit repayment', kind: 'balance' }],
    liabilityHints: ['benefit repayment'],
  },
  {
    key: 'fhsa', payerKind: 'individual', label: 'First Home Savings Account (FHSA)', program: 'SIN', registerType: 'other',
    allocations: [{ key: 'fhsa_tax', label: 'FHSA tax owing', kind: 'balance' }],
    liabilityHints: ['fhsa'],
  },
  {
    key: 'section_216', payerKind: 'individual', label: 'Section 216 tax return', program: 'SIN', registerType: 'other',
    allocations: [balance('Section 216 return balance')],
    liabilityHints: ['non-resident tax', 'part xiii'],
  },
  {
    key: 'uht_individual', payerKind: 'individual', label: 'Underused Housing Tax', program: 'SIN', registerType: 'other',
    allocations: [balance('Underused Housing Tax owing')],
    liabilityHints: ['underused housing'],
  },

  // ----- Businesses -----
  {
    key: 'gst_hst', payerKind: 'business', label: 'GST/HST', program: 'RT', registerType: 'gst_hst', prefill: 'gst',
    allocations: [
      { key: 'gst_payment', label: 'GST/HST payment', kind: 'balance' },
      { key: 'gst_return_and_payment', label: 'GST/HST return and payment', kind: 'return_and_payment' },
      { key: 'gst_instalment', label: 'GST/HST instalment', kind: 'instalment' },
    ],
    liabilityHints: ['gst/hst payable', 'hst payable', 'gst payable', 'gst/hst collected', 'sales tax payable'],
  },
  {
    key: 'payroll', payerKind: 'business', label: 'Payroll source deductions', program: 'RP', registerType: 'source_deductions', prefill: 'payroll',
    allocations: [
      { key: 'regular_remittance', label: 'Regular remittance', kind: 'remittance' },
      { key: 'quarterly_remittance', label: 'Quarterly remittance', kind: 'remittance' },
      { key: 'threshold_1', label: 'Accelerated remittance — Threshold 1', kind: 'remittance' },
      { key: 'threshold_2', label: 'Accelerated remittance — Threshold 2', kind: 'remittance' },
      { key: 'payroll_arrears', label: 'Arrears or balance owing', kind: 'balance' },
      { key: 'payroll_pd7a_assessed', label: 'Amount on a notice of assessment', kind: 'balance' },
    ],
    liabilityHints: ['source deductions', 'payroll liabilities', 'payroll payable', 'cpp', 'ei payable', 'income tax withheld'],
  },
  {
    key: 't2', payerKind: 'business', label: 'Corporation income tax (T2)', program: 'RC', registerType: 'corporate_tax', prefill: 'corporate',
    allocations: [
      { key: 't2_balance', label: 'Corporation tax balance due', kind: 'balance' },
      { key: 't2_instalment', label: 'Corporation tax instalment', kind: 'instalment' },
      { key: 't2_interim', label: 'Corporation tax interim payment', kind: 'interim' },
    ],
    liabilityHints: ['corporate income tax payable', 'income taxes payable', 'income tax payable', 'corporation tax'],
  },
  { key: 'excise_duty', payerKind: 'business', label: 'Excise duty', program: 'RD', registerType: 'other', allocations: [balance()], liabilityHints: ['excise duty'] },
  { key: 'excise_tax', payerKind: 'business', label: 'Excise tax', program: 'RE', registerType: 'other', allocations: [balance()], liabilityHints: ['excise tax'] },
  { key: 'fuel_charge', payerKind: 'business', label: 'Fuel charge', program: 'RE', registerType: 'other', allocations: [balance()], liabilityHints: ['fuel charge'] },
  { key: 'luxury_tax', payerKind: 'business', label: 'Luxury tax', program: 'RE', registerType: 'other', allocations: [balance()], liabilityHints: ['luxury tax'] },
  { key: 'atsc', payerKind: 'business', label: "Air Travellers Security Charge (ATSC)", program: 'RE', registerType: 'other', allocations: [balance()], liabilityHints: ['air travellers', 'atsc'] },
  { key: 'insurance_premiums', payerKind: 'business', label: 'Excise Tax on Insurance Premiums', program: 'RE', registerType: 'other', allocations: [balance()], liabilityHints: ['insurance premium tax', 'excise tax'] },
  { key: 'ns_wcb', payerKind: 'business', label: "Nova Scotia Workers' Compensation Board", program: 'RP', registerType: 'other', allocations: [balance('WCB premium')], liabilityHints: ['wcb', 'workers compensation'] },
  {
    key: 'partnership_penalties', payerKind: 'business', label: 'Partnerships and information returns penalties', program: 'RZ', registerType: 'other',
    allocations: [balance('Penalty or balance owing')], liabilityHints: ['penalties payable'],
  },
  { key: 'equity_repurchase', payerKind: 'business', label: 'Tax on repurchases of equity', program: 'RC', registerType: 'corporate_tax', allocations: [balance()], liabilityHints: ['equity repurchase tax', 'income tax payable'] },
  { key: 'rent_subsidy_repayment', payerKind: 'business', label: 'Rent subsidies repayment', program: 'RC', registerType: 'other', allocations: [{ key: 'subsidy_repayment', label: 'Subsidy repayment', kind: 'balance' }], liabilityHints: ['subsidy repayment', 'cers', 'crhp'] },
  { key: 'uht_business', payerKind: 'business', label: 'Underused Housing Tax', program: 'RZ', registerType: 'other', allocations: [balance('Underused Housing Tax owing')], liabilityHints: ['underused housing'] },
];

export interface CatalogOverride {
  payer_kind: PayerKind;
  type_key: string;
  label: string | null;
  program_code: string | null;
  allocations: CraAllocation[] | null;
  hidden: boolean;
}

const PROGRAM_CODES = new Set<ProgramCode>(['RT', 'RP', 'RC', 'RZ', 'RD', 'RE', 'SY', 'RG', 'XR', 'SIN', 'NONE']);

function cleanAllocations(value: unknown): CraAllocation[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value
    .filter((row): row is { key: unknown; label: unknown; kind?: unknown } => !!row && typeof row === 'object')
    .map((row) => ({
      key: String(row.key ?? '').trim(),
      label: String(row.label ?? '').trim(),
      kind: (['balance', 'instalment', 'return_and_payment', 'interim', 'remittance'] as const).find((k) => k === row.kind),
    }))
    .filter((row) => /^[a-z0-9_]{2,60}$/.test(row.key) && row.label.length > 0);
  return rows.length ? rows : null;
}

/** Built-in catalog with an organization's overrides applied. Hidden types are dropped. */
export function mergeCatalog(overrides: CatalogOverride[] = []): CraPaymentType[] {
  const byKey = new Map<string, CraPaymentType>();
  for (const type of BUILT_IN_CATALOG) byKey.set(`${type.payerKind}:${type.key}`, { ...type, allocations: [...type.allocations] });

  for (const override of overrides) {
    const id = `${override.payer_kind}:${override.type_key}`;
    const existing = byKey.get(id);
    if (override.hidden) {
      byKey.delete(id);
      continue;
    }
    const allocations = cleanAllocations(override.allocations);
    const program = PROGRAM_CODES.has(override.program_code as ProgramCode) ? (override.program_code as ProgramCode) : undefined;
    if (existing) {
      byKey.set(id, {
        ...existing,
        label: override.label?.trim() || existing.label,
        program: program ?? existing.program,
        allocations: allocations ?? existing.allocations,
      });
    } else if (override.label?.trim() && allocations) {
      byKey.set(id, {
        key: override.type_key,
        payerKind: override.payer_kind,
        label: override.label.trim(),
        program: program ?? (override.payer_kind === 'individual' ? 'SIN' : 'NONE'),
        registerType: 'other',
        allocations,
        liabilityHints: [],
        custom: true,
      });
    }
  }
  return [...byKey.values()];
}

export function findType(catalog: CraPaymentType[], payerKind: PayerKind | null | undefined, key: string | null | undefined) {
  if (!payerKind || !key) return undefined;
  return catalog.find((type) => type.payerKind === payerKind && type.key === key);
}

export function findAllocation(type: CraPaymentType | undefined, key: string | null | undefined) {
  if (!type || !key) return undefined;
  return type.allocations.find((allocation) => allocation.key === key);
}

/** Whether an allocation belongs to the selected payment type. */
export function allocationMatchesType(type: CraPaymentType | undefined, allocationKey: string): boolean {
  return !!findAllocation(type, allocationKey);
}

export function typeLabel(catalog: CraPaymentType[], payerKind: string | null | undefined, key: string | null | undefined): string {
  return findType(catalog, payerKind as PayerKind, key)?.label ?? key ?? '—';
}

export function allocationLabel(catalog: CraPaymentType[], payerKind: string | null | undefined, typeKey: string | null | undefined, allocationKey: string | null | undefined): string {
  const type = findType(catalog, payerKind as PayerKind, typeKey);
  return findAllocation(type, allocationKey)?.label ?? allocationKey ?? '—';
}

/**
 * CRA T5 — Statement of Investment Income — slip box definitions.
 *
 * T5 is issued by financial institutions to report interest, dividends, and
 * certain other investment income paid to Canadian residents. Box codes map to
 * the CRA T5 XML schema element tags.
 *
 * Source: CRA "T5, Statement of Investment Income" and its XML specifications.
 */
export interface T5BoxDefinition {
  boxCode: string;
  craTag: string;
  label: string;
  description: string;
  /** Where the value originates: a GL category, or computed from other boxes. */
  dataSource: 'interest_income' | 'dividend_income' | 'foreign_income' | 'computed' | 'manual';
  isRequired: boolean;
}

export const T5_BOXES: T5BoxDefinition[] = [
  {
    boxCode: '13',
    craTag: 'int_inc',
    label: 'Interest income',
    description: 'Interest income paid to the recipient.',
    dataSource: 'interest_income',
    isRequired: false,
  },
  {
    boxCode: '23',
    craTag: 'elgbl_div',
    label: 'Eligible dividends',
    description: 'Actual amount of taxable dividends designated as eligible.',
    dataSource: 'dividend_income',
    isRequired: false,
  },
  {
    boxCode: '24',
    craTag: 'oth_div',
    label: 'Other than eligible dividends',
    description: 'Actual amount of taxable dividends that are not eligible.',
    dataSource: 'dividend_income',
    isRequired: false,
  },
  {
    boxCode: '31',
    craTag: 'tot_div',
    label: 'Total amount of dividends',
    description: 'Total gross dividends = box 23 + box 24 (+ portions of 32).',
    dataSource: 'computed',
    isRequired: true,
  },
  {
    boxCode: '32',
    craTag: 'frgn_div',
    label: 'Foreign dividends',
    description: 'Actual amount of foreign non-business-income-tax-paid dividends.',
    dataSource: 'foreign_income',
    isRequired: false,
  },
  {
    boxCode: '33',
    craTag: 'brg_int',
    label: 'Amount of bridge loan interest',
    description: 'Interest from a bridge loan.',
    dataSource: 'interest_income',
    isRequired: false,
  },
  {
    boxCode: '39',
    craTag: 'rptbl_exmpt_div',
    label: 'Reportable exempt dividends',
    description: 'Reportable exempt dividends paid.',
    dataSource: 'dividend_income',
    isRequired: false,
  },
  {
    boxCode: '40',
    craTag: 'tot_inv_inc',
    label: 'Total investment income',
    description: 'Total amount of investment income = box 13 + box 31 + box 32 (net of 33).',
    dataSource: 'computed',
    isRequired: true,
  },
  {
    boxCode: '42',
    craTag: 'frgn_tax_pd',
    label: 'Foreign tax paid',
    description: 'Actual amount of foreign tax paid.',
    dataSource: 'foreign_income',
    isRequired: false,
  },
];

/** Lookup helper by box code. */
export function t5BoxByCode(code: string): T5BoxDefinition | undefined {
  return T5_BOXES.find((b) => b.boxCode === code);
}

/** Lookup helper by CRA XML tag. */
export function t5BoxByTag(tag: string): T5BoxDefinition | undefined {
  return T5_BOXES.find((b) => b.craTag === tag);
}

/** Boxes that must contain a valid value for a T5 slip to be reportable. */
export const T5_MANDATORY_BOXES = [
  '31', // total dividends
  '40', // total investment income
];

/** CRA $50 reporting threshold (cent) — below this a T5 is not required unless other income pushes over. */
export const T5_REPORTING_THRESHOLD_CENTS = 5000;

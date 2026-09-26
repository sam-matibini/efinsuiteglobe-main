/**
 * Attach GST/HST and PST general-ledger accounts to a tax code.
 *
 * A combined Manitoba rate is often stored with empty account ids so PST is
 * not posted to the GST input-tax-credit account. The chart of accounts and
 * the individual GST and PST codes already name those accounts.
 */

import { PROVINCE_TAX_CONFIG } from '@/lib/splitTaxCalculator';

export interface NamedAccount {
  id: string;
  name: string;
  is_header?: boolean;
  posting_allowed?: boolean;
}

export interface TaxGlComponent {
  code: string;
  rate: number;
  isRecoverable?: boolean;
  authority?: string;
  glCollectedAccountId?: string | null;
  glPaidAccountId?: string | null;
}

export interface TaxGlSource {
  code?: string | null;
  tax_type?: string | null;
  applies_to?: string | null;
  gl_collected_account_id?: string | null;
  gl_paid_account_id?: string | null;
  component_taxes?: TaxGlComponent[] | null;
}

export interface ResolvableTaxCode extends TaxGlSource {
  rate: number;
  jurisdiction?: string | null;
}

const GST_COLLECTED = [
  /^GST\/HST Payable/i,
  /^GST\/HST Collected/i,
  /^HST Payable/i,
  /^GST Payable/i,
  /^GST Collected/i,
];
const GST_PAID = [
  /^GST\/HST Paid.*Input Tax Credit/i,
  /^GST\/HST Input Tax Credit/i,
  /Input Tax Credit/i,
  /^GST\/HST Receivable/i,
  /^GST\/HST ITC/i,
  /^GST Paid/i,
  /^HST Paid/i,
];
const PST_COLLECTED = [
  /^PST Payable/i,
  /^PST Collected/i,
  /^Provincial Sales Tax.*Payable/i,
  /^QST Payable/i,
  /^QST Collected/i,
];
const PST_PAID = [
  /^PST Paid/i,
  /^Provincial Sales Tax Paid/i,
  /^PST.*Non-Recoverable/i,
  /^QST.*Input Tax/i,
  /^QST.*ITR/i,
];

export function resolveTaxAccount(
  accounts: NamedAccount[] | undefined,
  patterns: RegExp[],
): string | null {
  if (!accounts?.length) return null;
  const postable = accounts.filter((account) => !account.is_header && account.posting_allowed !== false);
  const pool = postable.length > 0 ? postable : accounts.filter((account) => !account.is_header);
  for (const pattern of patterns) {
    const hit = pool.find((account) => pattern.test(account.name.trim()));
    if (hit) return hit.id;
  }
  return null;
}

function firstId(...ids: Array<string | null | undefined>): string | null {
  return ids.find((id) => !!id) ?? null;
}

function isPaidCode(code: TaxGlSource): boolean {
  const upper = (code.code || '').toUpperCase();
  return code.applies_to === 'purchases' || /-(ITC|PAID|ITR|INPUT)$/.test(upper);
}

function findCodeAccount(
  taxCodes: TaxGlSource[] | undefined,
  kind: 'gst' | 'pst',
  field: 'gl_collected_account_id' | 'gl_paid_account_id',
): string | null {
  const match = taxCodes?.find((code) => {
    const upper = (code.code || '').toUpperCase();
    const type = (code.tax_type || '').toUpperCase();
    const paid = isPaidCode(code);
    if (kind === 'gst') {
      const isGst = upper === 'GST' || upper.startsWith('GST-') || type === 'GST' || upper.startsWith('HST') || type === 'HST';
      return isGst && (field === 'gl_paid_account_id' ? paid || !!code.gl_paid_account_id : !paid);
    }
    const isPst = upper === 'PST' || upper.startsWith('PST') || type === 'PST' || upper.startsWith('QST') || type === 'QST';
    return isPst && !upper.includes('GST') && (field === 'gl_paid_account_id' ? paid || !!code.gl_paid_account_id : !paid);
  });
  return match?.[field] ?? null;
}

export function resolveCanadianTaxAccounts(
  accounts: NamedAccount[] | undefined,
  taxCodes?: TaxGlSource[],
) {
  return {
    gstCollected: firstId(
      findCodeAccount(taxCodes, 'gst', 'gl_collected_account_id'),
      resolveTaxAccount(accounts, GST_COLLECTED),
    ),
    gstPaid: firstId(
      findCodeAccount(taxCodes, 'gst', 'gl_paid_account_id'),
      resolveTaxAccount(accounts, GST_PAID),
    ),
    pstCollected: firstId(
      findCodeAccount(taxCodes, 'pst', 'gl_collected_account_id'),
      resolveTaxAccount(accounts, PST_COLLECTED),
    ),
    pstPaid: firstId(
      findCodeAccount(taxCodes, 'pst', 'gl_paid_account_id'),
      resolveTaxAccount(accounts, PST_PAID),
    ),
  };
}

function isSplitCode(code: ResolvableTaxCode): boolean {
  const type = (code.tax_type || '').toUpperCase();
  if (type === 'GST+PST' || type === 'GST+QST' || type.includes('GST_PST')) return true;
  const province = (code.jurisdiction || '').toUpperCase();
  const config = PROVINCE_TAX_CONFIG[province];
  return !!config && config.taxModel === 'GST_PST' && Math.abs(code.rate - (config.gstRate + config.pstRate)) < 0.02;
}

function defaultComponents(province: string, resolved: ReturnType<typeof resolveCanadianTaxAccounts>): TaxGlComponent[] {
  const config = PROVINCE_TAX_CONFIG[province];
  if (!config || config.taxModel !== 'GST_PST') return [];
  const isQc = province === 'QC';
  return [
    {
      code: 'GST',
      rate: config.gstRate,
      isRecoverable: true,
      authority: 'CRA',
      glCollectedAccountId: resolved.gstCollected,
      glPaidAccountId: resolved.gstPaid,
    },
    {
      code: isQc ? 'QST' : config.pstCode,
      rate: config.pstRate,
      isRecoverable: config.pstRecoverable,
      authority: config.pstAuthority,
      glCollectedAccountId: resolved.pstCollected,
      glPaidAccountId: resolved.pstPaid,
    },
  ];
}

export function withResolvedTaxAccounts<T extends ResolvableTaxCode>(
  code: T | null,
  accounts: NamedAccount[] | undefined,
  taxCodes?: TaxGlSource[],
): T | null {
  if (!code) return code;
  const resolved = resolveCanadianTaxAccounts(accounts, taxCodes);
  const province = (code.jurisdiction || '').toUpperCase();
  const upper = (code.code || '').toUpperCase();

  if (isSplitCode(code) || (code.component_taxes && code.component_taxes.length > 0)) {
    const source = code.component_taxes?.length
      ? code.component_taxes
      : defaultComponents(province, resolved);
    const components = source.map((component) => {
      const componentCode = component.code.toUpperCase();
      const isPst = componentCode !== 'GST' && !componentCode.startsWith('HST');
      const glCollectedAccountId = firstId(
        component.glCollectedAccountId,
        isPst ? resolved.pstCollected : resolved.gstCollected,
      );
      const glPaidAccountId = firstId(
        component.glPaidAccountId,
        isPst ? resolved.pstPaid : resolved.gstPaid,
      );
      if (
        glCollectedAccountId === (component.glCollectedAccountId ?? null)
        && glPaidAccountId === (component.glPaidAccountId ?? null)
      ) {
        return component;
      }
      return { ...component, glCollectedAccountId, glPaidAccountId };
    });
    const unchanged = components.every((component, index) => component === source[index])
      && code.gl_collected_account_id === firstId(code.gl_collected_account_id, resolved.gstCollected)
      && code.gl_paid_account_id === firstId(code.gl_paid_account_id, resolved.gstPaid);
    if (unchanged && code.component_taxes === source) return code;
    return {
      ...code,
      gl_collected_account_id: firstId(code.gl_collected_account_id, resolved.gstCollected),
      gl_paid_account_id: firstId(code.gl_paid_account_id, resolved.gstPaid),
      component_taxes: components,
    };
  }

  const isPst = upper.includes('PST') || upper.includes('QST') || (code.tax_type || '').toUpperCase() === 'PST';
  const glCollected = firstId(code.gl_collected_account_id, isPst ? resolved.pstCollected : resolved.gstCollected);
  const glPaid = firstId(code.gl_paid_account_id, isPst ? resolved.pstPaid : resolved.gstPaid);
  if (glCollected === code.gl_collected_account_id && glPaid === code.gl_paid_account_id) return code;
  return { ...code, gl_collected_account_id: glCollected, gl_paid_account_id: glPaid };
}

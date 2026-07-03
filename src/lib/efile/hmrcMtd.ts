/**
 * Phase 11a — HMRC MTD VAT helper (client-side packet builder).
 *
 * The actual API submission happens in the `tax-efile-submit` edge function,
 * which holds OAuth tokens server-side. This module just shapes the JSON
 * body that HMRC's `/organisations/vat/{vrn}/returns` endpoint expects.
 */
import type { FilingFormResult } from '@/lib/filings/types';
import type { EFilePacket } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const truncToInt = (n: number) => Math.trunc(n);

interface HmrcOptions {
  vrn: string;
  periodKey: string; // assigned by HMRC obligations endpoint, e.g. "23A1"
  finalised?: boolean;
}

/**
 * HMRC field mapping (VAT100):
 *   vatDueSales      = box 1  (VAT due on sales)
 *   vatDueAcquisitions = box 2 (Acquisitions from EU member states — usually 0 post-Brexit)
 *   totalVatDue      = box 3  (sum of 1+2)
 *   vatReclaimedCurrPeriod = box 4 (VAT reclaimed on purchases / ITC)
 *   netVatDue        = box 5  (|3 - 4|)
 *   totalValueSalesExVAT = box 6 (Net sales)
 *   totalValuePurchasesExVAT = box 7 (Net purchases)
 *   totalValueGoodsSuppliedExVAT = box 8 (EU goods supplied)
 *   totalAcquisitionsExVAT = box 9 (EU acquisitions)
 */
export function buildHmrcVatBody(form: FilingFormResult, opts: HmrcOptions) {
  const get = (code: string) => {
    const line = form.lines.find((l) => l.code === code);
    return line?.amount ?? 0;
  };

  // Map our FilingFormResult lines (built by euVat.ts) to HMRC schema.
  const box1 = round2(get('1'));
  const box2 = round2(get('2'));
  const box3 = round2(get('3') || box1 + box2);
  const box4 = round2(get('4'));
  const box5 = round2(Math.abs(get('5') || box3 - box4));
  const box6 = truncToInt(get('6'));
  const box7 = truncToInt(get('7'));
  const box8 = truncToInt(get('8'));
  const box9 = truncToInt(get('9'));

  return {
    periodKey: opts.periodKey,
    vatDueSales: box1,
    vatDueAcquisitions: box2,
    totalVatDue: box3,
    vatReclaimedCurrPeriod: box4,
    netVatDue: box5,
    totalValueSalesExVAT: box6,
    totalValuePurchasesExVAT: box7,
    totalValueGoodsSuppliedExVAT: box8,
    totalAcquisitionsExVAT: box9,
    finalised: opts.finalised ?? true,
  };
}

export function buildHmrcPacket(form: FilingFormResult, opts: HmrcOptions): EFilePacket {
  const body = buildHmrcVatBody(form, opts);
  return {
    channel: 'hmrc_mtd',
    format: 'json',
    filename: `HMRC_VAT_${opts.vrn}_${opts.periodKey}.json`,
    mimeType: 'application/json',
    contents: JSON.stringify(body, null, 2),
    canDirectSubmit: true,
    instructions: [
      'efinsuite will submit this return directly to HMRC via Making Tax Digital.',
      'You must have authorised efinsuite to file VAT returns on your behalf.',
      'After HMRC accepts the submission, the confirmation reference is recorded automatically.',
    ],
    form,
  };
}

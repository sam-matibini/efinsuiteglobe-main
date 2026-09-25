/**
 * Phase 11c — US state sales tax submission packets.
 *
 * No unified US API exists. Each state runs its own portal (CDTFA, NY DTF, TX
 * Comptroller, FL DOR, WA DOR). We generate a portal-friendly CSV, deep-link
 * the user, and track the manual confirmation number.
 */
import type { FilingFormResult } from '@/lib/filings/types';
import type { EFilePacket } from './types';

interface StateConfig {
  name: string;
  portalUrl: string;
  instructions: string[];
}

const STATE_PORTALS: Record<string, StateConfig> = {
  CA: {
    name: 'California (CDTFA)',
    portalUrl: 'https://onlineservices.cdtfa.ca.gov/',
    instructions: [
      'Sign in to CDTFA Online Services.',
      'Select your sales & use tax return for the period.',
      'Use this CSV to transcribe the line items.',
    ],
  },
  NY: {
    name: 'New York (DTF)',
    portalUrl: 'https://www.tax.ny.gov/online/bus.htm',
    instructions: [
      'Sign in to NY Business Online Services.',
      'Select Sales Tax Web File.',
      'Enter line totals from this packet.',
    ],
  },
  TX: {
    name: 'Texas (Comptroller)',
    portalUrl: 'https://comptroller.texas.gov/taxes/file-pay/',
    instructions: [
      'Sign in to Webfile at the Texas Comptroller.',
      'Select Sales and Use Tax > File a Return.',
    ],
  },
  FL: {
    name: 'Florida (DOR)',
    portalUrl: 'https://floridarevenue.com/taxes/eservices/Pages/filepay.aspx',
    instructions: [
      'Sign in to Florida Department of Revenue eServices.',
      'Select File and Pay Sales and Use Tax (DR-15).',
    ],
  },
  WA: {
    name: 'Washington (DOR)',
    portalUrl: 'https://secure.dor.wa.gov/',
    instructions: [
      'Sign in to My DOR.',
      'Select Excise Tax Returns.',
    ],
  },
};

const csvEscape = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildUsStatePacket(
  form: FilingFormResult,
  state: string,
  registrationNumber?: string,
): EFilePacket {
  const cfg = STATE_PORTALS[state.toUpperCase()] ?? {
    name: `US-${state}`,
    portalUrl: 'https://www.taxadmin.org/state-tax-agencies',
    instructions: [
      'Locate your state portal from the FTA directory.',
      'Sign in and start a new sales & use tax return.',
      'Use this CSV to transcribe the line items.',
    ],
  };

  const rows: string[][] = [
    ['Filing', form.formCode, form.formName],
    ['State', state, cfg.name],
    ['Period', form.periodStart, form.periodEnd],
    ['Currency', form.currency, ''],
    ['Registration', registrationNumber ?? '', ''],
    [],
    ['Line', 'Label', 'Amount'],
    ...form.lines.map((l) => [l.code, l.label, l.amount.toFixed(2)]),
    [],
    ['Net Payable', '', form.netPayable.toFixed(2)],
  ];

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');

  return {
    channel: 'us_state_packet',
    format: 'csv',
    filename: `US-${state}_SalesTax_${form.periodStart}_${form.periodEnd}.csv`,
    mimeType: 'text/csv',
    contents: csv,
    portalUrl: cfg.portalUrl,
    canDirectSubmit: false,
    instructions: cfg.instructions,
    form,
  };
}

export const SUPPORTED_US_STATES = Object.keys(STATE_PORTALS);

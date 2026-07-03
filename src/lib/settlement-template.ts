// Builds a downloadable XLSX template for settlement imports.
// CSV is shipped as a static file in /public/templates/.
import * as XLSX from 'xlsx';

const HEADERS = [
  'settlement_ref',
  'settlement_date',
  'expected_deposit_date',
  'gross_amount',
  'fees',
  'chargebacks',
  'refunds',
  'reserves',
  'net_amount',
  'currency',
  'payer_name',
  'payee_name',
  'payout_ref',
  'description',
];

const SAMPLES = [
  ['po_1ABC123', '2026-06-15', '2026-06-17', 10000.0, 290.0, 0.0, 150.0, 0.0, 9560.0, 'CAD', 'Acme Corp', 'Your Org Inc.', 'bnk_po_001', 'Stripe payout June 15'],
  ['po_1ABC124', '2026-06-16', '2026-06-18', 5500.5, 160.0, 25.0, 0.0, 0.0, 5315.5, 'USD', 'Beta LLC', 'Your Org Inc.', 'bnk_po_002', 'Stripe payout June 16'],
];

const README_ROWS: (string | number)[][] = [
  ['Field', 'Required', 'Format', 'Notes'],
  ['settlement_ref', 'Yes', 'Text', 'Unique processor payout id (e.g. Stripe po_xxx). Used to dedupe re-imports.'],
  ['settlement_date', 'Yes', 'YYYY-MM-DD', 'Date the processor settled the payout.'],
  ['expected_deposit_date', 'No', 'YYYY-MM-DD', 'Date funds expected in your bank. Used for aging.'],
  ['gross_amount', 'No', 'Number', 'Pre-fee gross. If omitted, computed from net + fees + chargebacks + refunds + reserves.'],
  ['fees', 'No', 'Number', 'Processor fees (positive number).'],
  ['chargebacks', 'No', 'Number', 'Chargebacks deducted (positive number).'],
  ['refunds', 'No', 'Number', 'Refunds deducted (positive number).'],
  ['reserves', 'No', 'Number', 'Reserves held back (positive number).'],
  ['net_amount', 'Yes', 'Number', 'Final amount deposited to bank. Required for reconciliation matching.'],
  ['currency', 'Yes', 'ISO 4217', 'CAD, USD, EUR, GBP, AUD, etc.'],
  ['payer_name', 'No', 'Text', 'Counterparty that sent the funds (customer / cardholder / originator). Required for FINTRAC LCTR when gross_amount ≥ 10,000 CAD and for EFTR on inbound EFTs ≥ 10,000 CAD.'],
  ['payee_name', 'No', 'Text', 'Beneficiary that received the funds (usually your organization; specify for marketplaces / split settlements). Required for FINTRAC EFTR on outbound EFTs ≥ 10,000 CAD.'],
  ['payout_ref', 'No', 'Text', 'Bank-side reference / wire id.'],
  ['description', 'No', 'Text', 'Free-text memo shown in UI.'],
  [],
  ['RPAA / FINTRAC note', '', '', 'Settlements flowing to end-user funds must be reconciled to the safeguarding account, not the operating account.'],
  ['Retention', '', '', 'Imported rows are retained for 5 years per FINTRAC record-keeping requirements.'],
];

export function downloadSettlementTemplateXlsx() {
  const wb = XLSX.utils.book_new();

  const wsData = [HEADERS, ...SAMPLES];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Settlements');

  const readme = XLSX.utils.aoa_to_sheet(README_ROWS);
  readme['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  XLSX.writeFile(wb, 'settlement-import-template.xlsx');
}

function toCsvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const SETTLEMENT_TEMPLATE_CSV = [HEADERS, ...SAMPLES]
  .map((row) => row.map(toCsvCell).join(','))
  .join('\r\n');

export function downloadSettlementTemplateCsv() {
  const blob = new Blob(['\ufeff' + SETTLEMENT_TEMPLATE_CSV], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'settlement-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

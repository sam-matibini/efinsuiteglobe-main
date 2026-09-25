import jsPDF from 'jspdf';
import { parseLocalDate } from '@/lib/utils';
import { getPayrollPdfConfig, type RemittanceRowSpec } from './slipFieldMapping';
import { formatPdfCurrencyByCode } from './pdfCurrency';

export interface GenericRemittanceEmployee {
  name: string;
  employeeNumber?: string;
  grossPay: number;
  federalTax: number;
  provincialTax: number;
  cppEmployee: number;
  cppEmployer: number;
  eiEmployee: number;
  eiEmployer: number;
}

export interface GenericRemittanceData {
  countryCode: string;
  employerName: string;
  employerAddress?: string;
  employerTaxId?: string;

  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;

  numberOfEmployees: number;
  grossPayroll: number;
  federalTax: number;
  provincialTax: number;
  cppEmployee: number;
  cppEmployer: number;
  eiEmployee: number;
  eiEmployer: number;

  employees: GenericRemittanceEmployee[];

  currencyCode: string;
  currencyLocale: string;
}

type Src = RemittanceRowSpec['source'] | 'gross' | 'name';

const resolveTotal = (d: GenericRemittanceData, s: RemittanceRowSpec['source']): number => {
  switch (s) {
    case 'incomeTax': return (d.federalTax || 0) + (d.provincialTax || 0);
    case 'federalTax': return d.federalTax || 0;
    case 'provincialTax': return d.provincialTax || 0;
    case 'pensionEmployee': return d.cppEmployee || 0;
    case 'pensionEmployer': return d.cppEmployer || 0;
    case 'pensionTotal': return (d.cppEmployee || 0) + (d.cppEmployer || 0);
    case 'socialInsuranceEmployee': return d.eiEmployee || 0;
    case 'socialInsuranceEmployer': return d.eiEmployer || 0;
    case 'socialInsuranceTotal': return (d.eiEmployee || 0) + (d.eiEmployer || 0);
  }
};

const resolveDetail = (e: GenericRemittanceEmployee, s: Src): string | number => {
  switch (s) {
    case 'name': return e.name + (e.employeeNumber ? ` (${e.employeeNumber})` : '');
    case 'gross': return e.grossPay;
    case 'incomeTax': return (e.federalTax || 0) + (e.provincialTax || 0);
    case 'federalTax': return e.federalTax;
    case 'provincialTax': return e.provincialTax;
    case 'pensionEmployee': return e.cppEmployee;
    case 'pensionEmployer': return e.cppEmployer;
    case 'pensionTotal': return e.cppEmployee + e.cppEmployer;
    case 'socialInsuranceEmployee': return e.eiEmployee;
    case 'socialInsuranceEmployer': return e.eiEmployer;
    case 'socialInsuranceTotal': return e.eiEmployee + e.eiEmployer;
  }
};

const fmtDate = (d: string, locale: string) => {
  try {
    return parseLocalDate(d).toLocaleDateString(locale, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return d; }
};

export function generateGenericRemittancePdf(data: GenericRemittanceData): jsPDF {
  const cfg = getPayrollPdfConfig(data.countryCode).remittance;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = M;

  const money = (v: number) =>
    formatPdfCurrencyByCode(v || 0, data.currencyCode, data.currencyLocale);

  // Title bar
  doc.setFillColor(15, 38, 65);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${cfg.formTitle} — ${cfg.formCode}`, M, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(cfg.authorityName, M, 16);

  y = 28;
  doc.setTextColor(0);
  doc.setFontSize(10);

  // Employer / Account block
  doc.setFont('helvetica', 'bold');
  doc.text('Employer', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.employerName, M, y + 5);
  if (data.employerAddress) doc.text(data.employerAddress, M, y + 10);

  const rx = pw / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Account', rx, y);
  doc.setFont('helvetica', 'normal');
  if (data.employerTaxId) doc.text(`${cfg.taxIdLabel}: ${data.employerTaxId}`, rx, y + 5);

  y += 20;

  // Period banner
  doc.setFillColor(240, 244, 250);
  doc.rect(M, y, pw - 2 * M, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text(`Period: ${data.periodLabel}`, M + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${fmtDate(data.periodStart, data.currencyLocale)} – ${fmtDate(data.periodEnd, data.currencyLocale)}`,
    M + 3, y + 11,
  );
  doc.setFont('helvetica', 'bold');
  doc.text(`Due: ${fmtDate(data.dueDate, data.currencyLocale)}`, pw - M - 3, y + 6, { align: 'right' });
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.text(`Number of employees: ${data.numberOfEmployees}`, M, y);
  doc.text(`Gross payroll: ${money(data.grossPayroll)}`, M, y + 5);
  y += 12;

  // Summary rows
  const tableW = pw - 2 * M;
  let total = 0;
  cfg.rows.forEach((row) => {
    const val = resolveTotal(data, row.source);
    total += val;
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + tableW, y);
    doc.setFont('helvetica', 'normal');
    doc.text(row.label, M + 3, y + 5);
    doc.text(money(val), M + tableW - 3, y + 5, { align: 'right' });
    y += 7;
  });
  // Total row
  doc.setFillColor(15, 38, 65);
  doc.rect(M, y, tableW, 9, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL REMITTANCE DUE', M + 3, y + 6);
  doc.text(money(total), M + tableW - 3, y + 6, { align: 'right' });
  doc.setTextColor(0);
  doc.setFontSize(10);
  y += 13;

  // Employee detail
  if (data.employees.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Employee Detail', M, y);
    y += 4;

    const cols = cfg.detailColumns;
    const nameW = 44;
    const numCols = cols.length - 1;
    const dataW = (tableW - nameW) / numCols;

    doc.setFillColor(230, 235, 242);
    doc.rect(M, y, tableW, 6, 'F');
    doc.setFontSize(8);
    let cx = M;
    cols.forEach((c, i) => {
      const w = i === 0 ? nameW : dataW;
      const align = i === 0 ? 'left' : 'right';
      const tx = align === 'left' ? cx + 2 : cx + w - 2;
      doc.text(c.label, tx, y + 4, { align });
      cx += w;
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    data.employees.forEach((e) => {
      if (y > ph - 25) { doc.addPage(); y = M; }
      cx = M;
      cols.forEach((c, i) => {
        const w = i === 0 ? nameW : dataW;
        const align = i === 0 ? 'left' : 'right';
        const tx = align === 'left' ? cx + 2 : cx + w - 2;
        const raw = resolveDetail(e, c.source);
        const val = typeof raw === 'number' ? money(raw) : String(raw);
        doc.text(val, tx, y + 4, { align });
        cx += w;
      });
      doc.setDrawColor(220);
      doc.line(M, y + 5.5, M + tableW, y + 5.5);
      y += 5.5;
    });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(
    `Submit to ${cfg.authorityName} by ${fmtDate(data.dueDate, data.currencyLocale)}.`,
    pw / 2, ph - 12, { align: 'center' },
  );
  doc.text('Generated by eFinsuite — keep a copy with your payroll records.', pw / 2, ph - 8, { align: 'center' });

  return doc;
}

export function downloadGenericRemittancePdf(data: GenericRemittanceData): void {
  const cfg = getPayrollPdfConfig(data.countryCode).remittance;
  const doc = generateGenericRemittancePdf(data);
  const safe = data.periodLabel.replace(/[^A-Za-z0-9]+/g, '-');
  doc.save(`${cfg.formCode.replace(/\s+/g, '')}-${safe}.pdf`);
}

export function buildGenericRemittanceCsv(data: GenericRemittanceData): string {
  const cfg = getPayrollPdfConfig(data.countryCode).remittance;
  const lines: string[] = [];
  lines.push(`${cfg.formCode} — ${cfg.formTitle}`);
  lines.push(`Authority,${cfg.authorityName}`);
  lines.push(`Employer,${data.employerName}`);
  lines.push(`${cfg.taxIdLabel},${data.employerTaxId || ''}`);
  lines.push(`Period,${data.periodLabel}`);
  lines.push(`Due Date,${data.dueDate}`);
  lines.push('');
  lines.push('Summary');
  lines.push(`Number of Employees,${data.numberOfEmployees}`);
  lines.push(`Gross Payroll,${data.grossPayroll.toFixed(2)}`);
  let total = 0;
  cfg.rows.forEach((r) => {
    const v = resolveTotal(data, r.source);
    total += v;
    lines.push(`${r.label},${v.toFixed(2)}`);
  });
  lines.push(`Total Remittance Due,${total.toFixed(2)}`);
  lines.push('');
  lines.push('Employee Detail');
  lines.push(cfg.detailColumns.map((c) => c.label).join(','));
  data.employees.forEach((e) => {
    lines.push(
      cfg.detailColumns
        .map((c) => {
          const v = resolveDetail(e, c.source);
          if (typeof v === 'number') return v.toFixed(2);
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
  });
  return lines.join('\n');
}

export function downloadGenericRemittanceCsv(data: GenericRemittanceData): void {
  const cfg = getPayrollPdfConfig(data.countryCode).remittance;
  const csv = buildGenericRemittanceCsv(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = data.periodLabel.replace(/[^A-Za-z0-9]+/g, '-');
  a.download = `${cfg.formCode.replace(/\s+/g, '')}-${safe}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

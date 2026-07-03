import jsPDF from 'jspdf';
import { parseLocalDate } from '@/lib/utils';

export interface RemittanceEmployeeLine {
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

export interface RemittancePD7AData {
  // Header
  formCode: string; // e.g. "PD7A", "P32", "Form 941"
  authorityName: string; // "Canada Revenue Agency"
  employerName: string;
  employerAddress?: string;
  payrollAccountNumber?: string;
  businessNumber?: string;

  // Period
  periodLabel: string; // "January 2026"
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  dueDate: string;

  // Totals
  numberOfEmployees: number;
  grossPayroll: number;
  federalTax: number;
  provincialTax: number;
  cppEmployee: number;
  cppEmployer: number;
  eiEmployee: number;
  eiEmployer: number;

  // Detail
  employees: RemittanceEmployeeLine[];

  // Localization
  currencyCode: string;
  currencyLocale: string;
}

const fmtMoney = (v: number, locale: string, currency: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(v || 0);

const fmtDate = (d: string, locale: string) => {
  try {
    return parseLocalDate(d).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
};

export function generateRemittancePD7APdf(data: RemittancePD7AData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = M;

  const money = (v: number) => fmtMoney(v, data.currencyLocale, data.currencyCode);

  // Title bar
  doc.setFillColor(15, 38, 65);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Source Deductions Remittance — ${data.formCode}`, M, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.authorityName, M, 16);

  y = 28;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  // Employer block
  doc.setFont('helvetica', 'bold');
  doc.text('Employer', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.employerName, M, y + 5);
  if (data.employerAddress) {
    doc.text(data.employerAddress, M, y + 10);
  }

  // Account block (right)
  const rx = pw / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Account', rx, y);
  doc.setFont('helvetica', 'normal');
  if (data.payrollAccountNumber) {
    doc.text(`Payroll Account #: ${data.payrollAccountNumber}`, rx, y + 5);
  }
  if (data.businessNumber) {
    doc.text(`Business #: ${data.businessNumber}`, rx, y + 10);
  }

  y += 20;

  // Period banner
  doc.setFillColor(240, 244, 250);
  doc.rect(M, y, pw - 2 * M, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text(`Remittance Period: ${data.periodLabel}`, M + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${fmtDate(data.periodStart, data.currencyLocale)} – ${fmtDate(data.periodEnd, data.currencyLocale)}`,
    M + 3,
    y + 11
  );
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Due: ${fmtDate(data.dueDate, data.currencyLocale)}`,
    pw - M - 3,
    y + 6,
    { align: 'right' }
  );
  y += 20;

  // Summary stats
  doc.setFont('helvetica', 'normal');
  doc.text(`Number of employees in the period: ${data.numberOfEmployees}`, M, y);
  doc.text(`Gross payroll for the period: ${money(data.grossPayroll)}`, M, y + 5);
  y += 12;

  // Totals table
  const incomeTax = (data.federalTax || 0) + (data.provincialTax || 0);
  const total =
    incomeTax +
    data.cppEmployee +
    data.cppEmployer +
    data.eiEmployee +
    data.eiEmployer;

  const rows: Array<[string, number, boolean?]> = [
    ['Income tax (Federal + Provincial)', incomeTax],
    ['CPP — employee', data.cppEmployee],
    ['CPP — employer', data.cppEmployer],
    ['EI — employee', data.eiEmployee],
    ['EI — employer (1.4×)', data.eiEmployer],
    ['TOTAL REMITTANCE DUE', total, true],
  ];

  const tableX = M;
  const tableW = pw - 2 * M;
  const colSplit = tableX + tableW * 0.65;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  rows.forEach(([label, value, bold]) => {
    if (bold) {
      doc.setFillColor(15, 38, 65);
      doc.rect(tableX, y, tableW, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(label, tableX + 3, y + 6);
      doc.text(money(value), tableX + tableW - 3, y + 6, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      y += 9;
    } else {
      doc.line(tableX, y, tableX + tableW, y);
      doc.setFont('helvetica', 'normal');
      doc.text(label, tableX + 3, y + 5);
      doc.text(money(value), tableX + tableW - 3, y + 5, { align: 'right' });
      y += 7;
    }
  });
  doc.line(tableX, y, tableX + tableW, y);
  y += 6;

  // Employee detail
  if (data.employees.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Employee Detail', M, y);
    y += 4;

    const headers = ['Employee', 'Gross', 'Fed', 'Prov', 'CPP-EE', 'CPP-ER', 'EI-EE', 'EI-ER'];
    const colWidths = [44, 18, 16, 16, 18, 18, 16, 16];
    const startX = M;

    doc.setFillColor(230, 235, 242);
    doc.rect(startX, y, colWidths.reduce((s, w) => s + w, 0), 6, 'F');
    let cx = startX;
    doc.setFontSize(8);
    headers.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right';
      const tx = align === 'left' ? cx + 2 : cx + colWidths[i] - 2;
      doc.text(h, tx, y + 4, { align });
      cx += colWidths[i];
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    data.employees.forEach((e) => {
      if (y > ph - 25) {
        doc.addPage();
        y = M;
      }
      cx = startX;
      const cells = [
        e.name + (e.employeeNumber ? ` (${e.employeeNumber})` : ''),
        money(e.grossPay),
        money(e.federalTax),
        money(e.provincialTax),
        money(e.cppEmployee),
        money(e.cppEmployer),
        money(e.eiEmployee),
        money(e.eiEmployer),
      ];
      cells.forEach((val, i) => {
        const align = i === 0 ? 'left' : 'right';
        const tx = align === 'left' ? cx + 2 : cx + colWidths[i] - 2;
        doc.text(String(val), tx, y + 4, { align });
        cx += colWidths[i];
      });
      doc.setDrawColor(220, 220, 220);
      doc.line(startX, y + 5.5, startX + colWidths.reduce((s, w) => s + w, 0), y + 5.5);
      y += 5.5;
    });
  }

  // Footer
  const footY = ph - 12;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Submit this remittance to ${data.authorityName} by ${fmtDate(data.dueDate, data.currencyLocale)}.`,
    pw / 2,
    footY,
    { align: 'center' }
  );
  doc.text(
    'Generated by efinsuite — keep a copy with your payroll records.',
    pw / 2,
    footY + 4,
    { align: 'center' }
  );

  return doc;
}

export function downloadRemittancePD7APdf(data: RemittancePD7AData): void {
  const doc = generateRemittancePD7APdf(data);
  const safe = data.periodLabel.replace(/[^A-Za-z0-9]+/g, '-');
  doc.save(`${data.formCode}-${safe}.pdf`);
}

export function buildRemittanceCsv(data: RemittancePD7AData): string {
  const lines: string[] = [];
  lines.push(`${data.formCode} Source Deductions Remittance`);
  lines.push(`Employer,${data.employerName}`);
  lines.push(`Payroll Account #,${data.payrollAccountNumber || ''}`);
  lines.push(`Period,${data.periodLabel}`);
  lines.push(`Due Date,${data.dueDate}`);
  lines.push('');
  lines.push('Summary');
  lines.push(`Number of Employees,${data.numberOfEmployees}`);
  lines.push(`Gross Payroll,${data.grossPayroll.toFixed(2)}`);
  lines.push(`Federal Tax,${data.federalTax.toFixed(2)}`);
  lines.push(`Provincial Tax,${data.provincialTax.toFixed(2)}`);
  lines.push(`CPP Employee,${data.cppEmployee.toFixed(2)}`);
  lines.push(`CPP Employer,${data.cppEmployer.toFixed(2)}`);
  lines.push(`EI Employee,${data.eiEmployee.toFixed(2)}`);
  lines.push(`EI Employer,${data.eiEmployer.toFixed(2)}`);
  const total =
    data.federalTax +
    data.provincialTax +
    data.cppEmployee +
    data.cppEmployer +
    data.eiEmployee +
    data.eiEmployer;
  lines.push(`Total Remittance Due,${total.toFixed(2)}`);
  lines.push('');
  lines.push('Employee Detail');
  lines.push('Employee,Employee #,Gross,Federal Tax,Provincial Tax,CPP-EE,CPP-ER,EI-EE,EI-ER');
  data.employees.forEach((e) => {
    lines.push(
      [
        `"${e.name.replace(/"/g, '""')}"`,
        e.employeeNumber || '',
        e.grossPay.toFixed(2),
        e.federalTax.toFixed(2),
        e.provincialTax.toFixed(2),
        e.cppEmployee.toFixed(2),
        e.cppEmployer.toFixed(2),
        e.eiEmployee.toFixed(2),
        e.eiEmployer.toFixed(2),
      ].join(',')
    );
  });
  return lines.join('\n');
}

export function downloadRemittanceCsv(data: RemittancePD7AData): void {
  const csv = buildRemittanceCsv(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = data.periodLabel.replace(/[^A-Za-z0-9]+/g, '-');
  a.download = `${data.formCode}-${safe}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

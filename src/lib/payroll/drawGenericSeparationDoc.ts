import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { RoERecord } from '@/hooks/useRoeRecords';
import { parseLocalDate } from '@/lib/utils';
import { getPayrollPdfConfig } from './slipFieldMapping';

export interface GenericSeparationDocData {
  roe: RoERecord;
  countryCode: string;
  employerName: string;
  employerTaxId?: string;
  currencyCode: string;
  currencyLocale: string;
}

const REASON_LABELS: Record<string, string> = {
  A: 'Shortage of work',
  B: 'Strike or lockout',
  D: 'Illness or injury',
  E: 'Resignation / Quit',
  F: 'Maternity',
  G: 'Retirement',
  H: 'Work-sharing',
  J: 'Apprentice training',
  K: 'Other',
  M: 'Dismissal / Termination',
  N: 'Leave of absence',
  P: 'Parental',
  Z: 'Compassionate care / Family caregiver',
};

export function generateGenericSeparationDocPdf(data: GenericSeparationDocData): void {
  const cfg = getPayrollPdfConfig(data.countryCode).separation;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pw = doc.internal.pageSize.getWidth();
  const M = 15;

  const money = (v: number) =>
    new Intl.NumberFormat(data.currencyLocale, {
      style: 'currency',
      currency: data.currencyCode,
      minimumFractionDigits: 2,
    }).format(v || 0);

  const fmtDate = (d: string) => {
    try { return format(parseLocalDate(d), 'MMMM d, yyyy'); } catch { return d; }
  };

  const emp = data.roe.employees;
  const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : 'Employee';
  const today = format(new Date(), 'MMMM d, yyyy');

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(cfg.docTitle.toUpperCase(), pw / 2, 22, { align: 'center' });
  if (cfg.authorityLine) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(cfg.authorityLine, pw / 2, 28, { align: 'center' });
  }

  let y = 42;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${today}`, pw - M, y, { align: 'right' });
  doc.text(`Reference: ${data.roe.roe_serial || cfg.docCode + '-DRAFT'}`, M, y);

  y += 12;

  // Employer block
  doc.setFont('helvetica', 'bold');
  doc.text('Issued by:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.employerName, M + 24, y);
  if (data.employerTaxId) {
    y += 5;
    doc.text(`Tax ID / Registration: ${data.employerTaxId}`, M + 24, y);
  }

  y += 12;

  // Salutation / employee identification
  doc.setFont('helvetica', 'bold');
  doc.text('Employee:', M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${empName}   (# ${emp?.employee_number || ''})`, M + 24, y);
  y += 6;
  const empAddr = [
    emp?.address_line1,
    emp?.address_line2,
    [emp?.city, emp?.province, emp?.postal_code].filter(Boolean).join(' '),
    emp?.country,
  ].filter(Boolean);
  empAddr.forEach((line) => {
    doc.text(String(line), M + 24, y);
    y += 5;
  });

  y += 6;

  // Body paragraph
  doc.setFont('helvetica', 'normal');
  const body =
    `This ${cfg.docTitle.toLowerCase()} certifies that the above-named employee ` +
    `was employed by ${data.employerName} from ${fmtDate(data.roe.first_day_worked)} ` +
    `to ${fmtDate(data.roe.last_day_paid)}.`;
  const bodyLines = doc.splitTextToSize(body, pw - 2 * M);
  doc.text(bodyLines, M, y);
  y += bodyLines.length * 5 + 6;

  // Reason
  doc.setFont('helvetica', 'bold');
  doc.text(`${cfg.reasonLabel}:`, M, y);
  doc.setFont('helvetica', 'normal');
  const reason = REASON_LABELS[data.roe.reason_code] || data.roe.reason_code;
  doc.text(`${data.roe.reason_code} — ${reason}`, M + 60, y);
  y += 10;

  // Hours block (CA-only concept, but useful reference)
  if (cfg.sections.hoursBlock) {
    doc.rect(M, y, (pw - 2 * M) / 2 - 2, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Insurable hours', M + 3, y + 5);
    doc.setFontSize(13);
    doc.text(`${(data.roe.total_insurable_hours || 0).toFixed(1)}`, M + 3, y + 13);
    doc.setFontSize(10);
  }

  if (cfg.sections.earningsBlock) {
    const rx = M + (pw - 2 * M) / 2 + 2;
    doc.rect(rx, y, (pw - 2 * M) / 2 - 2, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Total insurable earnings', rx + 3, y + 5);
    doc.setFontSize(13);
    doc.text(money(data.roe.total_insurable_earnings || 0), rx + 3, y + 13);
    doc.setFontSize(10);
  }
  y += 24;

  // Comments
  if (data.roe.comments) {
    doc.setFont('helvetica', 'bold');
    doc.text('Comments:', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const cl = doc.splitTextToSize(data.roe.comments, pw - 2 * M);
    doc.text(cl.slice(0, 6), M, y);
    y += Math.min(cl.length, 6) * 5 + 4;
  }

  // Signature block
  if (cfg.sections.signatureBlock) {
    y = Math.max(y, 220);
    doc.setDrawColor(150);
    doc.line(M, y, M + 70, y);
    doc.line(pw - M - 70, y, pw - M, y);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Authorized signatory', M, y + 5);
    doc.text('Date', pw - M - 70, y + 5);
    doc.setTextColor(0);
    doc.setFontSize(10);
  }

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text('Generated by eFinsuite Globe  |  info@efintax.biz', pw / 2, ph - 10, { align: 'center' });
  doc.text(`Status: ${data.roe.status?.toUpperCase() || 'DRAFT'}`, pw / 2, ph - 6, { align: 'center' });

  const filename = `${cfg.docCode}_${data.roe.roe_serial || 'draft'}_${emp?.last_name || 'Employee'}.pdf`;
  doc.save(filename);
}

import jsPDF from 'jspdf';
import type { RoERecord } from '@/hooks/useRoeRecords';
import { ROE_REASON_CODES } from '@/types/payroll';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface RoePdfData {
  roe: RoERecord;
  employerName: string;
  employerBn?: string;
}

export function generateRoePdf(data: RoePdfData): void {
  const { roe, employerName, employerBn } = data;
  const doc = new jsPDF();
  
  const formatCurrency = (value: number | undefined | null): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(value || 0);
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(parseLocalDate(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RECORD OF EMPLOYMENT', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Employment Insurance', 105, 28, { align: 'center' });

  // ROE Serial
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Serial Number: ${roe.roe_serial || 'PENDING'}`, 195, 20, { align: 'right' });

  // Employer Section
  let yPos = 45;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(15, yPos - 5, 180, 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 1 - EMPLOYER INFORMATION', 17, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  yPos += 8;
  doc.text(`Business Name: ${employerName}`, 17, yPos);
  if (employerBn) {
    doc.text(`Business Number: ${employerBn}`, 120, yPos);
  }

  // Employee Section
  yPos = 75;
  doc.rect(15, yPos - 5, 180, 38);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 2 - EMPLOYEE INFORMATION', 17, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  yPos += 8;
  const empName = roe.employees 
    ? `${roe.employees.first_name} ${roe.employees.last_name}`
    : 'Employee';
  doc.text(`Name: ${empName}`, 17, yPos);
  doc.text(`Employee #: ${roe.employees?.employee_number || ''}`, 120, yPos);
  
  yPos += 7;
  const empAddress = [
    roe.employees?.address_line1,
    roe.employees?.address_line2,
    [roe.employees?.city, roe.employees?.province, roe.employees?.postal_code].filter(Boolean).join(', '),
  ].filter(Boolean).join(', ');
  if (empAddress) {
    doc.text(`Address: ${empAddress.substring(0, 80)}`, 17, yPos);
    yPos += 7;
  }
  doc.text(`Province of Employment: ${roe.employees?.province || ''}`, 17, yPos);

  // Period of Employment
  yPos = 115;
  doc.rect(15, yPos - 5, 180, 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 3 - PERIOD OF EMPLOYMENT', 17, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  yPos += 8;
  doc.text(`First Day Worked: ${formatDate(roe.first_day_worked)}`, 17, yPos);
  doc.text(`Last Day for Which Paid: ${formatDate(roe.last_day_paid)}`, 100, yPos);

  // Reason for ROE
  yPos = 150;
  doc.rect(15, yPos - 5, 180, 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 4 - REASON FOR ISSUING THIS ROE', 17, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  yPos += 8;
  const reasonDesc = ROE_REASON_CODES[roe.reason_code] || 'Unknown';
  doc.text(`Code ${roe.reason_code}: ${reasonDesc}`, 17, yPos);

  // Insurable Hours and Earnings
  yPos = 180;
  doc.rect(15, yPos - 5, 90, 35);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 5 - INSURABLE HOURS', 17, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  yPos += 12;
  doc.text(`${roe.total_insurable_hours.toFixed(1)} hours`, 17, yPos);

  yPos = 180;
  doc.rect(105, yPos - 5, 90, 35);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 6 - INSURABLE EARNINGS', 107, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  yPos += 12;
  doc.text(formatCurrency(roe.total_insurable_earnings), 107, yPos);

  // Pay Period Type
  yPos = 225;
  doc.rect(15, yPos - 5, 180, 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOCK 7 - PAY PERIOD TYPE', 17, yPos);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  yPos += 8;
  const payPeriodLabels: Record<string, string> = {
    weekly: 'Weekly',
    bi_weekly: 'Bi-Weekly',
    semi_monthly: 'Semi-Monthly',
    monthly: 'Monthly',
  };
  doc.text(payPeriodLabels[roe.pay_period_type] || roe.pay_period_type, 17, yPos);

  // Comments
  if (roe.comments) {
    yPos = 255;
    doc.rect(15, yPos - 5, 180, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('COMMENTS', 17, yPos);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    yPos += 8;
    doc.text(roe.comments.substring(0, 100), 17, yPos);
  }

  // Footer with branding
  let footerY = 260;
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Powered By:', 105, footerY, { align: 'center' });
  footerY += 4;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('eFinsuite Globe', 105, footerY, { align: 'center' });
  footerY += 4;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('For more information or clarification email: info@efintax.biz', 105, footerY, { align: 'center' });
  footerY += 5;
  
  doc.setFontSize(8);
  doc.text(`Status: ${roe.status?.toUpperCase() || 'DRAFT'}`, 15, footerY);
  doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, 195, footerY, { align: 'right' });

  // Save
  const fileName = `ROE_${roe.roe_serial || 'draft'}_${roe.employees?.last_name || 'Employee'}.pdf`;
  doc.save(fileName);
}

export function downloadRoePdf(roe: RoERecord, organizationName: string): void {
  generateRoePdf({
    roe,
    employerName: organizationName,
  });
}

// Country-aware dispatcher — CA keeps the ROE layout; other countries produce
// a country-appropriate separation document (Certificate of Service, P45,
// Attestation de Travail, Termination Letter, Separation Notice…).
import { generateGenericSeparationDocPdf } from './payroll/drawGenericSeparationDoc';
import { getPayrollLocalization } from '@/data/payrollLocalization';

export function downloadSeparationDocPdf(
  roe: RoERecord,
  organization: any,
  countryCode: string,
): void {
  const cc = (countryCode || 'CA').toUpperCase();
  if (cc === 'CA') {
    downloadRoePdf(roe, organization?.name || 'Employer');
    return;
  }
  const loc = getPayrollLocalization(cc);
  generateGenericSeparationDocPdf({
    roe,
    countryCode: cc,
    employerName: organization?.legal_name || organization?.name || 'Employer',
    employerTaxId:
      organization?.tax_identification_number ||
      organization?.business_number ||
      organization?.payroll_account_number,
    currencyCode: loc.currencyCode,
    currencyLocale: loc.currencyLocale,
  });
}


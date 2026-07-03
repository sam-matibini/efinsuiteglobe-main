import jsPDF from 'jspdf';
import { parseLocalDate } from '@/lib/utils';

export interface PayStubData {
  // Employee Info
  employeeName: string;
  employeeNumber: string;
  department?: string;
  province: string;
  employeeAddress?: string;
  
  // Pay Period Info
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  
  // Earnings
  regularHours: number;
  regularEarnings: number;
  overtimeHours: number;
  overtimeEarnings: number;
  vacationHours: number;
  vacationPay: number;
  sickHours: number;
  bonus: number;
  commission: number;
  otherEarnings: number;
  grossPay: number;
  
  // Deductions
  cppContribution: number;
  eiPremium: number;
  federalTax: number;
  provincialTax: number;
  otherDeductions: number;
  totalDeductions: number;
  
  // Net Pay
  netPay: number;
  
  // YTD
  ytdGross: number;
  ytdCpp: number;
  ytdEi: number;
  ytdFederalTax: number;
  ytdProvincialTax: number;
  
  // Company Info
  companyName?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
};

const formatDate = (dateStr: string): string => {
  return parseLocalDate(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function generatePayStubPdf(data: PayStubData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;
  const leftMargin = 15;
  const rightCol = pageWidth / 2 + 10;
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName || 'Pay Statement', pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('EMPLOYEE PAY STUB', pageWidth / 2, y, { align: 'center' });
  
  // Divider
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(leftMargin, y, pageWidth - leftMargin, y);
  
  // Employee & Pay Period Info
  y += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE INFORMATION', leftMargin, y);
  doc.text('PAY PERIOD', rightCol, y);
  
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${data.employeeName}`, leftMargin, y);
  doc.text(`Period: ${formatDate(data.payPeriodStart)} - ${formatDate(data.payPeriodEnd)}`, rightCol, y);
  
  y += 5;
  doc.text(`Employee #: ${data.employeeNumber}`, leftMargin, y);
  doc.text(`Pay Date: ${formatDate(data.payDate)}`, rightCol, y);
  
  y += 5;
  doc.text(`Province: ${data.province}`, leftMargin, y);
  if (data.department) {
    doc.text(`Department: ${data.department}`, rightCol, y);
  }
  
  if (data.employeeAddress) {
    y += 5;
    doc.text(`Address: ${data.employeeAddress}`, leftMargin, y);
  }
  
  // Earnings Section
  y += 12;
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, y - 4, pageWidth - leftMargin * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('EARNINGS', leftMargin + 2, y);
  doc.text('Hours', pageWidth / 2 - 20, y, { align: 'right' });
  doc.text('Current', pageWidth / 2 + 30, y, { align: 'right' });
  
  y += 8;
  doc.setFont('helvetica', 'normal');
  
  const addEarningsLine = (label: string, hours: number | null, amount: number) => {
    if (amount > 0 || (hours && hours > 0)) {
      doc.text(label, leftMargin + 2, y);
      if (hours !== null) {
        doc.text(hours.toFixed(2), pageWidth / 2 - 20, y, { align: 'right' });
      }
      doc.text(formatCurrency(amount), pageWidth / 2 + 30, y, { align: 'right' });
      y += 5;
    }
  };
  
  addEarningsLine('Regular Earnings', data.regularHours, data.regularEarnings);
  addEarningsLine('Overtime Earnings', data.overtimeHours, data.overtimeEarnings);
  addEarningsLine('Vacation Pay', data.vacationHours, data.vacationPay);
  if (data.sickHours > 0) {
    addEarningsLine('Sick Pay', data.sickHours, 0);
  }
  addEarningsLine('Bonus', null, data.bonus);
  addEarningsLine('Commission', null, data.commission);
  addEarningsLine('Other Earnings', null, data.otherEarnings);
  
  // Gross Pay
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('GROSS PAY', leftMargin + 2, y);
  doc.text(formatCurrency(data.grossPay), pageWidth / 2 + 30, y, { align: 'right' });
  
  // Deductions Section
  y += 10;
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, y - 4, pageWidth - leftMargin * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('DEDUCTIONS', leftMargin + 2, y);
  doc.text('Current', pageWidth / 2 + 30, y, { align: 'right' });
  doc.text('YTD', pageWidth - leftMargin - 5, y, { align: 'right' });
  
  y += 8;
  doc.setFont('helvetica', 'normal');
  
  const addDeductionLine = (label: string, current: number, ytd: number) => {
    if (current > 0 || ytd > 0) {
      doc.text(label, leftMargin + 2, y);
      doc.text(formatCurrency(current), pageWidth / 2 + 30, y, { align: 'right' });
      doc.text(formatCurrency(ytd), pageWidth - leftMargin - 5, y, { align: 'right' });
      y += 5;
    }
  };
  
  addDeductionLine('CPP Contribution', data.cppContribution, data.ytdCpp);
  addDeductionLine('EI Premium', data.eiPremium, data.ytdEi);
  addDeductionLine('Federal Tax', data.federalTax, data.ytdFederalTax);
  addDeductionLine('Provincial Tax', data.provincialTax, data.ytdProvincialTax);
  if (data.otherDeductions > 0) {
    addDeductionLine('Other Deductions', data.otherDeductions, 0);
  }
  
  // Total Deductions
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DEDUCTIONS', leftMargin + 2, y);
  doc.text(formatCurrency(data.totalDeductions), pageWidth / 2 + 30, y, { align: 'right' });
  
  // Net Pay Section
  y += 12;
  doc.setFillColor(220, 240, 220);
  doc.rect(leftMargin, y - 4, pageWidth - leftMargin * 2, 10, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('NET PAY', leftMargin + 2, y + 2);
  doc.text(formatCurrency(data.netPay), pageWidth - leftMargin - 5, y + 2, { align: 'right' });
  
  // YTD Summary
  y += 18;
  doc.setFontSize(9);
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, y - 4, pageWidth - leftMargin * 2, 7, 'F');
  doc.text('YEAR-TO-DATE SUMMARY', leftMargin + 2, y);
  
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`YTD Gross Earnings: ${formatCurrency(data.ytdGross)}`, leftMargin + 2, y);
  
  y += 5;
  const ytdTotalDeductions = data.ytdCpp + data.ytdEi + data.ytdFederalTax + data.ytdProvincialTax;
  doc.text(`YTD Total Deductions: ${formatCurrency(ytdTotalDeductions)}`, leftMargin + 2, y);
  
  y += 5;
  doc.text(`YTD Net Pay: ${formatCurrency(data.ytdGross - ytdTotalDeductions)}`, leftMargin + 2, y);
  
  // Footer with branding
  y = doc.internal.pageSize.getHeight() - 30;
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Powered By:', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text('eFinsuite Globe', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  doc.setFontSize(6);
  doc.setTextColor(128, 128, 128);
  doc.text('This is an official pay statement. Please retain for your records.', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth / 2, y, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  return doc;
}

export function downloadPayStubPdf(data: PayStubData, filename?: string): void {
  const doc = generatePayStubPdf(data);
  const defaultFilename = `paystub_${data.employeeNumber}_${data.payDate}.pdf`;
  doc.save(filename || defaultFilename);
}

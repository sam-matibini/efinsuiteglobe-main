import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { generateInvoicePdfDoc } from '@/lib/generateInvoicePdf';
import { generatePayStubPdf, type PayStubData } from '@/lib/generatePayStubPdf';
import { parseLocalDate } from '@/lib/utils';

export type CommunicationDocType = 'invoice' | 'bill_of_sale' | 'bill' | 'paystub';

export interface CommunicationDocRef {
  id: string;
  type: CommunicationDocType;
  // For paystubs we need both pay_stub id and employee id
  employeeId?: string;
}

export interface BuiltAttachment {
  url: string;
  filename: string;
  mimeType: string;
}

const fmtCurrency = (n: number, currency = 'CAD', locale = 'en-CA') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n || 0);

const fmtDate = (d: string) => parseLocalDate(d).toLocaleDateString('en-CA');

/**
 * Build a PDF for an invoice or bill of sale and return as Blob.
 */
async function buildInvoiceBlob(invoiceId: string, organization: any): Promise<{ blob: Blob; filename: string }> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(*)')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error || !invoice) throw new Error('Invoice not found');

  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('line_order', { ascending: true });

  const customer: any = (invoice as any).customer || {};

  const doc = await generateInvoicePdfDoc({
    invoiceNumber: (invoice as any).invoice_number,
    invoiceDate: fmtDate((invoice as any).invoice_date),
    dueDate: fmtDate((invoice as any).due_date),
    status: (invoice as any).status,
    documentTitle: (invoice as any).document_title || 'Invoice',
    customerName: customer?.name || 'Unknown Customer',
    customerEmail: customer?.email || undefined,
    customerAddress: customer?.address_line1 || undefined,
    customerCity: customer?.city || undefined,
    customerProvince: customer?.province || undefined,
    customerPostalCode: customer?.postal_code || undefined,
    customerCountry: customer?.country || undefined,
    customerPhone: customer?.phone || undefined,
    buyerName: (invoice as any).buyer_name || undefined,
    buyerEmail: (invoice as any).buyer_email || undefined,
    buyerPhone: (invoice as any).buyer_phone || undefined,
    buyerAddressLine1: (invoice as any).buyer_address_line1 || undefined,
    buyerAddressLine2: (invoice as any).buyer_address_line2 || undefined,
    buyerCity: (invoice as any).buyer_city || undefined,
    buyerProvince: (invoice as any).buyer_province || undefined,
    buyerPostalCode: (invoice as any).buyer_postal_code || undefined,
    buyerCountry: (invoice as any).buyer_country || undefined,
    lines: (lines || []).map((l: any) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      amount: Number(l.amount),
      taxRate: l.tax_rate != null ? Number(l.tax_rate) : undefined,
      taxAmount: l.tax_amount != null ? Number(l.tax_amount) : undefined,
      notes: l.notes || undefined,
    })),
    subtotal: Number((invoice as any).subtotal),
    taxAmount: Number((invoice as any).tax_amount),
    gstHstAmount: (invoice as any).gst_hst_amount != null ? Number((invoice as any).gst_hst_amount) : undefined,
    pstAmount: (invoice as any).pst_amount != null ? Number((invoice as any).pst_amount) : undefined,
    total: Number((invoice as any).total),
    amountPaid: Number((invoice as any).amount_paid),
    balanceDue: Number((invoice as any).balance_due),
    notes: (invoice as any).notes || undefined,
    terms: (invoice as any).terms || undefined,
    organizationName: organization?.name,
    organizationAddress: organization?.address_line1 || undefined,
    organizationCity: organization?.city || undefined,
    organizationProvince: organization?.province || undefined,
    organizationPostalCode: organization?.postal_code || undefined,
    organizationCountry: organization?.country || undefined,
    organizationPhone: organization?.phone || undefined,
    organizationEmail: organization?.email || undefined,
    organizationWebsite: organization?.website || undefined,
    logoUrl: organization?.logo_url || undefined,
    currency: organization?.currency || 'CAD',
  });

  const blob = doc.output('blob') as Blob;
  const isBoS = ((invoice as any).document_title || '').toLowerCase().includes('bill of sale');
  const prefix = isBoS ? 'BillOfSale' : 'Invoice';
  return { blob, filename: `${prefix}-${(invoice as any).invoice_number}.pdf` };
}

/**
 * Build a simple PDF for a vendor bill.
 */
async function buildBillBlob(billId: string, organization: any): Promise<{ blob: Blob; filename: string }> {
  const { data: bill, error } = await supabase
    .from('bills')
    .select('*, vendor:vendors(*)')
    .eq('id', billId)
    .maybeSingle();
  if (error || !bill) throw new Error('Bill not found');

  const { data: lines } = await supabase
    .from('bill_lines')
    .select('*')
    .eq('bill_id', billId)
    .order('line_order', { ascending: true });

  const vendor: any = (bill as any).vendor || {};
  const currency = organization?.currency || 'CAD';

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Header
  doc.setFontSize(16).setFont('helvetica', 'bold');
  doc.text(organization?.name || 'Organization', 14, y);
  doc.setFontSize(20);
  doc.text('BILL', pageWidth - 14, y, { align: 'right' });
  y += 7;

  doc.setFontSize(9).setFont('helvetica', 'normal');
  const orgLines = [
    organization?.address_line1,
    [organization?.city, organization?.province, organization?.postal_code].filter(Boolean).join(', '),
    organization?.email,
    organization?.phone,
  ].filter(Boolean);
  orgLines.forEach((line: string) => {
    doc.text(line, 14, y);
    y += 4;
  });

  y += 4;
  // Meta
  doc.setFont('helvetica', 'bold').text('Bill #:', pageWidth - 60, y);
  doc.setFont('helvetica', 'normal').text(String((bill as any).bill_number || ''), pageWidth - 14, y, { align: 'right' });
  y += 5;
  doc.setFont('helvetica', 'bold').text('Date:', pageWidth - 60, y);
  doc.setFont('helvetica', 'normal').text(fmtDate((bill as any).bill_date), pageWidth - 14, y, { align: 'right' });
  y += 5;
  if ((bill as any).due_date) {
    doc.setFont('helvetica', 'bold').text('Due:', pageWidth - 60, y);
    doc.setFont('helvetica', 'normal').text(fmtDate((bill as any).due_date), pageWidth - 14, y, { align: 'right' });
    y += 5;
  }
  doc.setFont('helvetica', 'bold').text('Status:', pageWidth - 60, y);
  doc.setFont('helvetica', 'normal').text(String((bill as any).status || ''), pageWidth - 14, y, { align: 'right' });
  y += 8;

  // Vendor block
  doc.setFont('helvetica', 'bold').text('Vendor:', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal').text(vendor?.name || 'Unknown', 14, y);
  y += 5;
  if (vendor?.email) { doc.text(vendor.email, 14, y); y += 5; }
  if (vendor?.phone) { doc.text(vendor.phone, 14, y); y += 5; }

  y += 4;

  // Lines table
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Amount']],
    body: (lines || []).map((l: any) => [
      l.description,
      Number(l.quantity).toString(),
      fmtCurrency(Number(l.unit_price), currency),
      l.tax_amount != null ? fmtCurrency(Number(l.tax_amount), currency) : '-',
      fmtCurrency(Number(l.amount), currency),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 40, 40] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  let ty = finalY + 8;
  const labelX = pageWidth - 70;
  const valX = pageWidth - 14;

  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', labelX, ty);
  doc.text(fmtCurrency(Number((bill as any).subtotal), currency), valX, ty, { align: 'right' });
  ty += 5;
  doc.text('Tax:', labelX, ty);
  doc.text(fmtCurrency(Number((bill as any).tax_amount), currency), valX, ty, { align: 'right' });
  ty += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', labelX, ty);
  doc.text(fmtCurrency(Number((bill as any).total), currency), valX, ty, { align: 'right' });
  ty += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Balance Due:', labelX, ty);
  doc.text(fmtCurrency(Number((bill as any).balance_due), currency), valX, ty, { align: 'right' });

  if ((bill as any).notes) {
    ty += 10;
    doc.setFont('helvetica', 'bold').text('Notes:', 14, ty);
    ty += 5;
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(String((bill as any).notes), pageWidth - 28);
    doc.text(noteLines, 14, ty);
  }

  const blob = doc.output('blob') as Blob;
  return { blob, filename: `Bill-${(bill as any).bill_number}.pdf` };
}

/**
 * Build a paystub PDF.
 */
async function buildPaystubBlob(payStubId: string, employeeId: string, organization: any): Promise<{ blob: Blob; filename: string }> {
  const { data: stub, error: sErr } = await supabase
    .from('pay_stubs')
    .select('*')
    .eq('id', payStubId)
    .maybeSingle();
  if (sErr || !stub) throw new Error('Pay stub not found');

  const { data: payRun, error: prErr } = await supabase
    .from('pay_runs')
    .select('pay_period_start, pay_period_end, pay_date, status')
    .eq('id', (stub as any).pay_run_id)
    .maybeSingle();
  if (prErr || !payRun) throw new Error('Pay run not found');

  const { data: employee, error: eErr } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle();
  if (eErr || !employee) throw new Error('Employee not found');

  const data: PayStubData = {
    employeeName: `${(employee as any).first_name} ${(employee as any).last_name}`,
    employeeNumber: (employee as any).employee_number,
    department: (employee as any).department || undefined,
    province: (employee as any).province || 'ON',
    employeeAddress: [
      (employee as any).address_line1,
      (employee as any).address_line2,
      [(employee as any).city, (employee as any).province, (employee as any).postal_code].filter(Boolean).join(', '),
    ].filter(Boolean).join(', ') || undefined,
    payPeriodStart: (payRun as any).pay_period_start,
    payPeriodEnd: (payRun as any).pay_period_end,
    payDate: (payRun as any).pay_date,
    regularHours: (stub as any).regular_hours || 0,
    regularEarnings: (stub as any).regular_earnings || 0,
    overtimeHours: (stub as any).overtime_hours || 0,
    overtimeEarnings: (stub as any).overtime_earnings || 0,
    vacationHours: (stub as any).vacation_hours || 0,
    vacationPay: (stub as any).vacation_pay || 0,
    sickHours: (stub as any).sick_hours || 0,
    bonus: (stub as any).bonus || 0,
    commission: (stub as any).commission || 0,
    otherEarnings: (stub as any).other_earnings || 0,
    grossPay: (stub as any).gross_pay || 0,
    cppContribution: (stub as any).cpp_contribution || 0,
    eiPremium: (stub as any).ei_premium || 0,
    federalTax: (stub as any).federal_tax || 0,
    provincialTax: (stub as any).provincial_tax || 0,
    otherDeductions: (stub as any).other_deductions || 0,
    totalDeductions: (stub as any).total_deductions || 0,
    netPay: (stub as any).net_pay || 0,
    ytdGross: (stub as any).ytd_gross || 0,
    ytdCpp: (stub as any).ytd_cpp || 0,
    ytdEi: (stub as any).ytd_ei || 0,
    ytdFederalTax: (stub as any).ytd_federal_tax || 0,
    ytdProvincialTax: (stub as any).ytd_provincial_tax || 0,
    companyName: organization?.name || undefined,
  };

  const doc = generatePayStubPdf(data);
  const blob = doc.output('blob') as Blob;
  const safeName = data.employeeName.replace(/[^a-z0-9]+/gi, '_');
  return { blob, filename: `Paystub-${safeName}-${data.payDate}.pdf` };
}

/**
 * Build the document PDF, upload to storage, return public URL + metadata.
 */
export async function buildAndUploadDocumentPdf(
  ref: CommunicationDocRef,
  channel: 'email' | 'sms' | 'whatsapp',
  organization: any
): Promise<BuiltAttachment> {
  let built: { blob: Blob; filename: string };

  switch (ref.type) {
    case 'invoice':
    case 'bill_of_sale':
      built = await buildInvoiceBlob(ref.id, organization);
      break;
    case 'bill':
      built = await buildBillBlob(ref.id, organization);
      break;
    case 'paystub':
      if (!ref.employeeId) throw new Error('Missing employee for paystub');
      built = await buildPaystubBlob(ref.id, ref.employeeId, organization);
      break;
    default:
      throw new Error('Unsupported document type');
  }

  const folder = channel === 'email' ? 'email-attachments' : 'mms-attachments';
  const path = `${folder}/${Date.now()}-${built.filename}`;

  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(path, built.blob, { upsert: true, contentType: 'application/pdf' });
  if (upErr) throw upErr;

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('Failed to resolve public URL');

  return {
    url: urlData.publicUrl,
    filename: built.filename,
    mimeType: 'application/pdf',
  };
}

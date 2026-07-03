import jsPDF from 'jspdf';
import type { TaxSlip } from '@/hooks/useTaxSlips';

interface T4PdfData {
  slip: TaxSlip;
  employerName: string;
  employerBn?: string;
  employerAddress?: string;
  employerAccountNumber?: string;
}

/**
 * Generate a CRA-compliant T4 Statement of Remuneration Paid PDF
 * Layout matches the official CRA T4 slip format with bilingual labels
 */
export function generateT4Pdf(data: T4PdfData): void {
  const { slip, employerName, employerBn, employerAddress, employerAccountNumber } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pw = doc.internal.pageSize.getWidth();

  const fmt = (v: number | undefined | null): string => {
    const num = v || 0;
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${parts[0]} ${parts[1]}`;
  };

  

  // ==================== COPY 1: Employer / CRA Copy ====================
  drawT4Copy(doc, slip, employerName, employerAddress, employerBn, employerAccountNumber, 10, 'Employer\'s copy / Pour l\'employeur', fmt);

  // ==================== COPY 2: Employee / Recipient Copy ====================
  const copy2Y = 145;
  drawT4Copy(doc, slip, employerName, employerAddress, employerBn, employerAccountNumber, copy2Y, 'Recipient / Bénéficiaire', fmt);

  // Footer with branding
  const footY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('Powered By: eFinsuite Globe  |  info@efintax.biz', pw / 2, footY, { align: 'center' });
  doc.setFontSize(6);
  doc.text('This is an official T4 slip. Keep this document for your tax records.', pw / 2, footY + 4, { align: 'center' });
  if (slip.status) {
    doc.text(`Status: ${slip.status.toUpperCase()}${slip.issued_date ? '  |  Issued: ' + slip.issued_date : ''}`, pw / 2, footY + 8, { align: 'center' });
  }

  // Save
  const lastName = slip.employees?.last_name || 'Employee';
  const firstName = slip.employees?.first_name || '';
  doc.save(`T4_${slip.tax_year}_${lastName}_${firstName}.pdf`);
}

function drawT4Copy(
  doc: jsPDF,
  slip: TaxSlip,
  employerName: string,
  employerAddress: string | undefined,
  employerBn: string | undefined,
  employerAccountNumber: string | undefined,
  startY: number,
  copyLabel: string,
  fmt: (v: number | undefined | null) => string
) {
  const lm = 12; // left margin
  const pw = doc.internal.pageSize.getWidth();
  const contentW = pw - lm * 2;
  let y = startY;

  // ---- Top header bar ----
  doc.setFillColor(0, 0, 0);
  doc.rect(lm, y, contentW, 6, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`T4 (${String(slip.tax_year).slice(-2)})`, lm + 2, y + 4.2);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Protected B when completed / Protégé B une fois rempli', lm + 25, y + 4.2);
  doc.setTextColor(0, 0, 0);
  y += 7;

  // ---- Employer section + Year/Agency ----
  const empBoxH = 22;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // Employer name box
  const col1W = contentW * 0.48;
  const col2W = contentW * 0.26;
  const col3W = contentW * 0.26;
  doc.rect(lm, y, col1W, empBoxH);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text("Employer's name – Nom de l'employeur", lm + 1, y + 3);
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(employerName, lm + 1, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  if (employerAddress) {
    const addrLines = doc.splitTextToSize(employerAddress, col1W - 4);
    doc.text(addrLines, lm + 1, y + 12);
  }

  // Year box
  doc.rect(lm + col1W, y, col2W, empBoxH / 2);
  doc.setFontSize(5.5);
  doc.setTextColor(100);
  doc.text('Year / Année', lm + col1W + 1, y + 3);
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(String(slip.tax_year), lm + col1W + col2W / 2, y + 9, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  // Agency box
  doc.rect(lm + col1W + col2W, y, col3W, empBoxH / 2);
  doc.setFontSize(5);
  doc.setTextColor(100);
  doc.text('Canada Revenue Agency', lm + col1W + col2W + 1, y + 3.5);
  doc.text('Agence du revenu du Canada', lm + col1W + col2W + 1, y + 7);
  doc.setTextColor(0);

  // Statement title + dental benefits
  doc.rect(lm + col1W, y + empBoxH / 2, col2W, empBoxH / 2);
  doc.setFontSize(5);
  doc.setTextColor(100);
  doc.text('Statement of Remuneration Paid', lm + col1W + 1, y + empBoxH / 2 + 3.5);
  doc.text("État de la rémunération payée", lm + col1W + 1, y + empBoxH / 2 + 7);
  doc.setTextColor(0);

  doc.rect(lm + col1W + col2W, y + empBoxH / 2, col3W, empBoxH / 2);
  doc.setFontSize(5);
  doc.setTextColor(100);
  doc.text('Employer-offered dental benefits', lm + col1W + col2W + 1, y + empBoxH / 2 + 3.5);
  doc.text("Prestations dentaires offertes par l'empl.", lm + col1W + col2W + 1, y + empBoxH / 2 + 7);
  if (slip.dental_benefits_code) {
    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.text(slip.dental_benefits_code, lm + col1W + col2W + col3W - 3, y + empBoxH / 2 + 9, { align: 'right' });
  }
  doc.setTextColor(0);

  y += empBoxH + 0.5;

  // ---- Main T4 boxes grid ----
  const boxH = 10;
  const halfW = contentW / 2;
  const boxConfigs = [
    // Row 1: Employment income (14) | Income tax deducted (22)
    [
      { box: '14', labelEn: 'Employment income', labelFr: 'Revenus d\'emploi', value: fmt(slip.box_14_employment_income) },
      { box: '22', labelEn: 'Income tax deducted', labelFr: 'Impôt sur le revenu retenu', value: fmt(slip.box_22_income_tax_deducted) },
    ],
    // Row 2: Employer account # (54) | Province of employment (10)
    [
      { box: '54', labelEn: "Employer's account number", labelFr: "Numéro de compte de l'employeur", value: employerAccountNumber || employerBn || '' },
      { box: '10', labelEn: 'Province of employment', labelFr: "Province d'emploi", value: slip.province_of_employment || slip.employees?.province || '' },
    ],
    // Row 3: CPP contributions (16) | QPP contributions (17)
    [
      { box: '16', labelEn: "Employee's CPP contributions", labelFr: "Cotisations de l'employé au RPC", value: fmt(slip.box_16_cpp_contributions) },
      { box: '17', labelEn: "Employee's QPP contributions", labelFr: "Cotisations de l'employé au RRQ", value: fmt(slip.box_17_cpp2_contributions) },
    ],
    // Row 4: SIN | Exempt flags + Employment code
    [
      { box: '12', labelEn: 'Social insurance number', labelFr: "Numéro d'assurance sociale", value: slip.sin_display || '*** *** ***' },
      { box: '28/29', labelEn: 'Exempt CPP/QPP  EI  PPIP', labelFr: 'Exemption', value: [slip.exempt_cpp ? 'X' : '', slip.exempt_ei ? 'X' : '', slip.exempt_ppip ? 'X' : ''].join('  ') },
    ],
    // Row 5: CPP2 (16A) | QPP2 (17A)
    [
      { box: '16A', labelEn: "Employee's second CPP contributions", labelFr: "Deuxièmes cotis. de l'employé au RPC", value: fmt(slip.box_16a_cpp2_contributions) },
      { box: '17A', labelEn: "Employee's second QPP contributions", labelFr: "Deuxièmes cotis. de l'employé au RRQ", value: fmt(slip.box_17a_qpp2_contributions) },
    ],
    // Row 6: EI insurable earnings (24) | CPP/QPP pensionable earnings (26)
    [
      { box: '24', labelEn: 'EI insurable earnings', labelFr: "Gains assurables d'AE", value: fmt(slip.box_24_ei_insurable_earnings) },
      { box: '26', labelEn: 'CPP/QPP pensionable earnings', labelFr: 'Gains ouvrant droit à pension RPC/RRQ', value: fmt(slip.box_26_cpp_pensionable_earnings) },
    ],
  ];

  boxConfigs.forEach((row) => {
    row.forEach((cell, ci) => {
      const x = lm + ci * halfW;
      doc.setDrawColor(160);
      doc.setLineWidth(0.2);
      doc.rect(x, y, halfW, boxH);
      // Box number
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(cell.box, x + 1, y + 3.5);
      // Labels
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.5);
      doc.setTextColor(100);
      doc.text(cell.labelEn, x + 10, y + 3);
      doc.text(cell.labelFr, x + 10, y + 6);
      // Value
      doc.setTextColor(0);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(cell.value, x + halfW - 2, y + 8, { align: 'right' });
    });
    y += boxH;
  });

  // ---- Employee name & address + EI premiums, union dues etc. ----
  const empInfoH = 18;
  const leftPanelW = contentW * 0.55;
  const rightPanelW = contentW * 0.45;

  // Employee name/address
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(lm, y, leftPanelW, empInfoH);
  doc.setFontSize(5);
  doc.setTextColor(100);
  doc.text("Employee's name and address – Nom et adresse de l'employé", lm + 1, y + 3);
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const empNameDisplay = slip.employees
    ? `${slip.employees.last_name?.toUpperCase() || ''} ${slip.employees.first_name || ''}`
    : 'Employee';
  doc.text(empNameDisplay, lm + 1, y + 7.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  const empMailingProvince = slip.employees?.mailing_province || slip.employees?.province;
  const addrParts = [
    slip.employees?.address_line1,
    slip.employees?.address_line2,
    [slip.employees?.city, empMailingProvince, slip.employees?.postal_code].filter(Boolean).join(' '),
  ].filter(Boolean);
  addrParts.forEach((line, i) => {
    doc.text(line!, lm + 1, y + 11 + i * 3);
  });

  // Right side: EI premiums (18), Union dues (44), RPP (20), Charitable (46), Pension adj (52), RPP# (50), PPIP (55/56)
  const rightBoxH = empInfoH / 3;
  const rHalfW = rightPanelW / 2;

  const rightBoxes = [
    [
      { box: '18', label: "Employee's EI premiums\nCotisations de l'employé à l'AE", value: fmt(slip.box_18_ei_premiums) },
      { box: '44', label: 'Union dues\nCotisations syndicales', value: fmt(slip.box_44_union_dues) },
    ],
    [
      { box: '20', label: 'RPP contributions\nCotisations à un RPA', value: fmt(slip.box_20_rpp_contributions) },
      { box: '46', label: 'Charitable donations\nDons de bienfaisance', value: fmt(slip.box_46_charitable_donations) },
    ],
    [
      { box: '52', label: 'Pension adjustment\nFacteur d\'équivalence', value: fmt(slip.box_52_pension_adjustment) },
      { box: '55', label: 'PPIP premiums\nCotis. au RPAP', value: fmt(slip.box_55_ppip_premiums) },
    ],
  ];

  rightBoxes.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const x = lm + leftPanelW + ci * rHalfW;
      const boxY = y + ri * rightBoxH;
      doc.setDrawColor(160);
      doc.setLineWidth(0.2);
      doc.rect(x, boxY, rHalfW, rightBoxH);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(cell.box, x + 1, boxY + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(3.8);
      doc.setTextColor(100);
      const lines = cell.label.split('\n');
      lines.forEach((l, li) => doc.text(l, x + 7, boxY + 2.5 + li * 2.5));
      doc.setTextColor(0);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(cell.value, x + rHalfW - 2, boxY + rightBoxH - 1.5, { align: 'right' });
    });
  });

  y += empInfoH + 0.5;

  // ---- Other information section ----
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(lm, y, contentW, 8);
  doc.setFontSize(5);
  doc.setTextColor(100);
  doc.text('Other information (see over) – Autres renseignements (voir au verso)', lm + 1, y + 3);
  doc.setTextColor(0);

  // Render other_info boxes if present
  if (slip.other_info && typeof slip.other_info === 'object') {
    const entries = Object.entries(slip.other_info as Record<string, number>).filter(([_, v]) => v !== 0);
    const otherBoxW = contentW / 6;
    entries.slice(0, 6).forEach(([box, amount], i) => {
      const x = lm + i * otherBoxW;
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.text(`Box ${box}`, x + 1, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(fmt(amount), x + otherBoxW - 1, y + 6, { align: 'right' });
    });
  }

  y += 9;

  // Copy label
  doc.setFontSize(6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(copyLabel, lm, y + 3);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');

  // Notes if present
  if (slip.notes) {
    y += 5;
    doc.setFontSize(5.5);
    doc.setTextColor(80);
    const noteLines = doc.splitTextToSize(`Notes: ${slip.notes}`, contentW);
    doc.text(noteLines.slice(0, 2), lm, y + 3);
    doc.setTextColor(0);
  }
}

export function downloadT4Pdf(slip: TaxSlip, organizationName: string): void {
  generateT4Pdf({
    slip,
    employerName: organizationName,
    employerBn: slip.employer_bn || undefined,
    employerAddress: slip.employer_address || undefined,
    employerAccountNumber: slip.employer_account_number || undefined,
  });
}

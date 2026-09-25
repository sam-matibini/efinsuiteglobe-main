/**
 * Phase 13 — OSS quarterly return XML generator.
 *
 * Produces a structured XML payload aligned with the EU OSS schema
 * (simplified — member states accept slightly different formats; the
 * generated XML is suitable as an upload draft and as an internal record).
 *
 * Reference: https://ec.europa.eu/taxation_customs/business/vat/oss_en
 */
import type { OssReturnPayload } from './types';

function esc(s: string | number): string {
  return String(s).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]!));
}

export function generateOssReturnXml(payload: OssReturnPayload): string {
  const totalBase = payload.lines.reduce((s, l) => s + l.taxableBase, 0);
  const totalVat = payload.lines.reduce((s, l) => s + l.vatAmount, 0);

  const lines = payload.lines.map((l, idx) => `
    <MSConSupply>
      <SequenceNumber>${idx + 1}</SequenceNumber>
      <MSConsumption>${esc(l.memberStateOfConsumption)}</MSConsumption>
      <SupplyType>${esc(l.supplyType.toUpperCase())}</SupplyType>
      <VATRateType>${esc(l.vatRateType.toUpperCase())}</VATRateType>
      <VATRate>${l.vatRate.toFixed(2)}</VATRate>
      <TaxableAmount>${l.taxableBase.toFixed(2)}</TaxableAmount>
      <VATAmount>${l.vatAmount.toFixed(2)}</VATAmount>
    </MSConSupply>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<OSSReturn xmlns="urn:eu:vat:oss:return:v1">
  <Header>
    <Scheme>${esc(payload.scheme.toUpperCase())}</Scheme>
    <MSIdentification>${esc(payload.memberStateOfIdentification)}</MSIdentification>
    <OSSRegistrationNumber>${esc(payload.ossRegistrationNumber)}</OSSRegistrationNumber>
    <Period>
      <Year>${payload.periodYear}</Year>
      <Quarter>Q${payload.periodQuarter}</Quarter>
      <Start>${esc(payload.periodStart)}</Start>
      <End>${esc(payload.periodEnd)}</End>
    </Period>
    <Currency>${esc(payload.currency)}</Currency>
  </Header>
  <Supplies>${lines}
  </Supplies>
  <Totals>
    <TotalTaxableAmount>${totalBase.toFixed(2)}</TotalTaxableAmount>
    <TotalVATAmount>${totalVat.toFixed(2)}</TotalVATAmount>
  </Totals>
</OSSReturn>`;
}

export function quarterDates(year: number, quarter: 1 | 2 | 3 | 4): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

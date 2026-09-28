/**
 * GST34 worksheet for the sales-tax e-file screen.
 * CRA GST/HST NETFILE is completed by the user on canada.ca. This file is the
 * line amounts to enter there. It is not a certified NETFILE transmission,
 * and it does not contain a Web Access Code.
 */
import type { FilingFormResult } from '@/lib/filings/types';
import type { EFilePacket } from './types';
import { xmlEscape, formatCraAmount, omitEmptyOptionalTags } from './craXmlUtils';
import { schemaForTaxYear, type CraSchemaYear } from './craSchemaVersion';

interface CraOptions {
  businessNumber: string;       // 9-digit BN + RT0001
  webAccessCode?: string;       // optional WAC for NETFILE
  contactName?: string;
  contactPhone?: string;
  /** CRA schema year (2026 | 2027). Defaults from the filing period. */
  schemaYear?: CraSchemaYear;
}

export function buildCraGstHstPacket(form: FilingFormResult, opts: CraOptions): EFilePacket {
  const lineMap = new Map(form.lines.map((l) => [l.code, l.amount]));
  const get = (code: string) => formatCraAmount(lineMap.get(code) ?? 0);
  const year = form.periodEnd ? Number(form.periodEnd.slice(0, 4)) || new Date().getFullYear() : new Date().getFullYear();
  const schemaYear = opts.schemaYear ?? schemaForTaxYear(year);

  const xml = omitEmptyOptionalTags(`<?xml version="1.0" encoding="UTF-8"?>
<GSTHSTReturn xmlns="http://www.cra-arc.gc.ca/gst-hst/return/1.0" schemaVersion="${schemaYear}">
  <Header>
    <SchemaVersion>${schemaYear}</SchemaVersion>
    <BusinessNumber>${xmlEscape(opts.businessNumber)}</BusinessNumber>
    <FilerType>Software</FilerType>
    <SoftwareIdentifier>efinsuite-globe</SoftwareIdentifier>
    <ReturnType>GST34</ReturnType>
    <PeriodStart>${xmlEscape(form.periodStart)}</PeriodStart>
    <PeriodEnd>${xmlEscape(form.periodEnd)}</PeriodEnd>
    <Currency>${xmlEscape(form.currency)}</Currency>
    ${opts.contactName ? `<ContactName>${xmlEscape(opts.contactName)}</ContactName>` : ''}
    ${opts.contactPhone ? `<ContactPhone>${xmlEscape(opts.contactPhone)}</ContactPhone>` : ''}
  </Header>
  <Lines>
    <Line code="101" label="Sales and other revenue">${get('101')}</Line>
    <Line code="103" label="GST/HST collected">${get('103')}</Line>
    <Line code="104" label="Adjustments — collected">${get('104')}</Line>
    <Line code="105" label="Total GST/HST and adjustments">${get('105')}</Line>
    <Line code="106" label="Input tax credits (ITCs)">${get('106')}</Line>
    <Line code="107" label="Adjustments — ITCs">${get('107')}</Line>
    <Line code="108" label="Total ITCs and adjustments">${get('108')}</Line>
    <Line code="109" label="Net tax">${get('109')}</Line>
    <Line code="110" label="Instalment and other annual filer payments">${get('110')}</Line>
    <Line code="111" label="Rebates">${get('111')}</Line>
    <Line code="112" label="Total other credits">${get('112')}</Line>
    <Line code="113" label="Balance">${formatCraAmount(form.netPayable)}</Line>
  </Lines>
  <Summary>
    <NetPayable>${formatCraAmount(form.netPayable)}</NetPayable>
  </Summary>
</GSTHSTReturn>`);

  return {
    channel: 'cra_packet',
    format: 'xml',
    filename: `CRA_GST34_${form.periodStart}_${form.periodEnd}.xml`,
    mimeType: 'application/xml',
    contents: xml,
    portalUrl: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/gst-hst-netfile.html',
    canDirectSubmit: false,
    schemaVersion: schemaYear,
    instructions: [
      'eFinsuite calculates this GST34. It does not send the return to CRA.',
      'Sign in to GST/HST NETFILE or CRA My Business Account and enter these line amounts.',
      'Type the Web Access Code on CRA’s own site. It is not included in this packet.',
      'When CRA shows a confirmation number, paste it here. Until then this return is not filed.',
    ],
    form,
  };
}

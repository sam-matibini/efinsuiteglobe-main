/**
 * Phase 11b — CRA submission packet generator.
 *
 * CRA does NOT expose a public REST API for non-certified software. The realistic
 * path is: generate a signed XML packet matching the GST/HST NETFILE schema, capture
 * the Web Access Code (WAC), and deep-link the user into "My Business Account" or
 * NETFILE so they can upload the file and copy the confirmation number back.
 */
import type { FilingFormResult } from '@/lib/filings/types';
import type { EFilePacket } from './types';

const xmlEscape = (s: string | number | undefined | null): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

interface CraOptions {
  businessNumber: string;       // 9-digit BN + RT0001
  webAccessCode?: string;       // optional WAC for NETFILE
  contactName?: string;
  contactPhone?: string;
}

export function buildCraGstHstPacket(form: FilingFormResult, opts: CraOptions): EFilePacket {
  const lineMap = new Map(form.lines.map((l) => [l.code, l.amount]));
  const get = (code: string) => fmt(lineMap.get(code) ?? 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GSTHSTReturn xmlns="http://www.cra-arc.gc.ca/gst-hst/return/1.0">
  <Header>
    <BusinessNumber>${xmlEscape(opts.businessNumber)}</BusinessNumber>
    ${opts.webAccessCode ? `<WebAccessCode>${xmlEscape(opts.webAccessCode)}</WebAccessCode>` : ''}
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
    <Line code="113" label="Balance">${fmt(form.netPayable)}</Line>
  </Lines>
  <Summary>
    <NetPayable>${fmt(form.netPayable)}</NetPayable>
  </Summary>
</GSTHSTReturn>`;

  return {
    channel: 'cra_packet',
    format: 'xml',
    filename: `CRA_GST34_${form.periodStart}_${form.periodEnd}.xml`,
    mimeType: 'application/xml',
    contents: xml,
    portalUrl: 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account.html',
    canDirectSubmit: false,
    instructions: [
      'Sign in to CRA My Business Account or use GST/HST NETFILE.',
      'Select the GST/HST return for this period.',
      'Upload the generated XML packet OR transcribe the line amounts shown.',
      opts.webAccessCode
        ? 'Use the Web Access Code stored in your tax credentials.'
        : 'You may need a Web Access Code (WAC) from CRA to use NETFILE.',
      'After CRA confirms, paste the confirmation number back into efinsuite to mark the submission acknowledged.',
    ],
    form,
  };
}

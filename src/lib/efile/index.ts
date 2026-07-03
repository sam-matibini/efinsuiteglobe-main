/**
 * Phase 11 — E-file packet registry.
 * Selects the correct submission channel for a given authority + form.
 */
import type { FilingFormResult } from '@/lib/filings/types';
import type { EFilePacket } from './types';
import { buildCraGstHstPacket } from './craPacket';
import { buildUsStatePacket, SUPPORTED_US_STATES } from './usStatePacket';
import { buildHmrcPacket } from './hmrcMtd';

export * from './types';
export { SUPPORTED_US_STATES };

export interface EFileContext {
  countryCode?: string | null;
  region?: string | null; // e.g. CA-ON, US-CA, GB
  // CRA
  businessNumber?: string;
  webAccessCode?: string;
  contactName?: string;
  contactPhone?: string;
  // HMRC
  vrn?: string;
  periodKey?: string;
  // US state
  registrationNumber?: string;
}

export function buildEFilePacket(form: FilingFormResult, ctx: EFileContext): EFilePacket {
  const country = (ctx.countryCode ?? '').toUpperCase();
  const region = (ctx.region ?? '').toUpperCase();

  if (country === 'GB' || region === 'GB' || form.formCode.startsWith('VAT')) {
    return buildHmrcPacket(form, {
      vrn: ctx.vrn ?? '',
      periodKey: ctx.periodKey ?? '',
    });
  }

  if (country === 'US' || region.startsWith('US-')) {
    const state = region.split('-')[1] ?? 'XX';
    return buildUsStatePacket(form, state, ctx.registrationNumber);
  }

  // Default Canada / GST/HST
  return buildCraGstHstPacket(form, {
    businessNumber: ctx.businessNumber ?? '',
    webAccessCode: ctx.webAccessCode,
    contactName: ctx.contactName,
    contactPhone: ctx.contactPhone,
  });
}

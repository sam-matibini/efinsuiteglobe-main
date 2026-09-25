/**
 * Phase 11 — Direct e-file submission types.
 * Shared interfaces for HMRC MTD, CRA packets, and US state portal exports.
 */
import type { FilingFormResult } from '@/lib/filings/types';

export type EFileChannel = 'hmrc_mtd' | 'cra_packet' | 'us_state_packet' | 'manual';

export type SubmissionStatus =
  | 'drafted'
  | 'transmitted'
  | 'acknowledged'
  | 'rejected'
  | 'failed'
  | 'superseded';

export interface EFilePacket {
  channel: EFileChannel;
  format: 'xml' | 'json' | 'csv' | 'pdf';
  filename: string;
  mimeType: string;
  contents: string; // raw payload
  /** Deep-link to authority portal where the user uploads / completes filing */
  portalUrl?: string;
  /** Optional human-readable instructions surfaced in the UI */
  instructions?: string[];
  /** True if this channel can submit directly via API (HMRC) */
  canDirectSubmit: boolean;
  /** CRA schema year used to generate this packet (2026 | 2027). */
  schemaVersion?: string;
  /** Pre-filled filing form snapshot */
  form: FilingFormResult;
}

export interface SubmissionRow {
  id: string;
  organization_id: string;
  tax_return_id: string | null;
  filing_period_id: string | null;
  authority_id: string | null;
  channel: EFileChannel;
  status: SubmissionStatus;
  form_code: string | null;
  period_start: string | null;
  period_end: string | null;
  net_payable: number | null;
  currency: string | null;
  payload: unknown;
  payload_format: 'xml' | 'json' | 'csv' | 'pdf' | null;
  authority_response: unknown;
  confirmation_number: string | null;
  /** CRA schema year used (2026 | 2027). */
  schema_version?: string | null;
  transmitted_at: string | null;
  acknowledged_at: string | null;
  error_message: string | null;
  retry_count: number;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

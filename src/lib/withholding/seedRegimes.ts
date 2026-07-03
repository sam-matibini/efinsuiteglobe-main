// Phase 15: Default WHT regime templates per country
import type { WhtRegime } from './types';

export type SeedRegime = Omit<WhtRegime, 'id' | 'organization_id'>;

export const DEFAULT_REGIMES: SeedRegime[] = [
  // United States
  {
    code: '1099-NEC',
    name: '1099-NEC — Nonemployee Compensation',
    country_code: 'US',
    authority: 'IRS',
    slip_type: '1099-NEC',
    default_rate: 0,
    threshold_cents: 60000,
    box_code: 'box_1',
    is_active: true,
    notes: 'Backup withholding 24% if no TIN. Threshold $600.',
  },
  {
    code: '1099-MISC',
    name: '1099-MISC — Miscellaneous Income',
    country_code: 'US',
    authority: 'IRS',
    slip_type: '1099-MISC',
    default_rate: 0,
    threshold_cents: 60000,
    box_code: 'box_3',
    is_active: true,
    notes: 'Rents, royalties, other income. Threshold $600 ($10 for royalties).',
  },
  {
    code: 'BACKUP-WHT',
    name: 'IRS Backup Withholding',
    country_code: 'US',
    authority: 'IRS',
    slip_type: '1099-NEC',
    default_rate: 0.24,
    threshold_cents: 0,
    box_code: 'box_4',
    is_active: true,
    notes: 'Applies when vendor has not provided valid W-9.',
  },
  // Canada
  {
    code: 'T4A',
    name: 'T4A — Statement of Pension, Retirement, Annuity, and Other Income',
    country_code: 'CA',
    authority: 'CRA',
    slip_type: 'T4A',
    default_rate: 0,
    threshold_cents: 50000,
    box_code: 'box_048',
    is_active: true,
    notes: 'Fees for services. Threshold $500.',
  },
  {
    code: 'NR4',
    name: 'NR4 — Statement of Amounts Paid to Non-Residents',
    country_code: 'CA',
    authority: 'CRA',
    slip_type: 'NR4',
    default_rate: 0.25,
    threshold_cents: 0,
    box_code: 'box_16',
    is_active: true,
    notes: 'Default 25% non-resident WHT. Reduced by tax treaty (typically 10–15%).',
  },
];

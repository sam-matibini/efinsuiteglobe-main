import { describe, it, expect } from 'vitest';
import { missingColumnFromError } from '../postgrestSchema';
import {
  mergeRstPaidSettings,
  pickRstPaidFallback,
  readRstPaidFallback,
  sanitizeSalesTaxSettingsPayload,
  upsertSalesTaxSettingsRow,
  writeRstPaidFallback,
} from '../salesTaxSettingsWrite';

describe('missingColumnFromError', () => {
  it('parses PostgREST schema-cache and Postgres 42703 messages', () => {
    expect(
      missingColumnFromError({
        code: 'PGRST204',
        message: "Could not find the 'claim_gst_hst_itc' column of 'sales_tax_settings' in the schema cache",
      }),
    ).toBe('claim_gst_hst_itc');
    expect(
      missingColumnFromError({
        code: '42703',
        message: 'column sales_tax_settings.claim_input_tax does not exist',
      }),
    ).toBe('claim_input_tax');
    expect(missingColumnFromError({ code: '42501', message: 'permission denied' })).toBeNull();
  });
});

describe('salesTaxSettingsWrite', () => {
  it('nulls empty GL account ids and picks RST paid fallback fields', () => {
    const payload = sanitizeSalesTaxSettingsPayload({
      gst_paid_account_id: 'acct-1',
      vat_paid_account_id: '',
      claim_gst_hst_itc: true,
      claim_pst_paid: true,
    });
    expect(payload.vat_paid_account_id).toBeNull();
    expect(pickRstPaidFallback(payload)).toMatchObject({
      claim_gst_hst_itc: true,
      claim_pst_paid: true,
      vat_paid_account_id: null,
    });
  });

  it('merges fallback flags when the hosted row lacks the columns', () => {
    const merged = mergeRstPaidSettings(
      { id: '1', gst_paid_account_id: 'acct' },
      { claim_gst_hst_itc: false, claim_pst_paid: true },
    );
    expect(merged.claim_gst_hst_itc).toBe(false);
    expect(merged.claim_pst_paid).toBe(true);
    expect(merged.claim_input_tax).toBe(true);
    expect(mergeRstPaidSettings({ claim_gst_hst_itc: true }, { claim_gst_hst_itc: false }).claim_gst_hst_itc).toBe(true);
  });

  it('strips missing columns and still returns the saved row', async () => {
    const attempts: Record<string, unknown>[] = [];
    const { row, omitted } = await upsertSalesTaxSettingsRow(async (payload) => {
      attempts.push({ ...payload });
      if ('claim_gst_hst_itc' in payload) {
        return {
          data: null,
          error: {
            code: 'PGRST204',
            message: "Could not find the 'claim_gst_hst_itc' column of 'sales_tax_settings' in the schema cache",
          },
        };
      }
      return { data: { id: 'saved', ...payload }, error: null };
    }, {
      filing_frequency: 'quarterly',
      claim_gst_hst_itc: true,
      claim_input_tax: true,
      gst_paid_account_id: 'acct-1',
    });
    expect(attempts).toHaveLength(2);
    expect(omitted).toEqual(expect.arrayContaining(['claim_gst_hst_itc', 'claim_input_tax']));
    expect(row).toMatchObject({ id: 'saved', gst_paid_account_id: 'acct-1' });
    expect(row).not.toHaveProperty('claim_gst_hst_itc');
  });

  it('merges fallback into existing efinconnect preferences', () => {
    const next = writeRstPaidFallback(
      { payoutProviders: { wise: true } },
      { claim_pst_paid: true },
    );
    expect(next.payoutProviders).toEqual({ wise: true });
    expect(readRstPaidFallback(next).claim_pst_paid).toBe(true);
  });
});

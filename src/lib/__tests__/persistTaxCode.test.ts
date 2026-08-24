import { describe, it, expect, vi } from 'vitest';
import {
  isMissingColumnError,
  persistTaxCodeUpdate,
  sanitizeTaxCodeWrite,
  stripOptionalSchemaColumns,
} from '../persistTaxCode';

describe('sanitizeTaxCodeWrite', () => {
  it('drops client-only fields and maps purchase to purchases', () => {
    const payload = sanitizeTaxCodeWrite({
      id: 'skip-me',
      organization_id: 'org',
      isVirtual: true,
      created_at: 'now',
      code: 'GST-ITC',
      name: 'GST Paid (ITC)',
      tax_type: 'purchase',
      rate: 5,
    });
    expect(payload).toMatchObject({
      code: 'GST-ITC',
      name: 'GST Paid (ITC)',
      tax_type: 'purchases',
      applies_to: 'purchases',
      rate: 5,
    });
    expect(payload).not.toHaveProperty('isVirtual');
    expect(payload).not.toHaveProperty('id');
  });
});

describe('isMissingColumnError', () => {
  it('detects PostgREST schema-cache misses for paid columns', () => {
    expect(
      isMissingColumnError({
        code: 'PGRST204',
        message: "Could not find the 'applies_to' column of 'tax_codes' in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(stripOptionalSchemaColumns({ code: 'GST', applies_to: 'purchases', paid_name: 'x' })).toEqual({
      code: 'GST',
    });
  });
});

function mockWriter(handlers: {
  update?: (body: Record<string, unknown>, filters: Record<string, string>) => Promise<{ data: any; error: any }>;
  insert?: (body: Record<string, unknown>) => Promise<{ data: any; error: any }>;
}) {
  return {
    from: () => ({
      update: (body: Record<string, unknown>) => {
        const filters: Record<string, string> = {};
        const chain: any = {
          eq: (column: string, value: string) => {
            filters[column] = value;
            return chain;
          },
          select: () => ({
            maybeSingle: () => handlers.update?.(body, { ...filters }) ?? Promise.resolve({ data: null, error: null }),
          }),
        };
        return chain;
      },
      insert: (body: Record<string, unknown>) => ({
        select: () => ({
          single: () => handlers.insert?.(body) ?? Promise.resolve({ data: body, error: null }),
        }),
      }),
    }),
  };
}

describe('persistTaxCodeUpdate', () => {
  it('updates when a row exists', async () => {
    const saved = { id: 'real', code: 'GST', name: 'Collect GST' };
    const result = await persistTaxCodeUpdate(
      mockWriter({
        update: async () => ({ data: saved, error: null }),
      }),
      { id: 'real', organizationId: 'org', updates: { name: 'Collect GST', code: 'GST', rate: 5 } },
    );
    expect(result).toEqual(saved);
  });

  it('inserts synthesized ITC codes that are not in the database', async () => {
    const insert = vi.fn(async (body: Record<string, unknown>) => ({
      data: { ...body, persisted: true },
      error: null,
    }));
    const result = await persistTaxCodeUpdate(
      mockWriter({
        update: async () => ({ data: null, error: null }),
        insert,
      }),
      {
        id: 'virtual-id',
        organizationId: 'org-1',
        updates: {
          code: 'GST-ITC',
          name: 'GST Paid (ITC)',
          rate: 5,
          tax_type: 'GST',
          isVirtual: true,
        },
      },
    );
    expect(insert).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'virtual-id',
      organization_id: 'org-1',
      code: 'GST-ITC',
      applies_to: 'purchases',
      persisted: true,
    });
  });
});

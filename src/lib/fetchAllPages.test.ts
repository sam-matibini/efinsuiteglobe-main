import { describe, expect, it } from 'vitest';
import { bankingActivity } from './bankingActivity';
import { fetchAllPages, fetchInChunks } from './fetchAllPages';

describe('fetchAllPages', () => {
  it('loads every page past the 1000-row cap', async () => {
    const rows = Array.from({ length: 2500 }, (_, index) => ({ id: `tx-${index}`, amount: 1 }));
    const ranges: Array<[number, number]> = [];
    const loaded = await fetchAllPages(async (from, to) => {
      ranges.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });

    expect(loaded).toHaveLength(2500);
    expect(loaded[0].id).toBe('tx-0');
    expect(loaded[2499].id).toBe('tx-2499');
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('stops when a later page repeats rows', async () => {
    const page = Array.from({ length: 1000 }, (_, index) => ({ id: `tx-${index}` }));
    let calls = 0;
    const loaded = await fetchAllPages(async () => {
      calls += 1;
      return { data: page, error: null };
    });
    expect(loaded).toHaveLength(1000);
    expect(calls).toBe(2);
  });

  it('throws the query error', async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: 'timeout' } }))).rejects.toEqual({
      message: 'timeout',
    });
  });

  it('chunks an id list', async () => {
    const seen: string[][] = [];
    const rows = await fetchInChunks(['a', 'b', 'c'], 2, async (ids) => {
      seen.push(ids);
      return { data: ids.map((id) => ({ id })), error: null };
    });
    expect(seen).toEqual([['a', 'b'], ['c']]);
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('banking activity quantity', () => {
  it('counts deposits and withdrawals without stopping at 1000', () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      amount: index < 400 ? 10 : 2.5,
      transaction_type: index < 400 ? 'deposit' : 'withdrawal',
    }));
    const activity = bankingActivity(rows, 'bank');
    expect(activity.total).toBe(1001);
    expect(activity.inflowCount).toBe(400);
    expect(activity.outflowCount).toBe(601);
    expect(activity.volume).toBe(400 * 10 + 601 * 2.5);
  });
});

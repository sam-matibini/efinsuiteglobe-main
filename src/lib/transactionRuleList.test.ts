import { describe, expect, it } from 'vitest';
import { filterAndSortTransactionRules, type RuleListItem, type RuleListQuery } from './transactionRuleList';

const rules: RuleListItem[] = [
  {
    id: '1',
    name: 'Insurance Corporation Of Bc',
    description: null,
    is_active: true,
    priority: 10,
    matches_count: 1,
    last_matched_at: '2026-10-03',
    updated_at: '2026-10-01',
    logic_operator: 'and',
    conditions: [{ field: 'payee_payor', operator: 'contains', value: 'Insurance Corporation Of Bc' }],
    actions: [{ type: 'post_to_gl', glAccountName: 'Insurance' }],
  },
  {
    id: '2',
    name: 'Opos Adobe Inc 800-8',
    description: 'software',
    is_active: true,
    priority: 5,
    matches_count: 4,
    last_matched_at: '2026-09-01',
    updated_at: '2026-10-02',
    logic_operator: 'and',
    conditions: [{ field: 'description', operator: 'contains', value: 'Adobe' }],
    actions: [{ type: 'categorize', category: 'Software' }],
  },
  {
    id: '3',
    name: 'Unused rent rule',
    description: null,
    is_active: false,
    priority: 20,
    matches_count: 0,
    last_matched_at: null,
    updated_at: '2026-08-01',
    logic_operator: 'or',
    conditions: [{ field: 'amount', operator: 'greater_than', value: '1000' }],
    actions: [{ type: 'flag_review' }],
  },
];

const base: RuleListQuery = {
  tab: 'all',
  search: '',
  action: 'all',
  field: 'all',
  matches: 'all',
  sort: 'priority',
  direction: 'desc',
};

describe('transaction rule list', () => {
  it('sorts by priority, name, and matches', () => {
    expect(filterAndSortTransactionRules(rules, base).map((rule) => rule.name)).toEqual([
      'Unused rent rule',
      'Insurance Corporation Of Bc',
      'Opos Adobe Inc 800-8',
    ]);
    expect(filterAndSortTransactionRules(rules, { ...base, sort: 'name', direction: 'asc' }).map((rule) => rule.id)).toEqual(['1', '2', '3']);
    expect(filterAndSortTransactionRules(rules, { ...base, sort: 'matches', direction: 'desc' }).map((rule) => rule.id)).toEqual(['2', '1', '3']);
  });

  it('filters by tab, action, condition field, match history, and condition text', () => {
    expect(filterAndSortTransactionRules(rules, { ...base, tab: 'inactive' }).map((rule) => rule.id)).toEqual(['3']);
    expect(filterAndSortTransactionRules(rules, { ...base, tab: 'ai' }).map((rule) => rule.id)).toEqual(['1']);
    expect(filterAndSortTransactionRules(rules, { ...base, action: 'categorize' }).map((rule) => rule.id)).toEqual(['2']);
    expect(filterAndSortTransactionRules(rules, { ...base, field: 'payee_payor' }).map((rule) => rule.id)).toEqual(['1']);
    expect(filterAndSortTransactionRules(rules, { ...base, matches: 'never' }).map((rule) => rule.id)).toEqual(['3']);
    expect(filterAndSortTransactionRules(rules, { ...base, search: 'adobe' }).map((rule) => rule.id)).toEqual(['2']);
    expect(filterAndSortTransactionRules(rules, { ...base, sort: 'last_matched', direction: 'desc' }).map((rule) => rule.id)[0]).toBe('1');
    expect(filterAndSortTransactionRules(rules, { ...base, sort: 'last_matched', direction: 'desc' }).map((rule) => rule.id).at(-1)).toBe('3');
  });
});

/**
 * Combine every condition on a transaction rule.
 *
 * AND keeps a transaction only when every filled condition matches.
 * OR keeps it when any filled condition matches. Payee text is also read from
 * the description, because statement imports often leave payee blank.
 */

import { extractVendorName, fuzzyContains, matchText } from '@/lib/transactionMatcher';

export interface RuleMatchTransaction {
  description?: string | null;
  payee_payor?: string | null;
  reference?: string | null;
  memo?: string | null;
  amount?: number | string | null;
  transaction_type?: string | null;
  transaction_date?: string | null;
}

export interface RuleMatchCondition {
  field?: string | null;
  operator?: string | null;
  value?: string | null;
  value2?: string | null;
}

export interface RuleMatchOptions {
  txDirection?: 'inflow' | 'outflow' | null;
  accountKind?: 'bank' | 'card';
}

const TEXT_OPERATORS = new Set([
  'contains',
  'not_contains',
  'equals',
  'not_equals',
  'starts_with',
  'ends_with',
  'contains_words',
  'contains_any_word',
  'fuzzy_match',
  'matches_regex',
]);

function uniqueTexts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const texts: string[] = [];
  for (const value of values) {
    const text = value || '';
    if (!text || seen.has(text)) continue;
    seen.add(text);
    texts.push(text);
  }
  return texts;
}

function textsForField(tx: RuleMatchTransaction, field: string): string[] {
  const description = tx.description || '';
  const payee = tx.payee_payor || '';
  const reference = tx.reference || '';
  const memo = tx.memo || '';
  if (field === 'payee_payor') return uniqueTexts([payee, description, memo, reference]);
  if (field === 'reference') return uniqueTexts([reference, description, memo]);
  return uniqueTexts([description, extractVendorName(description), payee, memo, reference]);
}

function amountMatches(tx: RuleMatchTransaction, condition: RuleMatchCondition): boolean {
  const amount = Math.abs(Number(tx.amount));
  if (!Number.isFinite(amount)) return false;
  const min = parseFloat(condition.value || '');
  const max = parseFloat(condition.value2 || '');
  switch (condition.operator) {
    case 'equals':
      return Number.isFinite(min) && Math.abs(amount - min) < 0.01;
    case 'greater_than':
      return Number.isFinite(min) && amount > min;
    case 'less_than':
      return Number.isFinite(min) && amount < min;
    case 'between':
      return Number.isFinite(min) && Number.isFinite(max) && amount >= min && amount <= max;
    default:
      return false;
  }
}

function dateKey(value: string | null | undefined): string {
  return (value || '').slice(0, 10);
}

function dateMatches(tx: RuleMatchTransaction, condition: RuleMatchCondition): boolean {
  const day = dateKey(tx.transaction_date);
  const start = dateKey(condition.value);
  const end = dateKey(condition.value2);
  if (!day || !start) return false;
  switch (condition.operator) {
    case 'equals':
      return day === start;
    case 'greater_than':
      return day > start;
    case 'less_than':
      return day < start;
    case 'between':
      return !!end && day >= start && day <= end;
    default:
      return false;
  }
}

function typeMatches(tx: RuleMatchTransaction, operator: string, kind: 'bank' | 'card'): boolean {
  const type = (tx.transaction_type || '').toLowerCase();
  if (kind === 'card') {
    if (operator === 'is_deposit') return type === 'payment' || type === 'credit';
    if (operator === 'is_withdrawal') return type === 'charge' || type === 'fee' || type === 'interest';
    return false;
  }
  if (operator === 'is_deposit') return type === 'deposit';
  if (operator === 'is_withdrawal') return type === 'withdrawal';
  return false;
}

function textMatches(
  tx: RuleMatchTransaction,
  condition: RuleMatchCondition,
  options: RuleMatchOptions,
): boolean {
  const operator = condition.operator || '';
  const search = condition.value || '';
  const texts = textsForField(tx, condition.field || 'description');
  const primary = texts[0] || '';
  if (operator === 'not_contains' || operator === 'not_equals') {
    return matchText(primary, operator, search, { txDirection: options.txDirection });
  }
  return texts.some((text) => {
    if (matchText(text, operator, search, { txDirection: options.txDirection })) return true;
    return operator === 'contains' && fuzzyContains(text, search);
  });
}

export function conditionIsReady(condition: RuleMatchCondition): boolean {
  const operator = condition.operator || '';
  if (operator === 'is_deposit' || operator === 'is_withdrawal') return true;
  return !!(condition.value && String(condition.value).trim());
}

export function conditionMatches(
  tx: RuleMatchTransaction,
  condition: RuleMatchCondition,
  options: RuleMatchOptions = {},
): boolean {
  if (!conditionIsReady(condition)) return false;
  if (condition.field === 'amount') return amountMatches(tx, condition);
  if (condition.field === 'date') return dateMatches(tx, condition);
  const operator = condition.operator || '';
  if (operator === 'is_deposit' || operator === 'is_withdrawal') {
    return typeMatches(tx, operator, options.accountKind || 'bank');
  }
  if (TEXT_OPERATORS.has(operator)) return textMatches(tx, condition, options);
  return false;
}

export function normalizeConditions(conditions: unknown): RuleMatchCondition[] {
  if (typeof conditions === 'string') {
    try {
      return normalizeConditions(JSON.parse(conditions));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(conditions)) return [];
  return conditions.filter((condition): condition is RuleMatchCondition => !!condition && typeof condition === 'object');
}

/**
 * AND matches only when every ready condition matches.
 * OR matches when any ready condition matches.
 * A blank extra row is left out so it does not erase the other conditions.
 */
export function ruleConditionsMatch(
  tx: RuleMatchTransaction,
  conditions: unknown,
  logicOperator: string | null | undefined,
  options: RuleMatchOptions = {},
): boolean {
  const ready = normalizeConditions(conditions).filter(conditionIsReady);
  if (ready.length === 0) return false;
  const results = ready.map((condition) => conditionMatches(tx, condition, options));
  const logic = (logicOperator || 'and').trim().toLowerCase();
  return logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

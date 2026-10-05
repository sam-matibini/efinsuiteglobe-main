/**
 * Combine criteria on a transaction rule the way a bank rule form does.
 *
 * Deposit / withdrawal scope always applies. AND and OR apply only to the
 * other criteria. "Contains" matches the phrase as whole words on the chosen
 * field, so "Canada" does not categorise "pos purchase" or "canadian child benefit".
 */

import { matchText } from '@/lib/transactionMatcher';

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
  if (field === 'payee_payor') {
    return payee.trim() ? [payee] : uniqueTexts([description]);
  }
  if (field === 'reference') return uniqueTexts([reference]);
  return uniqueTexts([description]);
}

/** Whole-word phrase. "canada" matches "First Data Canada", not "canadian". */
export function phraseContains(text: string | null | undefined, search: string | null | undefined): boolean {
  const haystack = (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const needle = (search || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!needle || !haystack) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^| )${escaped}(?: |$)`).test(haystack);
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

function searchWords(search: string): string[] {
  return search.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function textMatches(tx: RuleMatchTransaction, condition: RuleMatchCondition): boolean {
  const operator = condition.operator || '';
  const search = condition.value || '';
  const texts = textsForField(tx, condition.field || 'description');
  if (texts.length === 0) return false;
  if (operator === 'contains') return texts.some((text) => phraseContains(text, search));
  if (operator === 'not_contains') return texts.every((text) => !phraseContains(text, search));
  if (operator === 'contains_words') {
    const words = searchWords(search);
    return words.length > 0 && texts.some((text) => words.every((word) => phraseContains(text, word)));
  }
  if (operator === 'contains_any_word') {
    const words = searchWords(search);
    return words.length > 0 && texts.some((text) => words.some((word) => phraseContains(text, word)));
  }
  return texts.some((text) => matchText(text, operator, search));
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
  if (TEXT_OPERATORS.has(operator)) return textMatches(tx, condition);
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

export type RuleApplyTo = 'deposits' | 'withdrawals' | 'both';

export function splitRuleApplyTo<T extends RuleMatchCondition>(conditions: T[]): {
  applyTo: RuleApplyTo;
  criteria: T[];
} {
  const deposits = conditions.some((condition) => condition.operator === 'is_deposit');
  const withdrawals = conditions.some((condition) => condition.operator === 'is_withdrawal');
  const criteria = conditions.filter(
    (condition) => condition.operator !== 'is_deposit' && condition.operator !== 'is_withdrawal',
  );
  const applyTo: RuleApplyTo = deposits && !withdrawals
    ? 'deposits'
    : withdrawals && !deposits
      ? 'withdrawals'
      : 'both';
  return { applyTo, criteria };
}

export function withRuleApplyTo<T extends RuleMatchCondition>(criteria: T[], applyTo: RuleApplyTo): T[] {
  const rest = criteria.filter(
    (condition) => condition.operator !== 'is_deposit' && condition.operator !== 'is_withdrawal',
  );
  if (applyTo === 'both') return rest;
  const scope = {
    id: applyTo === 'deposits' ? 'apply-deposits' : 'apply-withdrawals',
    field: 'type',
    operator: applyTo === 'deposits' ? 'is_deposit' : 'is_withdrawal',
    value: '',
  } as T;
  return [scope, ...rest];
}

function isDirectionCondition(condition: RuleMatchCondition): boolean {
  const operator = condition.operator || '';
  return operator === 'is_deposit' || operator === 'is_withdrawal' || condition.field === 'type';
}

/**
 * Direction is required even when the criteria use OR.
 * AND matches only when every other criterion matches.
 * OR matches when any other criterion matches.
 * A blank extra row is left out so it does not erase the rest.
 */
export function ruleConditionsMatch(
  tx: RuleMatchTransaction,
  conditions: unknown,
  logicOperator: string | null | undefined,
  options: RuleMatchOptions = {},
): boolean {
  const ready = normalizeConditions(conditions).filter(conditionIsReady);
  if (ready.length === 0) return false;
  const scope = ready.filter(isDirectionCondition);
  const criteria = ready.filter((condition) => !isDirectionCondition(condition));
  if (scope.some((condition) => !conditionMatches(tx, condition, options))) return false;
  if (criteria.length === 0) return false;
  const results = criteria.map((condition) => conditionMatches(tx, condition, options));
  const logic = (logicOperator || 'and').trim().toLowerCase();
  return logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

export type RuleAccountScope = 'all' | 'banks' | 'cards' | 'custom';
export type RuleMarkAs = 'recognized' | 'categorized';

export interface RuleActionSettings {
  type?: string | null;
  markAs?: string | null;
  recordAs?: string | null;
  category?: string | null;
  referenceNumber?: string | null;
  accountScope?: string | null;
  bankAccountIds?: string[] | null;
  creditCardIds?: string[] | null;
  glAccountId?: string | null;
}

export function ruleActionSettings(actions: RuleActionSettings[] | null | undefined): {
  markAs: RuleMarkAs;
  recordAs: string;
  referenceNumber: string;
  accountScope: RuleAccountScope;
  bankAccountIds: string[];
  creditCardIds: string[];
} {
  const list = actions || [];
  const source = list.find((action) =>
    action.accountScope || action.markAs || action.recordAs || action.referenceNumber
    || action.bankAccountIds?.length || action.creditCardIds?.length,
  ) || list.find((action) => action.type === 'categorize') || {};
  const scope = source.accountScope;
  return {
    markAs: source.markAs === 'recognized' ? 'recognized' : 'categorized',
    recordAs: (source.recordAs || source.category || '').trim(),
    referenceNumber: (source.referenceNumber || '').trim(),
    accountScope: scope === 'banks' || scope === 'cards' || scope === 'custom' ? scope : 'all',
    bankAccountIds: source.bankAccountIds || [],
    creditCardIds: source.creditCardIds || [],
  };
}

export function ruleAppliesToAccount(
  actions: RuleActionSettings[] | null | undefined,
  tx: { bank_account_id?: string | null; credit_card_id?: string | null },
  kind: 'bank' | 'card',
): boolean {
  const settings = ruleActionSettings(actions);
  if (settings.accountScope === 'all') return true;
  if (settings.accountScope === 'banks') return kind === 'bank';
  if (settings.accountScope === 'cards') return kind === 'card';
  if (kind === 'bank') return !!tx.bank_account_id && settings.bankAccountIds.includes(tx.bank_account_id);
  return !!tx.credit_card_id && settings.creditCardIds.includes(tx.credit_card_id);
}

export function describeRuleCriteria(
  conditions: unknown,
  logicOperator: string | null | undefined,
): string {
  const ready = normalizeConditions(conditions).filter(conditionIsReady);
  const { applyTo, criteria } = splitRuleApplyTo(ready);
  const scope = applyTo === 'deposits'
    ? 'Deposits'
    : applyTo === 'withdrawals'
      ? 'Withdrawals'
      : 'Deposits and withdrawals';
  const logic = (logicOperator || 'and').trim().toLowerCase() === 'or' ? 'OR' : 'AND';
  const parts = criteria.map((condition) => {
    const field = (condition.field || 'description').replace(/_/g, ' ');
    const operator = (condition.operator || 'contains').replace(/_/g, ' ');
    const value = condition.value2 ? `${condition.value} and ${condition.value2}` : (condition.value || '');
    return `${field} ${operator} "${value}"`;
  });
  return parts.length > 0 ? `${scope} · ${parts.join(` ${logic} `)}` : scope;
}

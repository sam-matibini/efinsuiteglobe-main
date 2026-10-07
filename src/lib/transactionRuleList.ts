export type RuleSortKey = 'priority' | 'name' | 'matches' | 'last_matched' | 'updated';
export type RuleSortDirection = 'asc' | 'desc';
export type RuleTab = 'all' | 'active' | 'inactive' | 'ai';
export type RuleActionFilter = 'all' | 'categorize' | 'post_to_gl' | 'add_memo' | 'flag_review';
export type RuleFieldFilter = 'all' | 'description' | 'amount' | 'type' | 'date' | 'payee_payor' | 'reference';
export type RuleMatchFilter = 'all' | 'matched' | 'never';

export interface RuleListItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  matches_count: number;
  last_matched_at: string | null;
  updated_at: string;
  logic_operator: string;
  conditions: { field: string; operator: string; value: string; value2?: string }[];
  actions: { type: string; category?: string; glAccountName?: string; memo?: string }[];
}

export interface RuleListQuery {
  tab: RuleTab;
  search: string;
  action: RuleActionFilter;
  field: RuleFieldFilter;
  matches: RuleMatchFilter;
  sort: RuleSortKey;
  direction: RuleSortDirection;
}

export const RULE_SORT_OPTIONS: { value: RuleSortKey; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'name', label: 'Name' },
  { value: 'matches', label: 'Matches' },
  { value: 'last_matched', label: 'Last matched' },
  { value: 'updated', label: 'Updated' },
];

export const RULE_ACTION_FILTERS: { value: RuleActionFilter; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'categorize', label: 'Categorize' },
  { value: 'post_to_gl', label: 'Post to GL' },
  { value: 'add_memo', label: 'Add memo' },
  { value: 'flag_review', label: 'Flag for review' },
];

export const RULE_FIELD_FILTERS: { value: RuleFieldFilter; label: string }[] = [
  { value: 'all', label: 'All fields' },
  { value: 'description', label: 'Description' },
  { value: 'payee_payor', label: 'Payee / payor' },
  { value: 'amount', label: 'Amount' },
  { value: 'type', label: 'Type' },
  { value: 'reference', label: 'Reference' },
  { value: 'date', label: 'Date' },
];

export const RULE_MATCH_FILTERS: { value: RuleMatchFilter; label: string }[] = [
  { value: 'all', label: 'Any matches' },
  { value: 'matched', label: 'Has matches' },
  { value: 'never', label: 'Never matched' },
];

function searchableText(rule: RuleListItem): string {
  const conditionText = rule.conditions
    .map((condition) => [condition.field, condition.operator, condition.value, condition.value2].filter(Boolean).join(' '))
    .join(' ');
  const actionText = rule.actions
    .map((action) => [action.type, action.category, action.glAccountName, action.memo].filter(Boolean).join(' '))
    .join(' ');
  return [rule.name, rule.description, conditionText, actionText].filter(Boolean).join(' ').toLowerCase();
}

function compareRules(left: RuleListItem, right: RuleListItem, sort: RuleSortKey, direction: RuleSortDirection): number {
  const sign = direction === 'asc' ? 1 : -1;
  let diff = 0;
  if (sort === 'name') {
    diff = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  } else if (sort === 'matches') {
    diff = left.matches_count - right.matches_count;
  } else if (sort === 'priority') {
    diff = left.priority - right.priority;
  } else {
    const leftTime = Date.parse((sort === 'last_matched' ? left.last_matched_at : left.updated_at) || '') || Number.NEGATIVE_INFINITY;
    const rightTime = Date.parse((sort === 'last_matched' ? right.last_matched_at : right.updated_at) || '') || Number.NEGATIVE_INFINITY;
    diff = leftTime - rightTime;
  }
  if (diff === 0) diff = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  return diff * sign;
}

export function filterAndSortTransactionRules(rules: RuleListItem[], query: RuleListQuery): RuleListItem[] {
  const search = query.search.trim().toLowerCase();
  const filtered = rules.filter((rule) => {
    if (query.tab === 'active' && !rule.is_active) return false;
    if (query.tab === 'inactive' && rule.is_active) return false;
    if (query.tab === 'ai' && !rule.actions.some((action) => action.type === 'post_to_gl')) return false;
    if (query.action !== 'all' && !rule.actions.some((action) => action.type === query.action)) return false;
    if (query.field !== 'all' && !rule.conditions.some((condition) => condition.field === query.field)) return false;
    if (query.matches === 'matched' && rule.matches_count <= 0) return false;
    if (query.matches === 'never' && rule.matches_count > 0) return false;
    if (search && !searchableText(rule).includes(search)) return false;
    return true;
  });
  return filtered.sort((left, right) => compareRules(left, right, query.sort, query.direction));
}

export function defaultSortDirection(sort: RuleSortKey): RuleSortDirection {
  return sort === 'name' ? 'asc' : 'desc';
}

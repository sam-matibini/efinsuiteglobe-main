import { describe, expect, it } from 'vitest';
import { describeRuleCriteria, ruleAppliesToAccount, ruleConditionsMatch } from './ruleConditionFormula';

const firstData = {
  description: 'FIRST DATA CANADA MERCHANT',
  payee_payor: null,
  amount: 42,
  transaction_type: 'withdrawal',
  transaction_date: '2026-03-06',
};

const sobeys = {
  description: 'SOBEYS #4030',
  payee_payor: null,
  amount: 18,
  transaction_type: 'withdrawal',
  transaction_date: '2026-03-07',
};

const smallFirstData = {
  description: 'FIRST DATA CANADA',
  payee_payor: '',
  amount: 4,
  transaction_type: 'withdrawal',
  transaction_date: '2026-04-01',
};

const payeeAndAmount = [
  { field: 'payee_payor', operator: 'contains', value: 'First Data Canada' },
  { field: 'amount', operator: 'greater_than', value: '10' },
];

describe('transaction rule AND and OR', () => {
  it('ANDs a payee found in the description with the amount', () => {
    expect(ruleConditionsMatch(firstData, payeeAndAmount, 'AND')).toBe(true);
    expect(ruleConditionsMatch(sobeys, payeeAndAmount, 'and')).toBe(false);
    expect(ruleConditionsMatch(smallFirstData, payeeAndAmount, 'AND')).toBe(false);
  });

  it('ORs the same conditions so either hit is enough', () => {
    expect(ruleConditionsMatch(firstData, payeeAndAmount, 'OR')).toBe(true);
    expect(ruleConditionsMatch(sobeys, payeeAndAmount, 'or')).toBe(true);
    expect(ruleConditionsMatch(smallFirstData, payeeAndAmount, 'OR')).toBe(true);
    expect(ruleConditionsMatch(
      { description: 'OTHER', amount: 4, transaction_type: 'withdrawal' },
      payeeAndAmount,
      'OR',
    )).toBe(false);
  });

  it('keeps a third condition in the AND formula', () => {
    const three = [
      ...payeeAndAmount,
      { field: 'date', operator: 'less_than', value: '2026-04-01' },
    ];
    expect(ruleConditionsMatch(firstData, three, 'AND')).toBe(true);
    expect(ruleConditionsMatch(smallFirstData, three, 'AND')).toBe(false);
    expect(ruleConditionsMatch(
      { ...firstData, transaction_date: '2026-04-02' },
      three,
      'AND',
    )).toBe(false);
  });

  it('ignores a blank extra condition instead of failing the whole AND', () => {
    const withBlank = [
      ...payeeAndAmount,
      { field: 'reference', operator: 'contains', value: '   ' },
    ];
    expect(ruleConditionsMatch(firstData, withBlank, 'AND')).toBe(true);
  });

  it('includes a card charge type in the same AND', () => {
    expect(ruleConditionsMatch(
      { description: 'FIRST DATA CANADA', amount: 20, transaction_type: 'charge' },
      [...payeeAndAmount, { field: 'type', operator: 'is_withdrawal', value: '' }],
      'AND',
      { accountKind: 'card' },
    )).toBe(true);
    expect(ruleConditionsMatch(
      { description: 'FIRST DATA CANADA', amount: 20, transaction_type: 'payment' },
      [...payeeAndAmount, { field: 'type', operator: 'is_withdrawal', value: '' }],
      'AND',
      { accountKind: 'card' },
    )).toBe(false);
  });

  it('does not treat Canada as a match for pos purchase or canadian child benefit', () => {
    const canada = [{ field: 'description', operator: 'contains', value: 'Canada' }];
    expect(ruleConditionsMatch(
      { description: 'pos purchase', amount: 1.96, transaction_type: 'withdrawal' },
      canada,
      'AND',
    )).toBe(false);
    expect(ruleConditionsMatch(
      { description: 'canadian child benefit', amount: 549.1, transaction_type: 'deposit' },
      canada,
      'OR',
    )).toBe(false);
    expect(ruleConditionsMatch(
      { description: 'POS PURCHASE', payee_payor: 'Canada', amount: 7.29, transaction_type: 'withdrawal' },
      [{ field: 'payee_payor', operator: 'contains', value: 'Canada' }],
      'AND',
    )).toBe(true);
  });

  it('keeps deposit or withdrawal scope even when the other criteria use OR', () => {
    const rule = [
      { field: 'type', operator: 'is_withdrawal', value: '' },
      { field: 'description', operator: 'contains', value: 'First Data Canada' },
    ];
    expect(ruleConditionsMatch(firstData, rule, 'OR')).toBe(true);
    expect(ruleConditionsMatch(
      { description: 'pos purchase', amount: 20, transaction_type: 'withdrawal' },
      rule,
      'OR',
    )).toBe(false);
    expect(ruleConditionsMatch(
      { ...firstData, transaction_type: 'deposit' },
      rule,
      'OR',
    )).toBe(false);
  });

  it('does not let the word Canada match inside canadian', () => {
    expect(ruleConditionsMatch(
      { description: 'canadian child benefit', transaction_type: 'deposit' },
      [{ field: 'description', operator: 'contains_words', value: 'Canada benefit' }],
      'AND',
    )).toBe(false);
  });

  it('limits a custom rule to the selected bank account', () => {
    const actions = [{ accountScope: 'custom', bankAccountIds: ['bank-1'], creditCardIds: [] }];
    expect(ruleAppliesToAccount(actions, { bank_account_id: 'bank-1' }, 'bank')).toBe(true);
    expect(ruleAppliesToAccount(actions, { bank_account_id: 'bank-2' }, 'bank')).toBe(false);
    expect(ruleAppliesToAccount(actions, { credit_card_id: 'card-1' }, 'card')).toBe(false);
    expect(ruleAppliesToAccount([{ accountScope: 'banks' }], { bank_account_id: 'bank-2' }, 'bank')).toBe(true);
    expect(ruleAppliesToAccount([{ accountScope: 'cards' }], { credit_card_id: 'card-1' }, 'card')).toBe(true);
    expect(ruleAppliesToAccount([{ accountScope: 'all' }], { bank_account_id: 'bank-9' }, 'bank')).toBe(true);
  });

  it('describes apply-to separately from the criteria pattern', () => {
    expect(describeRuleCriteria([
      { field: 'type', operator: 'is_withdrawal', value: '' },
      { field: 'description', operator: 'contains', value: 'Canada' },
      { field: 'amount', operator: 'greater_than', value: '0' },
    ], 'or')).toBe('Withdrawals · description contains "Canada" OR amount greater than "0"');
  });

  it('still matches a payee stored on the payee field', () => {
    expect(ruleConditionsMatch(
      { description: 'POS PURCHASE', payee_payor: 'First Data Canada', amount: 42 },
      payeeAndAmount,
      'AND',
    )).toBe(true);
  });
});

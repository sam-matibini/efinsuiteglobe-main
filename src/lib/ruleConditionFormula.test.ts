import { describe, expect, it } from 'vitest';
import { ruleConditionsMatch } from './ruleConditionFormula';

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

  it('still matches a payee stored on the payee field', () => {
    expect(ruleConditionsMatch(
      { description: 'POS PURCHASE', payee_payor: 'First Data Canada', amount: 42 },
      payeeAndAmount,
      'AND',
    )).toBe(true);
  });
});

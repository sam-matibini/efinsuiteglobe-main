/**
 * E2E-only page for a rule with more than one condition.
 * Registered at /__e2e__/rule-formula when served with VITE_E2E=1.
 */
import { useMemo, useState } from 'react';
import RuleConditionBuilder from '@/components/banking/RuleConditionBuilder';
import TransactionRuleDialog from '@/components/banking/TransactionRuleDialog';
import { ruleConditionsMatch, withRuleApplyTo } from '@/lib/ruleConditionFormula';
import type { RuleCondition, RuleLogicOperator } from '@/types/bankingRules';

const samples = [
  { id: 'fd-42', description: 'FIRST DATA CANADA MERCHANT', payee_payor: null, amount: 42, transaction_type: 'withdrawal' },
  { id: 'sobeys', description: 'SOBEYS #4030', payee_payor: null, amount: 18, transaction_type: 'withdrawal' },
  { id: 'fd-4', description: 'FIRST DATA CANADA', payee_payor: null, amount: 4, transaction_type: 'withdrawal' },
];

const canadaSamples = [
  { id: 'pos', description: 'pos purchase', payee_payor: null, amount: 1.96, transaction_type: 'withdrawal' },
  { id: 'benefit', description: 'canadian child benefit', payee_payor: null, amount: 549.1, transaction_type: 'deposit' },
  { id: 'first-data', description: 'FIRST DATA CANADA MERCHANT', payee_payor: null, amount: 42, transaction_type: 'withdrawal' },
  { id: 'first-data-deposit', description: 'FIRST DATA CANADA MERCHANT', payee_payor: null, amount: 42, transaction_type: 'deposit' },
];

const initialConditions: RuleCondition[] = [
  { id: 'payee', field: 'payee_payor', operator: 'contains', value: 'First Data Canada' },
  { id: 'amount', field: 'amount', operator: 'greater_than', value: '10' },
];

const canadaConditions: RuleCondition[] = [
  { id: 'canada', field: 'description', operator: 'contains', value: 'Canada' },
];

export default function E2ERuleFormulaHarness() {
  const [conditions, setConditions] = useState(initialConditions);
  const [logicOperator, setLogicOperator] = useState<RuleLogicOperator>('AND');
  const [dialogOpen, setDialogOpen] = useState(true);
  const matched = useMemo(
    () => samples.filter((tx) => ruleConditionsMatch(tx, conditions, logicOperator, { accountKind: 'bank' })),
    [conditions, logicOperator],
  );
  const canadaMatched = useMemo(
    () => canadaSamples.filter((tx) => ruleConditionsMatch(
      tx,
      withRuleApplyTo(canadaConditions, 'withdrawals'),
      'OR',
      { accountKind: 'bank' },
    )),
    [],
  );
  const canadaInitial = useMemo<RuleCondition[]>(() => ([
    { id: 'scope', field: 'type', operator: 'is_withdrawal', value: '' },
    { id: 'canada', field: 'description', operator: 'contains', value: 'Canada' },
  ]), []);

  return (
    <div className="max-w-3xl p-6 space-y-4">
      <h1 className="text-lg font-semibold">Edit Rule</h1>
      <RuleConditionBuilder
        conditions={conditions}
        logicOperator={logicOperator}
        onConditionsChange={setConditions}
        onLogicOperatorChange={setLogicOperator}
      />
      <p data-testid="formula-match-count" className="text-sm font-medium">
        {matched.length} of {samples.length} transactions matched
      </p>
      <ul data-testid="formula-matches" className="text-sm space-y-1">
        {matched.map((tx) => (
          <li key={tx.id}>{tx.description}</li>
        ))}
      </ul>
      <ul data-testid="canada-matches" className="text-sm space-y-1">
        {canadaSamples.map((tx) => {
          const hit = canadaMatched.some((match) => match.id === tx.id);
          return (
            <li key={tx.id}>
              {tx.description} ({tx.transaction_type}) {hit ? 'matched' : 'unmatched'}
            </li>
          );
        })}
      </ul>
      <TransactionRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={() => {}}
        initialName="Canada"
        initialConditions={canadaInitial}
      />
    </div>
  );
}

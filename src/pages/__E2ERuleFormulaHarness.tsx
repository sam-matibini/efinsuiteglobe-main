/**
 * E2E-only page for a rule with more than one condition.
 * Registered at /__e2e__/rule-formula when served with VITE_E2E=1.
 */
import { useMemo, useState } from 'react';
import RuleConditionBuilder from '@/components/banking/RuleConditionBuilder';
import { ruleConditionsMatch } from '@/lib/ruleConditionFormula';
import type { RuleCondition, RuleLogicOperator } from '@/types/bankingRules';

const samples = [
  { id: 'fd-42', description: 'FIRST DATA CANADA MERCHANT', payee_payor: null, amount: 42, transaction_type: 'withdrawal' },
  { id: 'sobeys', description: 'SOBEYS #4030', payee_payor: null, amount: 18, transaction_type: 'withdrawal' },
  { id: 'fd-4', description: 'FIRST DATA CANADA', payee_payor: null, amount: 4, transaction_type: 'withdrawal' },
];

const initialConditions: RuleCondition[] = [
  { id: 'payee', field: 'payee_payor', operator: 'contains', value: 'First Data Canada' },
  { id: 'amount', field: 'amount', operator: 'greater_than', value: '10' },
];

export default function E2ERuleFormulaHarness() {
  const [conditions, setConditions] = useState(initialConditions);
  const [logicOperator, setLogicOperator] = useState<RuleLogicOperator>('AND');
  const matched = useMemo(
    () => samples.filter((tx) => ruleConditionsMatch(tx, conditions, logicOperator, { accountKind: 'bank' })),
    [conditions, logicOperator],
  );

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
    </div>
  );
}

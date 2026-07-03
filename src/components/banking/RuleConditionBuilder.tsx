import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RuleCondition, RuleConditionField, RuleConditionOperator, RuleLogicOperator } from '@/types/bankingRules';

interface RuleConditionBuilderProps {
  conditions: RuleCondition[];
  logicOperator: RuleLogicOperator;
  onConditionsChange: (conditions: RuleCondition[]) => void;
  onLogicOperatorChange: (operator: RuleLogicOperator) => void;
}

const fieldOptions: { value: RuleConditionField; label: string }[] = [
  { value: 'description', label: 'Description' },
  { value: 'payee_payor', label: 'Payee/Payor' },
  { value: 'reference', label: 'Reference' },
  { value: 'amount', label: 'Amount' },
  { value: 'type', label: 'Transaction Type' },
  { value: 'date', label: 'Date' },
];

const operatorsByField: Record<RuleConditionField, { value: RuleConditionOperator; label: string }[]> = {
  description: [
    { value: 'contains', label: 'Contains (fuzzy)' },
    { value: 'fuzzy_match', label: 'Fuzzy match' },
    { value: 'contains_words', label: 'Contains all words' },
    { value: 'contains_any_word', label: 'Contains any word' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'matches_regex', label: 'Matches pattern (regex)' },
  ],
  payee_payor: [
    { value: 'contains', label: 'Contains (fuzzy)' },
    { value: 'fuzzy_match', label: 'Fuzzy match' },
    { value: 'contains_words', label: 'Contains all words' },
    { value: 'contains_any_word', label: 'Contains any word' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'matches_regex', label: 'Matches pattern (regex)' },
  ],
  reference: [
    { value: 'contains', label: 'Contains (fuzzy)' },
    { value: 'fuzzy_match', label: 'Fuzzy match' },
    { value: 'contains_words', label: 'Contains all words' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
  ],
  amount: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' },
  ],
  type: [
    { value: 'is_deposit', label: 'Is deposit/payment' },
    { value: 'is_withdrawal', label: 'Is withdrawal/charge' },
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'between', label: 'Between' },
  ],
};

export default function RuleConditionBuilder({
  conditions,
  logicOperator,
  onConditionsChange,
  onLogicOperatorChange,
}: RuleConditionBuilderProps) {
  const addCondition = () => {
    const newCondition: RuleCondition = {
      id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      field: 'description',
      operator: 'contains',
      value: '',
    };
    onConditionsChange([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<RuleCondition>) => {
    onConditionsChange(
      conditions.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates };
          // Reset operator if field changed
          if (updates.field && updates.field !== c.field) {
            updated.operator = operatorsByField[updates.field][0].value;
            updated.value = '';
            updated.value2 = undefined;
          }
          return updated;
        }
        return c;
      })
    );
  };

  const removeCondition = (id: string) => {
    onConditionsChange(conditions.filter((c) => c.id !== id));
  };

  const needsValue = (operator: RuleConditionOperator) => {
    return !['is_deposit', 'is_withdrawal'].includes(operator);
  };

  const needsSecondValue = (operator: RuleConditionOperator) => {
    return operator === 'between';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Conditions</h4>
        {conditions.length > 1 && (
          <Select value={logicOperator} onValueChange={(v) => onLogicOperatorChange(v as RuleLogicOperator)}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {conditions.length > 1 && logicOperator === 'AND' && (
        <p className="text-xs text-muted-foreground -mt-2">
          All conditions must match. Switch to <span className="font-medium">OR</span> if any one is enough.
        </p>
      )}


      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div key={condition.id} className="space-y-2">
            {index > 0 && (
              <div className="flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                  {logicOperator}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Select
                value={condition.field}
                onValueChange={(v) => updateCondition(condition.id, { field: v as RuleConditionField })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={condition.operator}
                onValueChange={(v) => updateCondition(condition.id, { operator: v as RuleConditionOperator })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operatorsByField[condition.field].map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {needsValue(condition.operator) && (
                <>
                  <Input
                    placeholder={condition.field === 'amount' ? '0.00' : 'Value...'}
                    value={condition.value}
                    onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                    className="flex-1"
                    type={condition.field === 'amount' ? 'number' : 'text'}
                  />
                  {needsSecondValue(condition.operator) && (
                    <>
                      <span className="text-sm text-muted-foreground">and</span>
                      <Input
                        placeholder={condition.field === 'amount' ? '0.00' : 'Value...'}
                        value={condition.value2 || ''}
                        onChange={(e) => updateCondition(condition.id, { value2: e.target.value })}
                        className="flex-1"
                        type={condition.field === 'amount' ? 'number' : 'text'}
                      />
                    </>
                  )}
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCondition(condition.id)}
                disabled={conditions.length === 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addCondition} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add Condition
      </Button>
    </div>
  );
}

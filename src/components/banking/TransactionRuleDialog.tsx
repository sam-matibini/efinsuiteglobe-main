import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Save, X, FlaskConical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { splitRuleApplyTo, withRuleApplyTo, ruleActionSettings, type RuleApplyTo, type RuleAccountScope, type RuleMarkAs } from '@/lib/ruleConditionFormula';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCreditCards } from '@/hooks/useCreditCards';
import RuleConditionBuilder from './RuleConditionBuilder';
import { SearchableGLAccountSelect } from './SearchableGLAccountSelect';
import { TaxCodeSelect } from './TaxCodeSelect';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';
import { TransactionRule, RuleCondition, RuleLogicOperator, RuleAction } from '@/types/bankingRules';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useDepartments } from '@/hooks/useDimensions';
import { supabase } from '@/integrations/supabase/client';
import { matchesRule } from '@/hooks/useRuleAnalysis';
import { matchesCCRule } from '@/hooks/useCreditCardRuleAnalysis';
import type { TransactionRule as DBRule } from '@/hooks/useTransactionRules';


interface TransactionRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: TransactionRule | null;
  onSave: (rule: Partial<TransactionRule>) => void;
  initialConditions?: RuleCondition[];
  initialName?: string;
}

export default function TransactionRuleDialog({
  open,
  onOpenChange,
  rule,
  onSave,
  initialConditions,
  initialName,
}: TransactionRuleDialogProps) {
  const { currentOrganization } = useOrganizationContext();
  const { data: departments = [] } = useDepartments();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [logicOperator, setLogicOperator] = useState<RuleLogicOperator>('AND');
  const [applyTo, setApplyTo] = useState<RuleApplyTo>('deposits');
  const [markAs, setMarkAs] = useState<RuleMarkAs>('categorized');
  const [recordAs, setRecordAs] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [accountScope, setAccountScope] = useState<RuleAccountScope>('all');
  const [bankAccountIds, setBankAccountIds] = useState<string[]>([]);
  const [creditCardIds, setCreditCardIds] = useState<string[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const { accounts: bankAccounts = [] } = useBankAccounts();
  const { creditCards = [] } = useCreditCards();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    total: number;
    matched: number;
    samples: string[];
    perCondition: number[];
  } | null>(null);


  // Ensure conditions have proper unique IDs
  const ensureConditionIds = (conditions: RuleCondition[]): RuleCondition[] => {
    return conditions.map((c, index) => ({
      ...c,
      id: c.id && c.id !== 'cond-new' ? c.id : `cond-${Date.now()}-${index}`,
    }));
  };

  // Reset state when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      if (rule) {
        setName(rule.name || '');
        setDescription(rule.description || '');
        setIsActive(rule.isActive ?? true);
        const source = rule.conditions && rule.conditions.length > 0 ? rule.conditions : [];
        const split = splitRuleApplyTo(source);
        const ruleConditions = split.criteria.length > 0
          ? ensureConditionIds(split.criteria as RuleCondition[])
          : [{ id: `cond-${Date.now()}`, field: 'description' as const, operator: 'contains' as const, value: '' }];
        setApplyTo(source.length > 0 ? split.applyTo : 'deposits');
        setConditions(ruleConditions);
        setLogicOperator(rule.logicOperator || 'AND');
        const savedActions = rule.actions || [{ type: 'categorize' as const, category: '' }];
        const settings = ruleActionSettings(savedActions);
        setMarkAs(settings.markAs);
        setRecordAs(settings.recordAs);
        setReferenceNumber(settings.referenceNumber);
        setAccountScope(settings.accountScope);
        setBankAccountIds(settings.bankAccountIds);
        setCreditCardIds(settings.creditCardIds);
        setActions(savedActions);
      } else {
        setName(initialName || '');
        setDescription('');
        setIsActive(true);
        const source = initialConditions && initialConditions.length > 0 ? initialConditions : [];
        const split = splitRuleApplyTo(source);
        const initConditions = split.criteria.length > 0
          ? ensureConditionIds(split.criteria as RuleCondition[])
          : [{ id: `cond-${Date.now()}`, field: 'description' as const, operator: 'contains' as const, value: '' }];
        setApplyTo(source.length > 0 ? split.applyTo : 'deposits');
        setConditions(initConditions);
        setLogicOperator('AND');
        setMarkAs('categorized');
        setRecordAs('');
        setReferenceNumber('');
        setAccountScope('all');
        setBankAccountIds([]);
        setCreditCardIds([]);
        setActions([{ type: 'categorize', category: '' }]);
      }
      setTestResult(null);
    }
  }, [open, rule, initialConditions, initialName]);

  const stampedActions = (source: RuleAction[]): RuleAction[] => {
    const next = (source.length > 0 ? source : [{ type: 'categorize' as const }]).map((action) => ({ ...action }));
    let target = next.find((action) => action.type === 'categorize');
    if (!target) {
      target = { type: 'categorize', category: recordAs.trim() };
      next.unshift(target);
    }
    target.markAs = markAs;
    target.recordAs = recordAs.trim() || undefined;
    if (recordAs.trim()) target.category = recordAs.trim();
    target.referenceNumber = referenceNumber.trim() || undefined;
    target.accountScope = accountScope;
    target.bankAccountIds = accountScope === 'custom' ? bankAccountIds : [];
    target.creditCardIds = accountScope === 'custom' ? creditCardIds : [];
    if (markAs === 'recognized') return next.filter((action) => action.type !== 'post_to_gl');
    return next;
  };

  // Build a draft DB-shaped rule from current dialog state for the matchers
  const draftRule = useMemo<DBRule>(() => ({
    id: rule?.id || 'draft',
    organization_id: currentOrganization?.id || '',
    name: name || 'Draft',
    description: description || null,
    is_active: true,
    conditions: withRuleApplyTo(conditions, applyTo) as RuleCondition[],
    logic_operator: logicOperator.toLowerCase() as 'and' | 'or',
    actions: stampedActions(actions),
    priority: rule?.priority ?? 10,
    matches_count: 0,
    last_matched_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [rule?.id, rule?.priority, currentOrganization?.id, name, description, conditions, logicOperator, applyTo, actions, markAs, recordAs, referenceNumber, accountScope, bankAccountIds, creditCardIds]);

  const handleTestRule = async () => {
    if (!currentOrganization?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const [bankRes, ccRes] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('id, description, payee_payor, reference, memo, amount, transaction_type, transaction_date, bank_account_id')
          .order('transaction_date', { ascending: false })
          .limit(200),
        supabase
          .from('credit_card_transactions')
          .select('id, description, payee_payor, reference, memo, amount, transaction_type, transaction_date')
          .order('transaction_date', { ascending: false })
          .limit(200),
      ]);

      const bankTxs = (bankRes.data || []) as any[];
      const ccTxs = (ccRes.data || []) as any[];
      const total = bankTxs.length + ccTxs.length;

      const matchedSamples: string[] = [];
      let matched = 0;
      const perCondition: number[] = conditions.map(() => 0);

      // Helper to score one condition in isolation
      const singleConditionRule = (idx: number): DBRule => ({
        ...draftRule,
        conditions: [conditions[idx]],
        logic_operator: 'and',
      });

      for (const t of bankTxs) {
        if (matchesRule(t as any, draftRule)) {
          matched++;
          if (matchedSamples.length < 5) matchedSamples.push(t.description || '(no description)');
        }
        conditions.forEach((_, i) => {
          if (matchesRule(t as any, singleConditionRule(i))) perCondition[i]++;
        });
      }
      for (const t of ccTxs) {
        if (matchesCCRule(t as any, draftRule)) {
          matched++;
          if (matchedSamples.length < 5) matchedSamples.push(t.description || '(no description)');
        }
        conditions.forEach((_, i) => {
          if (matchesCCRule(t as any, singleConditionRule(i))) perCondition[i]++;
        });
      }

      setTestResult({ total, matched, samples: matchedSamples, perCondition });
    } finally {
      setTesting(false);
    }
  };


  // Check if conditions have required values
  const hasValidConditions = conditions.length > 0 && conditions.every(c => {
    // Type-based conditions don't need a value
    if (['is_deposit', 'is_withdrawal'].includes(c.operator)) return true;
    // Other conditions need a non-empty value
    return c.value && c.value.trim().length > 0;
  });

  // Check if at least one action has valid settings
  const hasValidActions = markAs === 'recognized' || actions.some(a => {
    if (a.type === 'categorize' && a.glAccountId) return true;
    if (a.type === 'post_to_gl' && a.glAccountId) return true;
    if (a.type === 'add_memo' && a.memo && a.memo.trim().length > 0) return true;
    if (a.type === 'flag_review') return true;
    return false;
  });
  const scopeReady = accountScope !== 'custom' || bankAccountIds.length + creditCardIds.length > 0;

  const handleSave = () => {
    // Ensure all conditions have proper unique IDs
    const validatedConditions = withRuleApplyTo(ensureConditionIds(conditions), applyTo) as RuleCondition[];
    
    const ruleData: Partial<TransactionRule> = {
      id: rule?.id || `rule-${Date.now()}`,
      name,
      description,
      isActive,
      conditions: validatedConditions,
      logicOperator,
      actions: stampedActions(actions),
      priority: rule?.priority || 10,
      matchCount: rule?.matchCount || 0,
      createdAt: rule?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    onSave(ruleData);
    onOpenChange(false);
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setActions(
      actions.map((a, i) => (i === index ? { ...a, ...updates } : a))
    );
  };

  const toggleActionType = (type: RuleAction['type']) => {
    const exists = actions.some((a) => a.type === type);
    if (exists) {
      setActions(actions.filter((a) => a.type !== type));
    } else {
      setActions([...actions, { type }]);
    }
  };

  const hasActionType = (type: RuleAction['type']) => actions.some((a) => a.type === type);
  const getAction = (type: RuleAction['type']) => actions.find((a) => a.type === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {rule ? 'Edit Rule' : 'Create Transaction Rule'}
            {rule?.isAISuggested && (
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                <Sparkles className="w-3 h-3" />
                AI Suggested
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Define conditions to analyze & categorize transactions, with optional posting to the General Ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Rule Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Payroll Transactions"
                className="mt-1.5"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Apply To <span className="text-destructive">*</span></Label>
              <RadioGroup
                value={applyTo}
                onValueChange={(value) => setApplyTo(value as RuleApplyTo)}
                className="flex flex-wrap gap-4"
                data-testid="rule-apply-to"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="deposits" id="apply-deposits" />
                  Deposits
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="withdrawals" id="apply-withdrawals" />
                  Withdrawals
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="both" id="apply-both" />
                  Deposits and withdrawals
                </label>
              </RadioGroup>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Mark Transaction As <span className="text-destructive">*</span></Label>
              <RadioGroup
                value={markAs}
                onValueChange={(value) => setMarkAs(value as RuleMarkAs)}
                className="flex flex-wrap gap-4"
                data-testid="rule-mark-as"
              >
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="recognized" id="mark-recognized" />
                  Recognized
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="categorized" id="mark-categorized" />
                  Categorized
                </label>
              </RadioGroup>
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this rule does..."
                className="mt-1.5 resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="border rounded-lg p-4">
            <RuleConditionBuilder
              conditions={conditions}
              logicOperator={logicOperator}
              onConditionsChange={setConditions}
              onLogicOperatorChange={setLogicOperator}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="record-as">Record As</Label>
              <Input
                id="record-as"
                data-testid="rule-record-as"
                value={recordAs}
                onChange={(e) => setRecordAs(e.target.value)}
                placeholder="e.g. Expense, Interest income"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="reference-number">Reference Number</Label>
              <Input
                id="reference-number"
                data-testid="rule-reference-number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Filled in only when the transaction has no reference"
                className="mt-1.5"
              />
            </div>
            <div className="space-y-2">
              <Label>Associate Accounts <span className="text-destructive">*</span></Label>
              <RadioGroup
                value={accountScope}
                onValueChange={(value) => setAccountScope(value as RuleAccountScope)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                data-testid="rule-account-scope"
              >
                {([
                  ['all', 'All Accounts'],
                  ['banks', 'All Banks'],
                  ['cards', 'All Cards'],
                  ['custom', 'Custom'],
                ] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <RadioGroupItem value={value} id={`scope-${value}`} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
              {accountScope === 'custom' && (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {bankAccounts.map((account) => (
                    <label key={account.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={bankAccountIds.includes(account.id)}
                        onCheckedChange={() => setBankAccountIds((current) => (
                          current.includes(account.id)
                            ? current.filter((id) => id !== account.id)
                            : [...current, account.id]
                        ))}
                      />
                      {account.name}
                    </label>
                  ))}
                  {creditCards.map((card) => (
                    <label key={card.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={creditCardIds.includes(card.id)}
                        onCheckedChange={() => setCreditCardIds((current) => (
                          current.includes(card.id)
                            ? current.filter((id) => id !== card.id)
                            : [...current, card.id]
                        ))}
                      />
                      {card.name}
                    </label>
                  ))}
                  {bankAccounts.length === 0 && creditCards.length === 0 && (
                    <p className="text-xs text-muted-foreground">No bank or card accounts are available for this company yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Account</h4>
              <p className="text-xs text-muted-foreground">
                {markAs === 'recognized' ? 'Recognized transactions are matched without a journal' : 'Categorized transactions use this account'}
              </p>
            </div>

            {markAs === 'categorized' && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="action-categorize"
                  checked={hasActionType('categorize')}
                  onCheckedChange={() => toggleActionType('categorize')}
                />
                <Label htmlFor="action-categorize" className="font-medium cursor-pointer">
                  Account <span className="text-destructive">*</span>
                </Label>
              </div>
              
              {hasActionType('categorize') && (
                <div className="ml-6">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Account
                  </Label>
                  <div className="w-full max-w-md">
                    <SearchableGLAccountSelect
                      value={getAction('categorize')?.glAccountId || getAction('post_to_gl')?.glAccountId || ''}
                      onValueChange={(id, account) => {
                        if (account?.name) {
                          setRecordAs((current) => current.trim() ? current : account.name);
                        }
                        // Update categorize action with GL account info
                        const catIdx = actions.findIndex((a) => a.type === 'categorize');
                        if (catIdx >= 0) {
                          updateAction(catIdx, { 
                            category: recordAs.trim() || account?.name || '',
                            glAccountId: id,
                            glAccountName: account?.name,
                          });
                        } else {
                          setActions([...actions, { 
                            type: 'categorize', 
                            category: account?.name || '',
                            glAccountId: id,
                            glAccountName: account?.name,
                          }]);
                        }
                        
                        // Auto-sync to post_to_gl if enabled
                        if (hasActionType('post_to_gl')) {
                          const glIdx = actions.findIndex((a) => a.type === 'post_to_gl');
                          if (glIdx >= 0) {
                            updateAction(glIdx, {
                              glAccountId: id,
                              glAccountName: account?.name,
                            });
                          }
                        }
                      }}
                      placeholder="Search and select GL account..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Post to GL (Optional - syncs with categorize) */}
            {markAs === 'categorized' && (
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="action-post-gl"
                  checked={hasActionType('post_to_gl')}
                  onCheckedChange={(checked) => {
                    toggleActionType('post_to_gl');
                    // When enabling, sync GL account from categorize action
                    if (checked && hasActionType('categorize')) {
                      const catAction = getAction('categorize');
                      if (catAction?.glAccountId) {
                        setTimeout(() => {
                          setActions(prev => prev.map(a => 
                            a.type === 'post_to_gl' 
                              ? { ...a, glAccountId: catAction.glAccountId, glAccountName: catAction.glAccountName }
                              : a
                          ));
                        }, 0);
                      }
                    }
                  }}
                />
                <Label htmlFor="action-post-gl" className="font-medium cursor-pointer">
                  Post to General Ledger
                </Label>
              </div>
              
              {hasActionType('post_to_gl') && (
                <div className="ml-6 space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      GL Account (synced with categorization)
                    </Label>
                    <div className="w-full max-w-md">
                      <SearchableGLAccountSelect
                        value={getAction('post_to_gl')?.glAccountId || getAction('categorize')?.glAccountId || ''}
                        onValueChange={(id, account) => {
                          // Update post_to_gl action
                          const glIdx = actions.findIndex((a) => a.type === 'post_to_gl');
                          if (glIdx >= 0) {
                            updateAction(glIdx, {
                              glAccountId: id,
                              glAccountName: account?.name,
                            });
                          } else {
                            setActions([...actions, { type: 'post_to_gl', glAccountId: id, glAccountName: account?.name }]);
                          }
                          
                          // Auto-sync to categorize if enabled
                          if (hasActionType('categorize')) {
                            const catIdx = actions.findIndex((a) => a.type === 'categorize');
                            if (catIdx >= 0) {
                              updateAction(catIdx, { 
                                category: account?.name || '',
                                glAccountId: id,
                                glAccountName: account?.name,
                              });
                            }
                          }
                        }}
                        placeholder="Search and select GL account..."
                      />
                    </div>
                  </div>
                  
                  {/* Tax Code Selection */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      Sales Tax Code (optional)
                    </Label>
                    <div className="w-full max-w-md">
                      <TaxCodeSelect
                        organizationId={currentOrganization?.id}
                        value={getAction('post_to_gl')?.taxCodeId || null}
                        onValueChange={(taxCode) => {
                          const glIdx = actions.findIndex((a) => a.type === 'post_to_gl');
                          if (glIdx >= 0 && taxCode) {
                            updateAction(glIdx, {
                              taxCodeId: taxCode.id,
                              taxCode: taxCode.code,
                              taxRate: taxCode.rate,
                              // Store BOTH GL accounts for correct routing based on transaction type
                              // - Deposits: Use taxCollectedGlAccountId (GST/HST Payable)
                              // - Withdrawals: Use taxPaidGlAccountId (GST/HST ITC)
                              taxCollectedGlAccountId: taxCode.gl_collected_account_id || undefined,
                              taxPaidGlAccountId: taxCode.gl_paid_account_id || undefined,
                              // Legacy field for backward compatibility
                              taxGlAccountId: taxCode.gl_paid_account_id || undefined,
                              taxGlAccountName: taxCode.name,
                            });
                          } else if (glIdx >= 0) {
                            updateAction(glIdx, {
                              taxCodeId: undefined,
                              taxCode: undefined,
                              taxRate: undefined,
                              taxCollectedGlAccountId: undefined,
                              taxPaidGlAccountId: undefined,
                              taxGlAccountId: undefined,
                              taxGlAccountName: undefined,
                            });
                          }
                        }}
                        placeholder="Select tax code..."
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tax will be posted to the correct GL account based on transaction type (ITC for expenses, Payable for sales)
                    </p>
                  </div>

                  {/* Division / Department */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      Division / Department (optional)
                    </Label>
                    <div className="w-full max-w-md">
                      <DivisionSelect
                        value={
                          getAction('post_to_gl')?.departmentId ||
                          getAction('categorize')?.departmentId ||
                          null
                        }
                        onChange={(deptId) => {
                          const dept = deptId
                            ? (departments as any[]).find((d) => d.id === deptId)
                            : null;
                          const deptName = dept?.name || undefined;
                          setActions((prev) =>
                            prev.map((a) => {
                              if (a.type === 'post_to_gl' || a.type === 'categorize') {
                                return {
                                  ...a,
                                  departmentId: deptId || undefined,
                                  departmentName: deptId ? deptName : undefined,
                                };
                              }
                              return a;
                            }),
                          );
                        }}
                        placeholder="Consolidated (no division)"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Matched transactions will be tagged to this division for divisional reporting.
                    </p>
                  </div>
                </div>
              )}
            </div>
            )}
            )}

            {/* Add Memo Action */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="action-memo"
                  checked={hasActionType('add_memo')}
                  onCheckedChange={() => toggleActionType('add_memo')}
                />
                <Label htmlFor="action-memo" className="font-normal cursor-pointer">
                  Add memo
                </Label>
              </div>
              {hasActionType('add_memo') && (
                <Input
                  value={getAction('add_memo')?.memo || ''}
                  onChange={(e) =>
                    updateAction(actions.findIndex((a) => a.type === 'add_memo'), { memo: e.target.value })
                  }
                  placeholder="Enter memo text..."
                  className="ml-6 w-80"
                />
              )}
            </div>

            {/* Flag for Review Action */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="action-flag"
                checked={hasActionType('flag_review')}
                onCheckedChange={() => toggleActionType('flag_review')}
              />
              <Label htmlFor="action-flag" className="font-normal cursor-pointer">
                Flag for manual review
              </Label>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">Rule Active</p>
              <p className="text-sm text-muted-foreground">Enable this rule to process new transactions</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Test Rule */}
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Test rule</p>
                <p className="text-xs text-muted-foreground">
                  Dry-run against the last 200 bank + credit-card transactions. No changes are saved.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestRule}
                disabled={testing || !hasValidConditions}
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
                Run test
              </Button>
            </div>
            {testResult && (
              <div className="text-xs space-y-2">
                <div>
                  <span className="font-medium">{testResult.matched}</span> of {testResult.total} transactions matched
                  {testResult.matched === 0 && (
                    <span className="text-muted-foreground"> — Apply To still has to match, and Contains uses the whole word.</span>
                  )}
                </div>
                {conditions.length > 1 && (
                  <div className="text-muted-foreground">
                    Per-condition hits:{' '}
                    {testResult.perCondition.map((n, i) => (
                      <span key={i} className="mr-2">
                        #{i + 1}: <span className="font-medium text-foreground">{n}</span>
                      </span>
                    ))}
                  </div>
                )}
                {testResult.samples.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1">Sample matches:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {testResult.samples.map((s, i) => (
                        <li key={i} className="truncate">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || !hasValidConditions || !hasValidActions || !scopeReady}
            title={
              !name.trim() ? 'Enter a rule name' :
              !hasValidConditions ? 'Add valid criteria with values' :
              !scopeReady ? 'Choose at least one account for a custom association' :
              !hasValidActions ? 'Choose an account, or mark the transaction as recognized' :
              'Save this rule'
            }
          >
            <Save className="w-4 h-4 mr-2" />
            Save Rule
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

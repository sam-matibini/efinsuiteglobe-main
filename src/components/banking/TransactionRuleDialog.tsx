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
  const [actions, setActions] = useState<RuleAction[]>([]);
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
        const ruleConditions = rule.conditions && rule.conditions.length > 0 
          ? ensureConditionIds(rule.conditions)
          : [{ id: `cond-${Date.now()}`, field: 'description' as const, operator: 'contains' as const, value: '' }];
        setConditions(ruleConditions);
        setLogicOperator(rule.logicOperator || 'AND');
        setActions(rule.actions || [{ type: 'categorize', category: '' }]);
      } else {
        setName(initialName || '');
        setDescription('');
        setIsActive(true);
        const initConditions = initialConditions && initialConditions.length > 0
          ? ensureConditionIds(initialConditions)
          : [{ id: `cond-${Date.now()}`, field: 'description' as const, operator: 'contains' as const, value: '' }];
        setConditions(initConditions);
        setLogicOperator('AND');
        setActions([{ type: 'categorize', category: '' }]);
      }
      setTestResult(null);
    }
  }, [open, rule, initialConditions, initialName]);

  // Build a draft DB-shaped rule from current dialog state for the matchers
  const draftRule = useMemo<DBRule>(() => ({
    id: rule?.id || 'draft',
    organization_id: currentOrganization?.id || '',
    name: name || 'Draft',
    description: description || null,
    is_active: true,
    conditions: conditions,
    logic_operator: logicOperator.toLowerCase() as 'and' | 'or',
    actions: actions,
    priority: rule?.priority ?? 10,
    matches_count: 0,
    last_matched_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }), [rule?.id, rule?.priority, currentOrganization?.id, name, description, conditions, logicOperator, actions]);

  const handleTestRule = async () => {
    if (!currentOrganization?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const [bankRes, ccRes] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('id, description, payee_payor, reference, amount, transaction_type, bank_account_id')
          .order('transaction_date', { ascending: false })
          .limit(200),
        supabase
          .from('credit_card_transactions')
          .select('id, description, payee_payor, reference, amount, transaction_type')
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
  const hasValidActions = actions.some(a => {
    if (a.type === 'categorize' && a.glAccountId) return true;
    if (a.type === 'post_to_gl' && a.glAccountId) return true;
    if (a.type === 'add_memo' && a.memo && a.memo.trim().length > 0) return true;
    if (a.type === 'flag_review') return true;
    return false;
  });

  const handleSave = () => {
    // Ensure all conditions have proper unique IDs
    const validatedConditions = ensureConditionIds(conditions);
    
    const ruleData: Partial<TransactionRule> = {
      id: rule?.id || `rule-${Date.now()}`,
      name,
      description,
      isActive,
      conditions: validatedConditions,
      logicOperator,
      actions,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Payroll Transactions"
                className="mt-1.5"
              />
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

          {/* Actions */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Actions</h4>
              <p className="text-xs text-muted-foreground">
                Analyze & Categorize → Post to GL (optional)
              </p>
            </div>

            {/* Analyze & Categorize (Primary action) */}
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="action-categorize"
                  checked={hasActionType('categorize')}
                  onCheckedChange={() => toggleActionType('categorize')}
                />
                <Label htmlFor="action-categorize" className="font-medium cursor-pointer">
                  Analyze & Categorize
                </Label>
              </div>
              
              {hasActionType('categorize') && (
                <div className="ml-6">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    GL Account (for categorization)
                  </Label>
                  <div className="w-full max-w-md">
                    <SearchableGLAccountSelect
                      value={getAction('categorize')?.glAccountId || getAction('post_to_gl')?.glAccountId || ''}
                      onValueChange={(id, account) => {
                        // Update categorize action with GL account info
                        const catIdx = actions.findIndex((a) => a.type === 'categorize');
                        if (catIdx >= 0) {
                          updateAction(catIdx, { 
                            category: account?.name || '',
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
                  {testResult.matched === 0 && conditions.length > 1 && logicOperator === 'AND' && (
                    <span className="text-amber-600"> — try switching AND → OR if any one condition should be enough.</span>
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
            disabled={!name.trim() || !hasValidConditions || !hasValidActions}
            title={
              !name.trim() ? 'Enter a rule name' :
              !hasValidConditions ? 'Add valid conditions with values' :
              !hasValidActions ? 'Configure at least one action with a GL account' :
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

import { useState, useCallback, memo } from 'react';
import {
  Plus,
  Sparkles,
  Settings,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Zap,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { TransactionRule as UITransactionRule } from '@/types/bankingRules';
import { useTransactionRules, TransactionRule, CreateRuleInput } from '@/hooks/useTransactionRules';
import TransactionRuleDialog from './TransactionRuleDialog';

interface TransactionRulesPanelProps {
  onApplyRules?: () => void;
}

// Memoized rule item for performance
const RuleItem = memo(({ 
  rule, 
  isExpanded, 
  onToggleExpand, 
  onToggleActive, 
  onEdit, 
  onDuplicate, 
  onDelete,
  onRefresh,
  isRefreshing,
}: {
  rule: TransactionRule;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onEdit: (rule: TransactionRule) => void;
  onDuplicate: (rule: TransactionRule) => void;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  isRefreshing: boolean;
}) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  const getConditionSummary = (rule: TransactionRule) => {
    return rule.conditions
      .map((c) => {
        const fieldLabel = c.field.charAt(0).toUpperCase() + c.field.slice(1);
        const opLabel = c.operator.replace(/_/g, ' ');
        if (['is_deposit', 'is_withdrawal'].includes(c.operator)) {
          return opLabel;
        }
        return `${fieldLabel} ${opLabel} "${c.value}"${c.value2 ? ` and "${c.value2}"` : ''}`;
      })
      .join(` ${rule.logic_operator.toUpperCase()} `);
  };

  return (
    <Card className={cn('transition-all duration-150', !rule.is_active && 'opacity-60')}>
      <Collapsible>
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 mt-0.5"
                  onClick={() => onToggleExpand(rule.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground truncate">{rule.name}</h4>
                  {rule.actions.some(a => a.type === 'post_to_gl') && (
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary shrink-0">
                      <Sparkles className="w-3 h-3" />
                      AI
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {getConditionSummary(rule)}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {rule.matches_count} matches
                  </span>
                  {rule.last_matched_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last: {formatDate(rule.last_matched_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={rule.is_active}
                onCheckedChange={() => onToggleActive(rule.id, rule.is_active)}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRefresh(rule.id)} disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(rule)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(rule)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(rule.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t">
            <div className="pt-4 space-y-3">
              {rule.description && (
                <p className="text-sm text-muted-foreground">{rule.description}</p>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {rule.actions.map((action, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {action.type === 'categorize' && `Category: ${action.category}`}
                      {action.type === 'post_to_gl' && `GL: ${action.glAccountName}${action.departmentName ? ` • Div: ${action.departmentName}` : ''}`}
                      {action.type === 'add_memo' && `Memo: ${action.memo}`}
                      {action.type === 'flag_review' && 'Flag for Review'}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
});

RuleItem.displayName = 'RuleItem';

export default function TransactionRulesPanel({ onApplyRules }: TransactionRulesPanelProps) {
  const { rules, activeRules, isLoading, createRule, updateRule, deleteRule, toggleRuleActive, refreshRule } = useTransactionRules();
  const [refreshingRuleId, setRefreshingRuleId] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);

  const toggleExpanded = useCallback((ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  }, []);

  const handleToggleActive = useCallback((id: string, currentState: boolean) => {
    toggleRuleActive.mutate({ id, is_active: !currentState });
  }, [toggleRuleActive]);

  const handleEditRule = useCallback((rule: TransactionRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  }, []);

  const handleCreateRule = useCallback(() => {
    setEditingRule(null);
    setDialogOpen(true);
  }, []);

  const handleSaveRule = useCallback((ruleData: Partial<UITransactionRule>) => {
    const input: CreateRuleInput = {
      name: ruleData.name || '',
      description: ruleData.description,
      is_active: ruleData.isActive,
      conditions: ruleData.conditions || [],
      logic_operator: ruleData.logicOperator?.toLowerCase() as 'and' | 'or',
      actions: ruleData.actions || [],
      priority: ruleData.priority,
    };

    if (editingRule) {
      updateRule.mutate({
        id: editingRule.id,
        name: input.name,
        description: input.description || null,
        is_active: input.is_active,
        conditions: input.conditions,
        logic_operator: input.logic_operator,
        actions: input.actions,
        priority: input.priority,
      });
    } else {
      createRule.mutate(input);
    }
    setDialogOpen(false);
  }, [editingRule, createRule, updateRule]);

  const handleDeleteRule = useCallback((id: string) => {
    deleteRule.mutate(id);
  }, [deleteRule]);

  const handleDuplicateRule = useCallback((rule: TransactionRule) => {
    const input: CreateRuleInput = {
      name: `${rule.name} (Copy)`,
      description: rule.description || undefined,
      is_active: false,
      conditions: rule.conditions,
      logic_operator: rule.logic_operator,
      actions: rule.actions,
      priority: rule.priority,
    };
    createRule.mutate(input);
  }, [createRule]);

  const handleRefreshRule = useCallback((id: string) => {
    setRefreshingRuleId(id);
    refreshRule.mutate(id, {
      onSettled: () => setRefreshingRuleId(null),
    });
  }, [refreshRule]);

  // Convert DB rule to UI rule for dialog
  const convertToUIRule = (rule: TransactionRule): UITransactionRule => ({
    id: rule.id,
    name: rule.name,
    description: rule.description || undefined,
    isActive: rule.is_active,
    priority: rule.priority,
    conditions: rule.conditions,
    logicOperator: rule.logic_operator.toUpperCase() as 'AND' | 'OR',
    actions: rule.actions,
    matchCount: rule.matches_count,
    lastMatched: rule.last_matched_at ? new Date(rule.last_matched_at) : undefined,
    createdAt: new Date(rule.created_at),
    updatedAt: new Date(rule.updated_at),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Transaction Rules</h3>
            <p className="text-sm text-muted-foreground">
              {activeRules.length} active rule{activeRules.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onApplyRules}>
            <Zap className="w-4 h-4 mr-2" />
            Apply Rules
          </Button>
          <Button size="sm" onClick={handleCreateRule}>
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        {rules.length === 0 ? (
          <Card className="p-6 text-center">
            <Settings className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No rules yet. Create your first rule to get started.</p>
          </Card>
        ) : (
          rules.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              isExpanded={expandedRules.has(rule.id)}
              onToggleExpand={toggleExpanded}
              onToggleActive={handleToggleActive}
              onEdit={handleEditRule}
              onDuplicate={handleDuplicateRule}
              onRefresh={handleRefreshRule}
              isRefreshing={refreshingRuleId === rule.id}
              onDelete={handleDeleteRule}
            />
          ))
        )}
      </div>

      <TransactionRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule ? convertToUIRule(editingRule) : undefined}
        onSave={handleSaveRule}
      />
    </div>
  );
}

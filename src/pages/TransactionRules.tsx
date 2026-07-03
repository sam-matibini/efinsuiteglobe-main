import { useState, useCallback, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Settings, 
  Zap, 
  Brain, 
  Filter,
  Search,
  RefreshCw,
  Loader2,
  Building2,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  CreditCard,
  Landmark,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useTransactionRules, TransactionRule, CreateRuleInput } from '@/hooks/useTransactionRules';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useBankTransactions, BankTransaction } from '@/hooks/useBankTransactions';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCreditCards, useCreditCardTransactions, CreditCardTransaction } from '@/hooks/useCreditCards';
import { analyzeTransactions, AnalysisResult, useProcessTransactions } from '@/hooks/useRuleAnalysis';
import { analyzeCCTransactions, CCAnalysisResult, useProcessCCTransactions } from '@/hooks/useCreditCardRuleAnalysis';
import TransactionRuleDialog from '@/components/banking/TransactionRuleDialog';
import AnalyzePostDialog from '@/components/banking/AnalyzePostDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { TransactionRule as UITransactionRule, RuleCondition, RuleAction } from '@/types/bankingRules';

type AnalysisSource = 'bank' | 'credit-card';

export default function TransactionRules() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { accounts } = useBankAccounts();
  const { rules, activeRules, isLoading, createRule, updateRule, deleteRule, toggleRuleActive } = useTransactionRules();
  
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeDialogOpen, setAnalyzeDialogOpen] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);

  // State for analysis source selection
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>('bank');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string>('');

  // Get all bank accounts and credit cards
  const { accounts: bankAccounts } = useBankAccounts();
  const { creditCards } = useCreditCards();
  
  // Auto-select first account when loaded
  useMemo(() => {
    if (bankAccounts.length > 0 && !selectedBankAccountId) {
      setSelectedBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, selectedBankAccountId]);
  
  useMemo(() => {
    if (creditCards.length > 0 && !selectedCreditCardId) {
      setSelectedCreditCardId(creditCards[0].id);
    }
  }, [creditCards, selectedCreditCardId]);

  // Get transactions based on selected source
  const { transactions: bankTransactions } = useBankTransactions(selectedBankAccountId);
  const { transactions: ccTransactions } = useCreditCardTransactions(
    selectedCreditCardId, 
    creditCards.find(c => c.id === selectedCreditCardId)?.gl_account_id
  );
  
  // Calculate eligible transactions for analysis (pending/unmatched without category)
  const eligibleBankTransactions = useMemo(() => 
    bankTransactions.filter(t => 
      (t.status === 'unmatched' || t.status === 'pending') && !t.category
    ), [bankTransactions]);
    
  const eligibleCCTransactions = useMemo(() => 
    ccTransactions.filter(t => 
      (t.status === 'pending' || t.status === 'unmatched' || !t.status) && 
      !t.category && t.status !== 'reconciled'
    ), [ccTransactions]);
  
  const currentEligibleCount = analysisSource === 'bank' 
    ? eligibleBankTransactions.length 
    : eligibleCCTransactions.length;

  const processBankRules = useProcessTransactions();
  const processCCRules = useProcessCCTransactions();

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

  // Analyze transactions against rules
  const handleAnalyzeTransactions = useCallback(async () => {
    if (currentEligibleCount === 0) {
      toast.info('No eligible transactions to analyze');
      return;
    }

    if (activeRules.length === 0) {
      toast.info('No active rules. Create and enable rules first.');
      return;
    }

    setAnalyzing(true);
    
    try {
      if (analysisSource === 'bank') {
        // Analyze bank transactions
        const results = analyzeTransactions(bankTransactions, activeRules);
        const matched = results.filter(r => r.matchedRule !== null);
        
        if (matched.length === 0) {
          toast.info('No transactions matched any rules');
          setAnalyzing(false);
          return;
        }
        
        setAnalysisResults(results);
        setAnalyzeDialogOpen(true);
        toast.success(`Analyzed ${results.length} bank transactions • ${matched.length} matched`);
      } else {
        // Analyze credit card transactions
        const results = analyzeCCTransactions(ccTransactions as CreditCardTransaction[], activeRules);
        const matched = results.filter(r => r.matchedRule !== null);
        
        if (matched.length === 0) {
          toast.info('No transactions matched any rules');
          setAnalyzing(false);
          return;
        }
        
        // Process CC transactions directly
        await processCCRules.mutateAsync({
          analysisResults: matched,
          organizationId: organization?.id || '',
          creditCardId: selectedCreditCardId,
        });
        
        toast.success(`Processed ${matched.length} credit card transactions`);
      }
    } catch (error) {
      toast.error('Failed to analyze transactions');
    }
    
    setAnalyzing(false);
  }, [currentEligibleCount, activeRules, analysisSource, bankTransactions, ccTransactions, organization?.id, selectedCreditCardId, processCCRules]);

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

  // Filter rules based on tab and search
  const filteredRules = useMemo(() => {
    let result = rules;
    
    if (activeTab === 'active') {
      result = result.filter(r => r.is_active);
    } else if (activeTab === 'inactive') {
      result = result.filter(r => !r.is_active);
    } else if (activeTab === 'ai') {
      result = result.filter(r => r.actions.some(a => a.type === 'post_to_gl'));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [rules, activeTab, searchQuery]);

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing transaction rules.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transaction Rules</h1>
          <p className="text-muted-foreground">AI-powered rules for automatic transaction categorization</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Source selector */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button
              variant={analysisSource === 'bank' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setAnalysisSource('bank')}
              className="gap-1.5"
            >
              <Landmark className="w-4 h-4" />
              Bank
            </Button>
            <Button
              variant={analysisSource === 'credit-card' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setAnalysisSource('credit-card')}
              className="gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              Credit Card
            </Button>
          </div>
          
          {/* Account/Card selector */}
          {analysisSource === 'bank' ? (
            <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={selectedCreditCardId} onValueChange={setSelectedCreditCardId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select credit card" />
              </SelectTrigger>
              <SelectContent>
                {creditCards.map(card => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {currentEligibleCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <AlertCircle className="w-3 h-3" />
              {currentEligibleCount} pending
            </Badge>
          )}
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleAnalyzeTransactions}
            disabled={analyzing || activeRules.length === 0 || currentEligibleCount === 0}
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 mr-2" />
            )}
            Analyze & Post to GL
          </Button>
          <Button variant="outline" size="sm" onClick={handleCreateRule}>
            <Plus className="w-4 h-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Rules</p>
              <p className="text-2xl font-bold text-foreground">{rules.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Rules</p>
              <p className="text-2xl font-bold text-success">{activeRules.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">GL Posting Rules</p>
              <p className="text-2xl font-bold text-blue-500">
                {rules.filter(r => r.actions.some(a => a.type === 'post_to_gl')).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Matches</p>
              <p className="text-2xl font-bold text-purple-500">
                {rules.reduce((sum, r) => sum + r.matches_count, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs and Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              <Settings className="w-4 h-4" />
              All Rules
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <Zap className="w-4 h-4" />
              Active
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="w-4 h-4" />
              GL Posting
            </TabsTrigger>
            <TabsTrigger value="inactive" className="gap-2">
              <Filter className="w-4 h-4" />
              Inactive
            </TabsTrigger>
          </TabsList>

          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {filteredRules.length === 0 ? (
            <Card className="p-8 text-center">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rules Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'No rules match your search criteria.'
                  : 'Create your first rule to automatically categorize transactions.'}
              </p>
              <Button onClick={handleCreateRule}>
                <Plus className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </Card>
          ) : (
            filteredRules.map((rule) => (
              <Card
                key={rule.id}
                className={cn(
                  'transition-all duration-200',
                  !rule.is_active && 'opacity-60'
                )}
              >
              <Collapsible open={expandedRules.has(rule.id)} onOpenChange={() => toggleExpanded(rule.id)}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 mt-0.5"
                          >
                            {expandedRules.has(rule.id) ? (
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
                                GL Post
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
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last: {formatDate(rule.last_matched_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggleActive(rule.id, rule.is_active)}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditRule(rule)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateRule(rule)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteRule(rule.id)}
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
            ))
          )}
        </TabsContent>
      </Tabs>

      <TransactionRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule ? convertToUIRule(editingRule) : undefined}
        onSave={handleSaveRule}
      />

      <AnalyzePostDialog
        open={analyzeDialogOpen}
        onOpenChange={setAnalyzeDialogOpen}
        analysisResults={analysisResults}
        organizationId={organization?.id || ''}
        onComplete={() => {
          setAnalysisResults([]);
        }}
      />
    </div>
  );
}

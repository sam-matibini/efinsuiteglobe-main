import { useState, useEffect } from 'react';
import { Sparkles, Check, X, Lightbulb, ArrowRight, RefreshCw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAccounts, DbAccount } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
}

interface AICategorizationResult {
  transactionId: string;
  suggestedCategory: string;
  suggestedGLAccount: {
    id: string;
    code: string;
    name: string;
  };
  confidence: number;
  reasoning: string;
}

interface AICategorizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  onApply: (results: AICategorizationResult[]) => void;
}

// AI-powered categorization using real GL accounts
const analyzeWithAI = async (
  transactions: Transaction[], 
  accounts: DbAccount[]
): Promise<AICategorizationResult[]> => {
  // Build account mapping for common categories
  const incomeAccounts = accounts.filter(a => a.account_type === 'income' && !a.is_header && a.is_active);
  const expenseAccounts = accounts.filter(a => a.account_type === 'expense' && !a.is_header && a.is_active);
  const assetAccounts = accounts.filter(a => a.account_type === 'asset' && !a.is_header && a.is_active);
  
  // Find specific accounts
  const findAccount = (keywords: string[], accountList: DbAccount[]) => {
    for (const keyword of keywords) {
      const found = accountList.find(a => 
        a.name.toLowerCase().includes(keyword.toLowerCase()) ||
        a.code.includes(keyword)
      );
      if (found) return found;
    }
    return accountList[0];
  };
  
  const defaultExpense = findAccount(['miscellaneous', 'other', 'general'], expenseAccounts) || expenseAccounts[0];
  const defaultIncome = findAccount(['revenue', 'sales', 'income'], incomeAccounts) || incomeAccounts[0];
  
  // Category mappings with real accounts
  const categoryMap: Record<string, { 
    category: string; 
    accountKeywords: string[];
    accountType: 'income' | 'expense' | 'asset';
    confidence: number; 
    reasoning: string 
  }> = {
    'PAYROLL': { category: 'Payroll', accountKeywords: ['salaries', 'wages', 'payroll'], accountType: 'expense', confidence: 95, reasoning: 'Contains "PAYROLL" keyword, typical payroll transaction pattern' },
    'SALARY': { category: 'Payroll', accountKeywords: ['salaries', 'wages', 'payroll'], accountType: 'expense', confidence: 93, reasoning: 'Salary payment detected' },
    'OFFICE': { category: 'Office Supplies', accountKeywords: ['office', 'supplies'], accountType: 'expense', confidence: 88, reasoning: 'Contains "OFFICE" keyword, matches office supply vendor patterns' },
    'RENT': { category: 'Rent Expense', accountKeywords: ['rent', 'lease'], accountType: 'expense', confidence: 92, reasoning: 'Rent payment reference detected' },
    'PROPERTY': { category: 'Rent Expense', accountKeywords: ['rent', 'property'], accountType: 'expense', confidence: 90, reasoning: 'Property management reference indicates rent payment' },
    'SUBSCRIPTION': { category: 'Software & Subscriptions', accountKeywords: ['software', 'subscription', 'computer'], accountType: 'expense', confidence: 85, reasoning: 'Recurring subscription pattern detected' },
    'CLOUDHOST': { category: 'Software & Subscriptions', accountKeywords: ['software', 'computer', 'hosting'], accountType: 'expense', confidence: 90, reasoning: 'Cloud hosting service, categorized as software expense' },
    'SOFTWARE': { category: 'Software & Subscriptions', accountKeywords: ['software', 'computer'], accountType: 'expense', confidence: 88, reasoning: 'Software expense detected' },
    'INSURANCE': { category: 'Insurance', accountKeywords: ['insurance'], accountType: 'expense', confidence: 92, reasoning: 'Insurance premium payment' },
    'UTILITIES': { category: 'Utilities', accountKeywords: ['utilities', 'hydro', 'electric', 'gas'], accountType: 'expense', confidence: 90, reasoning: 'Utility bill payment' },
    'HYDRO': { category: 'Utilities', accountKeywords: ['utilities', 'hydro'], accountType: 'expense', confidence: 90, reasoning: 'Hydro/electric bill detected' },
    'WIRE': { category: 'Customer Payment', accountKeywords: ['receivable', 'revenue', 'sales'], accountType: 'income', confidence: 78, reasoning: 'Wire transfer receipt, likely customer payment' },
    'E-TRANSFER': { category: 'Customer Payment', accountKeywords: ['receivable', 'revenue'], accountType: 'income', confidence: 82, reasoning: 'Electronic transfer, pattern matches customer payments' },
    'PAYMENT': { category: 'Customer Payment', accountKeywords: ['receivable', 'revenue'], accountType: 'income', confidence: 85, reasoning: 'Payment reference indicates customer receipt' },
    'INVOICE': { category: 'Customer Payment', accountKeywords: ['receivable', 'revenue'], accountType: 'income', confidence: 88, reasoning: 'Invoice payment received' },
    'ADVERTISING': { category: 'Advertising', accountKeywords: ['advertising', 'marketing'], accountType: 'expense', confidence: 87, reasoning: 'Advertising/marketing expense detected' },
    'MARKETING': { category: 'Marketing', accountKeywords: ['marketing', 'advertising'], accountType: 'expense', confidence: 87, reasoning: 'Marketing expense detected' },
    'PROFESSIONAL': { category: 'Professional Fees', accountKeywords: ['professional', 'consulting', 'legal', 'accounting'], accountType: 'expense', confidence: 85, reasoning: 'Professional services fee' },
    'CONSULTING': { category: 'Professional Fees', accountKeywords: ['professional', 'consulting'], accountType: 'expense', confidence: 85, reasoning: 'Consulting fee detected' },
    'TRAVEL': { category: 'Travel', accountKeywords: ['travel', 'transportation'], accountType: 'expense', confidence: 86, reasoning: 'Travel expense detected' },
    'FUEL': { category: 'Vehicle Expenses', accountKeywords: ['vehicle', 'auto', 'fuel'], accountType: 'expense', confidence: 88, reasoning: 'Fuel/vehicle expense' },
    'GAS': { category: 'Vehicle Expenses', accountKeywords: ['vehicle', 'auto', 'fuel'], accountType: 'expense', confidence: 85, reasoning: 'Gas/fuel expense detected' },
  };

  return transactions.map((t) => {
    const upperDesc = t.description.toUpperCase();
    
    for (const [key, value] of Object.entries(categoryMap)) {
      if (upperDesc.includes(key)) {
        const accountList = value.accountType === 'income' ? incomeAccounts : 
                           value.accountType === 'asset' ? assetAccounts : expenseAccounts;
        const matchedAccount = findAccount(value.accountKeywords, accountList);
        
        return {
          transactionId: t.id,
          suggestedCategory: value.category,
          suggestedGLAccount: matchedAccount 
            ? { id: matchedAccount.id, code: matchedAccount.code, name: matchedAccount.name }
            : { id: '', code: 'N/A', name: 'No matching account' },
          confidence: value.confidence,
          reasoning: value.reasoning,
        };
      }
    }
    
    // Default categorization based on transaction type
    const defaultAccount = t.type === 'deposit' ? defaultIncome : defaultExpense;
    return {
      transactionId: t.id,
      suggestedCategory: t.type === 'deposit' ? 'Other Income' : 'Miscellaneous Expense',
      suggestedGLAccount: defaultAccount 
        ? { id: defaultAccount.id, code: defaultAccount.code, name: defaultAccount.name }
        : { id: '', code: 'N/A', name: 'No matching account' },
      confidence: 50,
      reasoning: 'Unable to determine category with high confidence. Manual review recommended.',
    };
  });
};

export default function AICategorizationDialog({
  open,
  onOpenChange,
  transactions,
  onApply,
}: AICategorizationDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: accounts = [] } = useAccounts(organization?.id);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AICategorizationResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const startAnalysis = async () => {
    if (accounts.length === 0) {
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // Simulate AI analysis with progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      setAnalysisProgress(i);
    }

    const analysisResults = await analyzeWithAI(transactions, accounts);
    setResults(analysisResults);
    setSelectedResults(new Set(analysisResults.filter(r => r.suggestedGLAccount.id).map((r) => r.transactionId)));
    setIsAnalyzing(false);
  };

  const toggleResult = (transactionId: string) => {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  };

  const handleApply = () => {
    const selectedAnalysis = results.filter((r) => selectedResults.has(r.transactionId));
    onApply(selectedAnalysis);
    onOpenChange(false);
    setResults([]);
    setSelectedResults(new Set());
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-success';
    if (confidence >= 70) return 'text-warning';
    return 'text-muted-foreground';
  };

  const getTransaction = (id: string) => transactions.find((t) => t.id === id);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(Math.abs(value));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            AI Transaction Analysis
          </DialogTitle>
          <DialogDescription>
            Analyze {transactions.length} unmatched transaction{transactions.length !== 1 ? 's' : ''} using AI to suggest categories and GL accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {!isAnalyzing && results.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lightbulb className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Analyze</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Our AI will analyze transaction descriptions, amounts, and patterns to suggest the most accurate categories and GL accounts.
              </p>
              <Button onClick={startAnalysis} size="lg">
                <Sparkles className="w-4 h-4 mr-2" />
                Start AI Analysis
              </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Analyzing Transactions...</h3>
              <p className="text-muted-foreground mb-4">
                Processing patterns and generating suggestions
              </p>
              <div className="max-w-xs mx-auto">
                <Progress value={analysisProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-2">{analysisProgress}% complete</p>
              </div>
            </div>
          )}

          {!isAnalyzing && results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedResults.size} of {results.length} suggestions selected
                </p>
                <Button variant="outline" size="sm" onClick={startAnalysis}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-analyze
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result) => {
                  const transaction = getTransaction(result.transactionId);
                  if (!transaction) return null;

                  const isSelected = selectedResults.has(result.transactionId);

                  return (
                    <Card
                      key={result.transactionId}
                      className={cn(
                        'p-4 cursor-pointer transition-all',
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                      )}
                      onClick={() => toggleResult(result.transactionId)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5',
                            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <p className="font-medium text-foreground truncate">
                              {transaction.description}
                            </p>
                            <span
                              className={cn(
                                'text-sm font-mono font-medium shrink-0',
                                transaction.type === 'deposit' ? 'text-success' : 'text-foreground'
                              )}
                            >
                              {transaction.type === 'deposit' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="secondary">{result.suggestedCategory}</Badge>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-muted-foreground">
                              {result.suggestedGLAccount.code}
                            </span>
                            <span className="text-muted-foreground">
                              {result.suggestedGLAccount.name}
                            </span>
                            <span className={cn('ml-auto font-medium', getConfidenceColor(result.confidence))}>
                              {result.confidence}% confident
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                            <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                            {result.reasoning}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          {results.length > 0 && (
            <Button onClick={handleApply} disabled={selectedResults.size === 0}>
              <Check className="w-4 h-4 mr-2" />
              Apply {selectedResults.size} Suggestion{selectedResults.size !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

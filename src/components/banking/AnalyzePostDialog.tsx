import { useState, useMemo } from 'react';
import {
  Brain,
  Sparkles,
  Check,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  BookOpen,
  Tag,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AnalysisResult, useProcessTransactions } from '@/hooks/useRuleAnalysis';

interface AnalyzePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisResults: AnalysisResult[];
  organizationId: string;
  onComplete?: () => void;
}

export default function AnalyzePostDialog({
  open,
  onOpenChange,
  analysisResults,
  organizationId,
  onComplete,
}: AnalyzePostDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const processTransactions = useProcessTransactions();

  // Initialize selection with all matched transactions
  useMemo(() => {
    const matchedIds = analysisResults
      .filter(r => r.matchedRule !== null)
      .map(r => r.transaction.id);
    setSelectedIds(new Set(matchedIds));
  }, [analysisResults]);

  const matchedResults = analysisResults.filter(r => r.matchedRule !== null);
  const unmatchedResults = analysisResults.filter(r => r.matchedRule === null);

  const selectedResults = analysisResults.filter(r => selectedIds.has(r.transaction.id));
  const willPostCount = selectedResults.filter(r => r.willPostToGL).length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === matchedResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(matchedResults.map(r => r.transaction.id)));
    }
  };

  const handleProcess = async () => {
    const toProcess = analysisResults.filter(r => selectedIds.has(r.transaction.id));
    
    await processTransactions.mutateAsync({
      analysisResults: toProcess,
      organizationId,
    });

    onComplete?.();
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(Math.abs(value));
  };

  const confidenceColors = {
    high: 'bg-success/10 text-success',
    medium: 'bg-warning/10 text-warning',
    low: 'bg-muted text-muted-foreground',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Analyze & Post to GL
          </DialogTitle>
          <DialogDescription>
            Review matched transactions before categorizing and posting to the General Ledger.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 py-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{analysisResults.length}</p>
            <p className="text-xs text-muted-foreground">Analyzed</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-success">{matchedResults.length}</p>
            <p className="text-xs text-muted-foreground">Matched</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{selectedIds.size}</p>
            <p className="text-xs text-muted-foreground">Selected</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{willPostCount}</p>
            <p className="text-xs text-muted-foreground">Will Post to GL</p>
          </div>
        </div>

        {/* Matched Transactions */}
        <div className="flex-1 min-h-0">
          {matchedResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  Matched Transactions ({matchedResults.length})
                </h4>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedIds.size === matchedResults.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-2">
                  {matchedResults.map((result) => (
                    <div
                      key={result.transaction.id}
                      className={cn(
                        'p-3 border rounded-lg transition-colors cursor-pointer',
                        selectedIds.has(result.transaction.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      )}
                      onClick={() => toggleSelect(result.transaction.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.has(result.transaction.id)}
                          onCheckedChange={() => toggleSelect(result.transaction.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {result.transaction.description}
                            </p>
                            <span className={cn(
                              "font-mono text-sm font-medium",
                              result.transaction.transaction_type === 'deposit' 
                                ? 'text-success' 
                                : 'text-foreground'
                            )}>
                              {result.transaction.transaction_type === 'deposit' ? '+' : '-'}
                              {formatCurrency(Number(result.transaction.amount))}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Sparkles className="w-3 h-3" />
                              {result.matchedRule?.name}
                            </Badge>
                            
                            <Badge className={cn('text-xs', confidenceColors[result.confidence])}>
                              {result.confidence} confidence
                            </Badge>
                            
                            {result.category && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Tag className="w-3 h-3" />
                                {result.category}
                              </Badge>
                            )}
                            
                            {result.willPostToGL && (
                              <Badge variant="outline" className="gap-1 text-xs text-blue-600 border-blue-200">
                                <BookOpen className="w-3 h-3" />
                                {result.glAccountName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Unmatched Transactions */}
          {unmatchedResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                No Rule Match ({unmatchedResults.length})
              </h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  {unmatchedResults.length} transaction{unmatchedResults.length !== 1 ? 's' : ''} did not match any rules. 
                  Create new rules or use AI categorization for these.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleProcess}
            disabled={selectedIds.size === 0 || processTransactions.isPending}
            className="gap-2"
          >
            {processTransactions.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Process {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
            {willPostCount > 0 && (
              <span className="text-xs opacity-80">
                ({willPostCount} → GL)
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from 'react';
import { Send, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePostJournalEntry, JournalEntryWithLines } from '@/hooks/useJournalEntries';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface BulkPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: JournalEntryWithLines[];
  organizationId: string;
}

export function BulkPostDialog({
  open,
  onOpenChange,
  entries,
  organizationId,
}: BulkPostDialogProps) {
  const { user } = useAuth();
  const postEntry = usePostJournalEntry();
  const { formatCurrency } = useCurrencyFormatter();
  
  // Only show draft entries
  const draftEntries = useMemo(() => 
    entries.filter(e => e.status === 'draft'), 
    [entries]
  );
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPosting, setIsPosting] = useState(false);
  const [results, setResults] = useState<{ id: string; success: boolean; error?: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  const toggleEntry = (id: string) => {
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
    if (selectedIds.size === draftEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(draftEntries.map(e => e.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    return format(parseLocalDate(dateStr), 'MMM d, yyyy');
  };

  const handleBulkPost = async () => {
    if (!user || selectedIds.size === 0) return;
    
    setIsPosting(true);
    setResults([]);
    
    const entriesToPost = draftEntries.filter(e => selectedIds.has(e.id));
    const postResults: { id: string; success: boolean; error?: string }[] = [];
    
    for (const entry of entriesToPost) {
      try {
        await postEntry.mutateAsync({
          id: entry.id,
          organizationId,
          userId: user.id,
        });
        postResults.push({ id: entry.id, success: true });
      } catch (error: any) {
        postResults.push({ 
          id: entry.id, 
          success: false, 
          error: error.message || 'Unknown error' 
        });
      }
    }
    
    setResults(postResults);
    setShowResults(true);
    setIsPosting(false);
    
    const successCount = postResults.filter(r => r.success).length;
    const failCount = postResults.filter(r => !r.success).length;
    
    if (failCount === 0) {
      toast.success(`Successfully posted ${successCount} journal entries`);
    } else if (successCount === 0) {
      toast.error(`Failed to post all ${failCount} entries`);
    } else {
      toast.warning(`Posted ${successCount} entries, ${failCount} failed`);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setResults([]);
    setShowResults(false);
    onOpenChange(false);
  };

  const selectedTotal = useMemo(() => {
    return draftEntries
      .filter(e => selectedIds.has(e.id))
      .reduce((sum, e) => {
        const debit = e.lines.reduce((s, l) => s + Number(l.debit), 0);
        return sum + debit;
      }, 0);
  }, [draftEntries, selectedIds]);

  if (draftEntries.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Bulk Post Journal Entries
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            No draft journal entries available to post.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Bulk Post Journal Entries
          </DialogTitle>
          <DialogDescription>
            Select draft journal entries to post to the General Ledger
          </DialogDescription>
        </DialogHeader>

        {showResults ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <span className="font-medium">{results.filter(r => r.success).length} Posted</span>
              </div>
              {results.some(r => !r.success) && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <span className="font-medium">{results.filter(r => !r.success).length} Failed</span>
                </div>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2">
                {results.map(result => {
                  const entry = entries.find(e => e.id === result.id);
                  if (!entry) return null;
                  
                  return (
                    <div 
                      key={result.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                        <div>
                          <p className="font-medium font-mono">{entry.reference}</p>
                          <p className="text-sm text-muted-foreground">{entry.description}</p>
                        </div>
                      </div>
                      {!result.success && (
                        <p className="text-sm text-destructive max-w-[200px] truncate">
                          {result.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <>
            {/* Selection header */}
            <div className="flex items-center justify-between py-2 px-1 border-b">
              <div className="flex items-center gap-3">
                <Checkbox 
                  checked={selectedIds.size === draftEntries.length && draftEntries.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} of {draftEntries.length} selected
                </span>
              </div>
              {selectedIds.size > 0 && (
                <Badge variant="secondary">
                  Total: {formatCurrency(selectedTotal)}
                </Badge>
              )}
            </div>

            {/* Entry list */}
            <ScrollArea className="flex-1 min-h-[300px] max-h-[400px]">
              <div className="space-y-1 p-1">
                {draftEntries.map(entry => {
                  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
                  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
                  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
                  
                  return (
                    <div 
                      key={entry.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleEntry(entry.id)}
                    >
                      <Checkbox 
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleEntry(entry.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium font-mono text-foreground">{entry.reference}</p>
                          <span className="text-xs text-muted-foreground">{formatDate(entry.entry_date)}</span>
                          {!isBalanced && (
                            <Badge variant="destructive" className="text-xs">Unbalanced</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{entry.description || 'No description'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">{formatCurrency(totalDebit)}</p>
                        <p className="text-xs text-muted-foreground">{entry.lines.length} lines</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="border-t pt-4">
          {showResults ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPosting}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkPost} 
                disabled={selectedIds.size === 0 || isPosting}
              >
                {isPosting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post {selectedIds.size} {selectedIds.size === 1 ? 'Entry' : 'Entries'}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

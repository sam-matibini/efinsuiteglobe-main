import { useState } from 'react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Calendar as CalendarIcon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { JournalEntryWithLines } from '@/hooks/useJournalEntries';

interface ReverseJournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: JournalEntryWithLines | null;
  onConfirm: (reversalDate: string) => void;
  isLoading?: boolean;
}

export function ReverseJournalEntryDialog({
  open,
  onOpenChange,
  entry,
  onConfirm,
  isLoading,
}: ReverseJournalEntryDialogProps) {
  const [reversalDate, setReversalDate] = useState<Date>(new Date());

  const handleConfirm = () => {
    const dateStr = format(reversalDate, 'yyyy-MM-dd');
    onConfirm(dateStr);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (!entry) return null;

  const totalDebits = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-cyan-600" />
            Reverse Journal Entry
          </DialogTitle>
          <DialogDescription>
            This will create a reversing entry that swaps all debits and credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entry Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entry Number:</span>
              <span className="font-mono font-medium">{entry.reference}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Original Date:</span>
              <span>{format(parseLocalDate(entry.entry_date), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-mono">{formatCurrency(totalDebits)}</span>
            </div>
            {entry.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">Description:</span>
                <p className="mt-1">{entry.description}</p>
              </div>
            )}
          </div>

          {/* Reversal Date Picker */}
          <div className="space-y-2">
            <Label htmlFor="reversal-date">Reversal Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="reversal-date"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !reversalDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reversalDate ? format(reversalDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reversalDate}
                  onSelect={(date) => date && setReversalDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              The reversing entry will be dated on this date.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-cyan-600 hover:bg-cyan-700"
          >
            {isLoading ? 'Reversing...' : 'Reverse Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

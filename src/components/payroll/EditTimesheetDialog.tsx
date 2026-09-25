import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseLocalDate } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTimesheets, TimesheetWithEmployee } from '@/hooks/useTimesheets';

interface EditTimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timesheet: TimesheetWithEmployee | null;
}

export function EditTimesheetDialog({ open, onOpenChange, timesheet }: EditTimesheetDialogProps) {
  const { updateTimesheet } = useTimesheets();
  
  const [periodStart, setPeriodStart] = useState<Date | undefined>();
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (timesheet) {
      setPeriodStart(parseLocalDate(timesheet.period_start));
      setPeriodEnd(parseLocalDate(timesheet.period_end));
      setNotes(timesheet.notes || '');
    }
  }, [timesheet]);

  const handleSubmit = () => {
    if (!timesheet || !periodStart || !periodEnd) return;

    updateTimesheet.mutate({
      id: timesheet.id,
      period_start: format(periodStart, 'yyyy-MM-dd'),
      period_end: format(periodEnd, 'yyyy-MM-dd'),
      notes: notes || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  if (!timesheet) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Input 
              value={`${timesheet.employees?.first_name || ''} ${timesheet.employees?.last_name || ''}`}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Employee cannot be changed</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !periodStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {periodStart ? format(periodStart, 'PP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodStart}
                    onSelect={setPeriodStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Period End *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !periodEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {periodEnd ? format(periodEnd, 'PP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodEnd}
                    onSelect={setPeriodEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!periodStart || !periodEnd || updateTimesheet.isPending}
          >
            {updateTimesheet.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
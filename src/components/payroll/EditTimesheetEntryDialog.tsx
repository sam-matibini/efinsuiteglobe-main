import { useState, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimesheetEntry } from '@/hooks/useTimesheets';

interface EditTimesheetEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimesheetEntry | null;
  periodStart: string;
  periodEnd: string;
  onSave: (id: string, updates: Partial<TimesheetEntry>) => void;
  isPending?: boolean;
}

export function EditTimesheetEntryDialog({ 
  open, 
  onOpenChange, 
  entry,
  periodStart,
  periodEnd,
  onSave,
  isPending = false,
}: EditTimesheetEntryDialogProps) {
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [breakDuration, setBreakDuration] = useState(0);
  const [regularHours, setRegularHours] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [taskDescription, setTaskDescription] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (entry) {
      setWorkDate(entry.work_date);
      setStartTime(entry.start_time?.slice(0, 5) || '');
      setEndTime(entry.end_time?.slice(0, 5) || '');
      setBreakDuration(entry.break_duration || 0);
      setRegularHours(entry.regular_hours);
      setOvertimeHours(entry.overtime_hours || 0);
      setTaskDescription(entry.task_description || '');
      setNotes(entry.notes || '');
    }
  }, [entry]);

  const calculateHours = (start: string, end: string, breakHrs: number) => {
    if (!start || !end) return 0;
    const startDate = new Date(`2000-01-01T${start}`);
    const endDate = new Date(`2000-01-01T${end}`);
    const minutes = differenceInMinutes(endDate, startDate) - (breakHrs * 60);
    return Math.max(0, minutes / 60);
  };

  // Auto-calculate hours when times change
  useEffect(() => {
    if (startTime && endTime) {
      const totalHours = calculateHours(startTime, endTime, breakDuration);
      setRegularHours(Math.min(totalHours, 8));
      setOvertimeHours(Math.max(0, totalHours - 8));
    }
  }, [startTime, endTime, breakDuration]);

  const handleSubmit = () => {
    if (!entry) return;

    onSave(entry.id, {
      work_date: workDate,
      start_time: startTime || null,
      end_time: endTime || null,
      break_duration: breakDuration,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      task_description: taskDescription || null,
      notes: notes || null,
    });
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              min={periodStart}
              max={periodEnd}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Break Duration (hours)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              max="4"
              value={breakDuration}
              onChange={(e) => setBreakDuration(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Regular Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={regularHours}
                onChange={(e) => setRegularHours(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Overtime Hours</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Task Description</Label>
            <Input
              placeholder="What did you work on?"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!workDate || isPending}
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
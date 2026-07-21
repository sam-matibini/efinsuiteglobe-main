// Timesheet Detail - Semi-Monthly Fix v3
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Pencil,
  Clock,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Send,
  FileText,
  Briefcase,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, eachDayOfInterval, differenceInMinutes, addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTimesheets, useTimesheetEntries, TimesheetStatus, TimesheetEntry } from '@/hooks/useTimesheets';
import { useEmployees } from '@/hooks/useEmployees';
import { usePayrollLocalization } from '@/hooks/usePayrollLocalization';
import { EditTimesheetEntryDialog } from '@/components/payroll/EditTimesheetEntryDialog';
import { toast } from 'sonner';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

const statusConfig: Record<TimesheetStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  approved: { label: 'Approved', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  processed: { label: 'Processed', color: 'bg-primary/10 text-primary', icon: CheckCircle2 },
};

// Entry mode types
type EntryMode = 'daily' | 'weekly' | 'semimonthly' | 'biweekly' | 'project';

// Sample projects - in production, this would come from the database
const sampleProjects = [
  { id: 'proj-1', name: 'Website Redesign', code: 'WEB-001' },
  { id: 'proj-2', name: 'Mobile App Development', code: 'MOB-002' },
  { id: 'proj-3', name: 'API Integration', code: 'API-003' },
  { id: 'proj-4', name: 'Database Migration', code: 'DB-004' },
  { id: 'proj-5', name: 'Client Support', code: 'SUP-005' },
];

export default function TimesheetDetail() {
  const confirmDelete = useConfirmDelete();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { timesheets, isLoading, submitTimesheet, approveTimesheet, rejectTimesheet } = useTimesheets();
  const { entries, createEntry, updateEntry, deleteEntry } = useTimesheetEntries(id);
  const { getEmployeeById } = useEmployees();
  usePayrollLocalization(); // Keep hook for side effects

  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [editEntryOpen, setEditEntryOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<TimesheetEntry | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [entryMode, setEntryMode] = useState<EntryMode>('daily');

  // Week/Period navigation within each mode
  const [currentWeeklyWeek, setCurrentWeeklyWeek] = useState(1);
  const [currentSemiMonthlyPeriod, setCurrentSemiMonthlyPeriod] = useState(1);
  const [currentBiweeklyWeek, setCurrentBiweeklyWeek] = useState(1);

  // New entry form state - Daily
  const [newEntry, setNewEntry] = useState({
    work_date: '',
    start_time: '',
    end_time: '',
    break_duration: 0,
    regular_hours: 0,
    overtime_hours: 0,
    task_description: '',
    notes: '',
  });

  // Weekly entry state
  const [weeklyEntries, setWeeklyEntries] = useState<Record<string, number>>({});

  // Semi-monthly entry state (all days split into two periods)
  const [semiMonthlyEntries, setSemiMonthlyEntries] = useState<Record<string, number>>({});

  // Biweekly entry state (14 days)
  const [biweeklyEntries, setBiweeklyEntries] = useState<Record<string, number>>({});

  // Project-based entry state
  const [projectEntry, setProjectEntry] = useState({
    project_id: '',
    work_date: '',
    hours: 0,
    task_description: '',
    notes: '',
  });

  const timesheet = timesheets.find(t => t.id === id);
  const employee = timesheet?.employee_id ? getEmployeeById(timesheet.employee_id) : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!timesheet) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground">Timesheet not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/payroll/timesheets')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Timesheets
        </Button>
      </div>
    );
  }

  const status = statusConfig[timesheet.status];
  const StatusIcon = status.icon;
  const isDraft = timesheet.status === 'draft';
  const isSubmitted = timesheet.status === 'submitted';

  // Get all days in the timesheet period
  const periodDays = useMemo(() => {
    const start = parseLocalDate(timesheet.period_start);
    const end = parseLocalDate(timesheet.period_end);
    return eachDayOfInterval({ start, end }).map(day => ({
      date: format(day, 'yyyy-MM-dd'),
      dayName: format(day, 'EEE'),
      dayLabel: format(day, 'MMM d'),
      dayOfMonth: day.getDate(),
    }));
  }, [timesheet.period_start, timesheet.period_end]);

  // For weekly entry mode - split into weeks (7 days each)
  const weekDays = useMemo(() => {
    return periodDays.map((day, index) => ({
      ...day,
      weekNum: Math.floor(index / 7) + 1,
    }));
  }, [periodDays]);

  // Get unique week numbers for iteration
  const weekNumbers = useMemo(() => {
    const weeks = [...new Set(weekDays.map(d => d.weekNum))];
    return weeks.sort((a, b) => a - b);
  }, [weekDays]);

  // Helper for ordinal suffix
  const ordinalSuffix = (n: number) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'st';
    if (mod10 === 2 && mod100 !== 12) return 'nd';
    if (mod10 === 3 && mod100 !== 13) return 'rd';
    return 'th';
  };

  // Calculate weekly period labels for each week
  const weeklyPeriodLabels = useMemo(() => {
    const labels: Record<number, string> = {};
    
    weekNumbers.forEach(weekNum => {
      const daysInWeek = weekDays.filter(d => d.weekNum === weekNum);
      if (daysInWeek.length === 0) return;
      
      const first = parseLocalDate(daysInWeek[0].date);
      const last = parseLocalDate(daysInWeek[daysInWeek.length - 1].date);
      const lastSuffix = ordinalSuffix(last.getDate());
      
      const sameMonth = first.getMonth() === last.getMonth();
      if (sameMonth) {
        labels[weekNum] = `${format(first, 'MMM')} ${format(first, 'dd')}-${format(last, 'dd')}${lastSuffix}`;
      } else {
        labels[weekNum] = `${format(first, 'MMM dd')}-${format(last, 'MMM dd')}${lastSuffix}`;
      }
    });
    
    return labels;
  }, [weekDays, weekNumbers]);

  // Get semi-monthly days - split at 15th/16th boundary within the timesheet period
  const semiMonthlyDays = useMemo(() => {
    return periodDays.map((day) => ({
      ...day,
      periodNum: day.dayOfMonth <= 15 ? 1 : 2,
      monthName: format(parseLocalDate(day.date), 'MMMM'),
    }));
  }, [periodDays]);

  // Get dynamic period labels based on actual dates in each period
  const semiMonthlyPeriodLabels = useMemo(() => {
    const period1Days = semiMonthlyDays.filter((d) => d.periodNum === 1);
    const period2Days = semiMonthlyDays.filter((d) => d.periodNum === 2);

    const getLabel = (days: typeof period1Days) => {
      if (days.length === 0) return '';
      const first = parseLocalDate(days[0].date);
      const last = parseLocalDate(days[days.length - 1].date);

      const sameMonth = first.getMonth() === last.getMonth();
      const lastSuffix = ordinalSuffix(last.getDate());

      // Format: "Jan 01-08th" or "Jan 28-Feb 02nd"
      if (sameMonth) {
        return `${format(first, 'MMM')} ${format(first, 'dd')}-${format(last, 'dd')}${lastSuffix}`;
      }
      return `${format(first, 'MMM dd')}-${format(last, 'MMM dd')}${lastSuffix}`;
    };

    return {
      period1: getLabel(period1Days),
      period2: getLabel(period2Days),
    };
  }, [semiMonthlyDays]);

  // Get biweekly days (14 days)
  const biweeklyDays = useMemo(() => {
    const start = parseLocalDate(timesheet.period_start);
    return Array.from({ length: 14 }, (_, i) => {
      const day = addDays(start, i);
      return {
        date: format(day, 'yyyy-MM-dd'),
        dayName: format(day, 'EEE'),
        dayLabel: format(day, 'MMM d'),
        weekNum: i < 7 ? 1 : 2,
      };
    });
  }, [timesheet.period_start]);

  const calculateHours = (startTime: string, endTime: string, breakDuration: number) => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const minutes = differenceInMinutes(end, start) - (breakDuration * 60);
    return Math.max(0, minutes / 60);
  };

  const handleAddEntry = () => {
    if (!newEntry.work_date) {
      toast.error('Please select a date');
      return;
    }

    const hours = newEntry.start_time && newEntry.end_time
      ? calculateHours(newEntry.start_time, newEntry.end_time, newEntry.break_duration)
      : newEntry.regular_hours;

    createEntry.mutate({
      timesheet_id: timesheet.id,
      work_date: newEntry.work_date,
      start_time: newEntry.start_time || null,
      end_time: newEntry.end_time || null,
      break_duration: newEntry.break_duration,
      regular_hours: Math.min(hours, 8),
      overtime_hours: Math.max(0, hours - 8),
      project_id: null,
      task_description: newEntry.task_description || null,
      notes: newEntry.notes || null,
    }, {
      onSuccess: () => {
        setAddEntryOpen(false);
        resetEntryForms();
        toast.success('Entry added');
      },
    });
  };

  const handleAddWeeklyEntries = async () => {
    const entriesToAdd = Object.entries(weeklyEntries).filter(([_, hours]) => hours > 0);
    
    if (entriesToAdd.length === 0) {
      toast.error('Please enter hours for at least one day');
      return;
    }

    try {
      for (const [date, hours] of entriesToAdd) {
        await createEntry.mutateAsync({
          timesheet_id: timesheet.id,
          work_date: date,
          start_time: null,
          end_time: null,
          break_duration: 0,
          regular_hours: Math.min(hours, 8),
          overtime_hours: Math.max(0, hours - 8),
          project_id: null,
          task_description: null,
          notes: 'Weekly time entry',
        });
      }
      setAddEntryOpen(false);
      resetEntryForms();
      toast.success(`Added ${entriesToAdd.length} entries`);
    } catch (error) {
      toast.error('Failed to add some entries');
    }
  };

  const handleAddSemiMonthlyEntries = async () => {
    const entriesToAdd = Object.entries(semiMonthlyEntries).filter(([_, hours]) => hours > 0);
    
    if (entriesToAdd.length === 0) {
      toast.error('Please enter hours for at least one day');
      return;
    }

    try {
      for (const [date, hours] of entriesToAdd) {
        await createEntry.mutateAsync({
          timesheet_id: timesheet.id,
          work_date: date,
          start_time: null,
          end_time: null,
          break_duration: 0,
          regular_hours: Math.min(hours, 8),
          overtime_hours: Math.max(0, hours - 8),
          project_id: null,
          task_description: null,
          notes: 'Semi-monthly time entry',
        });
      }
      setAddEntryOpen(false);
      resetEntryForms();
      toast.success(`Added ${entriesToAdd.length} semi-monthly entries`);
    } catch (error) {
      toast.error('Failed to add some entries');
    }
  };

  const handleAddBiweeklyEntries = async () => {
    const entriesToAdd = Object.entries(biweeklyEntries).filter(([_, hours]) => hours > 0);
    
    if (entriesToAdd.length === 0) {
      toast.error('Please enter hours for at least one day');
      return;
    }

    try {
      for (const [date, hours] of entriesToAdd) {
        await createEntry.mutateAsync({
          timesheet_id: timesheet.id,
          work_date: date,
          start_time: null,
          end_time: null,
          break_duration: 0,
          regular_hours: Math.min(hours, 8),
          overtime_hours: Math.max(0, hours - 8),
          project_id: null,
          task_description: null,
          notes: 'Biweekly time entry',
        });
      }
      setAddEntryOpen(false);
      resetEntryForms();
      toast.success(`Added ${entriesToAdd.length} biweekly entries`);
    } catch (error) {
      toast.error('Failed to add some entries');
    }
  };

  const handleAddProjectEntry = () => {
    if (!projectEntry.project_id) {
      toast.error('Please select a project');
      return;
    }
    if (!projectEntry.work_date) {
      toast.error('Please select a date');
      return;
    }
    if (projectEntry.hours <= 0) {
      toast.error('Please enter hours worked');
      return;
    }

    const project = sampleProjects.find(p => p.id === projectEntry.project_id);

    createEntry.mutate({
      timesheet_id: timesheet.id,
      work_date: projectEntry.work_date,
      start_time: null,
      end_time: null,
      break_duration: 0,
      regular_hours: Math.min(projectEntry.hours, 8),
      overtime_hours: Math.max(0, projectEntry.hours - 8),
      project_id: projectEntry.project_id,
      task_description: `[${project?.code}] ${projectEntry.task_description || project?.name}`,
      notes: projectEntry.notes || null,
    }, {
      onSuccess: () => {
        setAddEntryOpen(false);
        resetEntryForms();
        toast.success('Project entry added');
      },
    });
  };

  const resetEntryForms = () => {
    setNewEntry({
      work_date: '',
      start_time: '',
      end_time: '',
      break_duration: 0,
      regular_hours: 0,
      overtime_hours: 0,
      task_description: '',
      notes: '',
    });
    setWeeklyEntries({});
    setSemiMonthlyEntries({});
    setBiweeklyEntries({});
    setProjectEntry({
      project_id: '',
      work_date: '',
      hours: 0,
      task_description: '',
      notes: '',
    });
  };

  const weeklyTotal = Object.values(weeklyEntries).reduce((sum, h) => sum + (h || 0), 0);
  const semiMonthlyTotal = Object.values(semiMonthlyEntries).reduce((sum, h) => sum + (h || 0), 0);
  const biweeklyTotal = Object.values(biweeklyEntries).reduce((sum, h) => sum + (h || 0), 0);

  const handleReject = () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    rejectTimesheet.mutate({ timesheetId: timesheet.id, reason: rejectReason }, {
      onSuccess: () => {
        setRejectDialogOpen(false);
        setRejectReason('');
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/payroll/timesheets')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                Timesheet - {employee?.first_name} {employee?.last_name}
              </h1>
              <Badge className={cn("gap-1", status.color)}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {format(parseLocalDate(timesheet.period_start), 'MMM d')} - {format(parseLocalDate(timesheet.period_end), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button variant="outline" onClick={() => setAddEntryOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Entry
              </Button>
              <Button onClick={() => submitTimesheet.mutate(timesheet.id)}>
                <Send className="w-4 h-4 mr-2" />
                Submit for Approval
              </Button>
            </>
          )}
          {isSubmitted && (
            <>
              <Button 
                variant="outline" 
                className="text-destructive"
                onClick={() => setRejectDialogOpen(true)}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button 
                className="bg-success hover:bg-success/90"
                onClick={() => approveTimesheet.mutate({ timesheetId: timesheet.id, method: 'manager' })}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{employee?.first_name} {employee?.last_name}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{employee?.employee_number}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regular Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold">{timesheet.total_regular_hours ?? 0}h</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overtime Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-2xl font-bold text-warning">{timesheet.total_overtime_hours ?? 0}h</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-success" />
              <span className="text-2xl font-bold text-success">{timesheet.total_hours ?? 0}h</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Time Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No time entries yet. {isDraft && 'Add entries to track work hours.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead className="text-right">Regular</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                  <TableHead>Task</TableHead>
                  {isDraft && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {format(parseLocalDate(entry.work_date), 'EEE, MMM d')}
                    </TableCell>
                    <TableCell>{entry.start_time?.slice(0, 5) || '-'}</TableCell>
                    <TableCell>{entry.end_time?.slice(0, 5) || '-'}</TableCell>
                    <TableCell>{entry.break_duration ?? 0}h</TableCell>
                    <TableCell className="text-right font-mono">{entry.regular_hours}h</TableCell>
                    <TableCell className="text-right font-mono text-warning">
                      {entry.overtime_hours ?? 0}h
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {entry.task_description || '-'}
                    </TableCell>
                    {isDraft && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              setSelectedEntry(entry);
                              setEditEntryOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive"
                            onClick={() => confirmDelete(() => deleteEntry.mutate(entry.id), { title: 'Delete time entry?' })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {timesheet.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{timesheet.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Rejection Reason */}
      {timesheet.status === 'rejected' && timesheet.rejection_reason && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Rejection Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{timesheet.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {/* Add Entry Dialog - Enhanced with Tabs */}
      <Dialog open={addEntryOpen} onOpenChange={(open) => {
        setAddEntryOpen(open);
        if (!open) resetEntryForms();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add Time Entry</DialogTitle>
          </DialogHeader>
          
          <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as EntryMode)} className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="grid w-full grid-cols-5 min-w-[600px]">
                <TabsTrigger value="daily" className="gap-1.5 text-xs sm:text-sm">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Daily
                </TabsTrigger>
                <TabsTrigger value="weekly" className="gap-1.5 text-xs sm:text-sm">
                  <CalendarRange className="w-3.5 h-3.5" />
                  Weekly
                </TabsTrigger>
                <TabsTrigger value="semimonthly" className="gap-1.5 text-xs sm:text-sm">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Semi-Monthly
                </TabsTrigger>
                <TabsTrigger value="biweekly" className="gap-1.5 text-xs sm:text-sm">
                  <CalendarRange className="w-3.5 h-3.5" />
                  Biweekly
                </TabsTrigger>
                <TabsTrigger value="project" className="gap-1.5 text-xs sm:text-sm">
                  <Briefcase className="w-3.5 h-3.5" />
                  Project
                </TabsTrigger>
              </TabsList>
            </ScrollArea>

            {/* Daily Entry Tab */}
            <TabsContent value="daily" className="mt-4">
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-4 pr-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={newEntry.work_date}
                      onChange={(e) => setNewEntry({ ...newEntry, work_date: e.target.value })}
                      min={timesheet.period_start}
                      max={timesheet.period_end}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={newEntry.start_time}
                        onChange={(e) => setNewEntry({ ...newEntry, start_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={newEntry.end_time}
                        onChange={(e) => setNewEntry({ ...newEntry, end_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Break (hours)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newEntry.break_duration}
                        onChange={(e) => setNewEntry({ ...newEntry, break_duration: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hours (if no start/end)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        value={newEntry.regular_hours}
                        onChange={(e) => setNewEntry({ ...newEntry, regular_hours: parseFloat(e.target.value) || 0 })}
                        disabled={!!newEntry.start_time && !!newEntry.end_time}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Task Description</Label>
                    <Input
                      value={newEntry.task_description}
                      onChange={(e) => setNewEntry({ ...newEntry, task_description: e.target.value })}
                      placeholder="What did you work on?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
                <Button onClick={handleAddEntry} disabled={createEntry.isPending}>
                  {createEntry.isPending ? 'Adding...' : 'Add Entry'}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Weekly Entry Tab */}
            <TabsContent value="weekly" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter hours for each day of the period. Leave blank for days not worked.
                </p>
                
                {/* Render only the current week */}
                {weekNumbers.includes(currentWeeklyWeek) && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-primary">
                      Week {currentWeeklyWeek}: {weeklyPeriodLabels[currentWeeklyWeek]}
                    </h4>
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="grid gap-2">
                        {weekDays.filter(d => d.weekNum === currentWeeklyWeek).map((day) => (
                          <div key={day.date} className="flex items-center gap-4">
                            <div className="w-28 font-medium">
                              <span className="text-foreground">{day.dayName}</span>
                              <span className="text-muted-foreground ml-2 text-sm">{day.dayLabel}</span>
                            </div>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              placeholder="0"
                              className="w-20"
                              value={weeklyEntries[day.date] || ''}
                              onChange={(e) => setWeeklyEntries({
                                ...weeklyEntries,
                                [day.date]: parseFloat(e.target.value) || 0,
                              })}
                            />
                            <span className="text-sm text-muted-foreground">hrs</span>
                            {(weeklyEntries[day.date] || 0) > 8 && (
                              <Badge variant="outline" className="text-warning border-warning text-xs">
                                +{((weeklyEntries[day.date] || 0) - 8).toFixed(1)}h OT
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Total:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{weeklyTotal.toFixed(1)}h</span>
                    {weeklyTotal > 40 && (
                      <Badge className="bg-warning/10 text-warning">
                        {(weeklyTotal - 40).toFixed(1)}h overtime
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4 flex justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
                  {currentWeeklyWeek > 1 && (
                    <Button variant="ghost" onClick={() => setCurrentWeeklyWeek(currentWeeklyWeek - 1)}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentWeeklyWeek < weekNumbers.length && (
                    <Button variant="ghost" onClick={() => setCurrentWeeklyWeek(currentWeeklyWeek + 1)}>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                  <Button onClick={handleAddWeeklyEntries} disabled={createEntry.isPending}>
                    {createEntry.isPending ? 'Adding...' : `Add ${Object.values(weeklyEntries).filter(h => h > 0).length} Entries`}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>

            {/* Semi-Monthly Entry Tab */}
            <TabsContent value="semimonthly" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter hours for each day. This view splits the current timesheet range at the 15th/16th boundary.
                </p>
                
                {/* Show only current period */}
                {currentSemiMonthlyPeriod === 1 && semiMonthlyDays.filter(d => d.periodNum === 1).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-primary">{semiMonthlyPeriodLabels.period1}</h4>
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="grid gap-2">
                        {semiMonthlyDays.filter(d => d.periodNum === 1).map((day) => (
                          <div key={day.date} className="flex items-center gap-4">
                            <div className="w-28 font-medium">
                              <span className="text-foreground">{day.dayName}</span>
                              <span className="text-muted-foreground ml-2 text-sm">{day.dayLabel}</span>
                            </div>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              placeholder="0"
                              className="w-20"
                              value={semiMonthlyEntries[day.date] || ''}
                              onChange={(e) => setSemiMonthlyEntries({
                                ...semiMonthlyEntries,
                                [day.date]: parseFloat(e.target.value) || 0,
                              })}
                            />
                            <span className="text-sm text-muted-foreground">hrs</span>
                            {(semiMonthlyEntries[day.date] || 0) > 8 && (
                              <Badge variant="outline" className="text-warning border-warning text-xs">
                                +{((semiMonthlyEntries[day.date] || 0) - 8).toFixed(1)}h OT
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {currentSemiMonthlyPeriod === 2 && semiMonthlyDays.filter(d => d.periodNum === 2).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-primary">{semiMonthlyPeriodLabels.period2}</h4>
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="grid gap-2">
                        {semiMonthlyDays.filter(d => d.periodNum === 2).map((day) => (
                          <div key={day.date} className="flex items-center gap-4">
                            <div className="w-28 font-medium">
                              <span className="text-foreground">{day.dayName}</span>
                              <span className="text-muted-foreground ml-2 text-sm">{day.dayLabel}</span>
                            </div>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              placeholder="0"
                              className="w-20"
                              value={semiMonthlyEntries[day.date] || ''}
                              onChange={(e) => setSemiMonthlyEntries({
                                ...semiMonthlyEntries,
                                [day.date]: parseFloat(e.target.value) || 0,
                              })}
                            />
                            <span className="text-sm text-muted-foreground">hrs</span>
                            {(semiMonthlyEntries[day.date] || 0) > 8 && (
                              <Badge variant="outline" className="text-warning border-warning text-xs">
                                +{((semiMonthlyEntries[day.date] || 0) - 8).toFixed(1)}h OT
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Semi-Monthly Total:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{semiMonthlyTotal.toFixed(1)}h</span>
                    {semiMonthlyTotal > 80 && (
                      <Badge className="bg-warning/10 text-warning">
                        {(semiMonthlyTotal - 80).toFixed(1)}h overtime
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4 flex justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
                  {currentSemiMonthlyPeriod > 1 && semiMonthlyDays.filter(d => d.periodNum === 1).length > 0 && (
                    <Button variant="ghost" onClick={() => setCurrentSemiMonthlyPeriod(1)}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentSemiMonthlyPeriod === 1 && semiMonthlyDays.filter(d => d.periodNum === 2).length > 0 && (
                    <Button variant="ghost" onClick={() => setCurrentSemiMonthlyPeriod(2)}>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                  <Button onClick={handleAddSemiMonthlyEntries} disabled={createEntry.isPending}>
                    {createEntry.isPending ? 'Adding...' : `Add ${Object.values(semiMonthlyEntries).filter(h => h > 0).length} Entries`}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>

            {/* Biweekly Entry Tab */}
            <TabsContent value="biweekly" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter hours for a full 14-day pay period. Leave blank for days not worked.
                </p>
                
                {/* Show only current week */}
                {currentBiweeklyWeek === 1 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-primary">Week 1</h4>
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="grid gap-2">
                        {biweeklyDays.filter(d => d.weekNum === 1).map((day) => (
                          <div key={day.date} className="flex items-center gap-4">
                            <div className="w-28 font-medium">
                              <span className="text-foreground">{day.dayName}</span>
                              <span className="text-muted-foreground ml-2 text-sm">{day.dayLabel}</span>
                            </div>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              placeholder="0"
                              className="w-20"
                              value={biweeklyEntries[day.date] || ''}
                              onChange={(e) => setBiweeklyEntries({
                                ...biweeklyEntries,
                                [day.date]: parseFloat(e.target.value) || 0,
                              })}
                            />
                            <span className="text-sm text-muted-foreground">hrs</span>
                            {(biweeklyEntries[day.date] || 0) > 8 && (
                              <Badge variant="outline" className="text-warning border-warning text-xs">
                                +{((biweeklyEntries[day.date] || 0) - 8).toFixed(1)}h OT
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {currentBiweeklyWeek === 2 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-primary">Week 2</h4>
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="grid gap-2">
                        {biweeklyDays.filter(d => d.weekNum === 2).map((day) => (
                          <div key={day.date} className="flex items-center gap-4">
                            <div className="w-28 font-medium">
                              <span className="text-foreground">{day.dayName}</span>
                              <span className="text-muted-foreground ml-2 text-sm">{day.dayLabel}</span>
                            </div>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              placeholder="0"
                              className="w-20"
                              value={biweeklyEntries[day.date] || ''}
                              onChange={(e) => setBiweeklyEntries({
                                ...biweeklyEntries,
                                [day.date]: parseFloat(e.target.value) || 0,
                              })}
                            />
                            <span className="text-sm text-muted-foreground">hrs</span>
                            {(biweeklyEntries[day.date] || 0) > 8 && (
                              <Badge variant="outline" className="text-warning border-warning text-xs">
                                +{((biweeklyEntries[day.date] || 0) - 8).toFixed(1)}h OT
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="pt-4 border-t flex justify-between items-center">
                  <span className="font-medium">Biweekly Total:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{biweeklyTotal.toFixed(1)}h</span>
                    {biweeklyTotal > 80 && (
                      <Badge className="bg-warning/10 text-warning">
                        {(biweeklyTotal - 80).toFixed(1)}h overtime
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4 flex justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
                  {currentBiweeklyWeek > 1 && (
                    <Button variant="ghost" onClick={() => setCurrentBiweeklyWeek(1)}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentBiweeklyWeek === 1 && (
                    <Button variant="ghost" onClick={() => setCurrentBiweeklyWeek(2)}>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                  <Button onClick={handleAddBiweeklyEntries} disabled={createEntry.isPending}>
                    {createEntry.isPending ? 'Adding...' : `Add ${Object.values(biweeklyEntries).filter(h => h > 0).length} Entries`}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>

            {/* Project-Based Entry Tab */}
            <TabsContent value="project" className="mt-4">
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-4 pr-4">
                  <div className="space-y-2">
                    <Label>Project *</Label>
                    <Select
                      value={projectEntry.project_id}
                      onValueChange={(v) => setProjectEntry({ ...projectEntry, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {sampleProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {project.code}
                              </Badge>
                              {project.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={projectEntry.work_date}
                        onChange={(e) => setProjectEntry({ ...projectEntry, work_date: e.target.value })}
                        min={timesheet.period_start}
                        max={timesheet.period_end}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hours Worked *</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={projectEntry.hours || ''}
                        onChange={(e) => setProjectEntry({ ...projectEntry, hours: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Task Description</Label>
                    <Input
                      value={projectEntry.task_description}
                      onChange={(e) => setProjectEntry({ ...projectEntry, task_description: e.target.value })}
                      placeholder="What did you work on for this project?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={projectEntry.notes}
                      onChange={(e) => setProjectEntry({ ...projectEntry, notes: e.target.value })}
                      placeholder="Additional notes for this project entry..."
                      rows={2}
                    />
                  </div>
                  {projectEntry.project_id && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Briefcase className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {sampleProjects.find(p => p.id === projectEntry.project_id)?.name}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
                <Button onClick={handleAddProjectEntry} disabled={createEntry.isPending}>
                  {createEntry.isPending ? 'Adding...' : 'Add Project Entry'}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Timesheet</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason for Rejection *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a reason for rejecting this timesheet..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={rejectTimesheet.isPending}
            >
              {rejectTimesheet.isPending ? 'Rejecting...' : 'Reject Timesheet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <EditTimesheetEntryDialog
        open={editEntryOpen}
        onOpenChange={(open) => {
          setEditEntryOpen(open);
          if (!open) setSelectedEntry(null);
        }}
        entry={selectedEntry}
        periodStart={timesheet?.period_start || ''}
        periodEnd={timesheet?.period_end || ''}
        onSave={(id, updates) => {
          updateEntry.mutate({ id, ...updates }, {
            onSuccess: () => {
              setEditEntryOpen(false);
              setSelectedEntry(null);
              toast.success('Entry updated');
            },
          });
        }}
        isPending={updateEntry.isPending}
      />
    </div>
  );
}

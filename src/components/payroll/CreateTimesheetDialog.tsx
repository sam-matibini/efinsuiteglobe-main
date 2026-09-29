import { useState } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Calendar as CalendarIcon, Check, ChevronsUpDown, UserPlus, Search, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimesheets, TimesheetEntryType } from '@/hooks/useTimesheets';
import { AddEmployeeDialog } from '@/components/employees/AddEmployeeDialog';
import { useNavigate } from 'react-router-dom';

interface CreateTimesheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmployeeId?: string;
}

const entryTypeOptions = [
  { value: 'daily', label: 'Daily Time Entries', description: 'Employees enter hours worked each day with start/end times.' },
  { value: 'weekly', label: 'Weekly Summary', description: 'Employees enter total hours per day for the week.' },
  { value: 'project', label: 'Project/Task-Based', description: 'Hours logged against specific projects or tasks.' },
];

export function CreateTimesheetDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
}: CreateTimesheetDialogProps) {
  const { employees } = useEmployees();
  const { createTimesheet } = useTimesheets();
  
  const today = new Date();
  const defaultStart = startOfWeek(today, { weekStartsOn: 1 });
  const defaultEnd = endOfWeek(today, { weekStartsOn: 1 });

  const [employeeId, setEmployeeId] = useState(defaultEmployeeId || '');
  const [periodStart, setPeriodStart] = useState<Date>(defaultStart);
  const [periodEnd, setPeriodEnd] = useState<Date>(defaultEnd);
  const [entryType, setEntryType] = useState<TimesheetEntryType>('daily');
  const [notes, setNotes] = useState('');
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [entryTypeOpen, setEntryTypeOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!employeeId) return;

    createTimesheet.mutate({
      employee_id: employeeId,
      period_start: format(periodStart, 'yyyy-MM-dd'),
      period_end: format(periodEnd, 'yyyy-MM-dd'),
      entry_type: entryType,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        resetForm();
      },
    });
  };

  const resetForm = () => {
    setEmployeeId(defaultEmployeeId || '');
    setPeriodStart(defaultStart);
    setPeriodEnd(defaultEnd);
    setEntryType('daily');
    setNotes('');
  };

  // Include active and onboarding employees for timesheet creation
  const eligibleEmployees = employees.filter(e => e.status === 'active' || e.status === 'onboarding');
  const selectedEmployee = eligibleEmployees.find(e => e.id === employeeId);
  const selectedEntryType = entryTypeOptions.find(e => e.value === entryType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Timesheet</DialogTitle>
          <DialogDescription>
            Create a new timesheet for an employee to track their work hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Searchable Employee Select with Lookup */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Employee *</Label>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => setAddEmployeeOpen(true)}
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Add New
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add a new employee</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => navigate('/payroll/employees')}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View employee list</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={employeeOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedEmployee
                    ? `${selectedEmployee.first_name} ${selectedEmployee.last_name} (${selectedEmployee.employee_number})`
                    : "Select employee"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>No employees found.</CommandEmpty>
                    <CommandGroup>
                      {eligibleEmployees.map(emp => (
                        <CommandItem
                          key={emp.id}
                          value={`${emp.first_name} ${emp.last_name} ${emp.employee_number}`}
                          onSelect={() => {
                            setEmployeeId(emp.id);
                            setEmployeeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              employeeId === emp.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{emp.first_name} {emp.last_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {emp.employee_number} • {emp.department || 'No department'}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
                    {periodStart ? format(periodStart, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodStart}
                    onSelect={(date) => date && setPeriodStart(date)}
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
                    {periodEnd ? format(periodEnd, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={periodEnd}
                    onSelect={(date) => date && setPeriodEnd(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Searchable Entry Type Select */}
          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Popover open={entryTypeOpen} onOpenChange={setEntryTypeOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={entryTypeOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedEntryType?.label || "Select entry type"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search entry types..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>No entry types found.</CommandEmpty>
                    <CommandGroup>
                      {entryTypeOptions.map(option => (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          onSelect={() => {
                            setEntryType(option.value as TimesheetEntryType);
                            setEntryTypeOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              entryType === option.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes for this timesheet..."
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
            disabled={!employeeId || createTimesheet.isPending}
          >
            {createTimesheet.isPending ? 'Creating...' : 'Create Timesheet'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Employee Dialog */}
      <AddEmployeeDialog
        open={addEmployeeOpen}
        onOpenChange={setAddEmployeeOpen}
        onSuccess={() => setAddEmployeeOpen(false)}
      />
    </Dialog>
  );
}

import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { appointmentStart, appointmentsOnDay, monthCells, sameDay } from '@/lib/receptionist/schedule';
import type { ReceptionAppointment, ReceptionDepartment } from '@/lib/receptionist/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEPARTMENTS: ReceptionDepartment[] = ['general', 'accounting', 'payroll', 'tax', 'billing'];

interface ReceptionScheduleProps {
  appointments: ReceptionAppointment[];
  notepad: string;
  onSaveNotepad: (value: string) => void;
  onAddAppointment: (appointment: { customerName: string; department: ReceptionDepartment; startsAt: string; notes: string }) => void;
}

export function ReceptionSchedule({ appointments, notepad, onSaveNotepad, onAddAppointment }: ReceptionScheduleProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [name, setName] = useState('');
  const [time, setTime] = useState('10:00');
  const [department, setDepartment] = useState<ReceptionDepartment>('general');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(notepad);
  const cells = monthCells(cursor);
  const dayItems = appointmentsOnDay(appointments, selected);
  const title = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(cursor);

  const add = () => {
    const startsAt = appointmentStart(selected, time);
    if (!name.trim() || !startsAt) return;
    onAddAppointment({ customerName: name.trim(), department, startsAt, notes: notes.trim() });
    setName('');
    setNotes('');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="p-4" data-testid="reception-calendar">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-medium">Calendar</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Previous month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="min-w-32 text-center text-sm font-medium">{title}</p>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Next month" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((day) => <div key={day} className="py-1">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const count = appointmentsOnDay(appointments, cell.date).length;
            const isSelected = sameDay(cell.date, selected);
            const label = new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }).format(cell.date);
            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                className={`flex h-10 flex-col items-center justify-center rounded-md text-sm ${
                  isSelected ? 'bg-primary text-primary-foreground' : cell.inMonth ? 'hover:bg-muted' : 'text-muted-foreground/50'
                }`}
                onClick={() => {
                  setSelected(cell.date);
                  if (!cell.inMonth) setCursor(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                }}
              >
                {cell.date.getDate()}
                {count > 0 && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-cyan-200' : 'bg-cyan-500'}`} />}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-2 border-t pt-3">
          <p className="text-sm font-medium">{new Intl.DateTimeFormat('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }).format(selected)}</p>
          {dayItems.length === 0 && <p className="text-sm text-muted-foreground">No appointments this day.</p>}
          {dayItems.map((item) => (
            <p key={item.id} className="text-sm">
              {new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(new Date(item.startsAt))}
              {' · '}{item.customerName} · {item.department}
              {item.notes ? ` · ${item.notes}` : ''}
            </p>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label="Appointment name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Caller or customer" />
            <Input aria-label="Appointment time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            <select aria-label="Appointment department" className="h-10 rounded-md border bg-background px-3 text-sm" value={department} onChange={(event) => setDepartment(event.target.value as ReceptionDepartment)}>
              {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Input aria-label="Appointment note" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Note" />
          </div>
          <Button type="button" variant="outline" onClick={add}>Add to calendar</Button>
        </div>
      </Card>
      <Card className="p-4" data-testid="reception-notepad">
        <div className="mb-3 flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          <h2 className="font-medium">Notepad</h2>
        </div>
        <Label htmlFor="reception-notepad" className="text-sm text-muted-foreground">Notes for the front desk. They stay with this organization.</Label>
        <Textarea
          id="reception-notepad"
          aria-label="Reception notepad"
          className="mt-2 min-h-64"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== notepad) onSaveNotepad(draft);
          }}
          placeholder="Call-back names, filing notes, or anything the next person on the desk should see."
        />
      </Card>
    </div>
  );
}

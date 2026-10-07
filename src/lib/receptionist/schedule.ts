import type { ReceptionAppointment } from './types';

export interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

export function monthCells(anchor: Date): CalendarCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, inMonth: date.getMonth() === anchor.getMonth() };
  });
}

export function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function appointmentsOnDay(items: ReceptionAppointment[], day: Date): ReceptionAppointment[] {
  return items.filter((item) => {
    const at = new Date(item.startsAt);
    return item.status === 'booked' && !Number.isNaN(at.getTime()) && sameDay(at, day);
  });
}

export function appointmentStart(day: Date, time: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const next = new Date(day);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

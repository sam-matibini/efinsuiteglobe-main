import { describe, expect, it } from 'vitest';
import { appointmentStart, appointmentsOnDay, monthCells, sameDay } from './schedule';
import type { ReceptionAppointment } from './types';

const booked: ReceptionAppointment = {
  id: 'a1',
  customerId: null,
  customerName: 'Jane Doe',
  department: 'payroll',
  startsAt: '2026-10-06T14:00:00.000Z',
  durationMinutes: 30,
  status: 'booked',
  notes: 'Pay stub question',
};

describe('receptionist schedule', () => {
  it('builds a six-week month and keeps October 4 in the month', () => {
    const cells = monthCells(new Date(2026, 9, 4));
    expect(cells).toHaveLength(42);
    expect(cells[0]?.date.getDay()).toBe(0);
    const today = cells.find((cell) => sameDay(cell.date, new Date(2026, 9, 4)));
    expect(today?.inMonth).toBe(true);
  });

  it('places a booked appointment on its local day and builds a start time', () => {
    const day = new Date(booked.startsAt);
    expect(appointmentsOnDay([booked, { ...booked, id: 'a2', status: 'cancelled' }], day)).toHaveLength(1);
    expect(appointmentsOnDay([booked], new Date(2026, 9, 4))).toHaveLength(0);
    const start = appointmentStart(new Date(2026, 9, 6), '10:30');
    expect(start).toBe(new Date(2026, 9, 6, 10, 30).toISOString());
    expect(appointmentStart(day, '25:00')).toBeNull();
  });
});
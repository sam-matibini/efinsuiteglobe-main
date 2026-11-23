import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClockWidget } from '@/components/timeAttendance/ClockWidget';

describe('ClockWidget', () => {
  it('shows clock in until the employee is punched in', () => {
    const onClockIn = vi.fn();
    const { rerender } = render(
      <ClockWidget
        dateLabel="Monday, October 5"
        scheduleLabel="8:00 AM – 4:30 PM"
        clockedIn={false}
        showBreak={false}
        onClockIn={onClockIn}
        onClockOut={vi.fn()}
        onStartBreak={vi.fn()}
        onEndBreak={vi.fn()}
      />,
    );
    expect(screen.getByText('Status: Not Clocked In')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CLOCK IN' }));
    expect(onClockIn).toHaveBeenCalledOnce();

    rerender(
      <ClockWidget
        dateLabel="Monday, October 5"
        scheduleLabel="8:00 AM – 4:30 PM"
        clockedIn
        clockInLabel="8:02 AM"
        elapsedMinutes={197}
        showBreak
        onClockIn={vi.fn()}
        onClockOut={vi.fn()}
        onStartBreak={vi.fn()}
        onEndBreak={vi.fn()}
      />,
    );
    expect(screen.getByText('8:02 AM')).toBeInTheDocument();
    expect(screen.getByText('Elapsed: 03:17')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CLOCK OUT' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Break' })).toBeInTheDocument();
  });
});

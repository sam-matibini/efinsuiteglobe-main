import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { currentPayPeriod, summarizePunches, workedMinutes } from '@/lib/timeClock';
import { useTimesheets, type Timesheet } from './useTimesheets';

type TimeClockPunch = Database['public']['Tables']['employee_time_clock_punches']['Row'];

export interface EmployeeLite {
  id: string;
  organization_id?: string | null;
  pay_frequency?: string | null;
}

interface UseTimeClockResult {
  openPunch: TimeClockPunch | null;
  openBreak: Database['public']['Tables']['employee_time_clock_breaks']['Row'] | null;
  todayPunches: TimeClockPunch[];
  periodPunches: TimeClockPunch[];
  periodTimesheet: Timesheet | undefined;
  summary: ReturnType<typeof summarizePunches>;
  liveElapsedMinutes: number | null;
  isLoading: boolean;
  isMutating: boolean;
  clockIn: () => void;
  startBreak: () => void;
  endBreak: () => void;
  clockOut: (note?: string) => void;
}

export function useTimeClock(employee: EmployeeLite | undefined | null): UseTimeClockResult {
  const queryClient = useQueryClient();
  const employeeId = employee?.id;

  // Reuse the existing submit flow so the card never forks approval logic
  const { submitTimesheet } = useTimesheets(employeeId);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const period = currentPayPeriod(employee?.pay_frequency);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['time-clock'] });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['timesheet-entries'] });
  };

  const punchesQuery = useQuery({
    queryKey: ['time-clock', 'period', employeeId, period.period_start],
    enabled: !!employeeId,
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_time_clock_punches')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', period.period_start)
        .lte('work_date', period.period_end)
        .order('clock_in_at');
      if (error) throw error;
      return data as TimeClockPunch[];
    },
  });

  const allPunches = punchesQuery.data ?? [];
  const openPunch = allPunches.find((p) => p.status === 'open') ?? null;
  const todayPunches = allPunches.filter((p) => p.work_date === todayStr);
  const periodPunches = allPunches.filter((p) => p.status === 'closed');

  const breaksQuery = useQuery({
    queryKey: ['time-clock', 'breaks', openPunch?.id],
    enabled: !!openPunch,
    queryFn: async () => {
      if (!openPunch) return [];
      const { data, error } = await supabase
        .from('employee_time_clock_breaks')
        .select('*')
        .eq('punch_id', openPunch.id)
        .order('break_start_at');
      if (error) throw error;
      return data as Array<
        Database['public']['Tables']['employee_time_clock_breaks']['Row']
      >;
    },
  });

  const breaks = breaksQuery.data ?? [];
  const openBreak = breaks.find((b) => !b.break_end_at) ?? null;
  const breakMinutesSoFar =
    openPunch?.break_minutes ||
    breaks.reduce((sum, b) => sum + (b.minutes ?? 0), 0) +
      (openBreak && openPunch
        ? Math.floor(
            (Date.now() - new Date(openBreak.break_start_at).getTime()) / 60000,
          )
        : 0);

  const liveElapsedMinutes = openPunch
    ? workedMinutes(openPunch.clock_in_at, new Date().toISOString(), breakMinutesSoFar)
    : null;

  // The timesheet these punches attach to (any covering the current period)
  const timesheetsQuery = useQuery({
    queryKey: ['time-clock', 'period-timesheet', employeeId, period.period_start],
    enabled: !!employeeId,
    initialData: [] as Timesheet[],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_timesheets')
        .select('*')
        .eq('employee_id', employeeId)
        .lte('period_start', period.period_end)
        .gte('period_end', period.period_start)
        .order('period_start', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Timesheet[];
    },
  });

  const periodTimesheet = (timesheetsQuery.data as Timesheet[] | undefined)?.[0];

  const clockIn = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error('No employee record linked to your account');
      if (openPunch) throw new Error('You are already clocked in');

      const { error } = await supabase.from('employee_time_clock_punches').insert({
        employee_id: employeeId,
        organization_id: employee?.organization_id ?? null,
        work_date: todayStr,
        clock_in_at: new Date().toISOString(),
        status: 'open',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Clocked in. Have a great shift!');
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const startBreak = useMutation({
    mutationFn: async () => {
      if (!openPunch) throw new Error('No open shift to start a break on');
      if (openBreak) throw new Error('You are already on a break');
      const { error } = await supabase.from('employee_time_clock_breaks').insert({
        punch_id: openPunch.id,
        break_start_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Break started');
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const endBreak = useMutation({
    mutationFn: async () => {
      if (!openBreak) throw new Error('No running break to end');
      const endAt = new Date();
      const minutes = Math.max(
        0,
        Math.round((endAt.getTime() - new Date(openBreak.break_start_at).getTime()) / 60000),
      );
      const { error } = await supabase
        .from('employee_time_clock_breaks')
        .update({ break_end_at: endAt.toISOString(), minutes })
        .eq('id', openBreak.id);
      if (error) throw error;

      // Keep the punch counter fresh for display; trigger re-sums at close
      await supabase
        .from('employee_time_clock_punches')
        .update({ break_minutes: (openPunch?.break_minutes ?? 0) + minutes })
        .eq('id', openBreak.punch_id);
    },
    onSuccess: () => {
      toast.success('Welcome back from your break');
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const clockOut = useMutation({
    mutationFn: async ({ note }: { note?: string } = {}) => {
      if (!openPunch) throw new Error('You are not clocked in');

      // Close any running break first so it counts into the shift total
      if (openBreak) {
        const endAt = new Date();
        const minutes = Math.max(
          0,
          Math.round((endAt.getTime() - new Date(openBreak.break_start_at).getTime()) / 60000),
        );
        await supabase
          .from('employee_time_clock_breaks')
          .update({ break_end_at: endAt.toISOString(), minutes })
          .eq('id', openBreak.id);
        await supabase
          .from('employee_time_clock_punches')
          .update({ break_minutes: (openPunch.break_minutes ?? 0) + minutes })
          .eq('id', openPunch.id);
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('employee_time_clock_punches')
        .update({
          status: 'closed',
          clock_out_at: now,
          notes: note?.trim() || null,
        })
        .eq('id', openPunch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Clocked out. Your hours were added to this pay period.');
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return {
    openPunch,
    openBreak,
    todayPunches,
    periodPunches,
    periodTimesheet,
    summary: summarizePunches(allPunches),
    liveElapsedMinutes,
    isLoading: punchesQuery.isLoading || breaksQuery.isLoading || timesheetsQuery.isLoading,
    isMutating:
      clockIn.isPending ||
      startBreak.isPending ||
      endBreak.isPending ||
      clockOut.isPending,
    clockIn: () => clockIn.mutate(),
    startBreak: () => startBreak.mutate(),
    endBreak: () => endBreak.mutate(),
    clockOut: (note?: string) => clockOut.mutate({ note }),
  };
}

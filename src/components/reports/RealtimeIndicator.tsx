import { useEffect, useRef, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { Loader2, CheckCircle2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { REPORT_QUERY_KEYS_LIST } from '@/hooks/useGLPropagation';

type IndicatorState = 'idle' | 'updating' | 'updated';

interface Props {
  lastEventAt?: number;
  className?: string;
}

const REPORT_KEY_SET = new Set(REPORT_QUERY_KEYS_LIST.map((k) => k[0]));

/**
 * Small status pill that signals when financial-report data is refreshing
 * because of an inbound realtime change (e.g. a posted/reversed journal entry).
 */
export function RealtimeIndicator({ lastEventAt, className }: Props) {
  const isFetching = useIsFetching({
    predicate: (q) => {
      const head = q.queryKey?.[0];
      return typeof head === 'string' && REPORT_KEY_SET.has(head);
    },
  });
  const [withinEventWindow, setWithinEventWindow] = useState(false);
  const [state, setState] = useState<IndicatorState>('idle');
  const prevUpdatingRef = useRef(false);
  const updatedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the 600ms window after a realtime event so we surface "Updating…"
  // even before any query has actually started fetching.
  useEffect(() => {
    if (!lastEventAt) return;
    setWithinEventWindow(true);
    const t = setTimeout(() => setWithinEventWindow(false), 600);
    return () => clearTimeout(t);
  }, [lastEventAt]);

  const updating = isFetching > 0 || withinEventWindow;

  useEffect(() => {
    if (updating) {
      if (updatedTimerRef.current) {
        clearTimeout(updatedTimerRef.current);
        updatedTimerRef.current = null;
      }
      setState('updating');
    } else if (prevUpdatingRef.current) {
      // Just finished updating — flash the "Updated" state briefly.
      setState('updated');
      updatedTimerRef.current = setTimeout(() => setState('idle'), 1500);
    }
    prevUpdatingRef.current = updating;
    return () => {
      // No cleanup on every render — only on unmount the final timer is cleared.
    };
  }, [updating]);

  useEffect(() => () => {
    if (updatedTimerRef.current) clearTimeout(updatedTimerRef.current);
  }, []);

  const config = {
    idle: {
      icon: <Radio className="h-3 w-3" />,
      label: 'Live',
      classes: 'text-muted-foreground border-border',
      dot: 'bg-emerald-500',
    },
    updating: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Updating…',
      classes: 'text-primary border-primary/40 bg-primary/5',
      dot: 'bg-primary',
    },
    updated: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: 'Updated',
      classes: 'text-emerald-600 border-emerald-500/40 bg-emerald-500/5',
      dot: 'bg-emerald-500',
    },
  }[state];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="status"
            aria-live="polite"
            aria-label={`Realtime status: ${config.label}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              config.classes,
              className,
            )}
          >
            {state === 'idle' ? (
              <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} aria-hidden />
            ) : (
              config.icon
            )}
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Reports refresh automatically when journal entries are posted or reversed.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default RealtimeIndicator;

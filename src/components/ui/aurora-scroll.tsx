import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuroraScrollProps {
  children: ReactNode;
  className?: string;
  /** Test id for the scroll region. The rail uses `${testId}-rail`. */
  testId?: string;
}

/**
 * A scroll area with a fixed indigo-to-cyan bar. The bar is a real element,
 * so it stays visible when the browser draws overlay scrollbars.
 */
export function AuroraScroll({ children, className, testId }: AuroraScrollProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 72, value: 0, max: 0 });

  const measure = () => {
    const el = scrollerRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    const track = rail.clientHeight;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const ratio = el.scrollHeight > 0 ? el.clientHeight / el.scrollHeight : 1;
    const height = maxScroll === 0 ? track : Math.max(72, Math.min(track, track * ratio));
    const maxTop = Math.max(0, track - height);
    const top = maxScroll === 0 ? 0 : (el.scrollTop / maxScroll) * maxTop;
    setThumb({ top, height, value: el.scrollTop, max: maxScroll });
  };

  useEffect(() => {
    measure();
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild instanceof Element) observer.observe(el.firstElementChild);
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const el = scrollerRef.current;
      const rail = railRef.current;
      if (!drag.current || !el || !rail) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const maxTop = rail.clientHeight - thumb.height;
      if (maxScroll <= 0 || maxTop <= 0) return;
      const delta = event.clientY - drag.current.y;
      el.scrollTop = drag.current.scroll + (delta / maxTop) * maxScroll;
    };
    const stop = () => {
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, [thumb.height]);

  const jumpTo = (clientY: number) => {
    const el = scrollerRef.current;
    const rail = railRef.current;
    if (!el || !rail) return;
    const rect = rail.getBoundingClientRect();
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    const next = ((clientY - rect.top) / rect.height) * maxScroll - el.clientHeight / 2;
    el.scrollTop = Math.min(maxScroll, Math.max(0, next));
  };

  return (
    <div className={cn('flex min-h-0', className)} data-testid={testId}>
      <div ref={scrollerRef} className="aurora-scroll-view min-h-0 min-w-0 flex-1 overflow-auto">
        {children}
      </div>
      <div
        ref={railRef}
        className="aurora-scroll-rail relative w-8 shrink-0 cursor-pointer border-l-2 border-indigo-300 bg-indigo-100"
        data-testid={testId ? `${testId}-rail` : 'aurora-scroll-rail'}
        role="scrollbar"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={Math.round(thumb.max)}
        aria-valuenow={Math.round(thumb.value)}
        onClick={(event) => {
          if ((event.target as HTMLElement).dataset.thumb === 'true') return;
          jumpTo(event.clientY);
        }}
      >
        <div
          data-thumb="true"
          className="absolute inset-x-1 rounded-full border-2 border-indigo-100 bg-gradient-to-b from-indigo-600 to-cyan-500 shadow-md"
          style={{ top: thumb.top, height: thumb.height }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            drag.current = { y: event.clientY, scroll: scrollerRef.current?.scrollTop ?? 0 };
          }}
        />
      </div>
    </div>
  );
}

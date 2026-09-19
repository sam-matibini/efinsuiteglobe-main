import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RstAgencyTotals } from '@/lib/rstAgencies';
import { formatQbPeriodLong } from '@/lib/gstHstStatement';

export interface SalesTaxAgencyCard extends RstAgencyTotals {
  periodStart: string;
  periodEnd: string;
  isCurrent?: boolean;
}

interface SalesTaxOverviewProps {
  cards: SalesTaxAgencyCard[];
  selectedId?: string;
  formatCurrency: (value: number) => string;
  onSelect: (id: string) => void;
}

export function SalesTaxOverview({ cards, selectedId, formatCurrency, onSelect }: SalesTaxOverviewProps) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    scroller.current?.scrollBy({ left: direction * 280, behavior: 'smooth' });
  };

  if (cards.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">Sales tax</h2>
      </div>
      <div className="flex items-stretch gap-2">
        {cards.length > 3 && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0 self-center" onClick={() => scroll(-1)} aria-label="Previous agencies">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <div ref={scroller} className="flex gap-4 overflow-x-auto pb-2 scroll-smooth flex-1">
          {cards.map((card) => {
            const selected = card.id === selectedId;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelect(card.id)}
                className={cn(
                  'min-w-[240px] max-w-[280px] flex-1 text-left rounded-xl border bg-card p-4 shadow-sm transition-colors',
                  selected ? 'border-[#2CA01C] ring-1 ring-[#2CA01C]' : 'border-border hover:border-muted-foreground/40',
                )}
              >
                <p className="text-sm font-medium text-foreground truncate">{card.agency}</p>
                <p className="text-2xl font-semibold tracking-tight mt-2">{formatCurrency(card.net)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatQbPeriodLong(card.periodStart, card.periodEnd)}</p>
                {card.isCurrent && (
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground mt-1">CURRENT PERIOD</p>
                )}
                <dl className="mt-4 space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Collected on sales</dt>
                    <dd className="font-mono">{formatCurrency(card.collected)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Paid on purchases</dt>
                    <dd className="font-mono">{formatCurrency(card.paidOnPurchases)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Adjustment</dt>
                    <dd className="font-mono">{formatCurrency(card.adjustment)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs font-medium flex justify-between border-t pt-2">
                  <span>{card.taxLabel}</span>
                  <span className="font-mono">{formatCurrency(card.net)}</span>
                </p>
              </button>
            );
          })}
        </div>
        {cards.length > 3 && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0 self-center" onClick={() => scroll(1)} aria-label="Next agencies">
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

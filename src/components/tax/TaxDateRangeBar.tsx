import { Calendar, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TAX_DATE_PRESET_OPTIONS,
  parseISODate,
  toISODate,
  type TaxDatePreset,
} from '@/lib/taxPeriodReport';

interface TaxDateRangeBarProps {
  preset: TaxDatePreset;
  start: Date;
  end: Date;
  periodLabel: string;
  countryCode?: string;
  isRefreshing?: boolean;
  onPresetChange: (preset: TaxDatePreset) => void;
  onStartChange: (date: Date) => void;
  onEndChange: (date: Date) => void;
  onRun?: () => void;
}

/** Zoho Books-style date range: preset + always-visible From/To + Run. */
export function TaxDateRangeBar({
  preset,
  start,
  end,
  periodLabel,
  countryCode,
  isRefreshing,
  onPresetChange,
  onStartChange,
  onEndChange,
  onRun,
}: TaxDateRangeBarProps) {
  const isFr = countryCode === 'BI';

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-muted/30 rounded-lg border mb-4">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Plage de dates' : 'Date Range'}</Label>
        <Select value={preset} onValueChange={(v) => onPresetChange(v as TaxDatePreset)}>
          <SelectTrigger className="w-[190px] h-9">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_DATE_PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {isFr ? option.labelFr : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Du' : 'From'}</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={toISODate(start)}
          onChange={(e) => {
            if (!e.target.value) return;
            onStartChange(parseISODate(e.target.value));
          }}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{isFr ? 'Au' : 'To'}</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={toISODate(end)}
          onChange={(e) => {
            if (!e.target.value) return;
            onEndChange(parseISODate(e.target.value));
          }}
        />
      </div>
      {onRun && (
        <Button type="button" size="sm" className="h-9" onClick={onRun} disabled={isRefreshing}>
          <Play className="w-3.5 h-3.5 mr-2" />
          {isFr ? 'Exécuter' : 'Run Report'}
        </Button>
      )}
      <Badge variant="outline" className="h-9 px-3 flex items-center">
        {periodLabel}
      </Badge>
      {isRefreshing && (
        <span className="text-xs text-muted-foreground">{isFr ? 'Mise à jour…' : 'Updating…'}</span>
      )}
    </div>
  );
}

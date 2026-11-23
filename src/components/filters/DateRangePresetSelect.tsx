import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { DateRangePresetId, DateRangePresetOption } from '@/lib/dateRangePresets';

interface DateRangePresetSelectProps {
  value?: string;
  onValueChange: (preset: DateRangePresetId) => void;
  presets: readonly DateRangePresetOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function DateRangePresetSelect({
  value,
  onValueChange,
  presets,
  placeholder = 'Date Range',
  className,
  triggerClassName,
}: DateRangePresetSelectProps) {
  return (
    <Select
      {...(value !== undefined ? { value } : {})}
      onValueChange={(next) => onValueChange(next as DateRangePresetId)}
    >
      <SelectTrigger className={cn('w-[220px]', triggerClassName)} aria-label="Date range">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn('max-h-80', className)}>
        {presets.map((preset) => (
          <SelectItem key={preset.id} value={preset.id}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

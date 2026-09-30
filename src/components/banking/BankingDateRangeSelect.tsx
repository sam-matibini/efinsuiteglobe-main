import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BANKING_DATE_RANGE_OPTIONS } from '@/lib/bankingDateRange';

interface BankingDateRangeSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  includeCustom?: boolean;
}

export function BankingDateRangeSelect({
  value,
  onValueChange,
  triggerClassName,
  includeCustom = true,
}: BankingDateRangeSelectProps) {
  const options = BANKING_DATE_RANGE_OPTIONS.filter((option) => includeCustom || option.value !== 'custom');
  const current = options.filter((option) => option.group === 'current');
  const previous = options.filter((option) => option.group === 'previous');

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="All Time" />
      </SelectTrigger>
      <SelectContent className="max-h-[var(--radix-select-content-available-height)]">
        <SelectItem value="all">All Time</SelectItem>
        <SelectGroup>
          <SelectLabel>Current</SelectLabel>
          {current.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Previous</SelectLabel>
          {previous.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectGroup>
        {includeCustom && <SelectItem value="custom">Custom Range</SelectItem>}
      </SelectContent>
    </Select>
  );
}

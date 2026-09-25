import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FormattedNumberInputProps {
  value: number | string;
  onChange: (value: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  step?: string;
}

export function FormattedNumberInput({
  value,
  onChange,
  onBlur,
  placeholder = '0.00',
  className,
  disabled = false,
  min = 0,
  step = '0.01',
}: FormattedNumberInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format number with commas
  const formatWithCommas = (num: number): string => {
    if (num === 0) return '';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Parse string to number, removing commas
  const parseNumber = (str: string): number => {
    const cleaned = str.replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Update display value when value prop changes (and not focused)
  useEffect(() => {
    if (!isFocused) {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
      setDisplayValue(numValue > 0 ? formatWithCommas(numValue) : '');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing (without commas)
    const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
    setDisplayValue(numValue > 0 ? numValue.toString() : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    const numValue = parseNumber(displayValue);
    setDisplayValue(numValue > 0 ? formatWithCommas(numValue) : '');
    onBlur?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty, numbers, and decimal point
    if (inputValue === '' || /^[\d]*\.?[\d]*$/.test(inputValue)) {
      setDisplayValue(inputValue);
      const numValue = parseNumber(inputValue);
      onChange(numValue);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn('text-right', className)}
      disabled={disabled}
    />
  );
}

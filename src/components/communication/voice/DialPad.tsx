import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DialPadProps {
  onDigitPress: (digit: string) => void;
  disabled?: boolean;
  className?: string;
}

const DIAL_PAD_KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export function DialPad({ onDigitPress, disabled = false, className }: DialPadProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {DIAL_PAD_KEYS.map(({ digit, letters }) => (
        <Button
          key={digit}
          variant="outline"
          className="h-14 w-full flex flex-col items-center justify-center gap-0 hover:bg-accent/10 active:scale-95 transition-transform"
          onClick={() => onDigitPress(digit)}
          disabled={disabled}
        >
          <span className="text-xl font-semibold">{digit}</span>
          {letters && (
            <span className="text-[10px] text-muted-foreground tracking-wider">{letters}</span>
          )}
        </Button>
      ))}
    </div>
  );
}

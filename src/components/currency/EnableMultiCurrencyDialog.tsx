import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBase: string;
  onConfirm: (baseCurrency: string) => void;
}

const COMMON = ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'JPY', 'CNY', 'INR', 'CHF', 'MXN'];

export function EnableMultiCurrencyDialog({ open, onOpenChange, defaultBase, onConfirm }: Props) {
  const [base, setBase] = useState(defaultBase || 'USD');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Enable Multi-Currency
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Enabling multi-currency allows you to record transactions in foreign currencies and translate them to your base currency.
            </span>
            <span className="block font-semibold text-foreground">
              ⚠️ Your base currency will be permanently locked once enabled. This cannot be changed after transactions begin.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label>Base Currency (locked after enable)</Label>
          <Select value={base} onValueChange={setBase}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(base)}>
            Enable & Lock
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Split Tax Display Component
 * 
 * Shows GST/PST/HST breakdown with optional combined rate toggle
 * 
 * IMPORTANT: This component is for DISPLAY only.
 * Actual tax calculation and GL posting must use separate values.
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { SplitTaxCalculation, TaxComponent } from '@/lib/splitTaxCalculator';

interface SplitTaxDisplayProps {
  calculation: SplitTaxCalculation;
  showCombinedToggle?: boolean;
  showCombined?: boolean;
  onShowCombinedChange?: (show: boolean) => void;
  compact?: boolean;
  className?: string;
  currencySymbol?: string;
}

export function SplitTaxDisplay({
  calculation,
  showCombinedToggle = true,
  showCombined = false,
  onShowCombinedChange,
  compact = false,
  className,
  currencySymbol = '$',
}: SplitTaxDisplayProps) {
  const formatAmount = (amount: number) => 
    `${currencySymbol}${amount.toFixed(2)}`;
  
  if (calculation.taxes.length === 0) {
    return (
      <div className={cn('text-muted-foreground text-sm', className)}>
        No Tax
      </div>
    );
  }
  
  // Combined display mode
  if (showCombined && calculation.taxes.length > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Tax ({calculation.combinedRate}%)
          </span>
          <span className="font-medium">
            {formatAmount(calculation.totalTax)}
          </span>
        </div>
        
        {showCombinedToggle && onShowCombinedChange && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              id="show-split"
              checked={!showCombined}
              onCheckedChange={(checked) => onShowCombinedChange(!checked)}
              className="scale-75"
            />
            <Label htmlFor="show-split" className="text-xs cursor-pointer">
              Show split breakdown
            </Label>
          </div>
        )}
      </div>
    );
  }
  
  // Split display mode (detailed)
  return (
    <div className={cn('space-y-2', className)}>
      {calculation.taxes.map((tax, index) => (
        <TaxLineItem 
          key={tax.code + index} 
          tax={tax} 
          currencySymbol={currencySymbol}
          compact={compact}
        />
      ))}
      
      {calculation.taxes.length > 1 && (
        <>
          <Separator className="my-1" />
          <div className="flex items-center justify-between font-medium">
            <span className="text-sm">Total Tax</span>
            <span>{formatAmount(calculation.totalTax)}</span>
          </div>
        </>
      )}
      
      {showCombinedToggle && onShowCombinedChange && calculation.taxes.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <Switch
            id="show-combined"
            checked={showCombined}
            onCheckedChange={onShowCombinedChange}
            className="scale-75"
          />
          <Label htmlFor="show-combined" className="text-xs cursor-pointer">
            Show combined ({calculation.combinedRate}%)
          </Label>
        </div>
      )}
    </div>
  );
}

interface TaxLineItemProps {
  tax: TaxComponent;
  currencySymbol: string;
  compact: boolean;
}

function TaxLineItem({ tax, currencySymbol, compact }: TaxLineItemProps) {
  const formatAmount = (amount: number) => 
    `${currencySymbol}${amount.toFixed(2)}`;
  
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {tax.code} ({tax.rate}%)
        </span>
        
        {!compact && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Badge 
                    variant={tax.isRecoverable ? 'default' : 'secondary'}
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    {tax.authority}
                  </Badge>
                  {!tax.isRecoverable && (
                    <Info className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {tax.isRecoverable 
                    ? 'Recoverable (Input Tax Credit eligible)'
                    : 'Non-recoverable (expense or capitalize)'
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <span className="font-medium tabular-nums">
        {formatAmount(tax.amount)}
      </span>
    </div>
  );
}

/**
 * Invoice Tax Summary Component
 * Shows tax breakdown in invoice style format
 */
interface InvoiceTaxSummaryProps {
  subtotal: number;
  calculation: SplitTaxCalculation;
  showCombined?: boolean;
  currencySymbol?: string;
  className?: string;
}

export function InvoiceTaxSummary({
  subtotal,
  calculation,
  showCombined = false,
  currencySymbol = '$',
  className,
}: InvoiceTaxSummaryProps) {
  const formatAmount = (amount: number) => 
    `${currencySymbol}${amount.toFixed(2)}`;
  
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-sm">
        <span>Subtotal:</span>
        <span className="tabular-nums">{formatAmount(subtotal)}</span>
      </div>
      
      {showCombined && calculation.taxes.length > 1 ? (
        <div className="flex justify-between text-sm">
          <span>Tax ({calculation.combinedRate}%):</span>
          <span className="tabular-nums">{formatAmount(calculation.totalTax)}</span>
        </div>
      ) : (
        calculation.taxes.map((tax, index) => (
          <div key={tax.code + index} className="flex justify-between text-sm">
            <span>{tax.code} ({tax.rate}%):</span>
            <span className="tabular-nums">{formatAmount(tax.amount)}</span>
          </div>
        ))
      )}
      
      {calculation.taxes.length > 1 && !showCombined && (
        <div className="flex justify-between text-sm border-t pt-1">
          <span>Total Tax:</span>
          <span className="tabular-nums">{formatAmount(calculation.totalTax)}</span>
        </div>
      )}
      
      <Separator className="my-2" />
      
      <div className="flex justify-between font-semibold">
        <span>Total:</span>
        <span className="tabular-nums">{formatAmount(subtotal + calculation.totalTax)}</span>
      </div>
    </div>
  );
}

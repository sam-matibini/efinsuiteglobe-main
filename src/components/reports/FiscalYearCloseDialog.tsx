/**
 * ============================================================================
 * FISCAL YEAR CLOSE DIALOG - GAAP/IFRS/ASPE COMPLIANT
 * ============================================================================
 * 
 * This dialog allows users to manually close fiscal years, which:
 * 1. Creates a closing journal entry that zeros out all income/expense accounts
 * 2. Transfers the net income/loss to Retained Earnings
 * 3. Records the close in fiscal_year_closes for audit trail
 * 
 * This is required per GAAP to properly close the books and maintain
 * the Balance Sheet equation: Assets = Liabilities + Equity
 * 
 * ============================================================================
 */

import { useState } from 'react';
import { Lock, AlertTriangle, CheckCircle, BookOpen, CheckSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFiscalYearClose } from '@/hooks/useFiscalYearClose';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

interface FiscalYearCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FiscalYearCloseDialog({ open, onOpenChange }: FiscalYearCloseDialogProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [closingProgress, setClosingProgress] = useState<{ current: number; total: number } | null>(null);
  
  const {
    unclosedYears,
    yearsNeedingClose,
    closeHistory,
    isLoading,
    isClosing,
    closeYear,
    closeYearAsync,
  } = useFiscalYearClose();
  
  const { formatCurrency } = useCurrencyFormatter();

  // Get only open years
  const openYears = unclosedYears.filter(y => !y.is_closed);

  const handleCloseYear = () => {
    if (!selectedYear) return;
    
    const yearData = unclosedYears.find(y => y.fiscal_year === selectedYear);
    if (!yearData) return;
    
    closeYear({
      fiscalYear: yearData.fiscal_year,
      fiscalYearStart: yearData.fiscal_year_start,
      fiscalYearEnd: yearData.fiscal_year_end,
      notes: notes || undefined,
    });
    
    setConfirmOpen(false);
    setSelectedYear(null);
    setNotes('');
  };

  const handleCloseAllSelected = async () => {
    const yearsToClose = selectedYears.length > 0 
      ? openYears.filter(y => selectedYears.includes(y.fiscal_year)).sort((a, b) => a.fiscal_year - b.fiscal_year)
      : openYears.sort((a, b) => a.fiscal_year - b.fiscal_year);
    
    if (yearsToClose.length === 0) return;

    setClosingProgress({ current: 0, total: yearsToClose.length });

    for (let i = 0; i < yearsToClose.length; i++) {
      const yearData = yearsToClose[i];
      setClosingProgress({ current: i + 1, total: yearsToClose.length });
      
      try {
        await closeYearAsync({
          fiscalYear: yearData.fiscal_year,
          fiscalYearStart: yearData.fiscal_year_start,
          fiscalYearEnd: yearData.fiscal_year_end,
          notes: notes || `Batch close - ${yearsToClose.length} years`,
        });
      } catch (error) {
        console.error(`Failed to close year ${yearData.fiscal_year}:`, error);
        break;
      }
    }

    setClosingProgress(null);
    setConfirmAllOpen(false);
    setSelectedYears([]);
    setNotes('');
  };

  const toggleYearSelection = (fiscalYear: number) => {
    setSelectedYears(prev => 
      prev.includes(fiscalYear) 
        ? prev.filter(y => y !== fiscalYear)
        : [...prev, fiscalYear]
    );
  };

  const toggleAllYears = () => {
    if (selectedYears.length === openYears.length) {
      setSelectedYears([]);
    } else {
      setSelectedYears(openYears.map(y => y.fiscal_year));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Fiscal Year Close
            </DialogTitle>
            <DialogDescription>
              Close fiscal years to transfer net income/loss to Retained Earnings. 
              This is required per GAAP/IFRS/ASPE to maintain balanced financial statements.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 p-1">
              {/* Warning Banner for Unclosed Years */}
              {yearsNeedingClose.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-800 dark:text-amber-200">
                        {yearsNeedingClose.length} Fiscal Year{yearsNeedingClose.length > 1 ? 's' : ''} Require Closing
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Unclosed fiscal years cause the Balance Sheet to be out of balance. 
                        Close prior years in chronological order to ensure accurate financial statements.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Unclosed Years Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Fiscal Years Requiring Close</h3>
                  {openYears.length > 1 && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setConfirmAllOpen(true)}
                      disabled={isClosing}
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      {selectedYears.length > 0 
                        ? `Close ${selectedYears.length} Selected` 
                        : `Close All ${openYears.length} Years`}
                    </Button>
                  )}
                </div>
                {isLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : unclosedYears.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No prior fiscal years with activity found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedYears.length === openYears.length && openYears.length > 0}
                            onCheckedChange={toggleAllYears}
                            disabled={openYears.length === 0}
                          />
                        </TableHead>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Net Income</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unclosedYears.map((year) => (
                        <TableRow key={year.fiscal_year}>
                          <TableCell>
                            {!year.is_closed && (
                              <Checkbox
                                checked={selectedYears.includes(year.fiscal_year)}
                                onCheckedChange={() => toggleYearSelection(year.fiscal_year)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            FY {year.fiscal_year}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(year.fiscal_year_start)} – {formatDate(year.fiscal_year_end)}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${year.net_income < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {formatCurrency(year.net_income)}
                          </TableCell>
                          <TableCell>
                            {year.is_closed ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Closed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Open
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!year.is_closed && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedYear(year.fiscal_year);
                                  setConfirmOpen(true);
                                }}
                                disabled={isClosing}
                              >
                                <Lock className="h-3 w-3 mr-1" />
                                Close Year
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <Separator />

              {/* Close History */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Close History</h3>
                {closeHistory.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No fiscal years have been closed yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead className="text-right">Net Income</TableHead>
                        <TableHead>Closed At</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closeHistory.map((close) => (
                        <TableRow key={close.id}>
                          <TableCell className="font-medium">
                            FY {close.fiscal_year}
                          </TableCell>
                          <TableCell className={`text-right font-mono ${close.net_income < 0 ? 'text-destructive' : 'text-green-600'}`}>
                            {formatCurrency(close.net_income)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(close.closed_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {close.notes || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Close Fiscal Year {selectedYear}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will create a closing journal entry that:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Zeros out all income and expense accounts for FY {selectedYear}</li>
                <li>Transfers the net income/loss to Retained Earnings</li>
                <li>Records the close for audit purposes</li>
              </ul>
              <p className="font-medium text-foreground">
                This action cannot be undone. Please ensure all FY {selectedYear} transactions are finalized.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4">
            <Label htmlFor="close-notes">Notes (Optional)</Label>
            <Textarea
              id="close-notes"
              placeholder="Add any notes about this year-end close..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCloseYear();
              }}
              disabled={isClosing}
            >
              {isClosing ? 'Closing...' : 'Confirm Close'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog for Closing All Years */}
      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Close {selectedYears.length > 0 ? selectedYears.length : openYears.length} Fiscal Year{(selectedYears.length > 0 ? selectedYears.length : openYears.length) > 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will create closing journal entries for the following fiscal years (in chronological order):
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm max-h-32 overflow-y-auto">
                {(selectedYears.length > 0 
                  ? openYears.filter(y => selectedYears.includes(y.fiscal_year))
                  : openYears
                ).sort((a, b) => a.fiscal_year - b.fiscal_year).map(y => (
                  <li key={y.fiscal_year}>
                    FY {y.fiscal_year}: {formatCurrency(y.net_income)}
                  </li>
                ))}
              </ul>
              <p className="font-medium text-foreground">
                This action cannot be undone. Please ensure all transactions are finalized.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {closingProgress && (
            <div className="my-4 p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium">
                Closing year {closingProgress.current} of {closingProgress.total}...
              </div>
              <div className="w-full bg-background rounded-full h-2 mt-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all" 
                  style={{ width: `${(closingProgress.current / closingProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="my-4">
            <Label htmlFor="close-all-notes">Notes (Optional)</Label>
            <Textarea
              id="close-all-notes"
              placeholder="Add any notes about this batch close..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2"
              disabled={!!closingProgress}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!closingProgress}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCloseAllSelected();
              }}
              disabled={!!closingProgress}
            >
              {closingProgress 
                ? `Closing ${closingProgress.current}/${closingProgress.total}...` 
                : `Close ${selectedYears.length > 0 ? selectedYears.length : openYears.length} Years`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, AlertCircle, CheckCircle2, RefreshCw, Plus, FastForward } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFixedAssets, getDepreciationForFiscalYear, FixedAsset } from '@/hooks/useFixedAssets';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { parseISO, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { DepreciationPostingResult } from '@/hooks/useDepreciationGL';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddFixedAssetDialogEnhanced } from './AddFixedAssetDialogEnhanced';
import { getFiscalYearStart, getFiscalYearEnd, formatFiscalYearPeriod } from '@/lib/fiscalYearUtils';

interface RunAmortizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AmortizationEntry {
  asset: FixedAsset;
  monthlyEntries: { period_start: string; depreciation_amount: number }[];
  totalDepreciation: number;
  hasGLAccounts: boolean;
}

export function RunAmortizationDialog({ open, onOpenChange }: RunAmortizationDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: assets = [], refetch: refetchAssets, isRefetching } = useFixedAssets(organization?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const currentYear = new Date().getFullYear();
  const MIN_YEAR = 2010;
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [postingResults, setPostingResults] = useState<DepreciationPostingResult[]>([]);
  const [showAddAssetDialog, setShowAddAssetDialog] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [existingDepreciationRefs, setExistingDepreciationRefs] = useState<Set<string>>(new Set());
  const [_isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  
  // Batch mode state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentYear: '' });
  const [batchResults, setBatchResults] = useState<{ year: string; successCount: number; totalPosted: number; errors: string[] }[]>([]);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Use organization's fiscal year end month (default to December/12 if not set)
  const fiscalYearEndMonth = organization?.fiscal_year_end_month || 12;
  
  // Calculate fiscal year period based on organization settings
  const fiscalYear = parseInt(selectedYear);
  const fyEnd = getFiscalYearEnd(fiscalYear, fiscalYearEndMonth);
  const fyPeriodLabel = formatFiscalYearPeriod(fiscalYear, fiscalYearEndMonth);

  // Check for existing depreciation entries when year changes
  useEffect(() => {
    const checkExistingEntries = async () => {
      if (!organization?.id) return;
      
      setIsCheckingDuplicates(true);
      try {
        // Query for existing depreciation journal entries for this fiscal year
        const { data: existingEntries, error } = await supabase
          .from('journal_entries')
          .select('reference')
          .eq('organization_id', organization.id)
          .like('reference', `DEP-%-${selectedYear}`)
          .eq('status', 'posted');
        
        if (!error && existingEntries) {
          setExistingDepreciationRefs(new Set(existingEntries.map(e => e.reference)));
        }
      } catch (err) {
        console.error('Error checking existing depreciation entries:', err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    };
    
    checkExistingEntries();
  }, [organization?.id, selectedYear]);

  // Calculate depreciation for each active asset for the selected fiscal year
  const { amortizationEntries, excludedAssets } = useMemo(() => {
    const activeAssets = assets.filter(a => a.status === 'active');
    const excluded: { asset: FixedAsset; reason: string }[] = [];
    
    const entries = activeAssets
      .map(asset => {
        const depStartDate = parseISO(asset.depreciation_start_date);
        const expectedRef = `DEP-${asset.asset_number}-${selectedYear}`;
        const alreadyPosted = existingDepreciationRefs.has(expectedRef);
        
        // Check if already posted for this fiscal year
        if (alreadyPosted) {
          excluded.push({ 
            asset, 
            reason: `Already posted for FY ${selectedYear}` 
          });
          return null;
        }
        
        // Check if depreciation hasn't started yet for this fiscal year
        if (depStartDate > fyEnd) {
          excluded.push({ 
            asset, 
            reason: `Depreciation starts ${format(depStartDate, 'MMM yyyy')}` 
          });
          return null;
        }
        
        // Use fiscal-year-aware depreciation calculation
        const { entries: yearEntries, total: totalDepreciation } = getDepreciationForFiscalYear(
          asset, 
          fiscalYear, 
          fiscalYearEndMonth
        );
        
        if (totalDepreciation <= 0) {
          excluded.push({ 
            asset, 
            reason: asset.book_value <= asset.salvage_value ? 'Fully depreciated' : 'No depreciation for this period' 
          });
          return null;
        }
        
        const hasGLAccounts = !!(asset.depreciation_account_id && asset.accumulated_depreciation_account_id);
        
        return {
          asset,
          monthlyEntries: yearEntries.map(e => ({ period_start: e.period_start, depreciation_amount: e.depreciation_amount })),
          totalDepreciation: Math.round(totalDepreciation * 100) / 100,
          hasGLAccounts,
        };
      })
      .filter((entry): entry is AmortizationEntry => entry !== null);
    
    return { amortizationEntries: entries, excludedAssets: excluded };
  }, [assets, selectedYear, fiscalYear, fiscalYearEndMonth, fyEnd, existingDepreciationRefs]);

  // Auto-select all assets with GL accounts when entries change
  useEffect(() => {
    if (!processed) {
      const eligibleAssets = amortizationEntries.filter(e => e.hasGLAccounts).map(e => e.asset.id);
      setSelectedAssets(new Set(eligibleAssets));
    }
  }, [amortizationEntries.length, processed]);

  const toggleAsset = (assetId: string) => {
    const entry = amortizationEntries.find(e => e.asset.id === assetId);
    if (!entry?.hasGLAccounts) return; // Can't select assets without GL accounts
    
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const selectAll = () => {
    const eligibleAssets = amortizationEntries.filter(e => e.hasGLAccounts);
    if (selectedAssets.size === eligibleAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(eligibleAssets.map(e => e.asset.id)));
    }
  };

  const selectedEntries = amortizationEntries.filter(e => selectedAssets.has(e.asset.id));
  const totalAmortization = selectedEntries.reduce((sum, e) => sum + e.totalDepreciation, 0);
  const assetsWithoutGL = amortizationEntries.filter(e => !e.hasGLAccounts);
  const eligibleCount = amortizationEntries.filter(e => e.hasGLAccounts).length;

  const handleRunAmortization = async () => {
    if (!organization?.id || selectedAssets.size === 0) return;
    
    setIsProcessing(true);
    const results: DepreciationPostingResult[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Use fiscal year period dates for journal entries
      const periodEnd = fyEnd;
      const periodStart = getFiscalYearStart(fiscalYear, fiscalYearEndMonth);
      
      for (const entry of selectedEntries) {
        try {
          // Skip if no GL accounts configured
          if (!entry.asset.depreciation_account_id || !entry.asset.accumulated_depreciation_account_id) {
            results.push({
              assetId: entry.asset.id,
              assetNumber: entry.asset.asset_number,
              assetName: entry.asset.name,
              periodStart: format(periodStart, 'yyyy-MM-dd'),
              periodEnd: format(periodEnd, 'yyyy-MM-dd'),
              depreciationAmount: 0,
              journalEntryId: '',
              success: false,
              error: 'GL accounts not configured',
            });
            continue;
          }

          // Create journal entry as draft first
          const { data: journalEntry, error: jeError } = await supabase
            .from('journal_entries')
            .insert({
              organization_id: organization.id,
              entry_date: format(periodEnd, 'yyyy-MM-dd'),
              reference: `DEP-${entry.asset.asset_number}-${selectedYear}`,
              description: `Annual Depreciation - ${entry.asset.name} (FY ${selectedYear})`,
              status: 'draft',
              journal_type: 'depreciation',
              created_by: user?.id,
            })
            .select()
            .single();

          if (jeError) throw jeError;

          // Create balanced journal lines: Debit Expense, Credit Accumulated Depreciation
          const { error: linesError } = await supabase
            .from('journal_entry_lines')
            .insert([
              {
                journal_entry_id: journalEntry.id,
                account_id: entry.asset.depreciation_account_id,
                description: `Depreciation expense - ${entry.asset.name}`,
                debit: entry.totalDepreciation,
                credit: 0,
              },
              {
                journal_entry_id: journalEntry.id,
                account_id: entry.asset.accumulated_depreciation_account_id,
                description: `Accumulated depreciation - ${entry.asset.name}`,
                debit: 0,
                credit: entry.totalDepreciation,
              },
            ]);

          if (linesError) {
            // Rollback journal entry
            await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
            throw linesError;
          }

          // Post the journal entry - triggers will validate balance and update account balances
          const { error: postError } = await supabase
            .from('journal_entries')
            .update({ 
              status: 'posted', 
              posted_at: new Date().toISOString(),
              posted_by: user?.id,
            })
            .eq('id', journalEntry.id);

          if (postError) throw postError;

          // Update the fixed asset's accumulated depreciation and book value
          const newAccumulatedDep = entry.asset.accumulated_depreciation + entry.totalDepreciation;
          const newBookValue = Math.max(entry.asset.acquisition_cost - newAccumulatedDep, entry.asset.salvage_value);
          
          const { error: assetError } = await supabase
            .from('fixed_assets')
            .update({
              accumulated_depreciation: newAccumulatedDep,
              book_value: newBookValue,
              status: newBookValue <= entry.asset.salvage_value ? 'fully_depreciated' : 'active',
            })
            .eq('id', entry.asset.id);

          if (assetError) throw assetError;

          results.push({
            assetId: entry.asset.id,
            assetNumber: entry.asset.asset_number,
            assetName: entry.asset.name,
            periodStart: format(periodStart, 'yyyy-MM-dd'),
            periodEnd: format(periodEnd, 'yyyy-MM-dd'),
            depreciationAmount: entry.totalDepreciation,
            journalEntryId: journalEntry.id,
            success: true,
          });

        } catch (assetError: any) {
          results.push({
            assetId: entry.asset.id,
            assetNumber: entry.asset.asset_number,
            assetName: entry.asset.name,
            periodStart: format(periodStart, 'yyyy-MM-dd'),
            periodEnd: format(periodEnd, 'yyyy-MM-dd'),
            depreciationAmount: 0,
            journalEntryId: '',
            success: false,
            error: assetError.message,
          });
        }
      }
      
      setPostingResults(results);
      
      const successCount = results.filter(r => r.success).length;
      const totalPosted = results.filter(r => r.success).reduce((sum, r) => sum + r.depreciationAmount, 0);
      
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
      toast({ 
        title: 'Amortization Posted to GL', 
        description: `${successCount} journal entries created, total: ${formatCurrency(totalPosted)}` 
      });
      setProcessed(true);
      
    } catch (error: any) {
      toast({ title: 'Failed to process amortization', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Batch catch-up: run depreciation for all years from 2010 to current
  const handleBatchRunAll = useCallback(async () => {
    if (!organization?.id) return;
    
    setIsBatchMode(true);
    setIsProcessing(true);
    const allBatchResults: typeof batchResults = [];
    
    const yearsToProcess: number[] = [];
    for (let y = MIN_YEAR; y <= currentYear; y++) {
      yearsToProcess.push(y);
    }
    
    setBatchProgress({ current: 0, total: yearsToProcess.length, currentYear: '' });
    
    for (let idx = 0; idx < yearsToProcess.length; idx++) {
      const year = yearsToProcess[idx];
      setBatchProgress({ current: idx + 1, total: yearsToProcess.length, currentYear: year.toString() });
      
      // Check existing entries for this year
      const { data: existingEntries } = await supabase
        .from('journal_entries')
        .select('reference')
        .eq('organization_id', organization.id)
        .like('reference', `DEP-%-${year}`)
        .eq('status', 'posted');
      
      const existingRefs = new Set((existingEntries || []).map(e => e.reference));
      
      // Calculate eligible assets for this year
      const activeAssets = assets.filter(a => a.status === 'active' || a.status === 'fully_depreciated');
      const fyEndForYear = getFiscalYearEnd(year, fiscalYearEndMonth);
      const fyStartForYear = getFiscalYearStart(year, fiscalYearEndMonth);
      
      const eligibleEntries: AmortizationEntry[] = [];
      for (const asset of activeAssets) {
        const depStartDate = parseISO(asset.depreciation_start_date);
        const expectedRef = `DEP-${asset.asset_number}-${year}`;
        if (existingRefs.has(expectedRef)) continue;
        if (depStartDate > fyEndForYear) continue;
        
        const { entries: yearEntries, total: totalDep } = getDepreciationForFiscalYear(asset, year, fiscalYearEndMonth);
        if (totalDep <= 0) continue;
        if (!asset.depreciation_account_id || !asset.accumulated_depreciation_account_id) continue;
        
        eligibleEntries.push({
          asset,
          monthlyEntries: yearEntries.map(e => ({ period_start: e.period_start, depreciation_amount: e.depreciation_amount })),
          totalDepreciation: Math.round(totalDep * 100) / 100,
          hasGLAccounts: true,
        });
      }
      
      if (eligibleEntries.length === 0) {
        allBatchResults.push({ year: year.toString(), successCount: 0, totalPosted: 0, errors: [] });
        continue;
      }
      
      // Post for this year
      const { data: { user } } = await supabase.auth.getUser();
      let successCount = 0;
      let totalPosted = 0;
      const errors: string[] = [];
      
      for (const entry of eligibleEntries) {
        try {
          const { data: journalEntry, error: jeError } = await supabase
            .from('journal_entries')
            .insert({
              organization_id: organization.id,
              entry_date: format(fyEndForYear, 'yyyy-MM-dd'),
              reference: `DEP-${entry.asset.asset_number}-${year}`,
              description: `Annual Depreciation - ${entry.asset.name} (FY ${year})`,
              status: 'draft',
              journal_type: 'depreciation',
              created_by: user?.id,
            })
            .select()
            .single();
          
          if (jeError) throw jeError;
          
          const { error: linesError } = await supabase
            .from('journal_entry_lines')
            .insert([
              {
                journal_entry_id: journalEntry.id,
                account_id: entry.asset.depreciation_account_id,
                description: `Depreciation expense - ${entry.asset.name}`,
                debit: entry.totalDepreciation,
                credit: 0,
              },
              {
                journal_entry_id: journalEntry.id,
                account_id: entry.asset.accumulated_depreciation_account_id,
                description: `Accumulated depreciation - ${entry.asset.name}`,
                debit: 0,
                credit: entry.totalDepreciation,
              },
            ]);
          
          if (linesError) {
            await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
            throw linesError;
          }
          
          const { error: postError } = await supabase
            .from('journal_entries')
            .update({ status: 'posted', posted_at: new Date().toISOString(), posted_by: user?.id })
            .eq('id', journalEntry.id);
          
          if (postError) throw postError;
          
          // Update asset accumulated depreciation
          const newAccDep = entry.asset.accumulated_depreciation + entry.totalDepreciation;
          const newBookVal = Math.max(entry.asset.acquisition_cost - newAccDep, entry.asset.salvage_value);
          
          await supabase
            .from('fixed_assets')
            .update({
              accumulated_depreciation: newAccDep,
              book_value: newBookVal,
              status: newBookVal <= entry.asset.salvage_value ? 'fully_depreciated' : 'active',
            })
            .eq('id', entry.asset.id);
          
          // Update in-memory asset for subsequent years
          entry.asset.accumulated_depreciation = newAccDep;
          entry.asset.book_value = newBookVal;
          
          successCount++;
          totalPosted += entry.totalDepreciation;
        } catch (err: any) {
          errors.push(`${entry.asset.asset_number}: ${err.message}`);
        }
      }
      
      allBatchResults.push({ year: year.toString(), successCount, totalPosted, errors });
    }
    
    setBatchResults(allBatchResults);
    setIsProcessing(false);
    setProcessed(true);
    
    queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    queryClient.invalidateQueries({ queryKey: ['depreciation-entries'] });
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    
    const totalSuccess = allBatchResults.reduce((s, r) => s + r.successCount, 0);
    const totalAmount = allBatchResults.reduce((s, r) => s + r.totalPosted, 0);
    
    toast({
      title: 'Batch Depreciation Complete',
      description: `${totalSuccess} entries posted across ${yearsToProcess.length} years, total: ${formatCurrency(totalAmount)}`,
    });
  }, [organization?.id, assets, fiscalYearEndMonth, currentYear, formatCurrency, queryClient, toast]);

  const handleClose = () => {
    setProcessed(false);
    setSelectedAssets(new Set());
    setIsBatchMode(false);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: 0, currentYear: '' });
    onOpenChange(false);
  };

  const years = Array.from({ length: currentYear - MIN_YEAR + 3 }, (_, i) => (MIN_YEAR + i).toString());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Run Annual Amortization
          </DialogTitle>
          <DialogDescription>
            Select individual assets or all assets to calculate and record depreciation expense.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear} disabled={processed}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">{fyPeriodLabel}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAssets()}
                disabled={processed || isRefetching || isProcessing}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddAssetDialog(true)}
                disabled={processed || isProcessing}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Asset
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBatchRunAll}
                disabled={processed || isProcessing || assets.length === 0}
                title="Run depreciation for all years from 2010 to current, skipping already-posted years"
              >
                <FastForward className="h-4 w-4 mr-1" />
                Batch All Years (2010–{currentYear})
              </Button>
            </div>
            <div className="flex-1 text-right">
              <div className="text-sm text-muted-foreground">Selected Depreciation</div>
              <div className="text-2xl font-bold">{formatCurrency(totalAmortization)}</div>
              <div className="text-xs text-muted-foreground">{selectedAssets.size} of {eligibleCount} assets selected</div>
            </div>
          </div>

          {excludedAssets.length > 0 && (
            <Alert variant="default" className="bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <span className="font-medium">{excludedAssets.length} asset(s) excluded:</span>{' '}
                {excludedAssets.map(e => `${e.asset.asset_number} (${e.reason})`).join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* Batch mode progress */}
          {isBatchMode && isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing FY {batchProgress.currentYear}...</span>
                <span>{batchProgress.current} / {batchProgress.total} years</span>
              </div>
              <Progress value={(batchProgress.current / Math.max(batchProgress.total, 1)) * 100} />
            </div>
          )}

          {/* Batch results summary */}
          {isBatchMode && processed && batchResults.length > 0 && (
            <div className="space-y-2">
              <Alert className="bg-primary/10 border-primary/30">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  ✓ Batch depreciation complete for {MIN_YEAR}–{currentYear}.
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[250px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Entries Posted</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchResults.filter(r => r.successCount > 0 || r.errors.length > 0).map(r => (
                      <TableRow key={r.year}>
                        <TableCell className="font-mono">{r.year}</TableCell>
                        <TableCell className="text-right">{r.successCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.totalPosted)}</TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">{r.errors.length} errors</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Single-year mode */}
          {!isBatchMode && (
            <>
              {amortizationEntries.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No active assets require depreciation for {selectedYear}.
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-[300px] border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={selectedAssets.size === eligibleCount && eligibleCount > 0}
                            onCheckedChange={selectAll}
                            disabled={processed || eligibleCount === 0}
                          />
                        </TableHead>
                        <TableHead>Asset #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-center">GL</TableHead>
                        <TableHead className="text-center">Half-Year</TableHead>
                        <TableHead className="text-right">Book Value</TableHead>
                        <TableHead className="text-right">Depreciation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {amortizationEntries.map((entry) => {
                        const hasHalfYear = entry.asset.half_year_convention === true;
                        const acquisitionYear = parseISO(entry.asset.acquisition_date).getFullYear();
                        const isAcquisitionYear = acquisitionYear === parseInt(selectedYear);
                        const isSelected = selectedAssets.has(entry.asset.id);
                        
                        return (
                          <TableRow 
                            key={entry.asset.id} 
                            className={`${!entry.hasGLAccounts ? 'opacity-50' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                          >
                            <TableCell>
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleAsset(entry.asset.id)}
                                disabled={!entry.hasGLAccounts || processed}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{entry.asset.asset_number}</TableCell>
                            <TableCell>{entry.asset.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {entry.asset.depreciation_method === 'straight_line' ? 'SL' : 'DB'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {entry.hasGLAccounts ? (
                                <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                              ) : (
                                <Badge variant="destructive" className="text-xs">Missing</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {hasHalfYear && isAcquisitionYear ? (
                                <Badge variant="secondary" className="text-xs">50%</Badge>
                              ) : hasHalfYear ? (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.asset.book_value)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(entry.totalDepreciation)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}

              {assetsWithoutGL.length > 0 && !processed && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {assetsWithoutGL.length} asset(s) are missing GL account configuration and cannot be selected. 
                    Use "Configure GL Accounts" to set up depreciation accounts.
                  </AlertDescription>
                </Alert>
              )}

              {processed && (
                <div className="space-y-2">
                  <Alert className="bg-primary/10 border-primary/30">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-primary">
                      ✓ Amortization for {selectedYear} has been posted to the General Ledger.
                    </AlertDescription>
                  </Alert>
                  
                  {postingResults.some(r => !r.success) && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {postingResults.filter(r => !r.success).length} asset(s) failed to post:
                        <ul className="mt-1 text-xs">
                          {postingResults.filter(r => !r.success).map(r => (
                            <li key={r.assetId}>• {r.assetNumber}: {r.error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {processed ? 'Close' : 'Cancel'}
          </Button>
          {!processed && amortizationEntries.length > 0 && (
            <Button 
              onClick={handleRunAmortization} 
              disabled={isProcessing || selectedAssets.size === 0}
            >
              {isProcessing ? 'Posting to GL...' : `Post Depreciation (${selectedAssets.size} assets)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      
      <AddFixedAssetDialogEnhanced
        open={showAddAssetDialog}
        onOpenChange={setShowAddAssetDialog}
      />
    </Dialog>
  );
}

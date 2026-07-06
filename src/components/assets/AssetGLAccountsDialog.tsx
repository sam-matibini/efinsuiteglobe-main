import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Settings2, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFixedAssets, FixedAsset, useUpdateFixedAsset } from '@/hooks/useFixedAssets';
import { useAccounts, DbAccount } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { createJournalEntry } from '@/hooks/useJournalEntryCreation';

interface AssetGLAccountsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssetGLAccountsDialog({ open, onOpenChange }: AssetGLAccountsDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: assets = [] } = useFixedAssets(organization?.id);
  const { data: accounts = [] } = useAccounts(organization?.id);
  const updateAsset = useUpdateFixedAsset();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [assetAccountId, setAssetAccountId] = useState<string>('');
  const [depreciationAccountId, setDepreciationAccountId] = useState<string>('');
  const [accumulatedDepAccountId, setAccumulatedDepAccountId] = useState<string>('');
  const [offsetAccountId, setOffsetAccountId] = useState<string>('');
  const [backfillAcquisition, setBackfillAcquisition] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Postable asset accounts (for the Balance Sheet asset account, e.g. PPE)
  const assetAccounts = accounts
    .filter(a =>
      a.account_type === 'asset' &&
      a.is_active &&
      !a.is_header &&
      a.posting_allowed !== false &&
      a.normal_balance !== 'credit'
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  // Filter for expense accounts (depreciation expense)
  const expenseAccounts = accounts.filter(a => 
    a.account_type === 'expense' && 
    a.is_active && 
    a.posting_allowed !== false
  );

  // Filter for contra-asset accounts (accumulated depreciation)
  // Match by credit normal balance (contra-asset), or name keywords for accumulated dep/amort
  const accumulatedDepAccounts = accounts
    .filter(a => 
      a.account_type === 'asset' && 
      a.is_active && 
      !a.is_header &&
      a.posting_allowed !== false &&
      (a.normal_balance === 'credit' ||
       a.name.toLowerCase().includes('accum') || 
       a.name.toLowerCase().includes('depreciation') ||
       a.name.toLowerCase().includes('amortization'))
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  // Offset accounts for backfilling the acquisition JE: cash/bank, AP/liabilities,
  // or opening balance equity. Anything postable that isn't the PPE asset itself.
  const offsetAccounts = accounts
    .filter(a =>
      a.is_active &&
      !a.is_header &&
      a.posting_allowed !== false &&
      ['asset', 'liability', 'equity'].includes(a.account_type)
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  const activeAssets = assets.filter(a => a.status === 'active');

  const toggleAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const selectAll = () => {
    if (selectedAssets.size === activeAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(activeAssets.map(a => a.id)));
    }
  };

  const handleApply = async () => {
    if (selectedAssets.size === 0) {
      toast({ title: 'No assets selected', variant: 'destructive' });
      return;
    }

    if (!assetAccountId && !depreciationAccountId && !accumulatedDepAccountId) {
      toast({ title: 'Please select at least one GL account to assign', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const assetId of selectedAssets) {
      const asset = assets.find(a => a.id === assetId);
      if (!asset) continue;

      try {
        const updates: any = { id: assetId };
        if (assetAccountId) updates.asset_account_id = assetAccountId;
        if (depreciationAccountId) updates.depreciation_account_id = depreciationAccountId;
        if (accumulatedDepAccountId) updates.accumulated_depreciation_account_id = accumulatedDepAccountId;
        await updateAsset.mutateAsync(updates);

        // Backfill the acquisition JE so the asset lands on the TB / BS / FS.
        // Only run when: user opted in, an offset account is chosen, the asset
        // has (or now has) an asset account, no prior acquisition JE exists,
        // and cost > 0.
        const effectiveAssetAccount = assetAccountId || asset.asset_account_id;
        if (
          backfillAcquisition &&
          offsetAccountId &&
          effectiveAssetAccount &&
          !asset.acquisition_journal_id &&
          Number(asset.acquisition_cost) > 0 &&
          organization?.id
        ) {
          const jeId = await createJournalEntry({
            organizationId: organization.id,
            date: asset.acquisition_date,
            description: `Fixed Asset Acquisition - ${asset.name} (${asset.asset_number})`,
            reference: `FA-ACQ-${asset.asset_number}`,
            journalType: 'purchase',
            status: 'posted',
            lines: [
              {
                account_id: effectiveAssetAccount,
                debit: Number(asset.acquisition_cost),
                credit: 0,
                memo: `Acquisition of ${asset.name}`,
                source_document_type: 'fixed_asset_acquisition',
                source_document_id: asset.id,
              },
              {
                account_id: offsetAccountId,
                debit: 0,
                credit: Number(asset.acquisition_cost),
                memo: `Acquisition of ${asset.name}`,
                source_document_type: 'fixed_asset_acquisition',
                source_document_id: asset.id,
              },
            ],
          });

          await supabase
            .from('fixed_assets')
            .update({ acquisition_journal_id: jeId })
            .eq('id', asset.id);
        }

        successCount++;
      } catch (err: any) {
        console.error('Failed to update asset GL', err);
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });

    setIsProcessing(false);
    
    if (successCount > 0) {
      toast({ 
        title: 'GL Accounts Updated', 
        description: `${successCount} asset(s) configured successfully${failCount > 0 ? `, ${failCount} failed` : ''}`
      });
    }

    if (failCount === 0) {
      setSelectedAssets(new Set());
      onOpenChange(false);
    }
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return null;
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configure Asset GL Accounts
          </DialogTitle>
          <DialogDescription>
            Assign depreciation expense and accumulated depreciation accounts to your fixed assets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Bulk assignment section */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
            <h4 className="font-medium">Bulk Assign GL Accounts</h4>
            <p className="text-xs text-muted-foreground">
              Leave a field blank to keep each asset's existing value. Set the Asset Account so the
              asset balance appears on the Balance Sheet.
            </p>
            <div className="space-y-2">
              <Label>Asset Account (Balance Sheet)</Label>
              <Select value={assetAccountId || 'none'} onValueChange={(v) => setAssetAccountId(v === 'none' ? '' : v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select asset account (e.g. PPE)" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50 max-h-60">
                  <SelectItem value="none">— Keep existing —</SelectItem>
                  {assetAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depreciation Expense Account</Label>
                <Select value={depreciationAccountId || 'none'} onValueChange={(v) => setDepreciationAccountId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select expense account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="none">— Keep existing —</SelectItem>
                    {expenseAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Accumulated Depreciation Account</Label>
                <Select value={accumulatedDepAccountId || 'none'} onValueChange={(v) => setAccumulatedDepAccountId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select contra-asset account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="none">— Keep existing —</SelectItem>
                    {accumulatedDepAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Backfill acquisition JE — makes the asset appear on TB / BS / FS */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="backfill-je"
                  checked={backfillAcquisition}
                  onCheckedChange={(v) => setBackfillAcquisition(!!v)}
                />
                <div className="grid gap-1">
                  <Label htmlFor="backfill-je" className="cursor-pointer">
                    Post opening acquisition journal entry
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Posts DR Asset Account / CR Offset Account at the acquisition cost so the
                    asset shows on the Trial Balance, Balance Sheet and Fixed Asset Register.
                    Skipped for assets that already have an acquisition JE.
                  </p>
                </div>
              </div>
              {backfillAcquisition && (
                <div className="space-y-2">
                  <Label>Offset Account (Cash, Bank, Loan, or Opening Balance Equity)</Label>
                  <Select value={offsetAccountId || 'none'} onValueChange={(v) => setOffsetAccountId(v === 'none' ? '' : v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select offset account" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-60">
                      <SelectItem value="none">— Do not post JE —</SelectItem>
                      {offsetAccounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Asset selection table */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedAssets.size === activeAssets.length && activeAssets.length > 0}
                      onCheckedChange={selectAll}
                    />
                  </TableHead>
                  <TableHead>Asset #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Asset Account</TableHead>
                  <TableHead>Depreciation Account</TableHead>
                  <TableHead>Accumulated Dep. Account</TableHead>
                  <TableHead className="text-center w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No active assets found
                    </TableCell>
                  </TableRow>
                ) : activeAssets.map(asset => {
                  const hasGL = !!(asset.asset_account_id && asset.depreciation_account_id && asset.accumulated_depreciation_account_id);
                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedAssets.has(asset.id)}
                          onCheckedChange={() => toggleAsset(asset.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{asset.asset_number}</TableCell>
                      <TableCell>{asset.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getAccountName(asset.asset_account_id) || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getAccountName(asset.depreciation_account_id) || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getAccountName(asset.accumulated_depreciation_account_id) || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {hasGL ? (
                          <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <Badge variant="outline" className="text-xs">Missing</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>

          {selectedAssets.size > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedAssets.size} asset(s) selected. Click "Apply" to assign the selected GL accounts.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleApply}
            disabled={isProcessing || selectedAssets.size === 0 || (!assetAccountId && !depreciationAccountId && !accumulatedDepAccountId)}
          >
            <Save className="h-4 w-4 mr-2" />
            {isProcessing ? 'Applying...' : `Apply to ${selectedAssets.size} Asset(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [depreciationAccountId, setDepreciationAccountId] = useState<string>('');
  const [accumulatedDepAccountId, setAccumulatedDepAccountId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

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

    if (!depreciationAccountId || !accumulatedDepAccountId) {
      toast({ title: 'Please select both GL accounts', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const assetId of selectedAssets) {
      const asset = assets.find(a => a.id === assetId);
      if (!asset) continue;

      try {
        await updateAsset.mutateAsync({
          id: assetId,
          depreciation_account_id: depreciationAccountId,
          accumulated_depreciation_account_id: accumulatedDepAccountId,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

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
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configure Asset GL Accounts
          </DialogTitle>
          <DialogDescription>
            Assign depreciation expense and accumulated depreciation accounts to your fixed assets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bulk assignment section */}
          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
            <h4 className="font-medium">Bulk Assign GL Accounts</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Depreciation Expense Account</Label>
                <Select value={depreciationAccountId} onValueChange={setDepreciationAccountId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select expense account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
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
                <Select value={accumulatedDepAccountId} onValueChange={setAccumulatedDepAccountId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select contra-asset account" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    {accumulatedDepAccounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <TableHead>Depreciation Account</TableHead>
                  <TableHead>Accumulated Dep. Account</TableHead>
                  <TableHead className="text-center w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No active assets found
                    </TableCell>
                  </TableRow>
                ) : activeAssets.map(asset => {
                  const hasGL = !!(asset.depreciation_account_id && asset.accumulated_depreciation_account_id);
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
            disabled={isProcessing || selectedAssets.size === 0 || !depreciationAccountId || !accumulatedDepAccountId}
          >
            <Save className="h-4 w-4 mr-2" />
            {isProcessing ? 'Applying...' : `Apply to ${selectedAssets.size} Asset(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, Calculator, MoreHorizontal, Pencil, Trash2, ArrowRightLeft, XCircle, FileText, Upload, TrendingDown, Eye, Settings2 } from 'lucide-react';
import { useFixedAssets, generateDepreciationSchedule, FixedAsset } from '@/hooks/useFixedAssets';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { AddFixedAssetDialogEnhanced } from '@/components/assets/AddFixedAssetDialogEnhanced';
import { EditFixedAssetDialog } from '@/components/assets/EditFixedAssetDialog';
import { DeleteAssetDialog } from '@/components/assets/DeleteAssetDialog';
import { RunAmortizationDialog } from '@/components/assets/RunAmortizationDialog';
import { AssetDisposalDialog } from '@/components/assets/AssetDisposalDialog';
import { AssetTransferDialog } from '@/components/assets/AssetTransferDialog';
import { FixedAssetsReports } from '@/components/assets/FixedAssetsReports';
import { AssetDetailDialog } from '@/components/assets/AssetDetailDialog';
import { AssetRevaluationDialog } from '@/components/assets/AssetRevaluationDialog';
import { AssetImportDialog } from '@/components/assets/AssetImportDialog';
import { AssetGLAccountsDialog } from '@/components/assets/AssetGLAccountsDialog';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';


export default function FixedAssets() {
  const isReadOnly = useIsReadOnly();
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAmortizationDialog, setShowAmortizationDialog] = useState(false);
  const [showDisposalDialog, setShowDisposalDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showReportsDialog, setShowReportsDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRevaluationDialog, setShowRevaluationDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showGLAccountsDialog, setShowGLAccountsDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);
  const [assetToEdit, setAssetToEdit] = useState<FixedAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<FixedAsset | null>(null);
  const [assetToDispose, setAssetToDispose] = useState<FixedAsset | null>(null);
  const [assetToTransfer, setAssetToTransfer] = useState<FixedAsset | null>(null);
  const [assetToRevalue, setAssetToRevalue] = useState<FixedAsset | null>(null);
  const { organization } = useCurrentOrganization();
  
  const { data: assets = [], isLoading } = useFixedAssets(organization?.id);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: localization.currency, minimumFractionDigits: 2 }).format(value);

  const filteredAssets = useMemo(() => assets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || a.asset_number.toLowerCase().includes(search.toLowerCase())
  ), [assets, search]);

  const stats = useMemo(() => ({
    total: assets.length,
    active: assets.filter(a => a.status === 'active').length,
    totalCost: assets.filter(a => a.status === 'active').reduce((s, a) => s + a.acquisition_cost, 0),
    totalBookValue: assets.filter(a => a.status === 'active').reduce((s, a) => s + a.book_value, 0),
    totalDepreciation: assets.filter(a => a.status === 'active').reduce((s, a) => s + a.accumulated_depreciation, 0),
  }), [assets]);

  const handleRowClick = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setShowDetailDialog(true);
  };

  const handleEdit = (asset: FixedAsset, e: React.MouseEvent) => { e.stopPropagation(); setAssetToEdit(asset); setShowEditDialog(true); };
  const handleDelete = (asset: FixedAsset, e: React.MouseEvent) => { e.stopPropagation(); setAssetToDelete(asset); setShowDeleteDialog(true); };
  const handleDispose = (asset: FixedAsset, e: React.MouseEvent) => { e.stopPropagation(); setAssetToDispose(asset); setShowDisposalDialog(true); };
  const handleTransfer = (asset: FixedAsset, e: React.MouseEvent) => { e.stopPropagation(); setAssetToTransfer(asset); setShowTransferDialog(true); };
  const handleRevalue = (asset: FixedAsset, e: React.MouseEvent) => { e.stopPropagation(); setAssetToRevalue(asset); setShowRevaluationDialog(true); };

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fixed Assets Register</h1>
          <p className="text-muted-foreground">Capital assets, depreciation & CCA tax tracking</p>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && <Button variant="outline" onClick={() => setShowImportDialog(true)}><Upload className="h-4 w-4 mr-2" />Import</Button>}
          <Button variant="outline" onClick={() => setShowReportsDialog(true)}><FileText className="h-4 w-4 mr-2" />Reports</Button>
          {!isReadOnly && <Button variant="outline" onClick={() => setShowGLAccountsDialog(true)}><Settings2 className="h-4 w-4 mr-2" />GL Accounts</Button>}
          {!isReadOnly && <Button variant="outline" onClick={() => setShowAmortizationDialog(true)}><Calculator className="h-4 w-4 mr-2" />Run Depreciation</Button>}
          {!isReadOnly && <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />Add Asset</Button>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Assets</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">{stats.active} active</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Cost</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Accumulated Dep.</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalDepreciation)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Net Book Value</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalBookValue)}</div></CardContent></Card>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 max-w-sm" /></div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Acquired</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Accum. Dep.</TableHead>
              <TableHead className="text-right">Book Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">No assets found</TableCell></TableRow>
            ) : filteredAssets.map((asset) => (
              <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(asset)}>
                <TableCell className="font-mono">{asset.asset_number}</TableCell>
                <TableCell>{asset.name}</TableCell>
                <TableCell>{format(parseLocalDate(asset.acquisition_date), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-right">{formatCurrency(asset.acquisition_cost)}</TableCell>
                <TableCell className="text-right">{formatCurrency(asset.accumulated_depreciation)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(asset.book_value)}</TableCell>
                <TableCell><Badge variant={asset.status === 'active' ? 'default' : asset.status === 'disposed' ? 'destructive' : 'outline'}>{asset.status}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRowClick(asset); }}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                      {!isReadOnly && <DropdownMenuItem onClick={(e) => handleEdit(asset, e as any)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>}
                      {!isReadOnly && asset.status === 'active' && (
                        <>
                          <DropdownMenuItem onClick={(e) => handleTransfer(asset, e as any)}><ArrowRightLeft className="h-4 w-4 mr-2" />Transfer</DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleRevalue(asset, e as any)}><TrendingDown className="h-4 w-4 mr-2" />Revalue/Impair</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => handleDispose(asset, e as any)} className="text-destructive"><XCircle className="h-4 w-4 mr-2" />Dispose</DropdownMenuItem>
                        </>
                      )}
                      {!isReadOnly && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => handleDelete(asset, e as any)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <AddFixedAssetDialogEnhanced open={showAddDialog} onOpenChange={setShowAddDialog} />
      <EditFixedAssetDialog open={showEditDialog} onOpenChange={setShowEditDialog} asset={assetToEdit} />
      <DeleteAssetDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} asset={assetToDelete} />
      <RunAmortizationDialog open={showAmortizationDialog} onOpenChange={setShowAmortizationDialog} />
      <AssetDisposalDialog open={showDisposalDialog} onOpenChange={setShowDisposalDialog} asset={assetToDispose} />
      <AssetTransferDialog open={showTransferDialog} onOpenChange={setShowTransferDialog} asset={assetToTransfer} />
      <FixedAssetsReports
        open={showReportsDialog}
        onOpenChange={setShowReportsDialog}
        assets={assets}
        organizationId={organization?.id}
        organizationName={organization?.name}
        formatCurrency={formatCurrency}
        countryCode={countryCode}
      />
      <AssetDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        asset={selectedAsset}
        formatCurrency={formatCurrency}
      />
      <AssetRevaluationDialog
        open={showRevaluationDialog}
        onOpenChange={setShowRevaluationDialog}
        asset={assetToRevalue}
        formatCurrency={formatCurrency}
      />
      <AssetImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        organizationId={organization?.id}
      />
      <AssetGLAccountsDialog
        open={showGLAccountsDialog}
        onOpenChange={setShowGLAccountsDialog}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Download, Printer, Eye, XCircle, MoreHorizontal, Share2, ZoomIn, ZoomOut, Maximize2, Minimize2, Loader2, Layers, RefreshCw, FolderArchive, ChevronDown, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useDonationReceipts } from '@/hooks/useDonations';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { downloadDonationReceiptWithLogo, printDonationReceiptWithLogo, generateDonationReceiptWithLogo } from '@/lib/print/donationReceiptGenerator';
import { ShareReceiptDialog } from './ShareReceiptDialog';
import { ReissueReceiptDialog } from './ReissueReceiptDialog';
import { ConsolidateReceiptsDialog } from './ConsolidateReceiptsDialog';
import { BulkCancelReceiptsDialog } from './BulkCancelReceiptsDialog';
import { BulkReissueReceiptsDialog } from './BulkReissueReceiptsDialog';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { DonationReceipt } from '@/types/donations';

export function DonationReceiptsTab() {
  const { data: receipts = [], isLoading } = useDonationReceipts();
  const { formatWithSymbol } = useCurrencyFormatter();
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const logoUrl = (() => {
    if (organization?.receipt_show_logo === false) return undefined;
    return organization?.receipt_logo_url || organization?.logo_url;
  })();
  const [previewReceipt, setPreviewReceipt] = useState<DonationReceipt | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [bulkProgress, setBulkProgress] = useState<number | null>(null);
  const [shareReceipt, setShareReceipt] = useState<DonationReceipt | null>(null);
  const [consolidateOpen, setConsolidateOpen] = useState(false);
  const [reissueReceipt, setReissueReceipt] = useState<DonationReceipt | null>(null);
  const [bulkType, setBulkType] = useState<'all' | 'individual' | 'consolidated'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkReissueOpen, setBulkReissueOpen] = useState(false);

  // Derive unique tax years
  const taxYears = useMemo(() => {
    const years = [...new Set(receipts.map(r => new Date(r.date_of_donation).getFullYear()))];
    return years.sort((a, b) => b - a);
  }, [receipts]);

  // Filter receipts by tax year
  const filteredReceipts = useMemo(() => {
    let result = receipts;
    if (yearFilter !== 'all') {
      result = result.filter(r => new Date(r.date_of_donation).getFullYear().toString() === yearFilter);
    }
    return result;
  }, [receipts, yearFilter]);

  const bulkFilteredReceipts = useMemo(() => {
    if (bulkType === 'all') return filteredReceipts;
    if (bulkType === 'consolidated') return filteredReceipts.filter(r => r.is_consolidated);
    return filteredReceipts.filter(r => !r.is_consolidated);
  }, [filteredReceipts, bulkType]);

  const issuedReceipts = useMemo(() => filteredReceipts.filter(r => r.status === 'issued'), [filteredReceipts]);
  const selectedReceipts = useMemo(() => filteredReceipts.filter(r => selectedIds.has(r.id)), [filteredReceipts, selectedIds]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePreview = async (receipt: DonationReceipt) => {
    const doc = await generateDonationReceiptWithLogo(receipt, logoUrl);
    const dataUri = doc.output('datauristring');
    setPreviewUrl(dataUri);
    setPreviewReceipt(receipt);
    setZoom(100);
    setFullscreen(false);
  };

  const handleClosePreview = () => {
    setPreviewUrl(null);
    setPreviewReceipt(null);
  };

  const handleBulkDownload = async () => {
    if (bulkFilteredReceipts.length === 0) { toast.error('No receipts to download'); return; }

    setBulkProgress(0);
    try {
      for (let i = 0; i < bulkFilteredReceipts.length; i++) {
        await downloadDonationReceiptWithLogo(bulkFilteredReceipts[i], logoUrl);
        setBulkProgress(Math.round(((i + 1) / bulkFilteredReceipts.length) * 100));
        if (i < bulkFilteredReceipts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const yearLabel = yearFilter === 'all' ? 'All' : yearFilter;
      const typeLabel = bulkType === 'all' ? '' : ` (${bulkType})`;
      toast.success(`Downloaded ${bulkFilteredReceipts.length} receipt(s) for ${yearLabel}${typeLabel}`);
    } catch (err) {
      console.error('Bulk download error:', err);
      toast.error('Failed to generate bulk download');
    } finally {
      setBulkProgress(null);
    }
  };

  const handleBulkZipDownload = async () => {
    if (bulkFilteredReceipts.length === 0) { toast.error('No receipts to download'); return; }

    setBulkProgress(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < bulkFilteredReceipts.length; i++) {
        const doc = await generateDonationReceiptWithLogo(bulkFilteredReceipts[i], logoUrl);
        zip.file(`Receipt-${bulkFilteredReceipts[i].receipt_number}.pdf`, doc.output('arraybuffer'));
        setBulkProgress(Math.round(((i + 1) / bulkFilteredReceipts.length) * 90));
      }

      setBulkProgress(95);
      const blob = await zip.generateAsync({ type: 'blob' });

      const yearLabel = yearFilter === 'all' ? 'All' : yearFilter;
      const typeLabel = bulkType === 'all' ? '' : `-${bulkType}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipts-${yearLabel}${typeLabel}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBulkProgress(100);
      toast.success(`Downloaded ${bulkFilteredReceipts.length} receipt(s) as ZIP`);
    } catch (err) {
      console.error('Bulk ZIP download error:', err);
      toast.error('Failed to generate ZIP download');
    } finally {
      setBulkProgress(null);
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'issued': return 'default';
      case 'cancelled': return 'destructive';
      case 'replaced': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return <Card className="p-8 text-center text-muted-foreground">Loading receipts...</Card>;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tax Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tax Years</SelectItem>
            {taxYears.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => setConsolidateOpen(true)}>
          <Layers className="w-4 h-4 mr-2" />
          Consolidate Receipts
        </Button>

        <Select value={bulkType} onValueChange={(v) => setBulkType(v as 'all' | 'individual' | 'consolidated')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Receipt Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="individual">Individual Only</SelectItem>
            <SelectItem value="consolidated">Consolidated Only</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleBulkDownload} disabled={bulkProgress !== null || bulkFilteredReceipts.length === 0}>
          {bulkProgress !== null ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Bulk Download ({bulkFilteredReceipts.length})
        </Button>

        <Button variant="outline" onClick={handleBulkZipDownload} disabled={bulkProgress !== null || bulkFilteredReceipts.length === 0}>
          {bulkProgress !== null ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderArchive className="w-4 h-4 mr-2" />}
          Download ZIP ({bulkFilteredReceipts.length})
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
              toast.success('Receipts refreshed — ZIP downloads will use latest data');
            }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
                // Revoke any lingering object URLs and clear browser download history is not possible,
                // but we can prompt user to clear downloads folder
                toast.success('Receipt cache cleared. Previously downloaded files remain in your Downloads folder — you may delete them manually.');
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Downloaded Receipts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {bulkProgress !== null && (
          <div className="flex items-center gap-2 min-w-[160px]">
            <Progress value={bulkProgress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground">{bulkProgress}%</span>
          </div>
        )}
      </div>

      {/* Floating action bar for selected receipts */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 mb-4">
          <span className="text-sm font-medium">{selectedIds.size} receipt(s) selected</span>
          <Button variant="destructive" size="sm" onClick={() => setBulkCancelOpen(true)}>
            <XCircle className="w-4 h-4 mr-2" />
            Bulk Cancel
          </Button>
          <Button variant="default" size="sm" onClick={() => setBulkReissueOpen(true)}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Bulk Reissue / Correct
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={issuedReceipts.length > 0 && issuedReceipts.every(r => selectedIds.has(r.id))}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedIds(new Set(issuedReceipts.map(r => r.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>Tax Year</TableHead>
              <TableHead>Donation Date</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Eligible</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Charity BN</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReceipts.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {r.status === 'issued' ? (
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => handleToggleSelect(r.id)}
                    />
                  ) : null}
                </TableCell>
                <TableCell className="font-medium">{r.receipt_number}</TableCell>
                <TableCell>{r.donor_name}</TableCell>
                <TableCell>{new Date(r.date_of_donation).getFullYear()}</TableCell>
                <TableCell>{new Date(r.date_of_donation).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(r.date_of_issue).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">{formatWithSymbol(r.amount)}</TableCell>
                <TableCell className="text-right text-success">{formatWithSymbol(r.eligible_amount)}</TableCell>
                <TableCell>
                  {r.is_consolidated ? (
                    <Badge variant="outline" className="text-xs">Consolidated ({r.items?.length || 0})</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Individual</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.charity_bn}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreview(r)}>
                        <Eye className="w-4 h-4 mr-2" />Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadDonationReceiptWithLogo(r, logoUrl)}>
                        <Download className="w-4 h-4 mr-2" />Download PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => printDonationReceiptWithLogo(r, logoUrl)}>
                        <Printer className="w-4 h-4 mr-2" />Print
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShareReceipt(r)}>
                        <Share2 className="w-4 h-4 mr-2" />Share (Email/SMS/WhatsApp)
                      </DropdownMenuItem>
                      {r.status === 'issued' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setReissueReceipt(r)}>
                            <RefreshCw className="w-4 h-4 mr-2" />Reissue / Correct
                          </DropdownMenuItem>
                        </>
                      )}
                      {r.status === 'cancelled' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="text-destructive">
                            <XCircle className="w-4 h-4 mr-2" />Cancelled
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredReceipts.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  No receipts found{yearFilter !== 'all' ? ` for tax year ${yearFilter}` : ''}. Issue receipts from the Donations tab or use Year-End Bulk Receipting.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Enhanced PDF Preview Dialog */}
      <Dialog open={!!previewReceipt} onOpenChange={() => handleClosePreview()}>
        <DialogContent className={fullscreen ? 'max-w-[95vw] max-h-[95vh] w-full h-full' : 'max-w-5xl max-h-[90vh]'}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Receipt Preview — {previewReceipt?.receipt_number}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(50, z - 25))} title="Zoom out">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
                <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(200, z + 25))} title="Zoom in">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setFullscreen(f => !f)} title="Toggle fullscreen">
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-4 flex-1 min-h-0">
            {/* PDF iframe */}
            <div className="flex-1 min-h-0 overflow-auto">
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  className="border rounded bg-white"
                  style={{ width: `${zoom}%`, height: fullscreen ? '75vh' : '65vh', minWidth: '100%' }}
                  title="Receipt Preview"
                />
              )}
            </div>

            {/* Side metadata panel */}
            {previewReceipt && (
              <div className="w-56 shrink-0 space-y-3 text-sm hidden md:block">
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground">Receipt Info</h4>
                  <div><span className="text-muted-foreground">Donor:</span> <span className="font-medium">{previewReceipt.donor_name}</span></div>
                  <div><span className="text-muted-foreground">Tax Year:</span> {new Date(previewReceipt.date_of_donation).getFullYear()}</div>
                  <div><span className="text-muted-foreground">Amount:</span> {formatWithSymbol(previewReceipt.amount)}</div>
                  <div><span className="text-muted-foreground">Eligible:</span> <span className="text-success font-medium">{formatWithSymbol(previewReceipt.eligible_amount)}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusVariant(previewReceipt.status)} className="ml-1">{previewReceipt.status}</Badge></div>
                  <div><span className="text-muted-foreground">BN:</span> <span className="text-xs">{previewReceipt.charity_bn}</span></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {previewReceipt && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShareReceipt(previewReceipt)}>
                  <Share2 className="w-4 h-4 mr-2" />Share
                </Button>
                <Button variant="outline" size="sm" onClick={() => printDonationReceiptWithLogo(previewReceipt, logoUrl)}>
                  <Printer className="w-4 h-4 mr-2" />Print
                </Button>
                <Button size="sm" onClick={() => downloadDonationReceiptWithLogo(previewReceipt, logoUrl)}>
                  <Download className="w-4 h-4 mr-2" />Download PDF
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      {shareReceipt && (
        <ShareReceiptDialog
          open={!!shareReceipt}
          onOpenChange={(open) => { if (!open) setShareReceipt(null); }}
          receipt={shareReceipt}
        />
      )}

      <ConsolidateReceiptsDialog
        open={consolidateOpen}
        onOpenChange={setConsolidateOpen}
      />

      {reissueReceipt && (
        <ReissueReceiptDialog
          open={!!reissueReceipt}
          onOpenChange={(open) => { if (!open) setReissueReceipt(null); }}
          receipt={reissueReceipt}
        />
      )}

      <BulkCancelReceiptsDialog
        open={bulkCancelOpen}
        onOpenChange={setBulkCancelOpen}
        receipts={selectedReceipts}
        onComplete={() => setSelectedIds(new Set())}
      />

      <BulkReissueReceiptsDialog
        open={bulkReissueOpen}
        onOpenChange={setBulkReissueOpen}
        receipts={selectedReceipts}
        onComplete={() => setSelectedIds(new Set())}
      />
    </>
  );
}

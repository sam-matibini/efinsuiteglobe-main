import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, Calendar, DollarSign, TrendingDown, MapPin, 
  FileText, History, ArrowRightLeft, Download, Barcode,
  Shield, AlertTriangle, Clock
} from 'lucide-react';
import { format, parseISO, differenceInMonths, isBefore } from 'date-fns';
import { FixedAsset, generateDepreciationSchedule } from '@/hooks/useFixedAssets';
import { useAssetMovements, useAssetAuditTrail, useAssetRevaluations } from '@/hooks/useFixedAssetsRegister';
import JsBarcode from 'jsbarcode';

interface AssetDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset | null;
  formatCurrency: (value: number) => string;
}

export function AssetDetailDialog({ open, onOpenChange, asset, formatCurrency }: AssetDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const barcodeRef = useRef<SVGSVGElement>(null);
  
  const { data: movements = [] } = useAssetMovements(asset?.id);
  const { data: auditTrail = [] } = useAssetAuditTrail(asset?.id);
  const { data: revaluations = [] } = useAssetRevaluations(asset?.id);

  const schedule = useMemo(() => {
    if (!asset) return [];
    return generateDepreciationSchedule(asset);
  }, [asset]);

  // Generate barcode
  useEffect(() => {
    if (barcodeRef.current && asset) {
      const barcodeValue = (asset as any).barcode || asset.asset_number;
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.5,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 5,
          background: '#ffffff',
        });
      } catch (e) {
        // Invalid barcode, ignore
      }
    }
  }, [asset, activeTab]);

  if (!asset) return null;

  const depreciationPercent = asset.acquisition_cost > 0 
    ? ((asset.accumulated_depreciation / asset.acquisition_cost) * 100)
    : 0;

  const remainingMonths = schedule.length;
  const monthsElapsed = differenceInMonths(new Date(), parseISO(asset.depreciation_start_date));

  // Check for warranty/insurance expiry warnings
  const warrantyExpired = (asset as any).warranty_expiry_date && isBefore(parseISO((asset as any).warranty_expiry_date), new Date());
  const insuranceExpired = (asset as any).insurance_expiry_date && isBefore(parseISO((asset as any).insurance_expiry_date), new Date());

  const downloadBarcode = () => {
    if (!barcodeRef.current) return;
    const svgData = new XMLSerializer().serializeToString(barcodeRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      ctx!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      
      const link = document.createElement('a');
      link.download = `asset-${asset.asset_number}-barcode.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {asset.name}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm text-muted-foreground">{asset.asset_number}</span>
                <Badge variant={asset.status === 'active' ? 'default' : asset.status === 'disposed' ? 'destructive' : 'secondary'}>
                  {asset.status}
                </Badge>
                {warrantyExpired && <Badge variant="outline" className="text-amber-600"><AlertTriangle className="h-3 w-3 mr-1" />Warranty Expired</Badge>}
                {insuranceExpired && <Badge variant="outline" className="text-red-600"><Shield className="h-3 w-3 mr-1" />Insurance Expired</Badge>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(asset.book_value)}</p>
              <p className="text-sm text-muted-foreground">Net Book Value</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              <TabsTrigger value="barcode">Barcode</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Visual Depreciation Timeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Depreciation Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Accumulated: {formatCurrency(asset.accumulated_depreciation)}</span>
                      <span>{depreciationPercent.toFixed(1)}% depreciated</span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(depreciationPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Cost: {formatCurrency(asset.acquisition_cost)}</span>
                      <span>Salvage: {formatCurrency(asset.salvage_value)}</span>
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{monthsElapsed}</p>
                      <p className="text-xs text-muted-foreground">Months Elapsed</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{remainingMonths}</p>
                      <p className="text-xs text-muted-foreground">Months Remaining</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{asset.useful_life_months}</p>
                      <p className="text-xs text-muted-foreground">Useful Life</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold capitalize">{asset.depreciation_method.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">Method</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Key Information */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Financial Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Acquisition Cost</span><span className="font-medium">{formatCurrency(asset.acquisition_cost)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Accumulated Dep.</span><span className="font-medium">{formatCurrency(asset.accumulated_depreciation)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Book Value</span><span className="font-medium">{formatCurrency(asset.book_value)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Salvage Value</span><span className="font-medium">{formatCurrency(asset.salvage_value)}</span></div>
                    {(asset as any).cca_class && (
                      <>
                        <Separator className="my-2" />
                        <div className="flex justify-between"><span className="text-muted-foreground">CCA Class</span><span className="font-medium">{(asset as any).cca_class}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Tax Book Value</span><span className="font-medium">{formatCurrency((asset as any).tax_book_value || asset.book_value)}</span></div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Asset Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Acquired</span><span className="font-medium">{format(parseISO(asset.acquisition_date), 'MMM d, yyyy')}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{asset.acquisition_method || 'Purchase'}</span></div>
                    {asset.serial_number && <div className="flex justify-between"><span className="text-muted-foreground">Serial #</span><span className="font-mono">{asset.serial_number}</span></div>}
                    {asset.location && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span>{asset.location}</span></div>}
                    {(asset as any).department && <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{(asset as any).department}</span></div>}
                  </CardContent>
                </Card>
              </div>

              {/* Compliance */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Compliance & Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Condition</p>
                      <p className="font-medium capitalize">{(asset as any).asset_condition || 'Good'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Warranty Expiry</p>
                      <p className={`font-medium ${warrantyExpired ? 'text-amber-600' : ''}`}>
                        {(asset as any).warranty_expiry_date ? format(parseISO((asset as any).warranty_expiry_date), 'MMM d, yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Insurance Expiry</p>
                      <p className={`font-medium ${insuranceExpired ? 'text-red-600' : ''}`}>
                        {(asset as any).insurance_expiry_date ? format(parseISO((asset as any).insurance_expiry_date), 'MMM d, yyyy') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ownership</p>
                      <p className="font-medium capitalize">{(asset as any).ownership_status || 'Owned'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="depreciation" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Depreciation Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Depreciation</TableHead>
                          <TableHead className="text-right">Accumulated</TableHead>
                          <TableHead className="text-right">Book Value</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedule.slice(0, 60).map((entry, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{format(parseISO(entry.period_start), 'MMM yyyy')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.depreciation_amount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.accumulated_depreciation)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(entry.book_value)}</TableCell>
                            <TableCell>
                              <Badge variant={entry.status === 'posted' ? 'default' : 'outline'} className="text-xs">
                                {entry.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="movements" className="mt-4 space-y-4">
              {/* Revaluations */}
              {revaluations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" />
                      Revaluations & Impairments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Old Value</TableHead>
                          <TableHead className="text-right">New Value</TableHead>
                          <TableHead className="text-right">Adjustment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {revaluations.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{format(parseISO(r.revaluation_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="capitalize">{r.revaluation_type}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.old_book_value)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(r.new_book_value)}</TableCell>
                            <TableCell className={`text-right font-medium ${r.adjustment_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {r.adjustment_amount >= 0 ? '+' : ''}{formatCurrency(r.adjustment_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Location/Department Transfers */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Movement History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {movements.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No movement history</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{format(parseISO(m.movement_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="capitalize">{m.movement_type}</TableCell>
                            <TableCell>{m.from_location || m.from_department || '-'}</TableCell>
                            <TableCell>{m.to_location || m.to_department || '-'}</TableCell>
                            <TableCell>{m.reason || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {auditTrail.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">No audit history</p>
                  ) : (
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date/Time</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Field</TableHead>
                            <TableHead>Old Value</TableHead>
                            <TableHead>New Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditTrail.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs">{format(parseISO(entry.performed_at), 'MMM d, yyyy h:mm a')}</TableCell>
                              <TableCell className="capitalize">{entry.action}</TableCell>
                              <TableCell>{entry.field_changed || '-'}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{entry.old_value || '-'}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{entry.new_value || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="barcode" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Barcode className="h-4 w-4" />
                    Asset Barcode / QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <svg ref={barcodeRef} />
                  </div>
                  
                  <div className="text-center space-y-1">
                    <p className="font-mono text-lg">{(asset as any).barcode || asset.asset_number}</p>
                    <p className="text-sm text-muted-foreground">{asset.name}</p>
                  </div>
                  
                  <Button variant="outline" onClick={downloadBarcode}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Barcode
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

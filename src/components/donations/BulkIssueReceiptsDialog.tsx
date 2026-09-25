import { useState, useMemo } from 'react';
import { Receipt, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useDonations } from '@/hooks/useDonations';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getFiscalYearStart,
  getFiscalYearEnd,
  getFiscalYearForDate,
  formatFiscalYearPeriod,
  getAvailableFiscalYears,
} from '@/lib/fiscalYearUtils';
import { format } from 'date-fns';
import type { Donation } from '@/types/donations';

interface BulkIssueReceiptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Stage = 'configure' | 'processing' | 'complete';

interface DonorGroup {
  donorId: string;
  donorName: string;
  donorAddress: string;
  donations: Donation[];
  totalAmount: number;
  totalEligible: number;
  totalAdvantage: number;
}

export function BulkIssueReceiptsDialog({ open, onOpenChange }: BulkIssueReceiptsDialogProps) {
  const { organization } = useCurrentOrganization();
  const { data: allDonations = [] } = useDonations();
  const queryClient = useQueryClient();

  const fiscalYearEndMonth = organization?.fiscal_year_end_month || 12;
  const currentFY = getFiscalYearForDate(new Date(), fiscalYearEndMonth);
  const availableYears = getAvailableFiscalYears(fiscalYearEndMonth, 3, 1);

  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryPosition, setSignatoryPosition] = useState('');
  const [locationIssued, setLocationIssued] = useState('');
  const [stage, setStage] = useState<Stage>('configure');
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);

  const fyStart = getFiscalYearStart(selectedFY, fiscalYearEndMonth);
  const fyEnd = getFiscalYearEnd(selectedFY, fiscalYearEndMonth);

  const eligibleDonations = useMemo(() => {
    return allDonations.filter((d) => {
      if (d.status !== 'confirmed' || d.receipt_issued) return false;
      const dateReceived = new Date(d.date_received);
      return dateReceived >= fyStart && dateReceived <= fyEnd;
    });
  }, [allDonations, fyStart, fyEnd]);

  // Group eligible donations by donor for consolidated receipts
  const donorGroups = useMemo((): DonorGroup[] => {
    const groups = new Map<string, DonorGroup>();
    for (const d of eligibleDonations) {
      const existing = groups.get(d.donor_id);
      const donorAddress = [
        d.donor?.address_line1,
        d.donor?.city,
        d.donor?.province,
        d.donor?.postal_code,
      ].filter(Boolean).join(', ');

      if (existing) {
        existing.donations.push(d);
        existing.totalAmount += d.amount;
        existing.totalEligible += d.eligible_amount;
        existing.totalAdvantage += d.advantage_value;
      } else {
        groups.set(d.donor_id, {
          donorId: d.donor_id,
          donorName: d.donor?.name || 'Unknown',
          donorAddress: donorAddress || '',
          donations: [d],
          totalAmount: d.amount,
          totalEligible: d.eligible_amount,
          totalAdvantage: d.advantage_value,
        });
      }
    }
    return Array.from(groups.values());
  }, [eligibleDonations]);

  const totalEligibleAmount = eligibleDonations.reduce((sum, d) => sum + d.eligible_amount, 0);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v);

  const charityLegalName = organization?.legal_name || organization?.name || '';
  const charityBN = (organization as any)?.business_number || '';
  const charityAddress = [
    organization?.address_line1,
    organization?.city,
    organization?.province,
    organization?.postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  const getNextReceiptNumber = async (orgId: string, offset: number): Promise<string> => {
    const { data } = await supabase
      .from('donation_receipts')
      .select('receipt_number')
      .eq('organization_id', orgId)
      .like('receipt_number', 'REC-%')
      .order('created_at', { ascending: false })
      .limit(200);

    let maxNum = 0;
    if (data) {
      maxNum = data.reduce((max, row) => {
        const match = row.receipt_number.match(/REC-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);
    }
    return `REC-${String(maxNum + 1 + offset).padStart(5, '0')}`;
  };

  const handleIssueAll = async () => {
    if (!organization?.id || donorGroups.length === 0) return;

    setStage('processing');
    setTotalToProcess(donorGroups.length);
    setProcessedCount(0);
    setErrorCount(0);
    setProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < donorGroups.length; i++) {
      const group = donorGroups[i];
      try {
        const receiptNumber = await getNextReceiptNumber(organization.id, 0);

        // Use the last donation date as the receipt's date_of_donation
        const lastDonationDate = group.donations
          .map(d => d.date_received)
          .sort()
          .pop() || new Date().toISOString().split('T')[0];

        const isConsolidated = group.donations.length > 1;

        // Create the consolidated receipt
        const { data: receipt, error: receiptError } = await supabase
          .from('donation_receipts')
          .insert({
            organization_id: organization.id,
            receipt_number: receiptNumber,
            donation_id: isConsolidated ? null : group.donations[0].id,
            is_consolidated: isConsolidated,
            charity_legal_name: charityLegalName,
            charity_bn: charityBN,
            charity_address: charityAddress,
            donor_name: group.donorName,
            donor_address: group.donorAddress,
            date_of_donation: lastDonationDate,
            date_of_issue: new Date().toISOString().split('T')[0],
            location_issued: locationIssued || null,
            amount: group.totalAmount,
            eligible_amount: group.totalEligible,
            advantage_value: group.totalAdvantage,
            advantage_description: null,
            status: 'issued',
            signatory_name: signatoryName || null,
            signatory_position: signatoryPosition || null,
            is_locked: true,
          })
          .select()
          .single();

        if (receiptError) throw receiptError;

        // Insert line items for consolidated receipts
        if (isConsolidated) {
          const items = group.donations.map(d => ({
            receipt_id: receipt.id,
            donation_id: d.id,
            date_received: d.date_received,
            amount: d.amount,
            eligible_amount: d.eligible_amount,
            advantage_value: d.advantage_value,
            donation_type: d.donation_type,
          }));

          const { error: itemsError } = await supabase
            .from('donation_receipt_items')
            .insert(items);

          if (itemsError) throw itemsError;
        }

        // Mark all donations in this group as receipted
        for (const d of group.donations) {
          await supabase
            .from('donations')
            .update({ receipt_issued: true, receipt_id: receipt.id })
            .eq('id', d.id);
        }

        successCount++;
      } catch (err) {
        console.error('Error issuing consolidated receipt:', err);
        failCount++;
      }

      setProcessedCount(successCount + failCount);
      setErrorCount(failCount);
      setProgress(((i + 1) / donorGroups.length) * 100);
    }

    setStage('complete');

    queryClient.invalidateQueries({ queryKey: ['donations'] });
    queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['next-receipt-number'] });
    queryClient.invalidateQueries({ queryKey: ['donation-stats'] });

    if (failCount === 0) {
      toast.success(`${successCount} consolidated CRA receipt(s) issued for ${eligibleDonations.length} donation(s)`);
    } else {
      toast.warning(`${successCount} receipts issued, ${failCount} failed`);
    }
  };

  const handleClose = () => {
    setStage('configure');
    setProgress(0);
    setProcessedCount(0);
    setErrorCount(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={stage === 'processing' ? undefined : handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Issue Year-End Consolidated CRA Receipts
          </DialogTitle>
          <DialogDescription>
            Issue one consolidated CRA-compliant tax receipt per donor, totalling all their donations for the selected fiscal year.
          </DialogDescription>
        </DialogHeader>

        {stage === 'configure' && (
          <div className="space-y-4">
            {/* Fiscal Year Selector */}
            <div className="space-y-2">
              <Label>Fiscal Year</Label>
              <Select value={String(selectedFY)} onValueChange={(v) => setSelectedFY(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((fy) => (
                    <SelectItem key={fy.year} value={String(fy.year)}>
                      FY {fy.year} ({fy.period})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Eligible Summary */}
            <Card className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Donors</span>
                <Badge variant={donorGroups.length > 0 ? 'default' : 'secondary'}>
                  {donorGroups.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Donations</span>
                <Badge variant="outline">
                  {eligibleDonations.length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Eligible Amount</span>
                <span className="font-bold text-lg">{formatCurrency(totalEligibleAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Period</span>
                <span className="text-sm">{format(fyStart, 'MMM d, yyyy')} – {format(fyEnd, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Receipts to Issue</span>
                <span className="text-sm font-medium">{donorGroups.length} consolidated receipt{donorGroups.length !== 1 ? 's' : ''}</span>
              </div>
            </Card>

            {/* Charity Details (pre-filled, read-only) */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Charity Details</Label>
              <div className="text-sm space-y-1 p-3 rounded-md bg-muted/50">
                <p><span className="text-muted-foreground">Legal Name:</span> {charityLegalName || '—'}</p>
                <p><span className="text-muted-foreground">BN:</span> {charityBN || '—'}</p>
                <p><span className="text-muted-foreground">Address:</span> {charityAddress || '—'}</p>
              </div>
            </div>

            {/* Signatory */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Signatory Name</Label>
                <Input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1">
                <Label>Position</Label>
                <Input value={signatoryPosition} onChange={(e) => setSignatoryPosition(e.target.value)} placeholder="Treasurer" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Location Issued</Label>
              <Input value={locationIssued} onChange={(e) => setLocationIssued(e.target.value)} placeholder="City, Province" />
            </div>

            {eligibleDonations.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md bg-muted/50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No confirmed donations without receipts found for this fiscal year.
              </div>
            )}
          </div>
        )}

        {stage === 'processing' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Issuing consolidated receipts… {processedCount} / {totalToProcess} donors</span>
            </div>
            <Progress value={progress} className="h-2" />
            {errorCount > 0 && (
              <p className="text-sm text-destructive">{errorCount} error(s) encountered</p>
            )}
          </div>
        )}

        {stage === 'complete' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto" />
            <div>
              <p className="text-lg font-semibold">{processedCount - errorCount} Consolidated Receipt{(processedCount - errorCount) !== 1 ? 's' : ''} Issued</p>
              <p className="text-sm text-muted-foreground">{eligibleDonations.length} donations consolidated</p>
              {errorCount > 0 && <p className="text-sm text-destructive">{errorCount} failed</p>}
              <p className="text-sm text-muted-foreground mt-1">
                FY {selectedFY} • {formatFiscalYearPeriod(selectedFY, fiscalYearEndMonth)}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === 'configure' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleIssueAll} disabled={donorGroups.length === 0}>
                <Receipt className="w-4 h-4 mr-2" />
                Issue {donorGroups.length} Consolidated Receipt{donorGroups.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {stage === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

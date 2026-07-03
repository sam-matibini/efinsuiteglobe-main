import { useState, useMemo } from 'react';
import { Layers, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDonationReceipts } from '@/hooks/useDonations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type { DonationReceipt } from '@/types/donations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DonorReceiptGroup {
  donorName: string;
  donorAddress: string;
  receipts: DonationReceipt[];
  totalAmount: number;
  totalEligible: number;
  totalAdvantage: number;
}

type Stage = 'select' | 'processing' | 'complete';

export function ConsolidateReceiptsDialog({ open, onOpenChange }: Props) {
  const { data: allReceipts = [] } = useDonationReceipts();
  const { organization } = useCurrentOrganization();
  const { formatWithSymbol } = useCurrencyFormatter();
  const queryClient = useQueryClient();

  const [yearFilter, setYearFilter] = useState<string>('');
  const [selectedDonors, setSelectedDonors] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<Stage>('select');
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // Get individual issued receipts only (not already consolidated, not cancelled)
  const individualReceipts = useMemo(() => {
    return allReceipts.filter(
      r => r.status === 'issued' && !r.is_consolidated
    );
  }, [allReceipts]);

  // Available years from individual receipts
  const years = useMemo(() => {
    const yrs = [...new Set(individualReceipts.map(r => new Date(r.date_of_donation).getFullYear()))];
    return yrs.sort((a, b) => b - a);
  }, [individualReceipts]);

  // Set default year on open
  useMemo(() => {
    if (years.length > 0 && !yearFilter) {
      setYearFilter(years[0].toString());
    }
  }, [years, yearFilter]);

  // Group by donor for the selected year — only donors with 2+ receipts
  const donorGroups = useMemo((): Map<string, DonorReceiptGroup> => {
    const groups = new Map<string, DonorReceiptGroup>();
    if (!yearFilter) return groups;

    for (const r of individualReceipts) {
      if (new Date(r.date_of_donation).getFullYear().toString() !== yearFilter) continue;
      const key = r.donor_name;
      const existing = groups.get(key);
      if (existing) {
        existing.receipts.push(r);
        existing.totalAmount += r.amount;
        existing.totalEligible += r.eligible_amount;
        existing.totalAdvantage += r.advantage_value;
      } else {
        groups.set(key, {
          donorName: r.donor_name,
          donorAddress: r.donor_address,
          receipts: [r],
          totalAmount: r.amount,
          totalEligible: r.eligible_amount,
          totalAdvantage: r.advantage_value,
        });
      }
    }

    return groups;
  }, [individualReceipts, yearFilter]);

  const donorList = useMemo(() => Array.from(donorGroups.entries()), [donorGroups]);

  const toggleDonor = (donorName: string) => {
    setSelectedDonors(prev => {
      const next = new Set(prev);
      if (next.has(donorName)) next.delete(donorName);
      else next.add(donorName);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedDonors.size === donorList.length) {
      setSelectedDonors(new Set());
    } else {
      setSelectedDonors(new Set(donorList.map(([k]) => k)));
    }
  };

  const getNextReceiptNumber = async (orgId: string): Promise<string> => {
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
        if (match) return Math.max(max, parseInt(match[1], 10));
        return max;
      }, 0);
    }
    return `REC-${String(maxNum + 1).padStart(5, '0')}`;
  };

  const handleConsolidate = async () => {
    if (!organization?.id || selectedDonors.size === 0) return;

    setStage('processing');
    const toProcess = donorList.filter(([k]) => selectedDonors.has(k));
    setProgress(0);
    setProcessedCount(0);
    setErrorCount(0);

    let success = 0;
    let fail = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const [, group] = toProcess[i];
      try {
        const receiptNumber = await getNextReceiptNumber(organization.id);
        const lastDate = group.receipts
          .map(r => r.date_of_donation)
          .sort()
          .pop()!;

        // Take signatory from first receipt
        const first = group.receipts[0];

        // Create new consolidated receipt
        const { data: newReceipt, error: insertErr } = await supabase
          .from('donation_receipts')
          .insert({
            organization_id: organization.id,
            receipt_number: receiptNumber,
            donation_id: null,
            is_consolidated: true,
            charity_legal_name: first.charity_legal_name,
            charity_bn: first.charity_bn,
            charity_address: first.charity_address,
            donor_name: group.donorName,
            donor_address: group.donorAddress,
            date_of_donation: lastDate,
            date_of_issue: new Date().toISOString().split('T')[0],
            location_issued: first.location_issued,
            amount: group.totalAmount,
            eligible_amount: group.totalEligible,
            advantage_value: group.totalAdvantage,
            advantage_description: null,
            status: 'issued',
            signatory_name: first.signatory_name,
            signatory_position: first.signatory_position,
            is_locked: true,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        // Create line items from the old receipts
        const items = group.receipts.map(r => ({
          receipt_id: newReceipt.id,
          donation_id: r.donation_id,
          date_received: r.date_of_donation,
          amount: r.amount,
          eligible_amount: r.eligible_amount,
          advantage_value: r.advantage_value,
          donation_type: 'consolidated',
        }));

        const { error: itemsErr } = await supabase
          .from('donation_receipt_items')
          .insert(items);

        if (itemsErr) throw itemsErr;

        // Cancel old individual receipts and link to replacement
        for (const oldReceipt of group.receipts) {
          await supabase
            .from('donation_receipts')
            .update({
              status: 'replaced',
              replaced_by_receipt_id: newReceipt.id,
              cancellation_reason: `Consolidated into ${receiptNumber}`,
            })
            .eq('id', oldReceipt.id);

          // Update the donation to point to the new receipt
          if (oldReceipt.donation_id) {
            await supabase
              .from('donations')
              .update({ receipt_id: newReceipt.id })
              .eq('id', oldReceipt.donation_id);
          }
        }

        success++;
      } catch (err) {
        console.error('Consolidation error:', err);
        fail++;
      }

      setProcessedCount(success + fail);
      setErrorCount(fail);
      setProgress(((i + 1) / toProcess.length) * 100);
    }

    setStage('complete');
    queryClient.invalidateQueries({ queryKey: ['donation-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['donations'] });
    queryClient.invalidateQueries({ queryKey: ['next-receipt-number'] });

    if (fail === 0) {
      toast.success(`${success} consolidated receipt(s) created`);
    } else {
      toast.warning(`${success} created, ${fail} failed`);
    }
  };

  const handleClose = () => {
    setStage('select');
    setProgress(0);
    setProcessedCount(0);
    setErrorCount(0);
    setSelectedDonors(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={stage === 'processing' ? undefined : handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Generate Annual Receipts
          </DialogTitle>
          <DialogDescription>
            Generate CRA-compliant annual receipts for all donors in the selected tax year. Donors with multiple receipts will be consolidated into a single document.
          </DialogDescription>
        </DialogHeader>

        {stage === 'select' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tax Year</Label>
              <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setSelectedDonors(new Set()); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {donorList.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md bg-muted/50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No donors with multiple individual receipts found for {yearFilter || 'this year'}.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground">{donorList.length} donor(s) available</Label>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedDonors.size === donorList.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>

                <ScrollArea className="h-[400px] border-y border-border">
                  <div className="space-y-2">
                    {donorList.map(([donorName, group]) => (
                      <Card
                        key={donorName}
                        className={`p-3 cursor-pointer transition-colors ${selectedDonors.has(donorName) ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => toggleDonor(donorName)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedDonors.has(donorName)}
                            onCheckedChange={() => toggleDonor(donorName)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm truncate">{donorName}</span>
                              <Badge variant="outline" className="text-xs ml-2 shrink-0">
                                {group.receipts.length} receipts
                              </Badge>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>Total: {formatWithSymbol(group.totalAmount)}</span>
                              <span>Eligible: {formatWithSymbol(group.totalEligible)}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
                {donorList.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Showing {donorList.length} donors — scroll to see all
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {stage === 'processing' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Consolidating… {processedCount} / {selectedDonors.size}</span>
            </div>
            <Progress value={progress} className="h-2" />
            {errorCount > 0 && <p className="text-sm text-destructive">{errorCount} error(s)</p>}
          </div>
        )}

        {stage === 'complete' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto" />
            <div>
              <p className="text-lg font-semibold">{processedCount - errorCount} Consolidated</p>
              <p className="text-sm text-muted-foreground">Old receipts marked as replaced</p>
              {errorCount > 0 && <p className="text-sm text-destructive">{errorCount} failed</p>}
            </div>
          </div>
        )}

        <DialogFooter>
          {stage === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleConsolidate} disabled={selectedDonors.size === 0}>
                <Layers className="w-4 h-4 mr-2" />
                Generate Annual Receipt{selectedDonors.size !== 1 ? 's' : ''} for {selectedDonors.size} Donor{selectedDonors.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {stage === 'complete' && <Button onClick={handleClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

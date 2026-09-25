import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Printer, X, Building2, ArrowRightLeft, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { ConsolidationReport } from '@/hooks/useConsolidation';

interface ConsolidatedReportViewerProps {
  reportId: string;
  onClose: () => void;
}

export function ConsolidatedReportViewer({ reportId, onClose }: ConsolidatedReportViewerProps) {
  const { data: report, isLoading } = useQuery({
    queryKey: ['consolidation-report', reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consolidation_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data as ConsolidationReport;
    },
  });

  if (isLoading) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96" />
        </DialogContent>
      </Dialog>
    );
  }

  if (!report) {
    return null;
  }

  const reportData = report.report_data as {
    generated_at?: string;
    members?: Array<{
      organization_name?: string;
      ownership_percentage?: number;
      consolidation_method?: string;
      functional_currency?: string;
    }>;
    totals?: {
      total_assets?: number;
      total_liabilities?: number;
      total_equity?: number;
      total_revenue?: number;
      total_expenses?: number;
      net_income?: number;
    };
  } | null;

  const eliminationEntries = report.elimination_entries as Array<{
    type?: string;
    description?: string;
    amount?: number;
  }> | null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: report.base_currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getReportTitle = () => {
    switch (report.report_type) {
      case 'balance_sheet': return 'Consolidated Balance Sheet';
      case 'income_statement': return 'Consolidated Income Statement';
      case 'cash_flow': return 'Consolidated Statement of Cash Flows';
      case 'changes_in_equity': return 'Consolidated Statement of Changes in Equity';
      default: return 'Consolidated Report';
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-5 h-5" />
              {getReportTitle()}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {format(parseLocalDate(report.period_start), 'MMMM d, yyyy')} - {format(parseLocalDate(report.period_end), 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={report.status === 'final' ? 'default' : 'secondary'}>
              {report.status}
            </Badge>
            <Badge variant="outline">{report.base_currency}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Consolidated Entities */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Consolidated Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Ownership</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Currency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.members?.map((member, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{member.organization_name}</TableCell>
                      <TableCell>{member.ownership_percentage}%</TableCell>
                      <TableCell className="capitalize">{member.consolidation_method}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{member.functional_currency}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Consolidated Figures */}
          {report.report_type === 'balance_sheet' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Consolidated Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Assets</h4>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(reportData?.totals?.total_assets || 0)}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Liabilities</h4>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(reportData?.totals?.total_liabilities || 0)}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Equity</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData?.totals?.total_equity || 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {report.report_type === 'income_statement' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Consolidated Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Revenue</h4>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(reportData?.totals?.total_revenue || 0)}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Expenses</h4>
                    <div className="text-2xl font-bold text-destructive">
                      {formatCurrency(reportData?.totals?.total_expenses || 0)}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Net Income</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData?.totals?.net_income || 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Elimination Entries */}
          {eliminationEntries && eliminationEntries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4" />
                  Elimination Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eliminationEntries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="capitalize">{entry.type?.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.amount || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Currency Translations (for international) */}
          {report.currency_translations && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Currency Translations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  All foreign currency amounts have been translated to {report.base_currency} using the applicable exchange rates.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Generated: {format(new Date(report.generated_at), 'MMM d, yyyy h:mm a')}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

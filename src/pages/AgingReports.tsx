import { useState } from 'react';
import { Download, Building2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useARAgingReport, useAPAgingReport } from '@/hooks/useAgingReports';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportActions, ReportData } from '@/components/reports/ReportActions';

export default function AgingReports() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: arData, isLoading: arLoading } = useARAgingReport();
  const { data: apData, isLoading: apLoading } = useAPAgingReport();
  const [showOrgDialog, setShowOrgDialog] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to view aging reports.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  const arReportData: ReportData = {
    title: 'Accounts Receivable Aging Report',
    subtitle: 'Customer balances by age',
    dateRange: `As of ${new Date().toLocaleDateString('en-CA')}`,
    organizationName: organization?.name || '',
    headers: ['Customer', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total'],
    rows: (arData?.customers || []).map(customer => [
      customer.name,
      customer.buckets.current,
      customer.buckets.days1to30,
      customer.buckets.days31to60,
      customer.buckets.days61to90,
      customer.buckets.over90,
      customer.buckets.total,
    ]),
    totals: arData?.summary ? [
      { label: 'Current', value: arData.summary.current },
      { label: '1-30 Days', value: arData.summary.days1to30 },
      { label: '31-60 Days', value: arData.summary.days31to60 },
      { label: '61-90 Days', value: arData.summary.days61to90 },
      { label: '90+ Days', value: arData.summary.over90 },
      { label: 'Total', value: arData.summary.total },
    ] : [],
  };

  const apReportData: ReportData = {
    title: 'Accounts Payable Aging Report',
    subtitle: 'Vendor balances by age',
    dateRange: `As of ${new Date().toLocaleDateString('en-CA')}`,
    organizationName: organization?.name || '',
    headers: ['Vendor', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total'],
    rows: (apData?.vendors || []).map(vendor => [
      vendor.name,
      vendor.buckets.current,
      vendor.buckets.days1to30,
      vendor.buckets.days31to60,
      vendor.buckets.days61to90,
      vendor.buckets.over90,
      vendor.buckets.total,
    ]),
    totals: apData?.summary ? [
      { label: 'Current', value: apData.summary.current },
      { label: '1-30 Days', value: apData.summary.days1to30 },
      { label: '31-60 Days', value: apData.summary.days31to60 },
      { label: '61-90 Days', value: apData.summary.days61to90 },
      { label: '90+ Days', value: apData.summary.over90 },
      { label: 'Total', value: apData.summary.total },
    ] : [],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aging Reports</h1>
          <p className="text-muted-foreground">Analyze outstanding receivables and payables by age</p>
        </div>
      </div>

      <Tabs defaultValue="ar" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ar" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Accounts Receivable
          </TabsTrigger>
          <TabsTrigger value="ap" className="gap-2">
            <TrendingDown className="w-4 h-4" />
            Accounts Payable
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ar" className="space-y-6">
          <div className="flex justify-end">
            <ReportActions reportData={arReportData} variant="compact" />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Current</p>
              <p className="text-lg font-bold text-success">{formatCurrency(arData?.summary?.current || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">1-30 Days</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(arData?.summary?.days1to30 || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">31-60 Days</p>
              <p className="text-lg font-bold text-warning">{formatCurrency(arData?.summary?.days31to60 || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">61-90 Days</p>
              <p className="text-lg font-bold text-orange-500">{formatCurrency(arData?.summary?.days61to90 || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">90+ Days</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(arData?.summary?.over90 || 0)}</p>
            </Card>
            <Card className="p-4 bg-primary/5">
              <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(arData?.summary?.total || 0)}</p>
            </Card>
          </div>

          {/* Customer Table */}
          <Card className="overflow-hidden">
            {arLoading ? (
              <div className="p-8">
                <Skeleton className="h-64" />
              </div>
            ) : (arData?.customers || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No outstanding receivables.
              </div>
            ) : (
              <table className="data-table">
                <thead className="bg-muted/50">
                  <tr>
                    <th>Customer</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">1-30 Days</th>
                    <th className="text-right">31-60 Days</th>
                    <th className="text-right">61-90 Days</th>
                    <th className="text-right">90+ Days</th>
                    <th className="text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(arData?.customers || []).map((customer) => (
                    <tr key={customer.id} className="hover:bg-muted/20">
                      <td className="font-medium">{customer.name}</td>
                      <td className="text-right font-mono">{formatCurrency(customer.buckets.current)}</td>
                      <td className="text-right font-mono">{formatCurrency(customer.buckets.days1to30)}</td>
                      <td className="text-right font-mono">{formatCurrency(customer.buckets.days31to60)}</td>
                      <td className="text-right font-mono">{formatCurrency(customer.buckets.days61to90)}</td>
                      <td className="text-right font-mono text-destructive">{formatCurrency(customer.buckets.over90)}</td>
                      <td className="text-right font-mono font-bold">{formatCurrency(customer.buckets.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-bold">
                  <tr>
                    <td>Total</td>
                    <td className="text-right font-mono">{formatCurrency(arData?.summary?.current || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(arData?.summary?.days1to30 || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(arData?.summary?.days31to60 || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(arData?.summary?.days61to90 || 0)}</td>
                    <td className="text-right font-mono text-destructive">{formatCurrency(arData?.summary?.over90 || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(arData?.summary?.total || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="ap" className="space-y-6">
          <div className="flex justify-end">
            <ReportActions reportData={apReportData} variant="compact" />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Current</p>
              <p className="text-lg font-bold text-success">{formatCurrency(apData?.summary?.current || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">1-30 Days</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(apData?.summary?.days1to30 || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">31-60 Days</p>
              <p className="text-lg font-bold text-warning">{formatCurrency(apData?.summary?.days31to60 || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">61-90 Days</p>
              <p className="text-lg font-bold text-orange-500">{formatCurrency(apData?.summary?.days61to90 || 0)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">90+ Days</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(apData?.summary?.over90 || 0)}</p>
            </Card>
            <Card className="p-4 bg-primary/5">
              <p className="text-xs text-muted-foreground mb-1">Total Outstanding</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(apData?.summary?.total || 0)}</p>
            </Card>
          </div>

          {/* Vendor Table */}
          <Card className="overflow-hidden">
            {apLoading ? (
              <div className="p-8">
                <Skeleton className="h-64" />
              </div>
            ) : (apData?.vendors || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No outstanding payables.
              </div>
            ) : (
              <table className="data-table">
                <thead className="bg-muted/50">
                  <tr>
                    <th>Vendor</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">1-30 Days</th>
                    <th className="text-right">31-60 Days</th>
                    <th className="text-right">61-90 Days</th>
                    <th className="text-right">90+ Days</th>
                    <th className="text-right font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(apData?.vendors || []).map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-muted/20">
                      <td className="font-medium">{vendor.name}</td>
                      <td className="text-right font-mono">{formatCurrency(vendor.buckets.current)}</td>
                      <td className="text-right font-mono">{formatCurrency(vendor.buckets.days1to30)}</td>
                      <td className="text-right font-mono">{formatCurrency(vendor.buckets.days31to60)}</td>
                      <td className="text-right font-mono">{formatCurrency(vendor.buckets.days61to90)}</td>
                      <td className="text-right font-mono text-destructive">{formatCurrency(vendor.buckets.over90)}</td>
                      <td className="text-right font-mono font-bold">{formatCurrency(vendor.buckets.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-bold">
                  <tr>
                    <td>Total</td>
                    <td className="text-right font-mono">{formatCurrency(apData?.summary?.current || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(apData?.summary?.days1to30 || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(apData?.summary?.days31to60 || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(apData?.summary?.days61to90 || 0)}</td>
                    <td className="text-right font-mono text-destructive">{formatCurrency(apData?.summary?.over90 || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(apData?.summary?.total || 0)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from 'react';
import { RefreshCw, Plus, Search, MoreHorizontal, Play, Pause, FileText, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useRecurringBills } from '@/hooks/useRecurringBills';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { CreateRecurringBillDialog } from '@/components/purchases/CreateRecurringBillDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function RecurringBills() {
  const [searchTerm, setSearchTerm] = useState('');
  const isReadOnly = useIsReadOnly();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { 
    recurringBills, 
    isLoading, 
    activeSchedules, 
    monthlyTotal, 
    nextSevenDays,
    updateRecurringBillStatus,
    generateBillNow,
  } = useRecurringBills();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const filteredBills = recurringBills.filter(bill =>
    bill.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bill.vendor?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return 'Weekly';
      case 'biweekly':
        return 'Bi-weekly';
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'annually':
        return 'Annually';
      default:
        return frequency;
    }
  };

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing recurring bills.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recurring Bills</h1>
          <p className="text-muted-foreground">Manage your recurring bill schedules</p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Recurring Bill
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Schedules</CardDescription>
            <CardTitle className="text-2xl">{activeSchedules}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Total</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(monthlyTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Next 7 Days</CardDescription>
            <CardTitle className="text-2xl">{nextSevenDays} bill{nextSevenDays !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bills Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Recurring Bills</CardTitle>
              <CardDescription>
                {filteredBills.length} recurring bill{filteredBills.length !== 1 ? 's' : ''} scheduled
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search recurring bills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No recurring bills found</p>
                    <p className="text-sm">Create a recurring bill to automate your expenses.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.vendor?.name || 'Unknown'}</TableCell>
                    <TableCell>{bill.template_name}</TableCell>
                    <TableCell>{getFrequencyLabel(bill.frequency)}</TableCell>
                    <TableCell>{formatDate(bill.next_bill_date)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(bill.total))}
                    </TableCell>
                    <TableCell>{getStatusBadge(bill.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <FileText className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Schedule</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {bill.status === 'active' ? (
                            <DropdownMenuItem 
                              onClick={() => updateRecurringBillStatus.mutate({ id: bill.id, status: 'paused' })}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          ) : bill.status === 'paused' ? (
                            <DropdownMenuItem 
                              onClick={() => updateRecurringBillStatus.mutate({ id: bill.id, status: 'active' })}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem 
                            onClick={() => generateBillNow.mutate(bill.id)}
                            disabled={bill.status !== 'active'}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Generate Bill Now
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => updateRecurringBillStatus.mutate({ id: bill.id, status: 'cancelled' })}
                          >
                            Cancel Schedule
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateRecurringBillDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { FileText, Plus, Send, Trash2, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MoreHorizontal } from 'lucide-react';
import { useRoeRecords, type CreateRoEInput } from '@/hooks/useRoeRecords';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { downloadRoePdf } from '@/lib/generateRoePdf';
import { ROE_REASON_CODES } from '@/types/payroll';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { getPayrollLocalization } from '@/data/payrollLocalization';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import type { Database } from '@/integrations/supabase/types';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

type RoEReasonCode = Database['public']['Enums']['roe_reason'];

export default function RoeRecords() {
  const confirmDelete = useConfirmDelete();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateRoEInput>>({});

  const { roeRecords, isLoading, createRoE, submitRoE, deleteRoE, stats } = useRoeRecords();
  const { employees } = useEmployees();
  const { organization } = useCurrentOrganization();

  // Determine country from organization
  const countryCode = useMemo(() => {
    if (organization?.country) {
      const upperCountry = organization.country.toUpperCase();
      if (COUNTRY_LOCALIZATIONS[upperCountry]) return upperCountry;
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    return 'CA';
  }, [organization?.country]);

  const payrollConfig = useMemo(() => getPayrollLocalization(countryCode), [countryCode]);
  const { separationDoc: docConfig, currencyCode, currencyLocale } = payrollConfig;

  // Filter to terminated or on_leave employees
  const eligibleEmployees = employees?.filter(e => 
    e.status === 'terminated' || e.status === 'on_leave'
  ) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(currencyLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Draft</Badge>;
      case 'submitted':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Submitted</Badge>;
      case 'accepted':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Accepted</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCreate = async () => {
    if (!formData.employee_id || !formData.reason_code || !formData.last_day_paid) {
      return;
    }
    await createRoE.mutateAsync(formData as CreateRoEInput);
    setCreateDialogOpen(false);
    setFormData({});
  };

  const reasonCodes = Object.entries(ROE_REASON_CODES) as [RoEReasonCode, string][];

  // For non-Canadian countries, show a different UI or message
  if (!docConfig.available && countryCode !== 'CA') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{docConfig.docName}</h1>
            <p className="text-muted-foreground">{docConfig.description}</p>
          </div>
        </div>

        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Feature Coming Soon</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {docConfig.docName} generation for your jurisdiction is currently in development. 
            For now, please generate these documents manually following your local labor law requirements.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{docConfig.docName}</h1>
          <p className="text-muted-foreground">{docConfig.description}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          {docConfig.createButtonLabel}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalRecords}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Submission</p>
              <p className="text-2xl font-bold text-foreground">{stats.draftCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="text-2xl font-bold text-foreground">{stats.submittedCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{docConfig.docCode} Serial</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>{docConfig.reasonLabel}</TableHead>
              <TableHead>First Day Worked</TableHead>
              <TableHead>Last Day Paid</TableHead>
              <TableHead className="text-right">Insurable Hours</TableHead>
              <TableHead className="text-right">Insurable Earnings</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : roeRecords && roeRecords.length > 0 ? (
              roeRecords.map((roe) => (
                <TableRow key={roe.id}>
                  <TableCell className="font-mono text-sm">{roe.roe_serial}</TableCell>
                  <TableCell className="font-medium">
                    {roe.employees?.first_name} {roe.employees?.last_name}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{roe.reason_code}</span>
                    <span className="text-muted-foreground text-sm ml-1">
                      - {ROE_REASON_CODES[roe.reason_code]}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(roe.first_day_worked)}</TableCell>
                  <TableCell>{formatDate(roe.last_day_paid)}</TableCell>
                  <TableCell className="text-right">{roe.total_insurable_hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(roe.total_insurable_earnings)}</TableCell>
                  <TableCell>{getStatusBadge(roe.status || 'draft')}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadRoePdf(roe, organization?.name || 'Company')}>
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </DropdownMenuItem>
                        {roe.status === 'draft' && (
                          <DropdownMenuItem onClick={() => submitRoE.mutate(roe.id)}>
                            <Send className="w-4 h-4 mr-2" />
                            Mark Submitted
                          </DropdownMenuItem>
                        )}
                        {roe.status === 'draft' && (
                          <DropdownMenuItem 
                            onClick={() => confirmDelete(() => deleteRoE.mutate(roe.id), { title: 'Delete ROE record?' })}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No {docConfig.docCode} records found. Create a new {docConfig.docCode} when an employee leaves.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create {docConfig.docName}</DialogTitle>
            <DialogDescription>
              Generate a {docConfig.docCode} for an employee who has left the company or stopped working.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select 
                value={formData.employee_id} 
                onValueChange={(v) => setFormData({ ...formData, employee_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEmployees.length > 0 ? (
                    eligibleEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_number})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No terminated or on-leave employees
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{docConfig.reasonLabel}</Label>
              <Select 
                value={formData.reason_code} 
                onValueChange={(v) => setFormData({ ...formData, reason_code: v as RoEReasonCode })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonCodes.map(([code, description]) => (
                    <SelectItem key={code} value={code}>
                      <span className="font-medium">{code}</span> - {description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Last Day Paid</Label>
              <Input 
                type="date" 
                value={formData.last_day_paid || ''} 
                onChange={(e) => setFormData({ ...formData, last_day_paid: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Recall Date (if applicable)</Label>
              <Input 
                type="date" 
                value={formData.recall_date || ''} 
                onChange={(e) => setFormData({ ...formData, recall_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea 
                placeholder="Additional comments or notes"
                value={formData.comments || ''} 
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreate} 
              disabled={createRoE.isPending || !formData.employee_id || !formData.reason_code || !formData.last_day_paid}
              className="bg-accent hover:bg-accent/90"
            >
              {createRoE.isPending ? 'Creating...' : `Create ${docConfig.docCode}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { Plus, Search, MoreHorizontal, FileText, Send, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import { usePMInvoices, useUpdatePMInvoiceStatus, useDeletePMInvoice } from '@/hooks/usePracticeManagement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import type { PMInvoice } from '@/types/practiceManagement';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

interface PMBillingTabProps {
  onAddInvoice: () => void;
}

export function PMBillingTab({ onAddInvoice }: PMBillingTabProps) {
  const confirmDelete = useConfirmDelete();
  const { data: invoices, isLoading } = usePMInvoices();
  const updateStatus = useUpdatePMInvoiceStatus();
  const deleteInvoice = useDeletePMInvoice();
  const { formatWithSymbol } = useCurrencyFormatter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = invoices?.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'sent': return 'secondary';
      case 'overdue': return 'destructive';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'sent': return <Send className="h-3 w-3 mr-1" />;
      case 'overdue': return <Clock className="h-3 w-3 mr-1" />;
      default: return <FileText className="h-3 w-3 mr-1" />;
    }
  };

  const handleStatusChange = async (invoice: PMInvoice, newStatus: string) => {
    await updateStatus.mutateAsync({ 
      id: invoice.id, 
      status: newStatus,
      amount_paid: newStatus === 'paid' ? invoice.total : undefined,
    });
  };

  const handleDelete = async (id: string) => {
    await deleteInvoice.mutateAsync(id);
  };

  // Calculate summary stats
  const stats = {
    totalOutstanding: filteredInvoices?.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((sum, i) => sum + i.balance_due, 0) || 0,
    totalPaid: filteredInvoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0) || 0,
    draftCount: filteredInvoices?.filter(i => i.status === 'draft').length || 0,
    overdueCount: filteredInvoices?.filter(i => i.status === 'overdue').length || 0,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Client Billing
            </CardTitle>
            <CardDescription>Create and manage invoices for your clients</CardDescription>
          </div>
          <Button onClick={onAddInvoice}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-bold text-warning">{formatWithSymbol(stats.totalOutstanding)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Paid This Month</p>
            <p className="text-2xl font-bold text-primary">{formatWithSymbol(stats.totalPaid)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold">{stats.draftCount}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-destructive">{stats.overdueCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No invoices found. Click "New Invoice" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices?.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.client?.legal_name || '-'}</TableCell>
                    <TableCell>{format(parseLocalDate(invoice.invoice_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(parseLocalDate(invoice.due_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right font-medium">{formatWithSymbol(invoice.total)}</TableCell>
                    <TableCell className="text-right">
                      {invoice.balance_due > 0 ? (
                        <span className="text-warning">{formatWithSymbol(invoice.balance_due)}</span>
                      ) : (
                        <span className="text-primary">Paid</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">
                        {getStatusIcon(invoice.status)}
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          {invoice.status === 'draft' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(invoice, 'sent')}>
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {['draft', 'sent', 'overdue'].includes(invoice.status) && (
                            <DropdownMenuItem onClick={() => handleStatusChange(invoice, 'paid')}>
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status === 'draft' && (
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => confirmDelete(() => handleDelete(invoice.id), { title: 'Delete invoice?', description: 'Time entries will be unbilled. This action cannot be undone.' })}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

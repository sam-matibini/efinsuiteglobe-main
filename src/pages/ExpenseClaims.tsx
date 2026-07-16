import { useState } from 'react';
import { Plus, Search, Download, MoreHorizontal, FileText, Send, Check, X, DollarSign, Building2, Paperclip, Sparkles } from 'lucide-react';
import { PurchaseAttachmentsDialog } from '@/components/purchases/PurchaseAttachmentsDialog';
import { AICategorizeAPDialog } from '@/components/purchases/AICategorizeAPDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useExpenseClaims } from '@/hooks/useExpenseClaims';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateExpenseClaimDialog } from '@/components/purchases/CreateExpenseClaimDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { DocumentShareDialog } from '@/components/shared/DocumentShareDialog';

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-muted text-muted-foreground' },
  submitted: { label: 'Submitted', icon: Send, color: 'bg-blue-500/10 text-blue-600' },
  under_review: { label: 'Under Review', icon: FileText, color: 'bg-warning/10 text-warning' },
  approved: { label: 'Approved', icon: Check, color: 'bg-success/10 text-success' },
  rejected: { label: 'Rejected', icon: X, color: 'bg-destructive/10 text-destructive' },
  paid: { label: 'Paid', icon: DollarSign, color: 'bg-primary/10 text-primary' },
  voided: { label: 'Voided', icon: X, color: 'bg-muted text-muted-foreground' },
};

export default function ExpenseClaims() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { 
    expenseClaims, 
    isLoading, 
    totalClaims, 
    pendingApproval, 
    pendingPayment, 
    totalPaid,
    submitExpenseClaim,
    approveExpenseClaim,
    rejectExpenseClaim,
    payExpenseClaim,
  } = useExpenseClaims();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [shareClaim, setShareClaim] = useState<any | null>(null);
  const [docsClaim, setDocsClaim] = useState<any | null>(null);
  const [showAICategorize, setShowAICategorize] = useState(false);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  const filteredClaims = expenseClaims.filter(claim => {
    const matchesSearch = 
      claim.claim_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (`${claim.employee?.first_name} ${claim.employee?.last_name}`).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing expense claims.
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
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Claims</h1>
          <p className="text-muted-foreground">Manage employee expense reimbursements</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Expense Claim
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Claims</p>
          <p className="text-2xl font-bold text-foreground">{totalClaims}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending Approval</p>
          <p className="text-2xl font-bold text-warning">{pendingApproval}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending Payment</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(pendingPayment)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(totalPaid)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search expense claims..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredClaims.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {expenseClaims.length === 0 ? 'No expense claims yet.' : 'No expense claims match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Claim #</th>
                <th>Employee</th>
                <th>Date</th>
                <th>Description</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => {
                const status = statusConfig[claim.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                return (
                  <tr key={claim.id} className="hover:bg-muted/20">
                    <td className="font-medium text-accent">{claim.claim_number}</td>
                    <td>{claim.employee ? `${claim.employee.first_name} ${claim.employee.last_name}` : 'Unknown'}</td>
                    <td className="text-muted-foreground">{formatDate(claim.claim_date)}</td>
                    <td className="text-muted-foreground truncate max-w-[200px]">{claim.description || '-'}</td>
                    <td>
                      <Badge className={cn('gap-1', status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="text-right font-mono font-medium">{formatCurrency(Number(claim.total_amount))}</td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>View Receipts</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShareClaim(claim)}>
                            <Send className="w-4 h-4 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDocsClaim(claim)}>
                            <Paperclip className="w-4 h-4 mr-2" /> Attach / Analyze Documents
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {claim.status === 'draft' && (
                            <DropdownMenuItem onClick={() => submitExpenseClaim.mutate(claim.id)}>
                              Submit for Approval
                            </DropdownMenuItem>
                          )}
                          {claim.status === 'submitted' && (
                            <>
                              <DropdownMenuItem onClick={() => approveExpenseClaim.mutate({ claimId: claim.id, approverId: 'current-user' })}>
                                <Check className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => rejectExpenseClaim.mutate({ claimId: claim.id, reviewerId: 'current-user' })}>
                                <X className="w-4 h-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {claim.status === 'approved' && (
                            <DropdownMenuItem onClick={() => payExpenseClaim.mutate({ claimId: claim.id, paymentMethod: 'bank_transfer' })}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <CreateExpenseClaimDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <DocumentShareDialog
        open={shareClaim !== null}
        onOpenChange={(o) => !o && setShareClaim(null)}
        kind="expense_claim"
        document={shareClaim ? {
          id: shareClaim.id,
          number: shareClaim.claim_number,
          date: shareClaim.claim_date ?? shareClaim.submission_date,
          total: Number(shareClaim.total_amount),
          notes: shareClaim.description,
        } : null}
        contact={shareClaim?.employee ? {
          name: shareClaim.employee.full_name || shareClaim.employee.name,
          email: shareClaim.employee.email,
          phone: shareClaim.employee.phone,
        } : null}
      />
      <PurchaseAttachmentsDialog
        open={docsClaim !== null}
        onOpenChange={(o) => !o && setDocsClaim(null)}
        entityType="expense_claim"
        entityId={docsClaim?.id}
        organizationId={docsClaim?.organization_id ?? organization?.id}
        title={docsClaim ? `Claim ${docsClaim.claim_number} — Documents` : undefined}
        currentNotes={docsClaim?.description}
        invalidateKeys={["expense_claims"]}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Plus, Search, Download, MoreHorizontal, Receipt, Car, Trash2, Building2, Paperclip } from 'lucide-react';
import { PurchaseAttachmentsDialog } from '@/components/purchases/PurchaseAttachmentsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
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
import { useExpenses } from '@/hooks/useExpenses';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { RecordExpenseDialog } from '@/components/expenses/RecordExpenseDialog';
import { ExpenseDetailsDialog } from '@/components/expenses/ExpenseDetailsDialog';
import { EditExpenseDialog } from '@/components/expenses/EditExpenseDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

export default function Expenses() {
  const confirmDelete = useConfirmDelete();
  const isReadOnly = useIsReadOnly();
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { 
    expenses, 
    isLoading, 
    totalExpenses,
    totalMileage,
    expenseCount,
    mileageCount,
    deleteExpense,
  } = useExpenses();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [docsExpense, setDocsExpense] = useState<any | null>(null);
  const [viewExpense, setViewExpense] = useState<any | null>(null);
  const [editExpense, setEditExpense] = useState<any | null>(null);
  
  // Feature toggles
  const [showMileageOnly, setShowMileageOnly] = useState(false);
  const [showExpensesOnly, setShowExpensesOnly] = useState(false);
  const [showReimbursable, setShowReimbursable] = useState(false);

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

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = 
        (expense.notes?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (expense.reference?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (expense.vendor?.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Apply type filter from dropdown or toggles
      let matchesType = true;
      if (showMileageOnly) {
        matchesType = expense.expense_type === 'mileage';
      } else if (showExpensesOnly) {
        matchesType = expense.expense_type === 'expense';
      } else if (typeFilter !== 'all') {
        matchesType = expense.expense_type === typeFilter;
      }
      
      return matchesSearch && matchesType;
    });
  }, [expenses, searchQuery, typeFilter, showMileageOnly, showExpensesOnly, showReimbursable]);

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start recording expenses.
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
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-muted-foreground">Track and manage business expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowRecordDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Expense
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-foreground">{expenseCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Expense Amount</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(totalExpenses)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Mileage Records</p>
          <p className="text-2xl font-bold text-foreground">{mileageCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Distance</p>
          <p className="text-2xl font-bold text-success">{totalMileage.toLocaleString()} km</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="mileage">Mileage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Feature Toggles */}
        <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch 
              id="mileage-only" 
              checked={showMileageOnly} 
              onCheckedChange={(checked) => {
                setShowMileageOnly(checked);
                if (checked) setShowExpensesOnly(false);
              }}
            />
            <Label htmlFor="mileage-only" className="text-sm cursor-pointer">
              Mileage Only
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="expenses-only" 
              checked={showExpensesOnly} 
              onCheckedChange={(checked) => {
                setShowExpensesOnly(checked);
                if (checked) setShowMileageOnly(false);
              }}
            />
            <Label htmlFor="expenses-only" className="text-sm cursor-pointer">
              Expenses Only
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="reimbursable" 
              checked={showReimbursable} 
              onCheckedChange={setShowReimbursable}
            />
            <Label htmlFor="reimbursable" className="text-sm cursor-pointer">
              Reimbursable
            </Label>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          Showing {filteredExpenses.length} of {expenses.length} expenses
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {expenses.length === 0 ? 'No expenses recorded yet.' : 'No expenses match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Vendor</th>
                <th>Reference</th>
                <th className="text-right">Amount</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-muted/20">
                  <td className="text-muted-foreground">{formatDate(expense.expense_date)}</td>
                  <td>
                    <Badge className={cn(
                      'gap-1',
                      expense.expense_type === 'mileage' 
                        ? 'bg-blue-500/10 text-blue-600' 
                        : 'bg-primary/10 text-primary'
                    )}>
                      {expense.expense_type === 'mileage' ? (
                        <>
                          <Car className="w-3 h-3" />
                          Mileage
                        </>
                      ) : (
                        <>
                          <Receipt className="w-3 h-3" />
                          Expense
                        </>
                      )}
                    </Badge>
                  </td>
                  <td className="max-w-[200px] truncate">
                    {expense.expense_type === 'mileage' 
                      ? `${expense.from_location} → ${expense.to_location} (${expense.distance} ${expense.distance_unit})`
                      : expense.notes || expense.expense_account?.name || '-'
                    }
                  </td>
                  <td className="text-muted-foreground">{expense.vendor?.name || '-'}</td>
                  <td className="text-muted-foreground">{expense.reference || '-'}</td>
                  <td className="text-right font-mono font-medium">{formatCurrency(Number(expense.amount))}</td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewExpense(expense)}>View Details</DropdownMenuItem>
                        {!isReadOnly && (
                          <DropdownMenuItem onClick={() => setEditExpense(expense)}>Edit</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => setDocsExpense(expense)}>
                          <Paperclip className="w-4 h-4 mr-2" /> Attach / Analyze Documents
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => confirmDelete(() => deleteExpense.mutate(expense.id), { title: 'Delete expense?' })}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <RecordExpenseDialog open={showRecordDialog} onOpenChange={setShowRecordDialog} />
      <PurchaseAttachmentsDialog
        open={docsExpense !== null}
        onOpenChange={(o) => !o && setDocsExpense(null)}
        entityType="expense"
        entityId={docsExpense?.id}
        organizationId={docsExpense?.organization_id ?? organization?.id}
        title={docsExpense ? `Expense ${docsExpense.reference || docsExpense.id.slice(0,8)} — Documents` : undefined}
        currentNotes={docsExpense?.notes}
        invalidateKeys={["expenses"]}
      />
      <ExpenseDetailsDialog
        expense={viewExpense}
        open={viewExpense !== null}
        onOpenChange={(o) => !o && setViewExpense(null)}
      />
      <EditExpenseDialog
        expense={editExpense}
        open={editExpense !== null}
        onOpenChange={(o) => !o && setEditExpense(null)}
      />
    </div>
  );
}

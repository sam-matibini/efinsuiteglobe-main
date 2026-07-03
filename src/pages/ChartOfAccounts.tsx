import { useState, useMemo, useCallback } from 'react';
import { Plus, Search, Download, Upload, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts, buildAccountTree, DbAccount } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { AddAccountDialog } from '@/components/accounts/AddAccountDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { DbAccountTree } from '@/components/accounts/DbAccountTree';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function ChartOfAccounts() {
  const isReadOnly = useIsReadOnly();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(organization?.id);

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.name.toLowerCase().includes(query) ||
          acc.code.toLowerCase().includes(query)
      );
    }
    
    if (filterType !== 'all') {
      filtered = filtered.filter((acc) => acc.account_type === filterType);
    }
    
    return filtered;
  }, [accounts, searchQuery, filterType]);

  // Build tree from filtered accounts
  const accountTree = useMemo(() => buildAccountTree(filteredAccounts), [filteredAccounts]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: accounts.length,
      assets: accounts.filter((a) => a.account_type === 'asset').length,
      liabilities: accounts.filter((a) => a.account_type === 'liability').length,
      equity: accounts.filter((a) => a.account_type === 'equity').length,
      incomeExpense: accounts.filter((a) => a.account_type === 'income' || a.account_type === 'expense').length,
    };
  }, [accounts]);

  const handleExportToExcel = useCallback(() => {
    if (accounts.length === 0) {
      toast.error('No accounts to export');
      return;
    }

    // Prepare data for export - flatten the account structure
    const exportData = accounts
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(acc => ({
        'Account Code': acc.code,
        'Account Name': acc.name,
        'Type': acc.account_type.charAt(0).toUpperCase() + acc.account_type.slice(1),
        'Normal Balance': acc.normal_balance === 'debit' ? 'Debit' : 'Credit',
        'Is Header': acc.is_header ? 'Yes' : 'No',
        'Group': acc.account_group || '',
        'Sub-Group': acc.account_sub_group || '',
        'T3010 Category': (acc as any).t3010_category || '',
        'Description': acc.description || '',
        'Opening Balance': acc.opening_balance || 0,
        'Current Balance': acc.current_balance || 0,
        'Active': acc.is_active ? 'Yes' : 'No',
      }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Account Code
      { wch: 35 }, // Account Name
      { wch: 12 }, // Type
      { wch: 14 }, // Normal Balance
      { wch: 10 }, // Is Header
      { wch: 20 }, // Group
      { wch: 20 }, // Sub-Group
      { wch: 22 }, // T3010 Category
      { wch: 40 }, // Description
      { wch: 15 }, // Opening Balance
      { wch: 15 }, // Current Balance
      { wch: 8 },  // Active
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');

    // Generate filename with organization name and date
    const orgName = organization?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'CoA';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${orgName}_ChartOfAccounts_${dateStr}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
    toast.success('Chart of Accounts exported successfully');
  }, [accounts, organization?.name]);

  const isLoading = orgLoading || accountsLoading;

  // No organization state
  if (!orgLoading && !organization) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
            <p className="text-muted-foreground">Manage your organization's account structure</p>
          </div>
        </div>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No Organization Found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-1">
                Create an organization to start managing your chart of accounts.
              </p>
            </div>
            <Button onClick={() => setCreateOrgDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </div>
        </Card>

        <CreateOrganizationDialog
          open={createOrgDialogOpen}
          onOpenChange={setCreateOrgDialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your organization's account structure</p>
        </div>
        <div className="flex items-center gap-3">
          {!isReadOnly && (
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportToExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="stat-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="asset">Assets</SelectItem>
              <SelectItem value="liability">Liabilities</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="active">
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card text-center py-4">
              <Skeleton className="h-8 w-12 mx-auto mb-1" />
              <Skeleton className="h-4 w-20 mx-auto" />
            </div>
          ))
        ) : (
          <>
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Accounts</p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold text-blue-600">{stats.assets}</p>
              <p className="text-sm text-muted-foreground">Assets</p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold text-orange-600">{stats.liabilities}</p>
              <p className="text-sm text-muted-foreground">Liabilities</p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold text-purple-600">{stats.equity}</p>
              <p className="text-sm text-muted-foreground">Equity</p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold text-green-600">{stats.incomeExpense}</p>
              <p className="text-sm text-muted-foreground">Income/Expense</p>
            </div>
          </>
        )}
      </div>

      {/* Account Tree */}
      <div className="stat-card">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No accounts found. Add your first account to get started.</p>
            <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No accounts match your search criteria.</p>
          </div>
        ) : (
          <DbAccountTree accounts={accountTree} organizationId={organization?.id || ''} />
        )}
      </div>

      {/* Dialogs */}
      {organization && (
        <AddAccountDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          organizationId={organization.id}
          existingAccounts={accounts}
        />
      )}
      
      <CreateOrganizationDialog
        open={createOrgDialogOpen}
        onOpenChange={setCreateOrgDialogOpen}
      />
    </div>
  );
}

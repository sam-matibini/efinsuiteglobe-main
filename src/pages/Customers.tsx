import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Mail, Phone, MoreHorizontal, FileText, DollarSign, Building2, LayoutGrid, List, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { AddCustomerDialog } from '@/components/customers/AddCustomerDialog';
import { EditCustomerDialog } from '@/components/customers/EditCustomerDialog';
import { CustomerDetailsDialog } from '@/components/customers/CustomerDetailsDialog';
import { BulkUploadCustomersDialog } from '@/components/customers/BulkUploadCustomersDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function Customers() {
  const navigate = useNavigate();
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { customers, isLoading, deleteCustomer } = useCustomers();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  
  // Feature toggles
  const [showInactive, setShowInactive] = useState(false);
  const [showWithBalance, setShowWithBalance] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filter customers based on search and toggles
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesSearch;
    });
  }, [customers, searchQuery, showInactive, showWithBalance]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this customer?')) {
      await deleteCustomer.mutateAsync(id);
    }
  };

  const handleCreateInvoice = (customer: Customer) => {
    navigate('/sales/invoices', { state: { createForCustomer: customer } });
  };

  const handleViewTransactions = (customer: Customer) => {
    navigate('/sales/invoices', { state: { filterCustomerId: customer.id, filterCustomerName: customer.name } });
  };

  // Reusable dropdown for both views
  const renderActions = (customer: Customer) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setDetailsCustomer(customer)}>
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setEditCustomer(customer)}>
          Edit Customer
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCreateInvoice(customer)}>
          Create Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleViewTransactions(customer)}>
          View Transactions
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="text-destructive"
          onClick={() => handleDelete(customer.id)}
        >
          Deactivate
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start managing customers.
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">Manage your customer relationships</p>
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsBulkOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setIsAddOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
        )}
      </div>

      <AddCustomerDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      <EditCustomerDialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)} customer={editCustomer} />
      <CustomerDetailsDialog open={!!detailsCustomer} onOpenChange={(open) => !open && setDetailsCustomer(null)} customer={detailsCustomer} />
      <BulkUploadCustomersDialog open={isBulkOpen} onOpenChange={setIsBulkOpen} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-foreground">{customers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <p className="text-2xl font-bold text-success">{customers.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Receivables</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Avg. Balance</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(0)}
          </p>
        </Card>
      </div>

      {/* Search and Toggles */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search customers by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setViewMode('cards')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Card View</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setViewMode('table')}
                >
                  <List className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Table View</TooltipContent>
            </Tooltip>
          </div>
          
          {/* Feature Toggles */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch 
                id="show-inactive" 
                checked={showInactive} 
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Show Inactive
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch 
                id="show-balance" 
                checked={showWithBalance} 
                onCheckedChange={setShowWithBalance}
              />
              <Label htmlFor="show-balance" className="text-sm cursor-pointer">
                With Balance
              </Label>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          Showing {filteredCustomers.length} of {customers.length} customers
        </div>
      </Card>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {customers.length === 0 ? 'No customers yet. Add your first customer to get started.' : 'No customers match your search.'}
          </p>
        </Card>
      ) : viewMode === 'table' ? (
        /* Table View */
        <Card className="overflow-hidden">
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th className="text-right">Balance</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-muted/20">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-accent">
                          {customer.name.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium">{customer.name}</span>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{customer.email || '-'}</td>
                  <td className="text-muted-foreground">{customer.phone || '-'}</td>
                  <td><Badge variant="outline">Active</Badge></td>
                  <td className="text-right font-mono">{formatCurrency(0)}</td>
                  <td>{renderActions(customer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <span className="text-lg font-semibold text-accent">
                      {customer.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{customer.name}</h3>
                    <Badge variant="outline" className="mt-1">Active</Badge>
                  </div>
                </div>
                {renderActions(customer)}
              </div>

              <div className="space-y-2 text-sm">
                {customer.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{customer.phone}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Outstanding Balance</span>
                  <span className="font-semibold text-muted-foreground">
                    {formatCurrency(0)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleCreateInvoice(customer)}>
                  <FileText className="w-4 h-4 mr-1" />
                  Invoice
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleViewTransactions(customer)}>
                  <DollarSign className="w-4 h-4 mr-1" />
                  Payment
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

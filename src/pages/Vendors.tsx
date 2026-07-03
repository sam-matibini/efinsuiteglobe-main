import { useState, useMemo } from 'react';
import { Plus, Search, Mail, Phone, MoreHorizontal, FileText, DollarSign, UserCheck, Building2, User, LayoutGrid, List, Paperclip } from 'lucide-react';
import { PurchaseAttachmentsDialog } from '@/components/purchases/PurchaseAttachmentsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useVendors } from '@/hooks/useVendors';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { AddVendorDialog } from '@/components/vendors/AddVendorDialog';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function Vendors() {
  const isReadOnly = useIsReadOnly();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [docsVendor, setDocsVendor] = useState<any | null>(null);
  
  // Feature toggles
  const [showInactive, setShowInactive] = useState(false);
  const [showContractorsOnly, setShowContractorsOnly] = useState(false);
  const [showT4AOnly, setShowT4AOnly] = useState(false);
  const [showWithBalance, setShowWithBalance] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const { vendors, isLoading, deactivateVendor } = useVendors();
  const { organization } = useCurrentOrganization();

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

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (v.first_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (v.last_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      
      let matchesType = true;
      if (typeFilter === 'contractor') matchesType = v.is_contractor;
      else if (typeFilter === 't4a') matchesType = v.t4a_required;
      else if (typeFilter === 'organization') matchesType = v.vendor_type === 'organization';
      else if (typeFilter === 'individual') matchesType = v.vendor_type === 'individual';
      
      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = v.is_active;
      else if (statusFilter === 'inactive') matchesStatus = !v.is_active;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [vendors, searchQuery, typeFilter, statusFilter]);

  const activeVendors = vendors.filter(v => v.is_active);
  const contractors = vendors.filter(v => v.is_contractor);
  const t4aVendors = vendors.filter(v => v.t4a_required);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors & Contractors</h1>
          <p className="text-muted-foreground">Manage vendors, contractors, and T4A tracking</p>
        </div>
        {!isReadOnly && (
          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Vendor
          </Button>
        )}
      </div>

      <AddVendorDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Vendors</p>
          <p className="text-2xl font-bold text-foreground">{vendors.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <p className="text-2xl font-bold text-success">{activeVendors.length}</p>
        </Card>
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-primary" />
            <p className="text-sm text-muted-foreground">Contractors</p>
          </div>
          <p className="text-2xl font-bold text-primary">{contractors.length}</p>
        </Card>
        <Card className="p-4 border-warning/20 bg-warning/5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-warning" />
            <p className="text-sm text-muted-foreground">T4A Required</p>
          </div>
          <p className="text-2xl font-bold text-warning">{t4aVendors.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Payables</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(0)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors by name or email..."
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
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="organization">Organizations</SelectItem>
              <SelectItem value="individual">Individuals</SelectItem>
              <SelectItem value="contractor">Contractors</SelectItem>
              <SelectItem value="t4a">T4A Required</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Feature Toggles */}
        <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch 
              id="show-inactive-vendors" 
              checked={showInactive} 
              onCheckedChange={(checked) => {
                setShowInactive(checked);
                setStatusFilter(checked ? 'all' : 'active');
              }}
            />
            <Label htmlFor="show-inactive-vendors" className="text-sm cursor-pointer">
              Show Inactive
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="contractors-only" 
              checked={showContractorsOnly} 
              onCheckedChange={(checked) => {
                setShowContractorsOnly(checked);
                setTypeFilter(checked ? 'contractor' : 'all');
              }}
            />
            <Label htmlFor="contractors-only" className="text-sm cursor-pointer">
              Contractors Only
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="t4a-only" 
              checked={showT4AOnly} 
              onCheckedChange={(checked) => {
                setShowT4AOnly(checked);
                setTypeFilter(checked ? 't4a' : 'all');
              }}
            />
            <Label htmlFor="t4a-only" className="text-sm cursor-pointer">
              T4A Required
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch 
              id="with-balance-vendors" 
              checked={showWithBalance} 
              onCheckedChange={setShowWithBalance}
            />
            <Label htmlFor="with-balance-vendors" className="text-sm cursor-pointer">
              With Balance
            </Label>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
          Showing {filteredVendors.length} of {vendors.length} vendors
        </div>
      </Card>

      {/* Vendors List */}
      {filteredVendors.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'active' 
              ? 'No vendors found matching your filters.' 
              : 'No vendors yet. Add your first vendor to get started.'}
          </p>
        </Card>
      ) : viewMode === 'table' ? (
        /* Table View */
        <Card className="overflow-hidden">
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th className="text-right">Balance</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-muted/20">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        vendor.is_contractor ? "bg-primary/10" : "bg-muted"
                      )}>
                        {vendor.vendor_type === 'individual' ? (
                          <User className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{vendor.name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {vendor.is_contractor && (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          <UserCheck className="w-3 h-3 mr-1" />
                          Contractor
                        </Badge>
                      )}
                      {vendor.t4a_required && (
                        <Badge className="bg-warning/10 text-warning border-warning/20">
                          T4A
                        </Badge>
                      )}
                      {!vendor.is_contractor && !vendor.t4a_required && (
                        <span className="text-muted-foreground text-sm">
                          {vendor.vendor_type === 'individual' ? 'Individual' : 'Organization'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground">{vendor.email || '-'}</td>
                  <td className="text-muted-foreground">{vendor.phone || '-'}</td>
                  <td>
                    <Badge variant="outline" className={cn(!vendor.is_active && "bg-muted")}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="text-right font-mono">{formatCurrency(0)}</td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Vendor</DropdownMenuItem>
                        <DropdownMenuItem>Create Bill</DropdownMenuItem>
                        <DropdownMenuItem>View Transactions</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDocsVendor(vendor)}>
                          <Paperclip className="w-4 h-4 mr-2" /> Attach / Analyze Documents
                        </DropdownMenuItem>
                        {vendor.t4a_required && (
                          <DropdownMenuItem>
                            <FileText className="w-4 h-4 mr-2" />
                            Generate T4A
                          </DropdownMenuItem>
                        )}
                        {vendor.is_active && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deactivateVendor.mutate(vendor.id)}
                          >
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    vendor.is_contractor ? "bg-primary/10" : "bg-muted"
                  )}>
                    {vendor.vendor_type === 'individual' ? (
                      <User className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{vendor.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className={cn(vendor.is_active ? "" : "bg-muted")}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {vendor.is_contractor && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                              <UserCheck className="w-3 h-3 mr-1" />
                              Contractor
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            This vendor is tracked as a contractor
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {vendor.t4a_required && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                              T4A
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            T4A slip required for this contractor
                            {vendor.sin_last_four && (
                              <span className="block text-xs mt-1">SIN: ***-***-{vendor.sin_last_four}</span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Details</DropdownMenuItem>
                    <DropdownMenuItem>Edit Vendor</DropdownMenuItem>
                    <DropdownMenuItem>Create Bill</DropdownMenuItem>
                    <DropdownMenuItem>View Transactions</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDocsVendor(vendor)}>
                      <Paperclip className="w-4 h-4 mr-2" /> Attach / Analyze Documents
                    </DropdownMenuItem>
                    {vendor.t4a_required && (
                      <DropdownMenuItem>
                        <FileText className="w-4 h-4 mr-2" />
                        Generate T4A
                      </DropdownMenuItem>
                    )}
                    {vendor.is_active && (
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => deactivateVendor.mutate(vendor.id)}
                      >
                        Deactivate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2 text-sm">
                {vendor.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{vendor.email}</span>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                {vendor.city && vendor.province && (
                  <div className="text-xs text-muted-foreground">
                    {vendor.city}, {vendor.province}
                  </div>
                )}
              </div>

              {vendor.is_contractor && (
                <div className="mt-4 pt-4 border-t border-border bg-muted/30 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">YTD Payments</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(0)}
                    </span>
                  </div>
                  {vendor.t4a_required && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">T4A Status</span>
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {!vendor.is_contractor && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount Owed</span>
                    <span className="font-semibold text-muted-foreground">
                      {formatCurrency(0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <FileText className="w-4 h-4 mr-1" />
                  Bill
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Payment
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <PurchaseAttachmentsDialog
        open={docsVendor !== null}
        onOpenChange={(o) => !o && setDocsVendor(null)}
        entityType="vendor"
        entityId={docsVendor?.id}
        organizationId={docsVendor?.organization_id ?? organization?.id}
        title={docsVendor ? `${docsVendor.name} — Documents` : undefined}
        currentNotes={docsVendor?.notes}
        invalidateKeys={["vendors"]}
      />
    </div>
  );
}

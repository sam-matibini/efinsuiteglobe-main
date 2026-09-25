import { useState, useMemo } from 'react';
import { useProductsServices, useDeleteProductService, ProductService } from '@/hooks/useProductsServices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AddProductServiceDialog } from '@/components/products/AddProductServiceDialog';
import { EditProductServiceDialog } from '@/components/products/EditProductServiceDialog';
import { ProductCostingDialog } from '@/components/products/ProductCostingDialog';
import { BulkUploadProductsDialog } from '@/components/products/BulkUploadProductsDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import {
  Plus,
  Search,
  Package,
  Wrench,
  MoreHorizontal,
  Edit,
  Trash2,
  DollarSign,
  Tag,
  Building2,
  Calculator,
  Upload,
} from 'lucide-react';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function ProductsServices() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { data: items = [], isLoading } = useProductsServices(organization?.id);
  const deleteMutation = useDeleteProductService();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [costingDialogOpen, setCostingDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductService | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku?.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase());
      
      if (activeTab === 'all') return matchesSearch;
      return matchesSearch && item.type === activeTab;
    });
  }, [items, search, activeTab]);

  const stats = useMemo(() => {
    const products = items.filter(i => i.type === 'product');
    const services = items.filter(i => i.type === 'service');
    const avgPrice = items.length > 0
      ? items.reduce((sum, i) => sum + i.selling_price, 0) / items.length
      : 0;

    return {
      total: items.length,
      products: products.length,
      services: services.length,
      avgPrice,
    };
  }, [items]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(amount);
  };

  if (orgLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground">Create an organization to manage products and services.</p>
        <Button onClick={() => setCreateOrgOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products & Services</h1>
          <p className="text-muted-foreground">
            Manage your sellable products and services for invoicing.
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product/Service
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Package className="w-4 h-4" /> Products
            </CardDescription>
            <CardTitle className="text-2xl">{stats.products}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Wrench className="w-4 h-4" /> Services
            </CardDescription>
            <CardTitle className="text-2xl">{stats.services}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" /> Avg. Price
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(stats.avgPrice)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="product">Products ({stats.products})</TabsTrigger>
                <TabsTrigger value="service">Services ({stats.services})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Taxable</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {search ? 'No items match your search' : 'No products or services yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant={item.type === 'product' ? 'default' : 'secondary'}>
                        {item.type === 'product' ? (
                          <Package className="w-3 h-3 mr-1" />
                        ) : (
                          <Wrench className="w-3 h-3 mr-1" />
                        )}
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.sku || '-'}</TableCell>
                    <TableCell>
                      {item.category ? (
                        <Badge variant="outline">
                          <Tag className="w-3 h-3 mr-1" />
                          {item.category}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.selling_price)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.cost_price ? formatCurrency(item.cost_price) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.is_taxable ? 'default' : 'outline'}>
                        {item.is_taxable ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedProduct(item);
                            setCostingDialogOpen(true);
                          }}>
                            <Calculator className="w-4 h-4 mr-2" />
                            Costing & Pricing
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedProduct(item);
                            setEditDialogOpen(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
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

      <AddProductServiceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditProductServiceDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} product={selectedProduct} />
      <BulkUploadProductsDialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen} />
      <ProductCostingDialog open={costingDialogOpen} onOpenChange={setCostingDialogOpen} product={selectedProduct} organizationId={organization?.id} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this product or service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteMutation.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

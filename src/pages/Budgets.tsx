import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  Sparkles,
  Factory,
  Wallet,
  FolderKanban,
  TrendingUp,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { BUDGET_TYPE_CATEGORIES, BUDGET_STATUS_CONFIG } from '@/types/budget';
import { CreateBudgetDialog } from '@/components/budget/CreateBudgetDialog';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function Budgets() {
  const isReadOnly = useIsReadOnly();
  const navigate = useNavigate();
  const { budgets, isLoading, deleteBudget } = useBudgets();
  const { formatCurrency } = useLocalizedCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const filteredBudgets = budgets.filter(budget => {
    const matchesSearch = budget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      budget.budget_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'financial') {
      return matchesSearch && BUDGET_TYPE_CATEGORIES.financial.some(t => t.value === budget.budget_type);
    }
    if (activeTab === 'production') {
      return matchesSearch && BUDGET_TYPE_CATEGORIES.production.some(t => t.value === budget.budget_type);
    }
    if (activeTab === 'program') {
      return matchesSearch && BUDGET_TYPE_CATEGORIES.program.some(t => t.value === budget.budget_type);
    }
    return matchesSearch;
  });

  const getBudgetTypeLabel = (type: string) => {
    const allTypes = [...BUDGET_TYPE_CATEGORIES.financial, ...BUDGET_TYPE_CATEGORIES.production, ...BUDGET_TYPE_CATEGORIES.program];
    return allTypes.find(t => t.value === type)?.label || type;
  };

  const stats = {
    total: budgets.length,
    active: budgets.filter(b => b.status === 'active').length,
    draft: budgets.filter(b => b.status === 'draft').length,
    totalValue: budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0),
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Budget Management</h1>
            <p className="text-muted-foreground">
              AI-powered budgeting for financial, operational, and production planning
            </p>
          </div>
          {!isReadOnly && (
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Budget
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budgets</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.draft}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/budgets/production')}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 rounded-lg bg-orange-100">
                <Factory className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Production Budgets</CardTitle>
                <CardDescription>Materials, Labor, Overhead, Capacity</CardDescription>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/budgets/variance')}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-100">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Variance Analysis</CardTitle>
                <CardDescription>AI-powered variance insights</CardDescription>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/budgets/ai-forecast')}>
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="p-2 rounded-lg bg-purple-100">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">AI Forecasting</CardTitle>
                <CardDescription>Predictive budget intelligence</CardDescription>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
          </Card>
        </div>

        {/* Budgets Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <CardTitle>All Budgets</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search budgets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="financial" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  Financial
                </TabsTrigger>
                <TabsTrigger value="production" className="gap-2">
                  <Factory className="h-4 w-4" />
                  Production
                </TabsTrigger>
                <TabsTrigger value="program" className="gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Program
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredBudgets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No budgets found</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first budget to get started with financial planning
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Budget
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>AI Generated</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBudgets.map((budget) => (
                        <TableRow 
                          key={budget.id} 
                          className="cursor-pointer"
                          onClick={() => navigate(`/budgets/${budget.id}`)}
                        >
                          <TableCell className="font-medium">{budget.name}</TableCell>
                          <TableCell>{getBudgetTypeLabel(budget.budget_type)}</TableCell>
                          <TableCell>{budget.fiscal_year}</TableCell>
                          <TableCell className="capitalize">{budget.period_type}</TableCell>
                          <TableCell>{formatCurrency(budget.total_amount || 0)}</TableCell>
                          <TableCell>
                            <Badge className={BUDGET_STATUS_CONFIG[budget.status]?.color}>
                              {BUDGET_STATUS_CONFIG[budget.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {budget.ai_generated && (
                              <Badge variant="outline" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                AI
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/budgets/${budget.id}`);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/budgets/${budget.id}/edit`);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this budget?')) {
                                      deleteBudget.mutate(budget.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <CreateBudgetDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />
    </AppLayout>
  );
}

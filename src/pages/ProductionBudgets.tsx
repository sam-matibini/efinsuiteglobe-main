import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Plus, 
  ArrowLeft,
  Factory,
  Package,
  HardHat,
  Settings,
  Clock,
  Gauge,
  Calculator,
  BarChart3,
  FileBox,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useProductionBudgets } from '@/hooks/useBudgets';
import { useProductionBoms, useProductionCapacity, useProductionRoutings } from '@/hooks/useProductionData';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { BUDGET_STATUS_CONFIG, BUDGET_TYPE_CATEGORIES } from '@/types/budget';
import { CreateBudgetDialog } from '@/components/budget/CreateBudgetDialog';
import { CreateBomDialog } from '@/components/budget/CreateBomDialog';
import { CreateCapacityDialog } from '@/components/budget/CreateCapacityDialog';
import { CreateRoutingDialog } from '@/components/budget/CreateRoutingDialog';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';

const PRODUCTION_ICONS: Record<string, any> = {
  master_production: Factory,
  production_volume: BarChart3,
  direct_materials: Package,
  direct_labor: HardHat,
  manufacturing_overhead: Settings,
  wip: Clock,
  production_cost_unit: Calculator,
  production_variance: BarChart3,
  production_capacity: Gauge,
};

export default function ProductionBudgets() {
  const navigate = useNavigate();
  const { data: productionBudgets, isLoading } = useProductionBudgets();
  const { boms, isLoading: bomsLoading } = useProductionBoms();
  const { capacities, isLoading: capacitiesLoading } = useProductionCapacity();
  const { routings, isLoading: routingsLoading } = useProductionRoutings();
  const { formatCurrency } = useLocalizedCurrency();
  
  const [activeTab, setActiveTab] = useState('budgets');
  const [showCreateBudget, setShowCreateBudget] = useState(false);
  const [showCreateBom, setShowCreateBom] = useState(false);
  const [showCreateCapacity, setShowCreateCapacity] = useState(false);
  const [showCreateRouting, setShowCreateRouting] = useState(false);

  const getBudgetTypeLabel = (type: string) => {
    return BUDGET_TYPE_CATEGORIES.production.find(t => t.value === type)?.label || type;
  };

  const budgetStats = {
    materials: productionBudgets?.filter(b => b.budget_type === 'direct_materials').length || 0,
    labor: productionBudgets?.filter(b => b.budget_type === 'direct_labor').length || 0,
    overhead: productionBudgets?.filter(b => b.budget_type === 'manufacturing_overhead').length || 0,
    capacity: productionBudgets?.filter(b => b.budget_type === 'production_capacity').length || 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/budgets')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Production Budgets</h1>
              <p className="text-muted-foreground">
                Manufacturing, materials, labor, and capacity planning
              </p>
            </div>
          </div>
        </div>

        {/* Production Budget Types */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Materials Budgets</CardTitle>
              <Package className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{budgetStats.materials}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Labor Budgets</CardTitle>
              <HardHat className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{budgetStats.labor}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overhead Budgets</CardTitle>
              <Settings className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{budgetStats.overhead}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity Plans</CardTitle>
              <Gauge className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{budgetStats.capacity}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="budgets" className="gap-2">
                    <Factory className="h-4 w-4" />
                    Production Budgets
                  </TabsTrigger>
                  <TabsTrigger value="boms" className="gap-2">
                    <FileBox className="h-4 w-4" />
                    Bills of Materials
                  </TabsTrigger>
                  <TabsTrigger value="routings" className="gap-2">
                    <Layers className="h-4 w-4" />
                    Routings
                  </TabsTrigger>
                  <TabsTrigger value="capacity" className="gap-2">
                    <Gauge className="h-4 w-4" />
                    Capacity
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  {activeTab === 'budgets' && (
                    <Button onClick={() => setShowCreateBudget(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Production Budget
                    </Button>
                  )}
                  {activeTab === 'boms' && (
                    <Button onClick={() => setShowCreateBom(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New BoM
                    </Button>
                  )}
                  {activeTab === 'routings' && (
                    <Button onClick={() => setShowCreateRouting(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Routing
                    </Button>
                  )}
                  {activeTab === 'capacity' && (
                    <Button onClick={() => setShowCreateCapacity(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Capacity
                    </Button>
                  )}
                </div>
              </div>

              {/* Production Budgets Tab */}
              <TabsContent value="budgets">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : productionBudgets?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Factory className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No production budgets</h3>
                    <p className="text-muted-foreground mb-4">
                      Create budgets for materials, labor, overhead, and capacity
                    </p>
                    <Button onClick={() => setShowCreateBudget(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Production Budget
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Fiscal Year</TableHead>
                        <TableHead>Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>AI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productionBudgets?.map((budget) => {
                        const Icon = PRODUCTION_ICONS[budget.budget_type] || Factory;
                        return (
                          <TableRow 
                            key={budget.id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/budgets/${budget.id}`)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {budget.name}
                              </div>
                            </TableCell>
                            <TableCell>{getBudgetTypeLabel(budget.budget_type)}</TableCell>
                            <TableCell>{budget.fiscal_year}</TableCell>
                            <TableCell>{formatCurrency(budget.total_amount || 0)}</TableCell>
                            <TableCell>
                              <Badge className={BUDGET_STATUS_CONFIG[budget.status]?.color}>
                                {BUDGET_STATUS_CONFIG[budget.status]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {budget.ai_generated && (
                                <Sparkles className="h-4 w-4 text-purple-500" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Bills of Materials Tab */}
              <TabsContent value="boms">
                {bomsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : boms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileBox className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Bills of Materials</h3>
                    <p className="text-muted-foreground mb-4">
                      Define product structures with materials, components, and costs
                    </p>
                    <Button onClick={() => setShowCreateBom(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create BoM
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>BoM Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Yield %</TableHead>
                        <TableHead>Batch Size</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boms.map((bom) => (
                        <TableRow key={bom.id}>
                          <TableCell className="font-medium">{bom.bom_name}</TableCell>
                          <TableCell>{bom.bom_code}</TableCell>
                          <TableCell>{bom.version}</TableCell>
                          <TableCell>{bom.yield_percentage}%</TableCell>
                          <TableCell>{bom.standard_batch_size}</TableCell>
                          <TableCell>{bom.items?.length || 0}</TableCell>
                          <TableCell>
                            <Badge variant={bom.is_active ? 'default' : 'secondary'}>
                              {bom.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Routings Tab */}
              <TabsContent value="routings">
                {routingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : routings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Production Routings</h3>
                    <p className="text-muted-foreground mb-4">
                      Define labor steps, work centers, and production sequences
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Routing Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Steps</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routings.map((routing) => {
                        const totalHours = routing.steps?.reduce((sum, s) => 
                          sum + s.standard_hours + s.setup_hours, 0) || 0;
                        return (
                          <TableRow key={routing.id}>
                            <TableCell className="font-medium">{routing.routing_name}</TableCell>
                            <TableCell>{routing.routing_code}</TableCell>
                            <TableCell>{routing.steps?.length || 0}</TableCell>
                            <TableCell>{totalHours.toFixed(2)} hrs</TableCell>
                            <TableCell>
                              <Badge variant={routing.is_active ? 'default' : 'secondary'}>
                                {routing.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Capacity Tab */}
              <TabsContent value="capacity">
                {capacitiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : capacities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Gauge className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No Capacity Records</h3>
                    <p className="text-muted-foreground mb-4">
                      Track machine hours, labor hours, and production capacity
                    </p>
                    <Button onClick={() => setShowCreateCapacity(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Capacity
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Facility</TableHead>
                        <TableHead>Work Center</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Utilized</TableHead>
                        <TableHead>Utilization %</TableHead>
                        <TableHead>Period</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capacities.map((cap) => (
                        <TableRow key={cap.id}>
                          <TableCell className="font-medium">{cap.facility_name}</TableCell>
                          <TableCell>{cap.work_center || '-'}</TableCell>
                          <TableCell className="capitalize">{cap.capacity_type.replace('_', ' ')}</TableCell>
                          <TableCell>{cap.available_capacity}</TableCell>
                          <TableCell>{cap.utilized_capacity}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full" 
                                  style={{ width: `${Math.min(cap.utilization_percentage, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm">{cap.utilization_percentage?.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(parseLocalDate(cap.period_start), 'MMM yyyy')}
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
        open={showCreateBudget} 
        onOpenChange={setShowCreateBudget}
        defaultCategory="production"
      />

      <CreateBomDialog
        open={showCreateBom}
        onOpenChange={setShowCreateBom}
      />

      <CreateCapacityDialog
        open={showCreateCapacity}
        onOpenChange={setShowCreateCapacity}
      />

      <CreateRoutingDialog
        open={showCreateRouting}
        onOpenChange={setShowCreateRouting}
      />
    </AppLayout>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  Plus, 
  Sparkles,
  GitBranch,
  BarChart3,
  Calculator,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useBudgetDetails, useBudgets } from '@/hooks/useBudgets';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { useAccounts } from '@/hooks/useAccounts';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { BUDGET_STATUS_CONFIG, BUDGET_TYPE_CATEGORIES, SCENARIO_TYPE_CONFIG } from '@/types/budget';
import { AddBudgetLineItemDialog } from '@/components/budget/AddBudgetLineItemDialog';
import { CreateScenarioDialog } from '@/components/budget/CreateScenarioDialog';
import { AIBudgetAssistant } from '@/components/budget/AIBudgetAssistant';
import { BudgetChartView } from '@/components/budget/BudgetChartView';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function BudgetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganizationContext();
  const { budget, lineItems, versions, isLoading, updateLineItem, refetch } = useBudgetDetails(id);
  const { updateBudget } = useBudgets();
  const { data: accounts = [] } = useAccounts(currentOrganization?.id);
  const { formatCurrency } = useLocalizedCurrency();
  
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [showScenarioDialog, setShowScenarioDialog] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [activeTab, setActiveTab] = useState('grid');
  const [editingCell, setEditingCell] = useState<{ lineId: string; period: number } | null>(null);

  const getBudgetTypeLabel = (type: string) => {
    const allTypes = [...BUDGET_TYPE_CATEGORIES.financial, ...BUDGET_TYPE_CATEGORIES.production, ...BUDGET_TYPE_CATEGORIES.program];
    return allTypes.find(t => t.value === type)?.label || type;
  };

  const handleCellUpdate = (lineId: string, period: number, value: number) => {
    const periodKey = `period_${period}` as keyof typeof lineItems[0];
    updateLineItem.mutate({ 
      id: lineId, 
      [periodKey]: value 
    });
    setEditingCell(null);
  };

  const calculateColumnTotal = (period: number) => {
    const periodKey = `period_${period}` as keyof typeof lineItems[0];
    return lineItems.reduce((sum, item) => sum + (Number(item[periodKey]) || 0), 0);
  };

  const grandTotal = lineItems.reduce((sum, item) => sum + (item.annual_total || 0), 0);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!budget) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <h2 className="text-xl font-semibold mb-2">Budget not found</h2>
          <Button onClick={() => navigate('/budgets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Budgets
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/budgets')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{budget.name}</h1>
                <Badge className={BUDGET_STATUS_CONFIG[budget.status]?.color}>
                  {BUDGET_STATUS_CONFIG[budget.status]?.label}
                </Badge>
                {budget.ai_generated && (
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {getBudgetTypeLabel(budget.budget_type)} • FY {budget.fiscal_year} • {budget.period_type}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAIAssistant(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Assistant
            </Button>
            <Button variant="outline" onClick={() => setShowScenarioDialog(true)}>
              <GitBranch className="h-4 w-4 mr-2" />
              New Scenario
            </Button>
            <Button onClick={() => setShowAddLineDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {lineItems.length} line items
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {format(parseLocalDate(budget.start_date), 'MMM d, yyyy')}
              </div>
              <p className="text-xs text-muted-foreground">
                to {format(parseLocalDate(budget.end_date), 'MMM d, yyyy')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Currency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{budget.currency}</div>
              {budget.base_currency && budget.base_currency !== budget.currency && (
                <p className="text-xs text-muted-foreground">
                  Base: {budget.base_currency}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{versions.length}</div>
              <p className="text-xs text-muted-foreground">
                {versions.filter(v => v.is_active).length} active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scenarios */}
        {versions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {versions.map((version) => (
                  <Badge 
                    key={version.id}
                    variant={version.is_active ? "default" : "outline"}
                    className={version.scenario_type ? SCENARIO_TYPE_CONFIG[version.scenario_type]?.color : ''}
                  >
                    {version.version_name}
                    {version.is_active && <span className="ml-1">✓</span>}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget Grid */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Budget Grid</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="grid">
                  <Calculator className="h-4 w-4 mr-2" />
                  Grid View
                </TabsTrigger>
                <TabsTrigger value="chart">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Chart View
                </TabsTrigger>
                <TabsTrigger value="notes">
                  <FileText className="h-4 w-4 mr-2" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grid">
                {lineItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">No line items yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add line items or use AI to generate budget
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowAIAssistant(true)}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate with AI
                      </Button>
                      <Button onClick={() => setShowAddLineDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Line Item
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="min-w-[1200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Description</TableHead>
                            <TableHead className="sticky left-[200px] bg-background z-10 min-w-[100px]">Account</TableHead>
                            {MONTHS.map((month, i) => (
                              <TableHead key={month} className="text-right min-w-[100px]">{month}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold min-w-[120px]">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                                {item.line_description}
                                {item.ai_suggested && (
                                  <Sparkles className="h-3 w-3 inline ml-1 text-purple-500" />
                                )}
                              </TableCell>
                              <TableCell className="sticky left-[200px] bg-background z-10 text-muted-foreground text-sm">
                                {item.account_code || '-'}
                              </TableCell>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((period) => {
                                const periodKey = `period_${period}` as keyof typeof item;
                                const value = Number(item[periodKey]) || 0;
                                const isEditing = editingCell?.lineId === item.id && editingCell?.period === period;
                                
                                return (
                                  <TableCell 
                                    key={period} 
                                    className="text-right p-0"
                                    onDoubleClick={() => setEditingCell({ lineId: item.id, period })}
                                  >
                                    {isEditing ? (
                                      <FormattedNumberInput
                                        value={value}
                                        onChange={(newValue) => handleCellUpdate(item.id, period, newValue)}
                                        onBlur={() => setEditingCell(null)}
                                        className="h-8 text-right"
                                      />
                                    ) : (
                                      <div className="px-4 py-2 cursor-pointer hover:bg-muted/50">
                                        {formatCurrency(value)}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-bold">
                                {formatCurrency(item.annual_total || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals Row */}
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell className="sticky left-0 bg-muted/50 z-10">Total</TableCell>
                            <TableCell className="sticky left-[200px] bg-muted/50 z-10"></TableCell>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((period) => (
                              <TableCell key={period} className="text-right">
                                {formatCurrency(calculateColumnTotal(period))}
                              </TableCell>
                            ))}
                            <TableCell className="text-right text-lg">
                              {formatCurrency(grandTotal)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="chart">
                <BudgetChartView lineItems={lineItems} />
              </TabsContent>

              <TabsContent value="notes">
                <div className="prose max-w-none">
                  {budget.description ? (
                    <p>{budget.description}</p>
                  ) : (
                    <p className="text-muted-foreground">No notes added</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <AddBudgetLineItemDialog
        open={showAddLineDialog}
        onOpenChange={setShowAddLineDialog}
        budgetId={id!}
        accounts={accounts}
      />

      <CreateScenarioDialog
        open={showScenarioDialog}
        onOpenChange={setShowScenarioDialog}
        budgetId={id!}
        existingVersions={versions}
      />

      <AIBudgetAssistant
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        budget={budget}
        lineItems={lineItems}
      />
    </AppLayout>
  );
}

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Download,
  Loader2,
} from 'lucide-react';
import { useBudgets } from '@/hooks/useBudgets';
import { useBudgetVariance, useBudgetActualsSummary } from '@/hooks/useBudgetVariance';
import { useBudgetAI } from '@/hooks/useBudgetAI';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';

export default function BudgetVariance() {
  const navigate = useNavigate();
  const { budgets, isLoading: budgetsLoading } = useBudgets();
  const { formatCurrency } = useLocalizedCurrency();
  const [selectedBudget, setSelectedBudget] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ytd');
  const [aiInsights, setAiInsights] = useState<string>('');

  const selectedBudgetData = budgets.find(b => b.id === selectedBudget);
  const { data: varianceData = [], isLoading: varianceLoading } = useBudgetVariance(selectedBudget, selectedPeriod);
  const { data: summary } = useBudgetActualsSummary(selectedBudget);
  const { isLoading: aiLoading, generateVarianceInsights } = useBudgetAI();

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getVarianceClass = (variance: number) => {
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const getVarianceTypeBadge = (type: string) => {
    const configs: Record<string, { label: string; class: string }> = {
      volume: { label: 'Volume', class: 'bg-blue-100 text-blue-800' },
      price: { label: 'Price', class: 'bg-purple-100 text-purple-800' },
      efficiency: { label: 'Efficiency', class: 'bg-green-100 text-green-800' },
      capacity: { label: 'Capacity', class: 'bg-orange-100 text-orange-800' },
      fx: { label: 'FX', class: 'bg-cyan-100 text-cyan-800' },
      mixed: { label: 'Mixed', class: 'bg-gray-100 text-gray-800' },
    };
    return configs[type] || configs.mixed;
  };

  const totals = useMemo(() => {
    return varianceData.reduce((acc, item) => ({
      budgeted: acc.budgeted + item.budgeted,
      actual: acc.actual + item.actual,
      variance: acc.variance + item.variance,
    }), { budgeted: 0, actual: 0, variance: 0 });
  }, [varianceData]);

  const favorableCount = varianceData.filter(v => v.variance > 0).length;
  const unfavorableCount = varianceData.filter(v => v.variance < 0).length;

  const handleGenerateInsights = async () => {
    if (!selectedBudgetData || varianceData.length === 0) {
      toast.error('Select a budget with variance data first');
      return;
    }

    const insights = await generateVarianceInsights(selectedBudgetData, varianceData);
    setAiInsights(insights);
  };

  const handleExport = () => {
    if (varianceData.length === 0) {
      toast.error('No variance data to export');
      return;
    }

    const csvContent = [
      ['Category', 'Budgeted', 'Actual', 'Variance', 'Variance %', 'Type'].join(','),
      ...varianceData.map(row => [
        `"${row.category}"`,
        row.budgeted,
        row.actual,
        row.variance,
        row.variancePercent.toFixed(2),
        row.type
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `variance-analysis-${selectedBudgetData?.name || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Variance report exported');
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
              <h1 className="text-3xl font-bold tracking-tight">Variance Analysis</h1>
              <p className="text-muted-foreground">
                AI-powered budget vs actual comparison with root cause insights
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={varianceData.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              onClick={handleGenerateInsights}
              disabled={aiLoading || !selectedBudget}
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI Insights
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="w-64">
                <label className="text-sm font-medium mb-2 block">Budget</label>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a budget" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((budget) => (
                      <SelectItem key={budget.id} value={budget.id}>
                        {budget.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48">
                <label className="text-sm font-medium mb-2 block">Period</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ytd">Year to Date</SelectItem>
                    <SelectItem value="q1">Q1</SelectItem>
                    <SelectItem value="q2">Q2</SelectItem>
                    <SelectItem value="q3">Q3</SelectItem>
                    <SelectItem value="q4">Q4</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.totalBudgeted || totals.budgeted)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.totalActual || totals.actual)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Variance</CardTitle>
              {getVarianceIcon(summary?.variance || totals.variance)}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getVarianceClass(summary?.variance || totals.variance)}`}>
                {formatCurrency(Math.abs(summary?.variance || totals.variance))}
              </div>
              <p className="text-xs text-muted-foreground">
                {((summary?.variancePercent || (totals.budgeted > 0 ? (totals.variance / totals.budgeted) * 100 : 0))).toFixed(1)}% of budget
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variance Summary</CardTitle>
              <Sparkles className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{favorableCount} favorable</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">{unfavorableCount} unfavorable</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Variance Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Detailed Variance Analysis</CardTitle>
                <CardDescription>
                  {selectedBudget ? 'Budget vs actual by line item' : 'Select a budget to view variance'}
                </CardDescription>
              </div>
              {varianceData.some(v => v.aiInsight) && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Insights Available
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {varianceLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !selectedBudget ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Budget Selected</h3>
                <p className="text-muted-foreground">
                  Select a budget above to view variance analysis
                </p>
              </div>
            ) : varianceData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">No Variance Data</h3>
                <p className="text-muted-foreground">
                  This budget has no line items or actuals recorded yet
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Budgeted</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>AI Insight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {varianceData.map((row) => {
                    const typeConfig = getVarianceTypeBadge(row.type);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.budgeted)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.actual)}</TableCell>
                        <TableCell className={`text-right font-medium ${getVarianceClass(row.variance)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {getVarianceIcon(row.variance)}
                            {formatCurrency(Math.abs(row.variance))}
                          </div>
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceClass(row.variancePercent)}`}>
                          {row.variancePercent > 0 ? '+' : ''}{row.variancePercent.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <Badge className={typeConfig.class}>
                            {typeConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {row.aiInsight ? (
                            <div className="flex items-start gap-2">
                              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{row.aiInsight}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.budgeted)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.actual)}</TableCell>
                    <TableCell className={`text-right ${getVarianceClass(totals.variance)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getVarianceIcon(totals.variance)}
                        {formatCurrency(Math.abs(totals.variance))}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right ${getVarianceClass(totals.variance)}`}>
                      {totals.budgeted > 0 ? ((totals.variance / totals.budgeted) * 100).toFixed(1) : 0}%
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* AI Insights Panel */}
        {aiInsights && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <CardTitle>AI Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {aiInsights}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

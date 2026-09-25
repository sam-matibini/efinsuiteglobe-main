import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Brain,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Play,
  Download,
  Settings,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { useBudgets, useBudgetDetails } from '@/hooks/useBudgets';
import { useBudgetAI } from '@/hooks/useBudgetAI';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';

export default function AIForecast() {
  const navigate = useNavigate();
  const { budgets, isLoading: budgetsLoading } = useBudgets();
  const { formatCurrency } = useLocalizedCurrency();
  
  const [selectedBudget, setSelectedBudget] = useState<string>('');
  const [forecastHorizon, setForecastHorizon] = useState([12]);
  const [confidenceLevel, setConfidenceLevel] = useState([95]);
  
  const selectedBudgetData = budgets.find(b => b.id === selectedBudget);
  const { lineItems } = useBudgetDetails(selectedBudget || undefined);
  const { isLoading, forecastResult, generateForecast, clearForecast } = useBudgetAI();

  const handleGenerateForecast = async () => {
    if (!selectedBudgetData) {
      toast.error('Please select a budget first');
      return;
    }

    await generateForecast(
      selectedBudgetData,
      lineItems,
      forecastHorizon[0],
      confidenceLevel[0]
    );
  };

  const handleApplyToBudget = () => {
    if (!forecastResult || !selectedBudgetData) return;
    toast.success('Forecast recommendations noted for budget planning');
    // In a full implementation, this would create new budget line items
  };

  const handleExportForecast = () => {
    if (!forecastResult) return;

    const data = {
      budget: selectedBudgetData?.name,
      generatedAt: new Date().toISOString(),
      horizon: `${forecastHorizon[0]} months`,
      confidence: `${confidenceLevel[0]}%`,
      forecast: forecastResult,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-${selectedBudgetData?.name || 'report'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Forecast exported');
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
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">AI Forecasting</h1>
                <Badge className="bg-purple-100 text-purple-800">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Powered by AI
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Predictive budget intelligence with machine learning
              </p>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Forecast Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select Budget</label>
                <Select value={selectedBudget} onValueChange={(v) => {
                  setSelectedBudget(v);
                  clearForecast();
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a budget" />
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
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Forecast Horizon: {forecastHorizon[0]} months
                </label>
                <Slider
                  value={forecastHorizon}
                  onValueChange={setForecastHorizon}
                  min={3}
                  max={24}
                  step={1}
                  className="mt-4"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Confidence Level: {confidenceLevel[0]}%
                </label>
                <Slider
                  value={confidenceLevel}
                  onValueChange={setConfidenceLevel}
                  min={80}
                  max={99}
                  step={1}
                  className="mt-4"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleGenerateForecast}
                  disabled={isLoading || !selectedBudget}
                  className="w-full gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Generate Forecast
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isLoading && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Analyzing historical data and generating predictions...</span>
                </div>
                <Progress value={67} className="animate-pulse" />
              </div>
            )}
          </CardContent>
        </Card>

        {forecastResult && (
          <>
            {/* Forecast Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue Forecast</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(forecastResult.revenue.base)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-xs text-green-600">
                      ▲ {formatCurrency(forecastResult.revenue.optimistic)} optimistic
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-red-600">
                      ▼ {formatCurrency(forecastResult.revenue.pessimistic)} pessimistic
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {forecastResult.revenue.confidence}% confidence
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cost Forecast</CardTitle>
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(forecastResult.costs.base)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-xs text-green-600">
                      ▼ {formatCurrency(forecastResult.costs.optimistic)} optimistic
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-red-600">
                      ▲ {formatCurrency(forecastResult.costs.pessimistic)} pessimistic
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {forecastResult.costs.confidence}% confidence
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Income Forecast</CardTitle>
                  <Target className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(forecastResult.netIncome.base)}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="text-xs text-green-600">
                      ▲ {formatCurrency(forecastResult.netIncome.optimistic)} optimistic
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-xs text-red-600">
                      ▼ {formatCurrency(forecastResult.netIncome.pessimistic)} pessimistic
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {forecastResult.netIncome.confidence}% confidence
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Drivers */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <CardTitle>Key Cost Drivers</CardTitle>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Discovered
                  </Badge>
                </div>
                <CardDescription>
                  Factors with the highest impact on your budget forecast
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {forecastResult.keyDrivers.map((driver, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-32 font-medium">{driver.name}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Progress value={driver.impact} className="flex-1" />
                          <span className="w-12 text-sm text-muted-foreground">
                            {driver.impact}%
                          </span>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className={
                          driver.trend === 'up' ? 'text-red-600' :
                          driver.trend === 'down' ? 'text-green-600' :
                          'text-muted-foreground'
                        }
                      >
                        {driver.trend === 'up' ? '↑ Rising' : driver.trend === 'down' ? '↓ Falling' : '→ Stable'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  <CardTitle>AI Recommendations</CardTitle>
                </div>
                <CardDescription>
                  Actionable insights to optimize your budget performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {forecastResult.recommendations.map((rec, index) => (
                    <Card key={index} className="border-l-4 border-l-primary">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{rec.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {rec.description}
                        </p>
                        <Badge className="bg-green-100 text-green-800">
                          <Zap className="h-3 w-3 mr-1" />
                          {rec.impact}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Export Forecast</h3>
                    <p className="text-sm text-muted-foreground">
                      Download forecast data and recommendations
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportForecast}>
                      <Download className="h-4 w-4 mr-2" />
                      Export JSON
                    </Button>
                    <Button onClick={handleApplyToBudget}>
                      Apply to Budget
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!forecastResult && !isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-16 w-16 text-purple-300 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ready to Forecast</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Select a budget and configure your forecast parameters, then click 
                "Generate Forecast" to get AI-powered predictions and recommendations.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/budgets')}>
                  View Budgets
                </Button>
                {selectedBudget && (
                  <Button onClick={handleGenerateForecast}>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Forecast
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

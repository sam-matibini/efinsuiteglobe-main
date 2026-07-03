import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BudgetLineItem } from '@/types/budget';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';

interface BudgetChartViewProps {
  lineItems: BudgetLineItem[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--accent))',
  'hsl(var(--muted-foreground))',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BudgetChartView({ lineItems }: BudgetChartViewProps) {
  const { formatCurrency } = useLocalizedCurrency();

  // Prepare monthly data for bar/line charts
  const monthlyData = useMemo(() => {
    return MONTHS.map((month, index) => {
      const periodKey = `period_${index + 1}` as keyof BudgetLineItem;
      const total = lineItems.reduce((sum, item) => sum + (Number(item[periodKey]) || 0), 0);
      return {
        month,
        total,
      };
    });
  }, [lineItems]);

  // Prepare pie chart data by line item
  const pieData = useMemo(() => {
    return lineItems
      .filter(item => (item.annual_total || 0) > 0)
      .map((item, index) => ({
        name: item.line_description,
        value: item.annual_total || 0,
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 items
  }, [lineItems]);

  // Cumulative monthly data for line chart
  const cumulativeData = useMemo(() => {
    let cumulative = 0;
    return MONTHS.map((month, index) => {
      const periodKey = `period_${index + 1}` as keyof BudgetLineItem;
      const total = lineItems.reduce((sum, item) => sum + (Number(item[periodKey]) || 0), 0);
      cumulative += total;
      return {
        month,
        monthly: total,
        cumulative,
      };
    });
  }, [lineItems]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (lineItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Add line items to see budget visualizations</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue="monthly" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="monthly">Monthly Trend</TabsTrigger>
        <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
        <TabsTrigger value="breakdown">Category Breakdown</TabsTrigger>
      </TabsList>

      <TabsContent value="monthly">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Budget Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="total" 
                    name="Budget" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cumulative">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cumulative Budget Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis 
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="monthly" 
                    name="Monthly" 
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative" 
                    name="Cumulative" 
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="breakdown">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm flex-1 truncate">{item.name}</span>
                    <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

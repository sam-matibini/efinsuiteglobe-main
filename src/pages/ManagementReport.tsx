import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  DollarSign, 
  Percent,
  BarChart3,
  PieChart,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { useReportFilters } from '@/hooks/useReportFilters';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart as RechartsPie,
  Pie,
  Legend
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

interface FinancialRatio {
  name: string;
  value: number;
  unit: '%' | 'x' | 'days' | '$';
  category: 'liquidity' | 'efficiency' | 'profitability' | 'leverage';
  description: string;
  benchmark?: { low: number; high: number };
  trend?: 'up' | 'down' | 'neutral';
}

export default function ManagementReport() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { 
    startDate, 
    endDate, 
    showZeroBalances, 
    fiscalYearEndMonth,
    setDateRange, 
    setShowZeroBalances,
    setFiscalYearEndMonth
  } = useReportFilters();
  
  // Sync fiscal year end month from organization
  useEffect(() => {
    if (organization?.fiscal_year_end_month) {
      setFiscalYearEndMonth(organization.fiscal_year_end_month);
    }
  }, [organization?.fiscal_year_end_month, setFiscalYearEndMonth]);
  
  const { isLoading, getBalanceSheetData, getIncomeStatementData, getCashFlowData } = useFinancialReports({
    startDate,
    endDate,
    period: 'custom'
  });

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange(start, end);
  };

  // Get data - hooks must be called unconditionally
  // These return objects with default empty arrays when data isn't loaded yet
  const balanceSheet = getBalanceSheetData();
  const incomeStatement = getIncomeStatementData();
  const cashFlow = getCashFlowData();

  // Calculate financial metrics from real data
  // GAAP: Use actual calculated_balance values (not Math.abs) since balances are already normalized
  const metrics = useMemo(() => {
    // Early return with zeros if still loading or no data
    if (isLoading || orgLoading || !balanceSheet?.assets?.length) {
      return {
        currentAssets: 0, currentLiabilities: 0, inventory: 0, cash: 0,
        receivables: 0, payables: 0, totalDebt: 0, totalAssets: 0,
        totalLiabilities: 0, totalEquity: 0, revenue: 0, cogs: 0,
        grossProfit: 0, operatingIncome: 0, netIncome: 0
      };
    }

    // Helper to check if account code starts with prefix
    const codeStartsWith = (code: string, prefixes: string[]) =>
      prefixes.some(p => code.startsWith(p));

    // Current Assets: Cash (10xx), AR (11xx), Prepaid (12xx), Inventory (13xx)
    // Use code-based classification for accuracy
    const currentAssets = balanceSheet.assets.filter(a =>
      codeStartsWith(a.code, ['10', '11', '12', '13', '14']) ||
      a.name.toLowerCase().includes('cash') ||
      a.name.toLowerCase().includes('bank') ||
      a.name.toLowerCase().includes('receivable') ||
      a.name.toLowerCase().includes('inventory') ||
      a.name.toLowerCase().includes('prepaid')
    ).reduce((sum, a) => {
      // For assets: debit-normal add, credit-normal (contra) subtract
      const sign = a.normal_balance === 'debit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Current Liabilities: AP (20xx), Accrued (21xx), Tax (22xx), Payroll (23xx)
    const currentLiabilities = balanceSheet.liabilities.filter(a =>
      codeStartsWith(a.code, ['20', '21', '22', '23', '24']) ||
      a.name.toLowerCase().includes('payable') ||
      a.name.toLowerCase().includes('accrued')
    ).reduce((sum, a) => {
      // For liabilities: credit-normal add, debit-normal (contra) subtract
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Inventory (13xx)
    const inventory = balanceSheet.assets.filter(a =>
      codeStartsWith(a.code, ['13']) ||
      a.name.toLowerCase().includes('inventory')
    ).reduce((sum, a) => {
      const sign = a.normal_balance === 'debit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Cash and Bank (10xx)
    const cash = balanceSheet.assets.filter(a =>
      codeStartsWith(a.code, ['10']) ||
      a.name.toLowerCase().includes('cash') ||
      a.name.toLowerCase().includes('bank') ||
      a.name.toLowerCase().includes('chequing') ||
      a.name.toLowerCase().includes('checking') ||
      a.name.toLowerCase().includes('savings')
    ).reduce((sum, a) => {
      const sign = a.normal_balance === 'debit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Receivables (11xx)
    const receivables = balanceSheet.assets.filter(a =>
      codeStartsWith(a.code, ['11']) ||
      a.name.toLowerCase().includes('receivable')
    ).reduce((sum, a) => {
      const sign = a.normal_balance === 'debit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Payables (20xx excluding credit cards)
    const payables = balanceSheet.liabilities.filter(a =>
      (codeStartsWith(a.code, ['20']) && !a.name.toLowerCase().includes('credit card')) ||
      a.name.toLowerCase().includes('accounts payable')
    ).reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Total Debt (Long-term liabilities 25xx, 26xx, 27xx)
    const totalDebt = balanceSheet.liabilities.filter(a =>
      codeStartsWith(a.code, ['25', '26', '27']) ||
      a.name.toLowerCase().includes('loan') ||
      a.name.toLowerCase().includes('mortgage') ||
      a.name.toLowerCase().includes('note payable')
    ).reduce((sum, a) => {
      const sign = a.normal_balance === 'credit' ? 1 : -1;
      return sum + a.calculated_balance * sign;
    }, 0);

    // Use pre-calculated totals from balance sheet (already GAAP-compliant)
    const totalAssets = balanceSheet?.totalAssets ?? 0;
    const totalLiabilities = balanceSheet?.totalLiabilities ?? 0;
    const totalEquity = (balanceSheet?.totalEquity ?? 0) + (balanceSheet?.netIncome ?? 0); // Include current year earnings
    const revenue = incomeStatement?.totalRevenue ?? 0;
    const cogs = incomeStatement?.totalCOGS ?? 0;
    const grossProfit = incomeStatement?.grossProfit ?? 0;
    const operatingIncome = incomeStatement?.operatingIncome ?? 0;
    const netIncome = incomeStatement?.netIncome ?? 0;

    return {
      currentAssets: Math.max(0, currentAssets),
      currentLiabilities: Math.max(0, currentLiabilities),
      inventory: Math.max(0, inventory),
      cash: Math.max(0, cash),
      receivables: Math.max(0, receivables),
      payables: Math.max(0, payables),
      totalDebt: Math.max(0, totalDebt),
      totalAssets,
      totalLiabilities,
      totalEquity,
      revenue,
      cogs,
      grossProfit,
      operatingIncome,
      netIncome
    };
  }, [balanceSheet, incomeStatement, isLoading, orgLoading]);

  // Calculate ratios
  const ratios: FinancialRatio[] = useMemo(() => {
    const { currentAssets, currentLiabilities, inventory, cash, receivables, payables, totalDebt, totalAssets, totalLiabilities, totalEquity, revenue, cogs, grossProfit, operatingIncome, netIncome } = metrics;

    // Prevent division by zero
    const safeDiv = (num: number, den: number) => den === 0 ? 0 : num / den;

    return [
      // Liquidity Ratios
      {
        name: 'Current Ratio',
        value: safeDiv(currentAssets, currentLiabilities),
        unit: 'x',
        category: 'liquidity',
        description: 'Measures ability to pay short-term obligations. Higher is better.',
        benchmark: { low: 1.5, high: 3.0 },
        trend: 'up'
      },
      {
        name: 'Quick Ratio (Acid Test)',
        value: safeDiv(currentAssets - inventory, currentLiabilities),
        unit: 'x',
        category: 'liquidity',
        description: 'Liquidity excluding inventory. Tests ability to meet immediate obligations.',
        benchmark: { low: 1.0, high: 2.0 },
        trend: 'up'
      },
      {
        name: 'Cash Ratio',
        value: safeDiv(cash, currentLiabilities),
        unit: 'x',
        category: 'liquidity',
        description: 'Most conservative liquidity measure using only cash.',
        benchmark: { low: 0.2, high: 0.5 },
        trend: 'neutral'
      },
      {
        name: 'Working Capital',
        value: currentAssets - currentLiabilities,
        unit: '$',
        category: 'liquidity',
        description: 'Operating liquidity available for day-to-day operations.',
        trend: 'up'
      },

      // Efficiency Ratios
      {
        name: 'Receivables Turnover',
        value: safeDiv(revenue, receivables),
        unit: 'x',
        category: 'efficiency',
        description: 'How efficiently receivables are collected. Higher is better.',
        benchmark: { low: 8, high: 15 },
        trend: 'up'
      },
      {
        name: 'Days Sales Outstanding',
        value: safeDiv(365, safeDiv(revenue, receivables)),
        unit: 'days',
        category: 'efficiency',
        description: 'Average days to collect payment. Lower is better.',
        benchmark: { low: 25, high: 45 },
        trend: 'down'
      },
      {
        name: 'Inventory Turnover',
        value: safeDiv(cogs, inventory),
        unit: 'x',
        category: 'efficiency',
        description: 'How quickly inventory is sold. Higher indicates efficiency.',
        benchmark: { low: 4, high: 12 },
        trend: 'up'
      },
      {
        name: 'Days Inventory Outstanding',
        value: safeDiv(365, safeDiv(cogs, inventory)),
        unit: 'days',
        category: 'efficiency',
        description: 'Average days to sell inventory. Lower is better.',
        benchmark: { low: 30, high: 90 },
        trend: 'down'
      },
      {
        name: 'Payables Turnover',
        value: safeDiv(cogs, payables),
        unit: 'x',
        category: 'efficiency',
        description: 'How quickly vendor invoices are paid.',
        benchmark: { low: 6, high: 12 },
        trend: 'neutral'
      },
      {
        name: 'Asset Turnover',
        value: safeDiv(revenue, totalAssets),
        unit: 'x',
        category: 'efficiency',
        description: 'How efficiently assets generate revenue.',
        benchmark: { low: 0.5, high: 2.0 },
        trend: 'up'
      },

      // Profitability Ratios
      {
        name: 'Gross Profit Margin',
        value: safeDiv(grossProfit, revenue) * 100,
        unit: '%',
        category: 'profitability',
        description: 'Percentage of revenue retained after COGS.',
        benchmark: { low: 25, high: 50 },
        trend: 'up'
      },
      {
        name: 'Operating Margin',
        value: safeDiv(operatingIncome, revenue) * 100,
        unit: '%',
        category: 'profitability',
        description: 'Profit from core operations as % of revenue.',
        benchmark: { low: 10, high: 25 },
        trend: 'up'
      },
      {
        name: 'Net Profit Margin',
        value: safeDiv(netIncome, revenue) * 100,
        unit: '%',
        category: 'profitability',
        description: 'Final profit percentage after all expenses.',
        benchmark: { low: 5, high: 20 },
        trend: 'up'
      },
      {
        name: 'Return on Assets (ROA)',
        value: safeDiv(netIncome, totalAssets) * 100,
        unit: '%',
        category: 'profitability',
        description: 'How effectively assets generate profit.',
        benchmark: { low: 5, high: 15 },
        trend: 'up'
      },
      {
        name: 'Return on Equity (ROE)',
        value: safeDiv(netIncome, totalEquity) * 100,
        unit: '%',
        category: 'profitability',
        description: "Profit generated per dollar of shareholders' equity.",
        benchmark: { low: 10, high: 25 },
        trend: 'up'
      },

      // Leverage Ratios
      {
        name: 'Debt-to-Equity',
        value: safeDiv(totalLiabilities, totalEquity),
        unit: 'x',
        category: 'leverage',
        description: 'Financial leverage measure. Lower generally means less risk.',
        benchmark: { low: 0.5, high: 2.0 },
        trend: 'down'
      },
      {
        name: 'Debt-to-Assets',
        value: safeDiv(totalLiabilities, totalAssets) * 100,
        unit: '%',
        category: 'leverage',
        description: 'Percentage of assets financed by debt.',
        benchmark: { low: 30, high: 60 },
        trend: 'down'
      },
      {
        name: 'Equity Ratio',
        value: safeDiv(totalEquity, totalAssets) * 100,
        unit: '%',
        category: 'leverage',
        description: 'Percentage of assets financed by equity.',
        benchmark: { low: 40, high: 70 },
        trend: 'up'
      }
    ];
  }, [metrics]);

  // Show loading skeleton if data is loading - AFTER all hooks
  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const formatValue = (ratio: FinancialRatio) => {
    // Handle NaN, Infinity, and undefined values
    const value = Number.isFinite(ratio.value) ? ratio.value : 0;
    
    if (ratio.unit === '$') {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value);
    }
    if (ratio.unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    if (ratio.unit === 'days') {
      return `${Math.round(value)} days`;
    }
    return `${value.toFixed(2)}x`;
  };

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: (organization as any)?.base_currency || 'CAD',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(v) ? v : 0);

  const getRatioStatus = (ratio: FinancialRatio): 'good' | 'warning' | 'poor' => {
    // Handle edge cases: NaN, Infinity, or missing values
    if (!Number.isFinite(ratio.value)) return 'warning';
    if (!ratio.benchmark) return 'good';
    
    const { low, high } = ratio.benchmark;
    
    if (ratio.trend === 'down') {
      // Lower is better
      if (ratio.value <= low) return 'good';
      if (ratio.value <= high) return 'warning';
      return 'poor';
    } else {
      // Higher is better
      if (ratio.value >= high) return 'good';
      if (ratio.value >= low) return 'warning';
      return 'poor';
    }
  };

  const getStatusColor = (status: 'good' | 'warning' | 'poor') => {
    switch (status) {
      case 'good': return 'text-emerald-500';
      case 'warning': return 'text-warning';
      case 'poor': return 'text-destructive';
    }
  };

  const getStatusBg = (status: 'good' | 'warning' | 'poor') => {
    switch (status) {
      case 'good': return 'bg-emerald-500/10';
      case 'warning': return 'bg-warning/10';
      case 'poor': return 'bg-destructive/10';
    }
  };

  // Export functions with proper number formatting
  const handleExportExcel = () => {
    const data = ratios.map(r => ({
      'Category': r.category.charAt(0).toUpperCase() + r.category.slice(1),
      'Ratio': r.name,
      'Value': r.value, // Use raw number, not formatted string
      'Unit': r.unit,
      'Status': getRatioStatus(r),
      'Description': r.description
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Apply number format to Value column (column C)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      const cellAddress = `C${R + 1}`;
      const cell = ws[cellAddress];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    }
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Category
      { wch: 25 }, // Ratio
      { wch: 12 }, // Value
      { wch: 8 },  // Unit
      { wch: 10 }, // Status
      { wch: 40 }, // Description
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financial Ratios');
    XLSX.writeFile(wb, `Management_Report_${organization?.name || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`, {
      cellStyles: true,
    });
    toast.success('Report exported to Excel');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('MANAGEMENT FINANCIAL REPORT', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(organization?.name || 'Organization', pageWidth / 2, 30, { align: 'center' });
    doc.text(`As of ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, 38, { align: 'center' });

    let yPos = 55;
    const categories = ['liquidity', 'efficiency', 'profitability', 'leverage'] as const;

    categories.forEach(category => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(category.charAt(0).toUpperCase() + category.slice(1) + ' Ratios', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      ratios.filter(r => r.category === category).forEach(ratio => {
        doc.text(ratio.name, 25, yPos);
        doc.text(formatValue(ratio), pageWidth - 40, yPos, { align: 'right' });
        yPos += 7;
      });

      yPos += 10;
    });

    doc.save(`Management_Report_${organization?.name || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Report exported to PDF');
  };

  const handlePrint = () => {
    window.print();
    toast.success('Printing report...');
  };

  // Chart data
  const profitabilityChartData = ratios
    .filter(r => r.category === 'profitability' && r.unit === '%')
    .map(r => ({
      name: r.name.replace(' Margin', '').replace('Return on ', ''),
      value: r.value
    }));

  const liquidityChartData = ratios
    .filter(r => r.category === 'liquidity' && r.unit === 'x')
    .map(r => ({
      name: r.name.replace(' Ratio', ''),
      value: r.value,
      benchmark: r.benchmark?.low || 1
    }));


  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-accent/10 rounded-xl">
            <Activity className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Management Financial Report</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Key financial ratios and performance metrics
            </p>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
              <FileText className="w-4 h-4" />
              Export to PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" />
              Print Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters */}
      <div className="print:hidden">
        <ReportFilters
          onDateRangeChange={handleDateRangeChange}
          showExpandCollapse={false}
          showZeroBalances={showZeroBalances}
          onShowZeroBalancesChange={setShowZeroBalances}
          initialStartDate={startDate}
          initialEndDate={endDate}
          fiscalYearEndMonth={fiscalYearEndMonth}
        />
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Management Financial Report</h1>
        <p className="text-lg">{organization?.name}</p>
        <p className="text-sm text-muted-foreground">
          {format(startDate, 'MMMM d, yyyy')} - {format(endDate, 'MMMM d, yyyy')}
        </p>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(() => {
          const currentRatio = ratios.find(r => r.name === 'Current Ratio');
          const currentRatioStatus = currentRatio ? getRatioStatus(currentRatio) : 'warning';
          return (
            <Card className="bg-gradient-to-br from-card to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Ratio</p>
                    <p className="text-2xl font-bold">{currentRatio?.value?.toFixed(2) ?? '0.00'}x</p>
                  </div>
                  <div className={`p-2 rounded-lg ${getStatusBg(currentRatioStatus)}`}>
                    <TrendingUp className={`w-5 h-5 ${getStatusColor(currentRatioStatus)}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {(() => {
          const netMarginRatio = ratios.find(r => r.name === 'Net Profit Margin');
          const netMarginStatus = netMarginRatio ? getRatioStatus(netMarginRatio) : 'warning';
          return (
            <Card className="bg-gradient-to-br from-card to-blue-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Net Margin</p>
                    <p className="text-2xl font-bold">{netMarginRatio?.value?.toFixed(1) ?? '0.0'}%</p>
                  </div>
                  <div className={`p-2 rounded-lg ${getStatusBg(netMarginStatus)}`}>
                    <Percent className={`w-5 h-5 ${getStatusColor(netMarginStatus)}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {(() => {
          const roeRatio = ratios.find(r => r.name === 'Return on Equity (ROE)');
          const roeStatus = roeRatio ? getRatioStatus(roeRatio) : 'warning';
          return (
            <Card className="bg-gradient-to-br from-card to-purple-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">ROE</p>
                    <p className="text-2xl font-bold">{roeRatio?.value?.toFixed(1) ?? '0.0'}%</p>
                  </div>
                  <div className={`p-2 rounded-lg ${getStatusBg(roeStatus)}`}>
                    <DollarSign className={`w-5 h-5 ${getStatusColor(roeStatus)}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {(() => {
          const debtEquityRatio = ratios.find(r => r.name === 'Debt-to-Equity');
          const debtEquityStatus = debtEquityRatio ? getRatioStatus(debtEquityRatio) : 'warning';
          return (
            <Card className="bg-gradient-to-br from-card to-orange-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Debt-to-Equity</p>
                    <p className="text-2xl font-bold">{debtEquityRatio?.value?.toFixed(2) ?? '0.00'}x</p>
                  </div>
                  <div className={`p-2 rounded-lg ${getStatusBg(debtEquityStatus)}`}>
                    <BarChart3 className={`w-5 h-5 ${getStatusColor(debtEquityStatus)}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Tabs for Ratio Categories */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="all">All Ratios</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="leverage">Leverage</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(['liquidity', 'efficiency', 'profitability', 'leverage'] as const).map(category => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {category === 'liquidity' && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                    {category === 'efficiency' && <Activity className="w-5 h-5 text-blue-500" />}
                    {category === 'profitability' && <Percent className="w-5 h-5 text-purple-500" />}
                    {category === 'leverage' && <BarChart3 className="w-5 h-5 text-orange-500" />}
                    {category} Ratios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ratios.filter(r => r.category === category).map(ratio => {
                      const status = getRatioStatus(ratio);
                      return (
                        <div key={ratio.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{ratio.name}</span>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>{ratio.description}</p>
                                {ratio.benchmark && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Benchmark: {ratio.benchmark.low} - {ratio.benchmark.high}{ratio.unit}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${getStatusColor(status)}`}>
                              {formatValue(ratio)}
                            </span>
                            {ratio.trend === 'up' && <ArrowUpRight className={`w-4 h-4 ${getStatusColor(status)}`} />}
                            {ratio.trend === 'down' && <ArrowDownRight className={`w-4 h-4 ${getStatusColor(status)}`} />}
                            {ratio.trend === 'neutral' && <Minus className={`w-4 h-4 ${getStatusColor(status)}`} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {(['liquidity', 'efficiency', 'profitability', 'leverage'] as const).map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="capitalize">{category} Ratios</CardTitle>
                <CardDescription>
                  {category === 'liquidity' && 'Measures the ability to meet short-term obligations'}
                  {category === 'efficiency' && 'Measures how effectively assets are utilized'}
                  {category === 'profitability' && 'Measures ability to generate profit from operations'}
                  {category === 'leverage' && 'Measures the degree of debt financing'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ratios.filter(r => r.category === category).map(ratio => {
                    const status = getRatioStatus(ratio);
                    return (
                      <div key={ratio.name} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{ratio.name}</span>
                          <Badge variant={status === 'good' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}>
                            {status}
                          </Badge>
                        </div>
                        <div className={`text-3xl font-bold ${getStatusColor(status)}`}>
                          {formatValue(ratio)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{ratio.description}</p>
                        {ratio.benchmark && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Low: {ratio.benchmark.low}{ratio.unit}</span>
                              <span>High: {ratio.benchmark.high}{ratio.unit}</span>
                            </div>
                            <Progress 
                              value={Math.min(100, (ratio.value / ratio.benchmark.high) * 100)} 
                              className="h-2"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profitability Margins</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitabilityChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={4}>
                    {profitabilityChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.value >= 10 ? 'hsl(var(--chart-2))' : entry.value >= 5 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Liquidity Position</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liquidityChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} name="Actual">
                    {liquidityChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.value >= entry.benchmark ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-4))'} 
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="benchmark" fill="hsl(var(--muted))" radius={4} name="Benchmark" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  TrendingUp, 
  PieChart, 
  Users, 
  Building2, 
  DollarSign,
  Calculator,
  Receipt,
  Clock,
  Star,
  Search,
  Package,
  Landmark,
  CreditCard,
  FileSpreadsheet,
  BarChart3,
  ArrowRightLeft,
  Wallet,
  BadgePercent,
  UserCheck,
  ClipboardList,
  Boxes,
  TrendingDown,
  ArrowUpDown,
  Shield,
  CalendarDays,
  Banknote,
  BookOpen,
  FileCheck,
  Scale,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReportItem {
  id: string;
  name: string;
  description: string;
  category: string;
  module: string;
  icon: React.ReactNode;
  href?: string;
  isFavorite?: boolean;
  isNew?: boolean;
  isPremium?: boolean;
}

const reports: ReportItem[] = [
  // Financial Statements
  { id: 'balance-sheet', name: 'Balance Sheet', description: 'Statement of financial position showing assets, liabilities & equity', category: 'Financial Statements', module: 'Accounting', icon: <Scale className="w-5 h-5" />, href: '/reports/balance-sheet', isFavorite: true },
  { id: 'income-statement', name: 'Income Statement', description: 'Profit & loss showing revenue, expenses & net income', category: 'Financial Statements', module: 'Accounting', icon: <TrendingUp className="w-5 h-5" />, href: '/reports/income-statement', isFavorite: true },
  { id: 'cash-flow', name: 'Cash Flow Statement', description: 'Operating, investing & financing cash activities', category: 'Financial Statements', module: 'Accounting', icon: <DollarSign className="w-5 h-5" />, href: '/reports/cash-flow' },
  { id: 'changes-equity', name: 'Changes in Equity', description: 'Movement in retained earnings & capital', category: 'Financial Statements', module: 'Accounting', icon: <ArrowUpDown className="w-5 h-5" />, href: '/reports/changes-in-equity' },
  { id: 'trial-balance', name: 'Trial Balance', description: 'All account balances with debit/credit verification', category: 'Financial Statements', module: 'Accounting', icon: <Calculator className="w-5 h-5" />, href: '/trial-balance', isFavorite: true },
  
  // Accounting Reports
  { id: 'general-ledger', name: 'General Ledger', description: 'Complete transaction history by account', category: 'Accounting', module: 'Accounting', icon: <BookOpen className="w-5 h-5" />, href: '/ledger' },
  { id: 'journal-entries', name: 'Journal Entries', description: 'All journal entries with status & amounts', category: 'Accounting', module: 'Accounting', icon: <FileText className="w-5 h-5" />, href: '/journal-entries' },
  { id: 'chart-of-accounts', name: 'Chart of Accounts', description: 'Complete account structure & hierarchy', category: 'Accounting', module: 'Accounting', icon: <FileSpreadsheet className="w-5 h-5" />, href: '/accounts' },
  { id: 'account-transactions', name: 'Account Transactions', description: 'Detailed transactions for specific accounts', category: 'Accounting', module: 'Accounting', icon: <ArrowRightLeft className="w-5 h-5" />, href: '/ledger' },
  { id: 'budget-vs-actual', name: 'Budget vs Actual', description: 'Compare budgeted vs actual amounts', category: 'Accounting', module: 'Accounting', icon: <BarChart3 className="w-5 h-5" />, isPremium: true },
  
  // Sales Reports (A/R)
  { id: 'sales-summary', name: 'Sales Summary', description: 'Revenue breakdown by customer & period', category: 'Sales', module: 'Sales', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'ar-aging', name: 'A/R Aging Report', description: 'Receivables by 30/60/90+ days buckets', category: 'Sales', module: 'Sales', icon: <Clock className="w-5 h-5" />, href: '/reports/aging', isFavorite: true },
  { id: 'ar-aging-detail', name: 'A/R Aging Detail', description: 'Detailed aging by customer with invoice breakdown', category: 'Sales', module: 'Sales', icon: <ClipboardList className="w-5 h-5" />, href: '/reports/aging' },
  { id: 'customer-balances', name: 'Customer Balances', description: 'Outstanding balances by customer', category: 'Sales', module: 'Sales', icon: <Users className="w-5 h-5" />, href: '/sales/customers' },
  { id: 'invoice-list', name: 'Invoice List', description: 'All invoices with status, amounts & due dates', category: 'Sales', module: 'Sales', icon: <Receipt className="w-5 h-5" />, href: '/sales/invoices' },
  { id: 'quotes-list', name: 'Quotes & Estimates', description: 'All quotes with status & conversion tracking', category: 'Sales', module: 'Sales', icon: <FileText className="w-5 h-5" />, href: '/sales/quotes' },
  { id: 'customer-statement', name: 'Customer Statement', description: 'Individual customer account statements', category: 'Sales', module: 'Sales', icon: <FileCheck className="w-5 h-5" /> },
  { id: 'sales-by-customer', name: 'Sales by Customer', description: 'Revenue analysis by customer', category: 'Sales', module: 'Sales', icon: <PieChart className="w-5 h-5" />, href: '/sales/customers' },
  { id: 'sales-by-item', name: 'Sales by Item', description: 'Revenue breakdown by product/service', category: 'Sales', module: 'Sales', icon: <Package className="w-5 h-5" />, href: '/sales/products' },
  { id: 'payment-received', name: 'Payments Received', description: 'Customer payment history & methods', category: 'Sales', module: 'Sales', icon: <CreditCard className="w-5 h-5" />, href: '/sales/payments' },
  { id: 'recurring-invoices', name: 'Recurring Invoices', description: 'Scheduled recurring invoice list', category: 'Sales', module: 'Sales', icon: <Clock className="w-5 h-5" />, href: '/sales/recurring' },
  { id: 'credit-notes', name: 'Credit Notes', description: 'Customer credit notes & refunds', category: 'Sales', module: 'Sales', icon: <FileSpreadsheet className="w-5 h-5" />, href: '/sales/credit-notes' },
  
  // Purchase Reports (A/P)
  { id: 'purchase-summary', name: 'Purchase Summary', description: 'Expenses by vendor & category', category: 'Purchases', module: 'Purchases', icon: <Package className="w-5 h-5" />, href: '/purchases/bills' },
  { id: 'ap-aging', name: 'A/P Aging Report', description: 'Payables by 30/60/90+ days buckets', category: 'Purchases', module: 'Purchases', icon: <Clock className="w-5 h-5" />, href: '/reports/aging' },
  { id: 'ap-aging-detail', name: 'A/P Aging Detail', description: 'Detailed aging by vendor with bill breakdown', category: 'Purchases', module: 'Purchases', icon: <ClipboardList className="w-5 h-5" />, href: '/reports/aging' },
  { id: 'vendor-balances', name: 'Vendor Balances', description: 'Outstanding amounts by vendor', category: 'Purchases', module: 'Purchases', icon: <Building2 className="w-5 h-5" />, href: '/purchases/vendors' },
  { id: 'bill-list', name: 'Bill List', description: 'All bills with status & payment info', category: 'Purchases', module: 'Purchases', icon: <Receipt className="w-5 h-5" />, href: '/purchases/bills' },
  { id: 'purchase-orders', name: 'Purchase Orders', description: 'All purchase orders with status', category: 'Purchases', module: 'Purchases', icon: <ClipboardList className="w-5 h-5" />, href: '/purchases/orders' },
  { id: 'vendor-credits', name: 'Vendor Credits', description: 'Credits & refunds from vendors', category: 'Purchases', module: 'Purchases', icon: <FileSpreadsheet className="w-5 h-5" />, href: '/purchases/credits' },
  { id: 'expense-claims', name: 'Expense Claims', description: 'Employee expense claims & reimbursements', category: 'Purchases', module: 'Purchases', icon: <Receipt className="w-5 h-5" />, href: '/purchases/expenses' },
  { id: 'purchases-by-vendor', name: 'Purchases by Vendor', description: 'Expense analysis by vendor', category: 'Purchases', module: 'Purchases', icon: <PieChart className="w-5 h-5" />, href: '/purchases/vendors' },
  { id: 'payments-made', name: 'Payments Made', description: 'Vendor payment history', category: 'Purchases', module: 'Purchases', icon: <CreditCard className="w-5 h-5" />, href: '/purchases/payments' },
  
  // Banking Reports
  { id: 'bank-summary', name: 'Bank Summary', description: 'All bank account balances & activity', category: 'Banking', module: 'Banking', icon: <Landmark className="w-5 h-5" />, href: '/banking/accounts' },
  { id: 'credit-card-summary', name: 'Credit Card Summary', description: 'Credit card balances & limits', category: 'Banking', module: 'Banking', icon: <CreditCard className="w-5 h-5" />, href: '/banking/credit-cards' },
  { id: 'bank-transactions', name: 'Bank Transactions', description: 'Complete transaction history by account', category: 'Banking', module: 'Banking', icon: <ArrowRightLeft className="w-5 h-5" />, href: '/banking/transactions' },
  { id: 'bank-reconciliation', name: 'Bank Reconciliation', description: 'Reconciliation history & status', category: 'Banking', module: 'Banking', icon: <Shield className="w-5 h-5" />, href: '/banking/reconciliation' },
  { id: 'cc-reconciliation', name: 'Credit Card Reconciliation', description: 'Credit card statement reconciliation', category: 'Banking', module: 'Banking', icon: <CreditCard className="w-5 h-5" />, href: '/banking/credit-cards/reconcile' },
  { id: 'uncleared-items', name: 'Outstanding Checks', description: 'Uncleared checks & deposits', category: 'Banking', module: 'Banking', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'cash-position', name: 'Cash Position', description: 'Current cash & near-cash balances', category: 'Banking', module: 'Banking', icon: <Wallet className="w-5 h-5" /> },
  
  // Inventory Reports
  { id: 'inventory-summary', name: 'Inventory Summary', description: 'Stock levels, values & turnover', category: 'Inventory', module: 'Inventory', icon: <Boxes className="w-5 h-5" />, href: '/inventory' },
  { id: 'inventory-valuation', name: 'Inventory Valuation', description: 'Current inventory value by item', category: 'Inventory', module: 'Inventory', icon: <DollarSign className="w-5 h-5" />, href: '/inventory' },
  { id: 'products-services', name: 'Products & Services', description: 'Product catalog with pricing & costs', category: 'Inventory', module: 'Sales', icon: <Package className="w-5 h-5" />, href: '/sales/products' },
  { id: 'stock-movement', name: 'Stock Movement', description: 'Inventory ins & outs over time', category: 'Inventory', module: 'Inventory', icon: <Activity className="w-5 h-5" /> },
  { id: 'reorder-report', name: 'Reorder Report', description: 'Items at or below reorder point', category: 'Inventory', module: 'Inventory', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'inventory-adjustments', name: 'Inventory Adjustments', description: 'Stock adjustment history', category: 'Inventory', module: 'Inventory', icon: <ArrowUpDown className="w-5 h-5" /> },
  
  // Fixed Assets Reports
  { id: 'fixed-asset-register', name: 'Fixed Asset Register', description: 'Complete list of all fixed assets', category: 'Fixed Assets', module: 'Assets', icon: <Building2 className="w-5 h-5" />, href: '/fixed-assets' },
  { id: 'depreciation-schedule', name: 'Depreciation Schedule', description: 'Monthly/annual depreciation by asset', category: 'Fixed Assets', module: 'Assets', icon: <TrendingDown className="w-5 h-5" /> },
  { id: 'asset-disposition', name: 'Asset Disposition', description: 'Disposed assets & gain/loss', category: 'Fixed Assets', module: 'Assets', icon: <FileText className="w-5 h-5" /> },
  { id: 'cca-schedule', name: 'CCA Schedule', description: 'Capital Cost Allowance for tax', category: 'Fixed Assets', module: 'Assets', icon: <Calculator className="w-5 h-5" />, isNew: true },
  
  // Lease Reports
  { id: 'lease-register', name: 'Lease Register', description: 'All leases with ROU assets & liabilities', category: 'Leases', module: 'Assets', icon: <FileText className="w-5 h-5" />, href: '/leases', isNew: true },
  { id: 'lease-amortization', name: 'Lease Amortization', description: 'Payment schedules with interest/principal split', category: 'Leases', module: 'Assets', icon: <TrendingDown className="w-5 h-5" />, isNew: true },
  { id: 'lease-maturity', name: 'Lease Maturity Analysis', description: 'Future lease payments by period', category: 'Leases', module: 'Assets', icon: <Clock className="w-5 h-5" />, isNew: true },
  { id: 'rou-asset-summary', name: 'ROU Asset Summary', description: 'Right-of-use asset values & depreciation', category: 'Leases', module: 'Assets', icon: <Building2 className="w-5 h-5" />, isNew: true },
  
  // Tax Reports
  { id: 'gst-hst', name: 'GST/HST Report', description: 'Tax collected, ITCs & net payable', category: 'Tax', module: 'Tax', icon: <BadgePercent className="w-5 h-5" />, href: '/tax', isFavorite: true },
  { id: 'tax-summary', name: 'Tax Summary', description: 'All tax transactions by code', category: 'Tax', module: 'Tax', icon: <Receipt className="w-5 h-5" /> },
  { id: 'qst-report', name: 'QST Report', description: 'Quebec Sales Tax report', category: 'Tax', module: 'Tax', icon: <Calculator className="w-5 h-5" /> },
  { id: 'pst-report', name: 'PST Report', description: 'Provincial Sales Tax report', category: 'Tax', module: 'Tax', icon: <Calculator className="w-5 h-5" /> },
  { id: 'tax-exception', name: 'Tax Exception Report', description: 'Transactions with tax issues', category: 'Tax', module: 'Tax', icon: <AlertTriangle className="w-5 h-5" /> },
  
  // Payroll Reports
  { id: 'payroll-summary', name: 'Payroll Summary', description: 'Pay run totals & contributions', category: 'Payroll', module: 'Payroll', icon: <Users className="w-5 h-5" />, href: '/payroll/reports' },
  { id: 'employee-earnings', name: 'Employee Earnings', description: 'YTD earnings by employee', category: 'Payroll', module: 'Payroll', icon: <DollarSign className="w-5 h-5" /> },
  { id: 'payroll-register', name: 'Payroll Register', description: 'Detailed pay run breakdown', category: 'Payroll', module: 'Payroll', icon: <ClipboardList className="w-5 h-5" /> },
  { id: 'deduction-report', name: 'Deduction Report', description: 'All payroll deductions by type', category: 'Payroll', module: 'Payroll', icon: <TrendingDown className="w-5 h-5" /> },
  { id: 'payroll-liability', name: 'Payroll Liabilities', description: 'CPP, EI & tax remittances owing', category: 'Payroll', module: 'Payroll', icon: <Calculator className="w-5 h-5" />, href: '/payroll/remittances', isNew: true },
  { id: 'pd7a-report', name: 'PD7A Report', description: 'CRA remittance report', category: 'Payroll', module: 'Payroll', icon: <FileSpreadsheet className="w-5 h-5" /> },
  { id: 't4-summary', name: 'T4 Summary', description: 'T4 slip summary for tax year', category: 'Payroll', module: 'Payroll', icon: <FileText className="w-5 h-5" />, href: '/payroll/tax-slips' },
  { id: 'roe-report', name: 'ROE Report', description: 'Record of Employment listing', category: 'Payroll', module: 'Payroll', icon: <ClipboardList className="w-5 h-5" />, href: '/payroll/roe' },
  { id: 'employee-list', name: 'Employee List', description: 'Active & inactive employees', category: 'Payroll', module: 'Payroll', icon: <UserCheck className="w-5 h-5" />, href: '/payroll/employees' },
  { id: 'vacation-accrual', name: 'Vacation Accrual', description: 'Vacation pay owing by employee', category: 'Payroll', module: 'Payroll', icon: <CalendarDays className="w-5 h-5" /> },
  { id: 'benefits-report', name: 'Benefits Report', description: 'Employee benefits summary', category: 'Payroll', module: 'Payroll', icon: <Shield className="w-5 h-5" /> },
  
  // Management Reports
  { id: 'executive-summary', name: 'Executive Summary', description: 'KPIs & financial highlights', category: 'Management', module: 'Dashboard', icon: <BarChart3 className="w-5 h-5" />, href: '/' },
  { id: 'comparative-balance', name: 'Comparative Balance Sheet', description: 'Period-over-period comparison', category: 'Management', module: 'Accounting', icon: <ArrowUpDown className="w-5 h-5" />, href: '/reports/balance-sheet' },
  { id: 'comparative-income', name: 'Comparative Income', description: 'P&L comparison across periods', category: 'Management', module: 'Accounting', icon: <BarChart3 className="w-5 h-5" />, href: '/reports/income-statement' },
  { id: 'financial-ratios', name: 'Financial Ratios', description: 'Liquidity, profitability & efficiency', category: 'Management', module: 'Dashboard', icon: <Activity className="w-5 h-5" />, isPremium: true },
  { id: 'expense-analysis', name: 'Expense Analysis', description: 'Expense breakdown & trends', category: 'Management', module: 'Accounting', icon: <PieChart className="w-5 h-5" />, href: '/reports/income-statement' },
  { id: 'management-report', name: 'Management Report', description: 'Comprehensive financial overview', category: 'Management', module: 'Dashboard', icon: <TrendingUp className="w-5 h-5" />, href: '/reports/management' },
];

const categories = [
  'All',
  'Financial Statements',
  'Accounting',
  'Sales',
  'Purchases',
  'Banking',
  'Inventory',
  'Fixed Assets',
  'Leases',
  'Tax',
  'Payroll',
  'Management'
];

const modules = ['All', 'Accounting', 'Sales', 'Purchases', 'Banking', 'Inventory', 'Assets', 'Tax', 'Payroll', 'Dashboard'];

export default function ReportsCentre() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedModule, setSelectedModule] = useState('All');
  const [favorites, setFavorites] = useState<string[]>(
    reports.filter(r => r.isFavorite).map(r => r.id)
  );

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) 
        ? prev.filter(f => f !== id)
        : [...prev, id]
    );
  };

  const handleReportClick = (report: ReportItem) => {
    if (report.href) {
      navigate(report.href);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          report.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || report.category === selectedCategory;
    const matchesModule = selectedModule === 'All' || report.module === selectedModule;
    return matchesSearch && matchesCategory && matchesModule;
  });

  const favoriteReports = reports.filter(r => favorites.includes(r.id));
  
  const groupedReports = categories.slice(1).reduce((acc, category) => {
    acc[category] = filteredReports.filter(r => r.category === category);
    return acc;
  }, {} as Record<string, ReportItem[]>);

  // Stats
  const totalReports = reports.length;
  const favoriteCount = favorites.length;
  const newReportsCount = reports.filter(r => r.isNew).length;
  const premiumReportsCount = reports.filter(r => r.isPremium).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-accent/10 rounded-xl">
            <PieChart className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports Centre</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Access all {totalReports} reports across your organization
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-card to-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalReports}</p>
              <p className="text-xs text-muted-foreground">Total Reports</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-card to-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Star className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{favoriteCount}</p>
              <p className="text-xs text-muted-foreground">Favorites</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-card to-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Badge className="bg-transparent p-0 hover:bg-transparent">
                <span className="text-emerald-500 text-xs font-medium">NEW</span>
              </Badge>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{newReportsCount}</p>
              <p className="text-xs text-muted-foreground">New Reports</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-card to-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{categories.length - 1}</p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {/* Category Filter */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={selectedCategory === category ? "bg-accent hover:bg-accent/90 shrink-0" : "shrink-0"}
              >
                {category}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Module Filter */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground self-center mr-2">Module:</span>
          {modules.map(module => (
            <Button
              key={module}
              variant={selectedModule === module ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelectedModule(module)}
              className="h-7 text-xs"
            >
              {module}
            </Button>
          ))}
        </div>
      </div>

      {/* Favorites Section */}
      {favoriteReports.length > 0 && selectedCategory === 'All' && selectedModule === 'All' && !searchQuery && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Star className="w-4 h-4 text-warning fill-warning" />
            Favorite Reports
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {favoriteReports.map(report => (
              <Card 
                key={report.id}
                className="p-4 hover:border-accent transition-all cursor-pointer group hover:shadow-md"
                onClick={() => handleReportClick(report)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-accent/10 rounded-lg text-accent shrink-0">
                      {report.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground group-hover:text-accent transition-colors truncate">
                          {report.name}
                        </h3>
                        {report.href && (
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {report.description}
                      </p>
                      <Badge variant="outline" className="mt-2 text-[10px] h-5">
                        {report.module}
                      </Badge>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(report.id); }}
                    className="text-warning shrink-0 ml-2"
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reports by Category */}
      {Object.entries(groupedReports).map(([category, categoryReports]) => {
        if (categoryReports.length === 0) return null;
        
        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">{category}</h2>
              <Badge variant="secondary" className="text-xs">{categoryReports.length} reports</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {categoryReports.map(report => (
                <Card 
                  key={report.id}
                  className={`p-4 hover:border-accent transition-all group hover:shadow-md ${report.href ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => handleReportClick(report)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-muted/50 rounded-lg text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors shrink-0">
                        {report.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground group-hover:text-accent transition-colors">
                            {report.name}
                          </h3>
                          {report.isNew && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20">
                              NEW
                            </Badge>
                          )}
                          {report.isPremium && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-600 hover:bg-purple-500/20">
                              PRO
                            </Badge>
                          )}
                          {report.href && (
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {report.description}
                        </p>
                        <Badge variant="outline" className="mt-2 text-[10px] h-5">
                          {report.module}
                        </Badge>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(report.id); }}
                      className={`shrink-0 ml-2 ${favorites.includes(report.id) ? "text-warning" : "text-muted-foreground hover:text-warning"}`}
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(report.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <Card className="p-12 text-center">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No reports found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </Card>
      )}
    </div>
  );
}

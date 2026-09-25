import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  FileText, 
  FileCheck, 
  Download, 
  Printer, 
  BookOpen,
  CheckCircle2,
  Clock,
  Building2,
  ScrollText,
  FileSpreadsheet,
  ClipboardCheck,
  Plus,
  Calendar,
  Trash2,
  Edit,
  Send,
  Check,
  RotateCcw,
  Sparkles,
  Loader2,
  User,
  History,
  FileType,
  Briefcase
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { useCompilationReports, useCreateCompilationReport, useUpdateCompilationReport, useDeleteCompilationReport, useIssueCompilationReport, CompilationReport, aspeNoteTemplates, getFrameworkNoteTemplates, engagementChecklistData } from '@/hooks/useCompilationReports';
import { useCreateAuditEntry } from '@/hooks/useCompilationAuditTrail';
import { useReportFilters } from '@/hooks/useReportFilters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateCompilationPDF } from '@/lib/generateCompilationPdf';
import { downloadCompilationWord } from '@/lib/generateCompilationWord';
import { generateEnhancedCompilationPDF, ComparativeFinancialData, FixedAssetNoteData, FixedAssetsNoteSection, LeaseNoteData } from '@/lib/generateCompilationPdfEnhanced';
import { downloadCompilationExcel } from '@/lib/generateCompilationExcel';
import { AICompilationDialog, CompilationDisplayOptions } from '@/components/reports/AICompilationDialog';
import { ExecutiveSignatureBlock } from '@/components/reports/ExecutiveSignatureBlock';
import { AuditVersionControlDialog } from '@/components/reports/AuditVersionControlDialog';
import { useComparativeFinancialReports } from '@/hooks/useComparativeFinancialReports';
import { useFixedAssets, generateDepreciationSchedule } from '@/hooks/useFixedAssets';
import { useLeases, useLeasePaymentSchedule } from '@/hooks/useLeases';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate } from '@/lib/fiscalYearUtils';
import { subYears, endOfYear } from 'date-fns';

export default function AccountantDashboard() {
  const navigate = useNavigate();
  const { organization } = useCurrentOrganization();
  const { startDate, endDate } = useReportFilters();
  
  // State to track which compilation to fetch comparative data for
  const [selectedCompilationForDownload, setSelectedCompilationForDownload] = useState<CompilationReport | null>(null);
  
  // Calculate periods based on the selected compilation's fiscal year
  // Default to current filter dates if no compilation selected
  const fiscalYearEndMonth = organization?.fiscal_year_end_month || 12;
  const compilationFiscalYearEnd = selectedCompilationForDownload?.fiscal_year_end 
    ? parseISO(selectedCompilationForDownload.fiscal_year_end)
    : (endDate || endOfYear(new Date()));
  
  // Use fiscal-year-aware period calculation instead of calendar year
  const compilationFiscalYear = getFiscalYearForDate(compilationFiscalYearEnd, fiscalYearEndMonth);
  const currentPeriodStart = getFiscalYearStart(compilationFiscalYear, fiscalYearEndMonth);
  const currentPeriodEnd = compilationFiscalYearEnd;
  const priorFiscalYear = compilationFiscalYear - 1;
  const priorYearStart = getFiscalYearStart(priorFiscalYear, fiscalYearEndMonth);
  const priorYearEnd = getFiscalYearEnd(priorFiscalYear, fiscalYearEndMonth);
  
  // Fetch retained earnings opening balances for SOCE accuracy
  const [retainedEarningsOpening, setRetainedEarningsOpening] = useState<number | undefined>(undefined);
  const [priorRetainedEarningsOpening, setPriorRetainedEarningsOpening] = useState<number | undefined>(undefined);
  
  // Fetch share capital opening/contributions for SOCE accuracy
  const [shareCapitalOpening, setShareCapitalOpening] = useState<number | undefined>(undefined);
  const [shareCapitalContributions, setShareCapitalContributions] = useState<number | undefined>(undefined);
  const [priorShareCapitalOpening, setPriorShareCapitalOpening] = useState<number | undefined>(undefined);
  const [priorShareCapitalContributions, setPriorShareCapitalContributions] = useState<number | undefined>(undefined);
  
  useEffect(() => {
    if (!organization?.id) return;
    
    const fetchOpeningRE = async () => {
      try {
        // Current year opening RE
        const { data: currentOpeningRE } = await supabase.rpc('calculate_opening_retained_earnings', {
          p_organization_id: organization.id,
          p_fiscal_year: compilationFiscalYear,
        });
        setRetainedEarningsOpening(Number(currentOpeningRE) || 0);
        
        // Prior year opening RE
        const { data: priorOpeningRE } = await supabase.rpc('calculate_opening_retained_earnings', {
          p_organization_id: organization.id,
          p_fiscal_year: priorFiscalYear,
        });
        setPriorRetainedEarningsOpening(Number(priorOpeningRE) || 0);
        
        // Fetch share capital (Common Stock) opening/contributions
        await fetchShareCapitalData(organization.id);
      } catch (err) {
        console.error('Failed to fetch opening RE for compilation:', err);
      }
    };
    
    const fetchShareCapitalData = async (orgId: string) => {
      try {
        // Fetch ALL share-capital-like accounts (Common Stock/Shares, Share Capital, APIC)
        // Some accounts have equity_category NULL — match by equity_type or name too.
        const { data: scAccountsRaw } = await supabase
          .from('accounts')
          .select('id, opening_balance, name, equity_category, equity_type')
          .eq('organization_id', orgId)
          .eq('account_type', 'equity')
          .eq('is_header', false)
          .or('equity_category.eq.COMMON_STOCK,equity_type.eq.share_capital,name.ilike.%common share%,name.ilike.%common stock%,name.ilike.%share capital%');
        
        // Deduplicate by id
        const seen = new Set<string>();
        const scAccounts = (scAccountsRaw || []).filter(a => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });
        
        if (!scAccounts || scAccounts.length === 0) {
          setShareCapitalOpening(0);
          setShareCapitalContributions(0);
          setPriorShareCapitalOpening(0);
          setPriorShareCapitalContributions(0);
          return;
        }

        
        const calcSC = async (year: number) => {
          const fiscalStart = `${year}-01-01`;
          const fiscalEnd = `${year}-12-31`;
          let totalOpening = 0;
          let totalContributions = 0;
          
          for (const acct of scAccounts) {
            const { data: priorActivity } = await supabase
              .from('journal_entry_lines')
              .select('debit, credit, journal_entries!inner(entry_date, status)')
              .eq('account_id', acct.id)
              .eq('journal_entries.status', 'posted')
              .lt('journal_entries.entry_date', fiscalStart);
            
            totalOpening += (acct.opening_balance || 0) +
              (priorActivity || []).reduce((sum, l) => sum + ((l.credit || 0) - (l.debit || 0)), 0);
            
            const { data: yearActivity } = await supabase
              .from('journal_entry_lines')
              .select('debit, credit, journal_entries!inner(entry_date, status)')
              .eq('account_id', acct.id)
              .eq('journal_entries.status', 'posted')
              .gte('journal_entries.entry_date', fiscalStart)
              .lte('journal_entries.entry_date', fiscalEnd);
            
            totalContributions += (yearActivity || []).reduce((sum, l) => sum + ((l.credit || 0) - (l.debit || 0)), 0);
          }
          
          return { opening: totalOpening, contributions: totalContributions };
        };
        
        const currentSC = await calcSC(compilationFiscalYear);
        setShareCapitalOpening(currentSC.opening);
        setShareCapitalContributions(currentSC.contributions);
        
        const priorSC = await calcSC(priorFiscalYear);
        setPriorShareCapitalOpening(priorSC.opening);
        setPriorShareCapitalContributions(priorSC.contributions);
      } catch (err) {
        console.error('Failed to fetch share capital data:', err);
      }
    };
    
    fetchOpeningRE();
  }, [organization?.id, compilationFiscalYear, priorFiscalYear]);
  
  // Use financial reports with compilation-specific dates
  const { isLoading: financialLoading, getBalanceSheetData, getIncomeStatementData, getCashFlowData } = useFinancialReports({
    startDate: currentPeriodStart,
    endDate: currentPeriodEnd,
    period: 'custom'
  });
  
  // Fetch comparative financial data for prior year
  const comparativeHook = useComparativeFinancialReports(
    { startDate: currentPeriodStart, endDate: currentPeriodEnd },
    [{ label: 'Prior', startDate: priorYearStart, endDate: priorYearEnd }]
  );
  
  // Fetch prior year financial reports for cash flow data
  const priorYearReports = useFinancialReports({
    startDate: priorYearStart,
    endDate: priorYearEnd,
    period: 'custom'
  });
  
  const { data: compilations = [], isLoading: compilationsLoading } = useCompilationReports();
  const { data: fixedAssets = [] } = useFixedAssets(organization?.id);
  const { data: leases = [] } = useLeases();
  const createCompilation = useCreateCompilationReport();
  const updateCompilation = useUpdateCompilationReport();
  const deleteCompilation = useDeleteCompilationReport();
  const issueCompilation = useIssueCompilationReport();
  
  const createAuditEntry = useCreateAuditEntry();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [selectedCompilationForAudit, setSelectedCompilationForAudit] = useState<CompilationReport | null>(null);
  const [editingReport, setEditingReport] = useState<CompilationReport | null>(null);
  const [selectedYear, setSelectedYear] = useState('2025');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preparedBy, setPreparedBy] = useState('');
  const [cpaDesignation, setCpaDesignation] = useState('CPA');
  const [selectedNotes, setSelectedNotes] = useState<string[]>(['basis', 'revenue', 'inventory']);
  const [customNote, setCustomNote] = useState('');
  const [isGeneratingAINotes, setIsGeneratingAINotes] = useState(false);
  
  // State for pending download (to wait for data after compilation selection)
  const [pendingDownload, setPendingDownload] = useState<{ format: 'pdf' | 'word' | 'excel'; hideZeroBalances?: boolean } | null>(null);
  
  // Store display options for PDF generation (set when creating/updating compilation)
  const [displayOptions, setDisplayOptions] = useState<CompilationDisplayOptions>({ hideZeroBalances: true });
  
  // Checklist state - persisted to localStorage per organization
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  
  // Load checklist state from localStorage
  useEffect(() => {
    if (organization?.id) {
      const saved = localStorage.getItem(`checklist-${organization.id}`);
      if (saved) {
        try {
          setCheckedItems(JSON.parse(saved));
        } catch {
          setCheckedItems({});
        }
      }
    }
  }, [organization?.id]);
  
  // Save checklist state to localStorage
  useEffect(() => {
    if (organization?.id && Object.keys(checkedItems).length > 0) {
      localStorage.setItem(`checklist-${organization.id}`, JSON.stringify(checkedItems));
    }
  }, [checkedItems, organization?.id]);

  const isLoading = financialLoading || compilationsLoading;
  const isDataReady = !financialLoading && !comparativeHook.isLoading && !priorYearReports.isLoading;
  
  // Get financial data directly - these functions return proper defaults when data isn't loaded
  const balanceSheet = getBalanceSheetData();
  const incomeStatement = getIncomeStatementData();
  const cashFlow = getCashFlowData();
  const priorCashFlow = priorYearReports.getCashFlowData();
  
  // Build fixed assets note data from fixed assets register
  // CRITICAL: Uses ACTUAL POSTED depreciation from the GL accounts (via useFinancialReports)
  // to ensure Note 8/9 PPE schedule matches the Balance Sheet exactly.
  // The Balance Sheet pulls from GL account balances, so Note 8/9 must use the same source.
  const buildFixedAssetsNoteData = (
    assets: typeof fixedAssets,
    currentStart: Date,
    currentEnd: Date,
    priorStart: Date,
    priorEnd: Date,
    fiscalYearEndMonth: number = 12,
    currentBalanceSheet?: typeof balanceSheet,
    priorBalanceSheet?: { assets: Array<{ name: string; calculated_balance: number; code?: string }> }
  ): FixedAssetsNoteSection | undefined => {
    if (!assets || assets.length === 0) return undefined;
    
    // Filter active assets that were acquired before or during the current period
    const activeAssets = assets.filter(a => {
      const [ay, am, ad] = a.acquisition_date.substring(0, 10).split('-').map(Number);
      return (a.status === 'active' || a.status === 'fully_depreciated') &&
        new Date(ay, am - 1, ad) <= currentEnd;
    });
    
    if (activeAssets.length === 0) return undefined;
    
    // Group assets by category/class
    const assetsByClass = new Map<string, typeof activeAssets>();
    // Vehicle make/model keywords for classification
    const vehicleKeywords = ['vehicle', 'car', 'truck', 'van', 'suv', 'sedan', 'coupe',
      'dodge', 'ford', 'toyota', 'honda', 'chevrolet', 'chevy', 'gmc', 'nissan', 'hyundai',
      'kia', 'subaru', 'mazda', 'lexus', 'acura', 'bmw', 'mercedes', 'audi', 'volkswagen',
      'jeep', 'ram', 'buick', 'cadillac', 'chrysler', 'lincoln', 'volvo', 'tesla', 'mitsubishi',
      'caravan', 'escape', 'sienna', 'camry', 'corolla', 'civic', 'accord', 'rav4', 'crv',
      'f-150', 'f150', 'silverado', 'sierra', 'tacoma', 'tundra', 'wrangler', 'explorer',
      'highlander', 'pathfinder', 'rogue', 'outback', 'forester', 'pilot', 'odyssey'];

    const classifyAsset = (assetName: string): string => {
      const nameLower = assetName.toLowerCase();
      if (vehicleKeywords.some(kw => nameLower.includes(kw))) return 'Vehicles';
      if (nameLower.includes('furniture') || nameLower.includes('fixture')) return 'Furniture & Fixtures';
      if (nameLower.includes('computer') || nameLower.includes('printer')) return 'Computer Hardware';
      if (nameLower.includes('building')) return 'Buildings';
      if (nameLower.includes('land')) return 'Land';
      if (nameLower.includes('machinery') || nameLower.includes('machine')) return 'Machinery';
      if (nameLower.includes('franchise')) return 'Franchise';
      return 'Equipment';
    };

    activeAssets.forEach(asset => {
      const className = classifyAsset(asset.name);
      
      if (!assetsByClass.has(className)) {
        assetsByClass.set(className, []);
      }
      assetsByClass.get(className)!.push(asset);
    });
    
    const currentYearData: FixedAssetNoteData[] = [];
    const priorYearData: FixedAssetNoteData[] = [];
    
    let totalCost = 0;
    let totalAccumDep = 0;
    let totalNetBookValue = 0;
    let priorTotalCost = 0;
    let priorTotalAccumDep = 0;
    let priorTotalNetBookValue = 0;
    let currentYearAdditions = 0;
    let priorYearAdditions = 0;
    
    // Helper: calculate accumulated depreciation for an asset as of a specific date
    // using the depreciation schedule
    const getAccumDepAsOfDate = (asset: typeof fixedAssets[0], asOfDate: Date): number => {
      const schedule = generateDepreciationSchedule(asset as any, fiscalYearEndMonth);
      let accumDep = 0;
      for (const entry of schedule) {
        const [ey, em, ed] = entry.period_end.split('-').map(Number);
        const entryEnd = new Date(ey, em - 1, ed);
        if (entryEnd <= asOfDate) {
          accumDep = entry.accumulated_depreciation;
        } else {
          break;
        }
      }
      return accumDep;
    };
    
    assetsByClass.forEach((classAssets, className) => {
      // Current period values - sum accumulated_depreciation directly from asset register
      const classCost = classAssets.reduce((sum, a) => sum + a.acquisition_cost, 0);
      
      // Get accumulated depreciation from the fixed assets table (per-asset, per-class)
      const classAccumDep = classAssets.reduce((sum, a) => sum + (a.accumulated_depreciation || 0), 0);
      const classNetBookValue = classCost - classAccumDep;
      
      // Determine depreciation method and rate for display
      const firstAsset = classAssets[0];
      const depMethod = firstAsset.depreciation_method === 'straight_line' ? 'straight-line' : 'declining balance';
      const depRate = firstAsset.depreciation_method === 'straight_line' 
        ? `${Math.round(12 / firstAsset.useful_life_months * 100)}% (${firstAsset.useful_life_months / 12} years)`
        : `${firstAsset.declining_rate || 20}%`;
      
      currentYearData.push({
        assetClass: className,
        acquisitionCost: classCost,
        accumulatedAmortization: classAccumDep,
        netBookValue: classNetBookValue,
        depreciationMethod: depMethod,
        depreciationRate: depRate,
      });
      
      totalCost += classCost;
      totalAccumDep += classAccumDep;
      totalNetBookValue += classNetBookValue;
      
      // Calculate prior year values using depreciation schedule as of prior period end
      const priorAssets = classAssets.filter(a => {
        const [ay, am, ad] = a.acquisition_date.substring(0, 10).split('-').map(Number);
        return new Date(ay, am - 1, ad) <= priorEnd;
      });
      const priorClassCost = priorAssets.reduce((sum, a) => sum + a.acquisition_cost, 0);
      const priorClassAccumDep = priorAssets.reduce((sum, a) => sum + getAccumDepAsOfDate(a, priorEnd), 0);
      const priorClassNetBookValue = priorClassCost - priorClassAccumDep;
      
      priorYearData.push({
        assetClass: className,
        acquisitionCost: priorClassCost,
        accumulatedAmortization: priorClassAccumDep,
        netBookValue: priorClassNetBookValue,
        depreciationMethod: depMethod,
        depreciationRate: depRate,
      });
      
      priorTotalCost += priorClassCost;
      priorTotalAccumDep += priorClassAccumDep;
      priorTotalNetBookValue += priorClassNetBookValue;
      
      // Calculate additions
      classAssets.forEach(asset => {
        const [ay, am, ad] = asset.acquisition_date.substring(0, 10).split('-').map(Number);
        const acqDate = new Date(ay, am - 1, ad);
        if (acqDate >= currentStart && acqDate <= currentEnd) {
          currentYearAdditions += asset.acquisition_cost;
        }
        if (acqDate >= priorStart && acqDate <= priorEnd) {
          priorYearAdditions += asset.acquisition_cost;
        }
      });
    });
    
    return {
      currentYear: currentYearData,
      priorYear: priorYearData.length > 0 ? priorYearData : undefined,
      totalCost,
      totalAccumulatedAmortization: totalAccumDep,
      totalNetBookValue,
      priorTotalCost,
      priorTotalAccumulatedAmortization: priorTotalAccumDep,
      priorTotalNetBookValue,
      currentYearAdditions: currentYearAdditions > 0 ? currentYearAdditions : undefined,
      priorYearAdditions: priorYearAdditions > 0 ? priorYearAdditions : undefined,
    };
  };

  // Build lease note data from lease payment schedules
  const buildLeaseNoteData = async (): Promise<LeaseNoteData[]> => {
    if (!leases || leases.length === 0) return [];
    
    const financeLeases = leases.filter(l => l.lease_type === 'finance' && l.status === 'active');
    if (financeLeases.length === 0) return [];
    
    const leaseNotes: LeaseNoteData[] = [];
    
    for (const lease of financeLeases) {
      // Fetch the full payment schedule for this lease
      const { data: schedule } = await supabase
        .from('lease_payment_schedule')
        .select('*')
        .eq('lease_id', lease.id)
        .order('payment_number', { ascending: true });
      
      if (!schedule || schedule.length === 0) continue;
      
      const currentFYEStr = format(currentPeriodEnd, 'yyyy-MM-dd');
      const priorFYEStr = format(priorYearEnd, 'yyyy-MM-dd');
      
      // Find closing liability at each FYE (last payment on or before FYE)
      const currentFYEPayments = schedule.filter(p => p.payment_date <= currentFYEStr);
      const priorFYEPayments = schedule.filter(p => p.payment_date <= priorFYEStr);
      
      const currentLiabilityTotal = currentFYEPayments.length > 0 
        ? currentFYEPayments[currentFYEPayments.length - 1].closing_liability 
        : lease.lease_liability_initial;
      const priorLiabilityTotal = priorFYEPayments.length > 0 
        ? priorFYEPayments[priorFYEPayments.length - 1].closing_liability 
        : lease.lease_liability_initial;
      
      // Current portion = sum of principal payments due within 12 months after FYE
      // This correctly handles grace periods where interest compounds but no principal is repaid
      const nextYearFromCurrent = format(new Date(currentPeriodEnd.getFullYear() + 1, currentPeriodEnd.getMonth(), currentPeriodEnd.getDate()), 'yyyy-MM-dd');
      const nextYearFromPrior = format(new Date(priorYearEnd.getFullYear() + 1, priorYearEnd.getMonth(), priorYearEnd.getDate()), 'yyyy-MM-dd');
      
      const currentPortionCurrent = schedule
        .filter(p => p.payment_date > currentFYEStr && p.payment_date <= nextYearFromCurrent)
        .reduce((sum, p) => sum + p.principal_amount, 0);
      const currentPortionPrior = schedule
        .filter(p => p.payment_date > priorFYEStr && p.payment_date <= nextYearFromPrior)
        .reduce((sum, p) => sum + p.principal_amount, 0);
      
      const nonCurrentPortionCurrent = Math.max(0, Math.round((currentLiabilityTotal - currentPortionCurrent) * 100) / 100);
      const nonCurrentPortionPrior = Math.max(0, Math.round((priorLiabilityTotal - currentPortionPrior) * 100) / 100);
      
      // Interest expense for current and prior year
      const currentYearStartStr = format(currentPeriodStart, 'yyyy-MM-dd');
      const priorYearStartStr = format(priorYearStart, 'yyyy-MM-dd');
      
      const totalInterestCurrent = schedule
        .filter(p => p.payment_date >= currentYearStartStr && p.payment_date <= currentFYEStr)
        .reduce((sum, p) => sum + p.interest_amount, 0);
      const totalInterestPrior = schedule
        .filter(p => p.payment_date >= priorYearStartStr && p.payment_date <= priorFYEStr)
        .reduce((sum, p) => sum + p.interest_amount, 0);
      
      // Future minimum lease payments by year (from current FYE onwards)
      const futurePayments = schedule.filter(p => p.payment_date > currentFYEStr);
      const paymentsByYear = new Map<string, number>();
      futurePayments.forEach(p => {
        const year = p.payment_date.substring(0, 4);
        paymentsByYear.set(year, (paymentsByYear.get(year) || 0) + p.payment_amount);
      });
      
      const maturitySchedule = Array.from(paymentsByYear.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([year, amount]) => ({ year, amount: Math.round(amount * 100) / 100 }));
      
      leaseNotes.push({
        leaseName: lease.name,
        leaseType: lease.lease_type,
        commencementDate: lease.commencement_date,
        endDate: lease.end_date,
        termMonths: lease.term_months,
        paymentAmount: lease.payment_amount,
        paymentFrequency: lease.payment_frequency === 'bi_weekly' ? 'bi-weekly' : lease.payment_frequency,
        discountRate: lease.discount_rate,
        rouAssetInitial: lease.rou_asset_initial,
        currentLiabilityTotal: Math.round(currentLiabilityTotal * 100) / 100,
        priorLiabilityTotal: Math.round(priorLiabilityTotal * 100) / 100,
        currentPortionCurrent: Math.round(currentPortionCurrent * 100) / 100,
        nonCurrentPortionCurrent: Math.max(0, nonCurrentPortionCurrent),
        currentPortionPrior: Math.round(currentPortionPrior * 100) / 100,
        nonCurrentPortionPrior: Math.max(0, nonCurrentPortionPrior),
        totalInterestCurrent: Math.round(totalInterestCurrent * 100) / 100,
        totalInterestPrior: Math.round(totalInterestPrior * 100) / 100,
        maturitySchedule,
      });
    }
    
    return leaseNotes;
  };

  // Function to execute the actual download (called after data is ready)
  const executeDownload = async (compilation: CompilationReport, downloadFormat: 'pdf' | 'word' | 'excel', hideZeroBalances: boolean = true) => {
    // Get comparative data from hook
    const comparativeTotals = comparativeHook.getComparativeTotals();
    const comparativeIS = comparativeHook.getComparativeIncomeStatement();
    
    // Prior period data (index 1 is the prior year)
    const priorTotals = comparativeTotals.length > 1 ? comparativeTotals[1] : null;
    const priorIncomeData = comparativeIS && comparativeIS.length > 1 ? comparativeIS[1] : null;
    
    // Get prior period account details from the hook's raw data
    const priorPeriodData = comparativeHook.data && comparativeHook.data.length > 1 ? comparativeHook.data[1] : null;
    const priorAssets = priorPeriodData?.balances.filter(a => a.account_type === 'asset' && !a.is_header) || [];
    const priorLiabilities = priorPeriodData?.balances.filter(a => a.account_type === 'liability' && !a.is_header) || [];
    const priorEquity = priorPeriodData?.balances.filter(a => a.account_type === 'equity' && !a.is_header) || [];
    
    // Build lease note data
    const leaseNotes = await buildLeaseNoteData();

    // Fetch Statement of Retained Earnings closing balances (canonical equity
    // formula — matches BalanceSheet.tsx and AICompilationDialog validation).
    const fmtDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    let currentReClosingBalance: number | undefined;
    let priorReClosingBalance: number | undefined;
    if (organization?.id) {
      try {
        const [curRe, priorRe] = await Promise.all([
          supabase.rpc('calculate_retained_earnings_statement', {
            p_organization_id: organization.id,
            p_fiscal_year_start: fmtDate(currentPeriodStart),
            p_fiscal_year_end: fmtDate(currentPeriodEnd),
          }),
          supabase.rpc('calculate_retained_earnings_statement', {
            p_organization_id: organization.id,
            p_fiscal_year_start: fmtDate(priorYearStart),
            p_fiscal_year_end: fmtDate(priorYearEnd),
          }),
        ]);
        currentReClosingBalance = Number(curRe.data?.[0]?.closing_balance ?? 0);
        priorReClosingBalance = Number(priorRe.data?.[0]?.closing_balance ?? 0);
      } catch (e) {
        console.warn('Could not load RE closing balance for compilation export:', e);
      }
    }

    
    // Build comparative financial data structure for side-by-side display
    const comparativeData: ComparativeFinancialData = {
      currentYear: {
        label: compilation.fiscal_year,
        balanceSheet: {
          assets: balanceSheet.assets,
          liabilities: balanceSheet.liabilities,
          equity: balanceSheet.equity,
          totalAssets: balanceSheet.totalAssets,
          totalLiabilities: balanceSheet.totalLiabilities,
          totalEquity: balanceSheet.totalEquity,
          netIncome: incomeStatement.netIncome,
          reClosingBalance: currentReClosingBalance,
        },
        incomeStatement: {
          income: incomeStatement.income,
          cogs: incomeStatement.cogs,
          expenses: incomeStatement.expenses,
          otherIncome: incomeStatement.otherIncome || [],
          otherExpenses: incomeStatement.otherExpenses || [],
          totalRevenue: incomeStatement.totalRevenue,
          totalCogs: incomeStatement.cogs.reduce((sum, c) => sum + Math.abs(c.calculated_balance), 0),
          grossProfit: incomeStatement.grossProfit,
          totalExpenses: incomeStatement.totalExpenses,
          operatingIncome: incomeStatement.operatingIncome,
          netIncome: incomeStatement.netIncome,
        },
        cashFlow: {
          operatingActivities: cashFlow.operatingActivities,
          investingActivities: cashFlow.investingActivities,
          financingActivities: cashFlow.financingActivities,
          nonCashActivities: cashFlow.nonCashActivities,

          netOperating: cashFlow.netOperating,
          netInvesting: cashFlow.netInvesting,
          netFinancing: cashFlow.netFinancing,
          netChange: cashFlow.netChange,
          beginningCash: cashFlow.beginningCash,
          endingCash: cashFlow.endingCash,
        },
      },
      // Prior year data from comparative hook - always include if data exists
      priorYear: priorTotals ? {
        label: String(parseInt(compilation.fiscal_year) - 1),
        balanceSheet: {
          assets: priorAssets.map(a => ({ name: a.name, calculated_balance: a.calculated_balance, code: a.code, normal_balance: a.normal_balance })),
          liabilities: priorLiabilities.map(a => ({ name: a.name, calculated_balance: a.calculated_balance, code: a.code, normal_balance: a.normal_balance })),
          equity: priorEquity.map(a => ({ name: a.name, calculated_balance: a.calculated_balance, code: a.code, normal_balance: a.normal_balance })),
          totalAssets: priorTotals.totalAssets,
          totalLiabilities: priorTotals.totalLiabilities,
          totalEquity: priorTotals.totalEquity,
          netIncome: priorTotals.netIncome,
          reClosingBalance: priorReClosingBalance,
        },
        incomeStatement: {
          income: priorIncomeData?.income.map(a => ({ name: a.name, calculated_balance: a.calculated_balance })) || [],
          cogs: priorIncomeData?.cogs.map(a => ({ name: a.name, calculated_balance: a.calculated_balance })) || [],
          expenses: priorIncomeData?.expenses.map(a => ({ name: a.name, calculated_balance: a.calculated_balance })) || [],
          otherIncome: priorIncomeData?.otherIncome.map(a => ({ name: a.name, calculated_balance: a.calculated_balance })) || [],
          otherExpenses: priorIncomeData?.otherExpenses.map(a => ({ name: a.name, calculated_balance: a.calculated_balance })) || [],
          totalRevenue: priorIncomeData?.totalRevenue || 0,
          totalCogs: priorIncomeData?.totalCOGS || 0,
          grossProfit: priorIncomeData?.grossProfit || 0,
          totalExpenses: priorIncomeData?.totalExpenses || 0,
          operatingIncome: priorIncomeData?.operatingIncome || 0,
          netIncome: priorIncomeData?.netIncome || 0,
        },
        cashFlow: {
          operatingActivities: priorCashFlow.operatingActivities,
          investingActivities: priorCashFlow.investingActivities,
          financingActivities: priorCashFlow.financingActivities,
          nonCashActivities: priorCashFlow.nonCashActivities,

          netOperating: priorCashFlow.netOperating,
          netInvesting: priorCashFlow.netInvesting,
          netFinancing: priorCashFlow.netFinancing,
          netChange: priorCashFlow.netChange,
          beginningCash: priorCashFlow.beginningCash,
          endingCash: priorCashFlow.endingCash,
        },
      } : undefined,
      organizationName: organization?.name || 'Organization',
      retainedEarningsOpening,
      priorRetainedEarningsOpening,
      shareCapitalOpening,
      shareCapitalContributions,
      priorShareCapitalOpening,
      priorShareCapitalContributions,
      fixedAssets: buildFixedAssetsNoteData(
        fixedAssets, 
        currentPeriodStart, 
        currentPeriodEnd, 
        priorYearStart, 
        priorYearEnd,
        organization?.fiscal_year_end_month || 12,
        balanceSheet,
        { assets: priorAssets.map(a => ({ name: a.name, calculated_balance: a.calculated_balance, code: a.code })) }
      ),
      leaseNotes: leaseNotes.length > 0 ? leaseNotes : undefined,
    };

    // Legacy format for Word export
    const legacyFinancialData = {
      balanceSheet: { ...balanceSheet, netIncome: incomeStatement.netIncome, reClosingBalance: currentReClosingBalance },
      incomeStatement: { ...incomeStatement, totalCogs: incomeStatement.cogs.reduce((sum, c) => sum + Math.abs(c.calculated_balance), 0) },
      organizationName: organization?.name || 'Organization',
      leaseNotes: leaseNotes.length > 0 ? leaseNotes : undefined,
      retainedEarningsOpening,
      shareCapitalOpening,
      shareCapitalContributions,
    };

    const orgContext = {
      incorporation_jurisdiction: organization?.incorporation_jurisdiction,
      principal_activities: organization?.principal_activities,
    };

    // Fetch latest executive signatures (primary + secondary) + signer settings
    type ExecSlot = {
      signerName: string;
      signerTitle: string;
      secondaryTitle?: string;
      signatureImageUrl?: string | null;
      signedAt?: string | null;
    };
    let executiveSignature: {
      primary?: ExecSlot | null;
      secondary?: ExecSlot | null;
      certificationText?: string;
    } | null = null;
    try {
      const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      if (organization?.id) {
        const { data: sigRows } = await supabase
          .from('executive_statement_signatures')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('statement_type', 'compilation_report')
          .eq('period_start', toDateStr(currentPeriodStart))
          .eq('period_end', toDateStr(currentPeriodEnd))
          .eq('is_latest', true);
        const { data: orgRow } = await supabase
          .from('organizations')
          .select('executive_signer_name, executive_signer_title, executive_signer_secondary_title, executive_signer2_name, executive_signer2_title, executive_signer2_secondary_title')
          .eq('id', organization.id)
          .maybeSingle();
        const orgAny = orgRow as unknown as {
          executive_signer_name?: string | null;
          executive_signer_title?: string | null;
          executive_signer_secondary_title?: string | null;
          executive_signer2_name?: string | null;
          executive_signer2_title?: string | null;
          executive_signer2_secondary_title?: string | null;
        } | null;

        const sigArr = (sigRows || []) as Array<{
          signer_role?: string;
          signer_name: string;
          signer_title: string;
          signature_image_url: string;
          signed_at: string;
          certification_text: string;
        }>;
        const primarySig = sigArr.find((r) => (r.signer_role ?? 'primary') === 'primary');
        const secondarySig = sigArr.find((r) => r.signer_role === 'secondary');

        const primarySlot: ExecSlot | null = primarySig
          ? {
              signerName: primarySig.signer_name,
              signerTitle: primarySig.signer_title,
              secondaryTitle: orgAny?.executive_signer_secondary_title || undefined,
              signatureImageUrl: primarySig.signature_image_url,
              signedAt: primarySig.signed_at,
            }
          : orgAny?.executive_signer_name
            ? {
                signerName: orgAny.executive_signer_name,
                signerTitle: orgAny.executive_signer_title || 'CEO/President',
                secondaryTitle: orgAny.executive_signer_secondary_title || undefined,
              }
            : null;

        const secondarySlot: ExecSlot | null = secondarySig
          ? {
              signerName: secondarySig.signer_name,
              signerTitle: secondarySig.signer_title,
              secondaryTitle: orgAny?.executive_signer2_secondary_title || undefined,
              signatureImageUrl: secondarySig.signature_image_url,
              signedAt: secondarySig.signed_at,
            }
          : orgAny?.executive_signer2_name
            ? {
                signerName: orgAny.executive_signer2_name,
                signerTitle: orgAny.executive_signer2_title || 'CFO/Treasurer',
                secondaryTitle: orgAny.executive_signer2_secondary_title || undefined,
              }
            : null;

        if (primarySlot || secondarySlot) {
          executiveSignature = {
            primary: primarySlot,
            secondary: secondarySlot,
            certificationText:
              primarySig?.certification_text ||
              secondarySig?.certification_text ||
              undefined,
          };
        }
      }
    } catch (e) {
      console.warn('Could not load executive signature for export:', e);
    }


    try {
      if (downloadFormat === 'word') {
        await downloadCompilationWord(compilation, legacyFinancialData, orgContext, executiveSignature);
        toast.success('Word document exported successfully');
      } else if (downloadFormat === 'excel') {
        await downloadCompilationExcel(compilation, comparativeData, {
          hideZeroBalances,
          orgContext,
          executiveSignature,
          retainedEarningsOpening,
          priorRetainedEarningsOpening,
        });
        toast.success('Excel workbook exported successfully');
      } else {
        await generateEnhancedCompilationPDF(compilation, comparativeData, { hideZeroBalances, orgContext, executiveSignature });
        toast.success('PDF exported with comparative layout');
      }
      
      await createAuditEntry.mutateAsync({
        compilation_report_id: compilation.id,
        action: downloadFormat === 'word' ? 'exported_word' : downloadFormat === 'excel' ? 'exported_excel' : 'exported_pdf',
      });

    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export ${downloadFormat.toUpperCase()}`);
    }
  };
  
  // Effect to process pending download when data becomes ready
  useEffect(() => {
    if (pendingDownload && selectedCompilationForDownload && isDataReady) {
      executeDownload(selectedCompilationForDownload, pendingDownload.format, pendingDownload.hideZeroBalances ?? true);
      setPendingDownload(null);
    }
  }, [pendingDownload, selectedCompilationForDownload, isDataReady]);
  
  // Handler to initiate download - sets state to trigger data fetch
  const handleDownloadCompilation = (compilation: CompilationReport, format: 'pdf' | 'word' | 'excel' = 'pdf') => {
    setSelectedCompilationForDownload(compilation);
    setPendingDownload({ format, hideZeroBalances: displayOptions.hideZeroBalances });
  };

  const toggleChecklistItem = (itemId: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  const resetChecklist = () => {
    setCheckedItems({});
    if (organization?.id) {
      localStorage.removeItem(`checklist-${organization.id}`);
    }
  };
  
  const totalChecklistItems = engagementChecklistData.reduce((sum, section) => sum + section.items.length, 0);
  const completedChecklistItems = Object.values(checkedItems).filter(Boolean).length;
  const checklistProgress = (completedChecklistItems / totalChecklistItems) * 100;

  // Check for active finance leases to enforce permanent note
  const hasActiveFinanceLeases = leases.some(l => l.lease_type === 'finance' && l.status === 'active');

  const toggleNote = (noteId: string) => {
    // Prevent deselecting finance_lease when active finance leases exist
    if (noteId === 'finance_lease' && hasActiveFinanceLeases && selectedNotes.includes(noteId)) return;
    setSelectedNotes(prev =>
      prev.includes(noteId) ? prev.filter(n => n !== noteId) : [...prev, noteId]
    );
  };

  // Auto-inject finance_lease into selectedNotes when active finance leases exist
  useEffect(() => {
    if (hasActiveFinanceLeases && !selectedNotes.includes('finance_lease')) {
      setSelectedNotes(prev => [...prev, 'finance_lease']);
    }
  }, [hasActiveFinanceLeases]);

  const resetForm = () => {
    setSelectedYear('2025');
    setReportDate(format(new Date(), 'yyyy-MM-dd'));
    setPreparedBy('');
    setCpaDesignation('CPA');
    const defaultNotes = ['basis', 'revenue', 'inventory'];
    if (hasActiveFinanceLeases && !defaultNotes.includes('finance_lease')) {
      defaultNotes.push('finance_lease');
    }
    setSelectedNotes(defaultNotes);
    setCustomNote('');
  };

  // AI-powered note generation using efinsuite AI
  const generateAINotes = async () => {
    setIsGeneratingAINotes(true);
    try {
      const { data, error } = await supabase.functions.invoke('accounting-assistant', {
        body: {
          prompt: `Generate professional ASPE-compliant notes to financial statements for ${organization?.name || 'the Company'} for the fiscal year ended December 31, ${selectedYear}. 
          
          Based on the following financial data:
          - Total Assets: $${Math.abs(balanceSheet.totalAssets).toLocaleString()}
          - Total Liabilities: $${Math.abs(balanceSheet.totalLiabilities).toLocaleString()}
          - Total Equity: $${Math.abs(balanceSheet.totalEquity).toLocaleString()}
          - Total Revenue: $${Math.abs(incomeStatement.totalRevenue).toLocaleString()}
          - Net Income: $${Math.abs(incomeStatement.netIncome).toLocaleString()}
          
          Generate 2-3 additional relevant notes specific to this company's financial position. Focus on:
          1. Any significant accounting policies not covered by standard templates
          2. Potential going concern considerations if equity is negative
          3. Related party disclosures if applicable
          
          Keep each note concise (2-3 sentences) and professional.`,
        },
      });

      if (error) throw error;

      const aiResponse = data?.response || data?.content || '';
      if (aiResponse) {
        setCustomNote(prev => prev ? `${prev}\n\n${aiResponse}` : aiResponse);
        toast.success('AI notes generated successfully');
      }
    } catch (err) {
      console.error('AI note generation error:', err);
      toast.error('Failed to generate AI notes');
    } finally {
      setIsGeneratingAINotes(false);
    }
  };

  const handleCreateCompilation = async () => {
    const fullPreparedBy = preparedBy ? `${preparedBy}, ${cpaDesignation}` : undefined;
    await createCompilation.mutateAsync({
      fiscal_year: selectedYear,
      fiscal_year_end: `${selectedYear}-12-31`,
      report_date: reportDate,
      prepared_by: fullPreparedBy,
      selected_note_templates: selectedNotes,
      custom_notes: customNote || undefined,
    });
    setCreateDialogOpen(false);
    resetForm();
  };

  const handleEditCompilation = (report: CompilationReport) => {
    setEditingReport(report);
    setSelectedYear(report.fiscal_year);
    setReportDate(report.report_date);
    
    // Parse out the name and designation if stored together
    const preparedByValue = report.prepared_by || '';
    const designations = ['CPA, CA', 'CPA, CGA', 'CPA, CMA', 'CPA, CPA(US)', 'CPA', 'Accountant', 'Bookkeeper'];
    let foundDesignation = 'CPA';
    let foundName = preparedByValue;
    
    for (const designation of designations) {
      if (preparedByValue.endsWith(`, ${designation}`)) {
        foundDesignation = designation;
        foundName = preparedByValue.replace(`, ${designation}`, '');
        break;
      }
    }
    
    setPreparedBy(foundName);
    setCpaDesignation(foundDesignation);
    setSelectedNotes(report.selected_note_templates || []);
    setCustomNote(report.custom_notes || '');
    setEditDialogOpen(true);
  };

  const handleUpdateCompilation = async () => {
    if (!editingReport) return;
    
    const fullPreparedBy = preparedBy ? `${preparedBy}, ${cpaDesignation}` : undefined;
    await updateCompilation.mutateAsync({
      id: editingReport.id,
      prepared_by: fullPreparedBy,
      selected_note_templates: selectedNotes,
      custom_notes: customNote || undefined,
    });
    setEditDialogOpen(false);
    setEditingReport(null);
    resetForm();
  };

  const handleIssueReport = async (id: string) => {
    await issueCompilation.mutateAsync(id);
  };

  const handleDeleteReport = async (id: string) => {
    await deleteCompilation.mutateAsync(id);
  };


  const handleOpenAuditDialog = (compilation: CompilationReport) => {
    setSelectedCompilationForAudit(compilation);
    setAuditDialogOpen(true);
  };

  const getStatusBadge = (status: CompilationReport['status']) => {
    const variants = {
      draft: { variant: 'secondary' as const, icon: Clock, className: 'bg-muted text-muted-foreground' },
      in_progress: { variant: 'default' as const, icon: Clock, className: 'bg-warning/20 text-warning' },
      completed: { variant: 'default' as const, icon: CheckCircle2, className: 'bg-success/20 text-success' },
      issued: { variant: 'default' as const, icon: FileCheck, className: 'bg-primary/20 text-primary' }
    };
    const { icon: Icon, className } = variants[status];
    return (
      <Badge variant="outline" className={`flex items-center gap-1 ${className}`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  const completedCount = compilations.filter(c => c.status === 'completed' || c.status === 'issued').length;
  const completionRate = (completedCount / Math.max(compilations.length, 1)) * 100;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Skeleton className="w-11 h-11 rounded-xl" />
            <div>
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </div>
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const CompilationFormContent = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fiscal-year">Fiscal Year End</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isEdit}>
            <SelectTrigger id="fiscal-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025">December 31, 2025</SelectItem>
              <SelectItem value="2024">December 31, 2024</SelectItem>
              <SelectItem value="2023">December 31, 2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="report-date">Report Date</Label>
          <Input 
            id="report-date"
            type="date" 
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            disabled={isEdit}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <User className="w-4 h-4" />
          CPA / Preparer Information
        </Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input 
              id="prepared-by"
              placeholder="Full Name (e.g., John Smith)"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
            />
          </div>
          <Select value={cpaDesignation} onValueChange={setCpaDesignation}>
            <SelectTrigger>
              <SelectValue placeholder="Designation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CPA">CPA</SelectItem>
              <SelectItem value="CPA, CA">CPA, CA</SelectItem>
              <SelectItem value="CPA, CGA">CPA, CGA</SelectItem>
              <SelectItem value="CPA, CMA">CPA, CMA</SelectItem>
              <SelectItem value="CPA, CPA(US)">CPA, CPA(US)</SelectItem>
              <SelectItem value="Accountant">Accountant</SelectItem>
              <SelectItem value="Bookkeeper">Bookkeeper</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          The preparer's name and designation will appear on the Notice to Reader
        </p>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold">Notes to Financial Statements</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Select the notes to include in the compilation report
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {aspeNoteTemplates.map(note => {
            const isLockedLease = note.id === 'finance_lease' && hasActiveFinanceLeases;
            return (
            <div 
              key={note.id}
              className={`p-3 border rounded-lg transition-colors ${
                isLockedLease
                  ? 'border-primary bg-primary/5 cursor-not-allowed opacity-90'
                  : selectedNotes.includes(note.id) 
                    ? 'border-primary bg-primary/5 cursor-pointer' 
                    : 'hover:bg-muted/50 cursor-pointer'
              }`}
              onClick={() => !isLockedLease && toggleNote(note.id)}
            >
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedNotes.includes(note.id)}
                  onCheckedChange={() => toggleNote(note.id)}
                  disabled={isLockedLease}
                  className="pointer-events-none"
                />
                <span className="font-medium text-sm">{note.title}</span>
                {isLockedLease && (
                  <Badge variant="outline" className="text-xs font-normal text-primary border-primary/30">
                    Required
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6 line-clamp-2">
                {note.template}
              </p>
            </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="custom-notes">Additional Notes (Optional)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateAINotes}
            disabled={isGeneratingAINotes}
            className="gap-2"
          >
            {isGeneratingAINotes ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                AI Suggest Notes
              </>
            )}
          </Button>
        </div>
        <Textarea 
          id="custom-notes"
          placeholder="Add any custom notes or disclosures, or use AI to generate suggestions..."
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          AI-generated notes are based on your financial data and ASPE standards
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accountant Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              ASPE Compilation & Professional Engagement Tools
            </p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Sparkles className="w-4 h-4" />
          AI Compilation Report
        </Button>
        
        <AICompilationDialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetForm();
          }}
          onSubmit={async (input, options) => {
            await createCompilation.mutateAsync(input);
            setDisplayOptions(options);
            setCreateDialogOpen(false);
            resetForm();
          }}
          isSubmitting={createCompilation.isPending}
        />
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingReport(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Compilation Report</DialogTitle>
            <DialogDescription>
              Update the compilation report details
            </DialogDescription>
          </DialogHeader>
          
          <CompilationFormContent isEdit />

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateCompilation} 
              className="gap-2"
              disabled={updateCompilation.isPending}
            >
              <FileCheck className="w-4 h-4" />
              {updateCompilation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-muted/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ScrollText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compilations.length}</p>
                <p className="text-xs text-muted-foreground">Total Compilations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-muted/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <FileCheck className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compilations.filter(c => c.status === 'issued').length}</p>
                <p className="text-xs text-muted-foreground">Issued Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-muted/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{compilations.filter(c => c.status === 'draft' || c.status === 'in_progress').length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-card to-muted/20">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completion Rate</span>
                <span className="text-sm font-semibold">{completionRate.toFixed(0)}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compilations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compilations" className="gap-2">
            <ScrollText className="w-4 h-4" />
            Compilations
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Engagement Checklist
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="w-4 h-4" />
            Note Templates
          </TabsTrigger>
          <TabsTrigger value="practice" className="gap-2" onClick={() => navigate('/reports/practice-management')}>
            <Briefcase className="w-4 h-4" />
            Practice Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compilations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                ASPE Compilation Reports
              </CardTitle>
              <CardDescription>
                Non-audited compilation engagement reports prepared under Canadian ASPE
              </CardDescription>
            </CardHeader>
            <CardContent>
              {compilations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No compilation reports yet</p>
                  <p className="text-sm mt-1">Create your first ASPE compilation report to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {compilations.map(compilation => (
                    <div 
                      key={compilation.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Fiscal Year {compilation.fiscal_year}</span>
                            {getStatusBadge(compilation.status)}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {organization?.name || 'Organization'}
                            </span>
                            {compilation.prepared_by && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {compilation.prepared_by}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Created {format(parseISO(compilation.created_at), 'MMM d, yyyy')}
                            </span>
                            {compilation.issued_at && (
                              <span className="flex items-center gap-1">
                                <FileCheck className="w-3 h-3" />
                                Issued {format(parseISO(compilation.issued_at), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {compilation.status !== 'issued' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditCompilation(compilation)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="gap-1"
                              onClick={() => handleIssueReport(compilation.id)}
                              disabled={issueCompilation.isPending}
                            >
                              <Send className="w-4 h-4" />
                              Issue
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Download className="w-4 h-4" />
                              Export
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadCompilation(compilation, 'pdf')}>
                              <FileText className="w-4 h-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadCompilation(compilation, 'word')}>
                              <FileType className="w-4 h-4 mr-2" />
                              Download Word (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadCompilation(compilation, 'excel')}>
                              <FileSpreadsheet className="w-4 h-4 mr-2" />
                              Download Excel (.xlsx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              handleDownloadCompilation(compilation, 'pdf');
                              setTimeout(() => window.print(), 500);
                            }}>
                              <Printer className="w-4 h-4 mr-2" />
                              Print
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleOpenAuditDialog(compilation)}
                          title="Version History & Audit Trail"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Compilation Report?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the compilation report for fiscal year {compilation.fiscal_year}. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteReport(compilation.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ExecutiveSignatureBlock
            statementType="compilation_report"
            statementTitle="Accountant's Compilation Report"
            periodStart={currentPeriodStart}
            periodEnd={currentPeriodEnd}
          />
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" />
                  Compilation Engagement Checklist
                </CardTitle>
                <CardDescription>
                  CPA Canada recommended procedures for compilation engagements
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium">{completedChecklistItems} of {totalChecklistItems}</div>
                  <div className="text-xs text-muted-foreground">completed</div>
                </div>
                <div className="w-24">
                  <Progress value={checklistProgress} className="h-2" />
                </div>
                {completedChecklistItems > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetChecklist}
                    className="gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {engagementChecklistData.map((section, idx) => {
                  const sectionCompleted = section.items.filter(item => checkedItems[item.id]).length;
                  const sectionTotal = section.items.length;
                  const isComplete = sectionCompleted === sectionTotal;
                  
                  return (
                    <div key={idx} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          {section.section}
                          {isComplete && (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              Complete
                            </Badge>
                          )}
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {sectionCompleted}/{sectionTotal}
                        </span>
                      </div>
                      <div className="space-y-2 ml-1">
                        {section.items.map((item) => (
                          <div 
                            key={item.id} 
                            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50 ${
                              checkedItems[item.id] ? 'bg-success/5' : ''
                            }`}
                            onClick={() => toggleChecklistItem(item.id)}
                          >
                            <Checkbox 
                              id={item.id}
                              checked={!!checkedItems[item.id]}
                              onCheckedChange={() => toggleChecklistItem(item.id)}
                              className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                            />
                            <label 
                              htmlFor={item.id}
                              className={`text-sm cursor-pointer flex-1 ${
                                checkedItems[item.id] ? 'line-through text-muted-foreground' : ''
                              }`}
                            >
                              {item.text}
                            </label>
                            {checkedItems[item.id] && (
                              <Check className="w-4 h-4 text-success" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Note Templates
              </CardTitle>
              <CardDescription>
                Standard note disclosures for financial statements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aspeNoteTemplates.map((note, idx) => (
                  <div key={note.id} className="p-4 border rounded-lg">
                    <h4 className="font-semibold flex items-center gap-2">
                      <span className="text-primary">Note {idx + 1}:</span>
                      {note.title}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-2">{note.template}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports/balance-sheet')}>
              <FileSpreadsheet className="w-5 h-5" />
              <span className="text-xs">Balance Sheet</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports/income-statement')}>
              <FileSpreadsheet className="w-5 h-5" />
              <span className="text-xs">Income Statement</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/trial-balance')}>
              <FileSpreadsheet className="w-5 h-5" />
              <span className="text-xs">Trial Balance</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/reports/management')}>
              <FileSpreadsheet className="w-5 h-5" />
              <span className="text-xs">Management Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit & Version Control Dialog */}
      {selectedCompilationForAudit && (
        <AuditVersionControlDialog
          open={auditDialogOpen}
          onOpenChange={setAuditDialogOpen}
          compilation={selectedCompilationForAudit}
        />
      )}
    </div>
  );
}

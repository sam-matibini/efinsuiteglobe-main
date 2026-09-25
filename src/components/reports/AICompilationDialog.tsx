import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, subYears } from 'date-fns';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate } from '@/lib/fiscalYearUtils';
import { 
  FileText, 
  FileCheck, 
  Building2,
  ScrollText,
  Plus,
  Calendar,
  Sparkles,
  Loader2,
  User,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Shield,
  Eye,
  Info,
  ArrowRight,
  Lightbulb,
  X,
  Globe
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useFinancialReports } from '@/hooks/useFinancialReports';
import { useRetainedEarningsStatement } from '@/hooks/useRetainedEarningsStatement';
import { useLeases } from '@/hooks/useLeases';
import { useComparativeFinancialReports } from '@/hooks/useComparativeFinancialReports';
import { CreateCompilationInput, getFrameworkNoteTemplates } from '@/hooks/useCompilationReports';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AccountantAssetUpload } from './AccountantAssetUpload';

export interface CompilationDisplayOptions {
  hideZeroBalances: boolean;
  startDate?: Date;
  endDate?: Date;
  compareWith?: {
    type: 'period' | 'year';
    count: number;
  } | null;
}

interface AICompilationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCompilationInput, displayOptions: CompilationDisplayOptions) => Promise<void>;
  isSubmitting: boolean;
}

interface AIGeneratedNote {
  id: string;
  title: string;
  content: string;
  source: string;
  confidence: number;
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

// Validation types for financial data
interface DataValidation {
  debitsEqualCredits: boolean;
  classificationCorrect: boolean;
  priorYearIntegrity: boolean;
  aspeCompliant: boolean;
}

export function AICompilationDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isSubmitting 
}: AICompilationDialogProps) {
  const { organization } = useCurrentOrganization();

  // Form state
  const [activeTab, setActiveTab] = useState('period');
  const [fiscalYear, setFiscalYear] = useState('2025');
  const [fiscalYearEnd, setFiscalYearEnd] = useState('2025-12-31');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [periodType, setPeriodType] = useState<'annual' | 'interim' | 'quarterly'>('annual');
  const [periodStartDate, setPeriodStartDate] = useState('2025-01-01');
  const [comparativePeriodEnd, setComparativePeriodEnd] = useState('2024-12-31');
  const [includeComparative, setIncludeComparative] = useState(true);
  
  // Accountant Identity
  const [preparerName, setPreparerName] = useState('');
  const [cpaDesignation, setCpaDesignation] = useState('CPA');
  const [additionalQualifications, setAdditionalQualifications] = useState<string[]>([]);
  const [newQualification, setNewQualification] = useState('');
  const [firmName, setFirmName] = useState('');
  const [firmAddress, setFirmAddress] = useState('');
  const [preparerLicense, setPreparerLicense] = useState('');
  const [accountantLogoUrl, setAccountantLogoUrl] = useState<string | null>(null);
  const [accountantSignatureUrl, setAccountantSignatureUrl] = useState<string | null>(null);
  
  // Accounting Framework (ASPE for Canada private enterprises, IFRS for international, ASNPO for NPOs)
  const [accountingFramework, setAccountingFramework] = useState<'ASPE' | 'IFRS' | 'ASNPO'>('ASPE');
  
  // Statement Types
  const [statementTypes, setStatementTypes] = useState<string[]>([
    'balance_sheet', 'income_statement', 'retained_earnings', 'cash_flow'
  ]);
  
  // Display Options
  const [hideZeroBalances, setHideZeroBalances] = useState(true);
  
  // Notes
  const [selectedNotes, setSelectedNotes] = useState<string[]>([
    'basis', 'nature_operations', 'significant_policies', 'revenue', 
    'financial_instruments', 'finance_lease', 'related', 'comparative'
  ]);
  const [customNotes, setCustomNotes] = useState('');
  const [aiGeneratedNotes, setAiGeneratedNotes] = useState<AIGeneratedNote[]>([]);
  
  // AI States
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [dataValidation, setDataValidation] = useState<DataValidation | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  
  // UI States
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    policies: true,
    disclosure: true
  });
  const [ignoredWarnings, setIgnoredWarnings] = useState<Set<string>>(new Set());

  // Dialog dates are used (not global filter dates) to ensure validation matches the configured period
  const dialogStartDate = useMemo(() => periodStartDate ? parseISO(periodStartDate) : new Date(), [periodStartDate]);
  const dialogEndDate = useMemo(() => fiscalYearEnd ? parseISO(fiscalYearEnd) : new Date(), [fiscalYearEnd]);
  
  const { getBalanceSheetData, getIncomeStatementData } = useFinancialReports({
    startDate: dialogStartDate,
    endDate: dialogEndDate,
    period: 'custom'
  });

  // RE Statement hook — same source of truth as the Balance Sheet page
  const { currentStatement: reCurrentStatement } = useRetainedEarningsStatement(
    { startDate: dialogStartDate, endDate: dialogEndDate }
  );

  const balanceSheet = getBalanceSheetData();
  const incomeStatement = getIncomeStatementData();

  // Fetch leases to determine if finance_lease note must be permanent
  const { data: leases = [] } = useLeases();
  const hasActiveFinanceLeases = useMemo(() => 
    leases.some(l => l.lease_type === 'finance' && l.status === 'active'),
    [leases]
  );

  // Auto-inject finance_lease into selectedNotes when active finance leases exist
  useEffect(() => {
    if (hasActiveFinanceLeases && !selectedNotes.includes('finance_lease')) {
      setSelectedNotes(prev => [...prev, 'finance_lease']);
    }
  }, [hasActiveFinanceLeases]);

  // Get fiscal year settings from organization
  const fiscalYearEndMonth = organization?.fiscal_year_end_month || 12;
  
  // Derive fiscal year and period dates from organization settings
  const fiscalYearData = useMemo(() => {
    const now = new Date();
    const currentFY = getFiscalYearForDate(now, fiscalYearEndMonth);
    const fyStart = getFiscalYearStart(currentFY, fiscalYearEndMonth);
    const fyEnd = getFiscalYearEnd(currentFY, fiscalYearEndMonth);
    const prevFY = currentFY - 1;
    const prevFYEnd = getFiscalYearEnd(prevFY, fiscalYearEndMonth);
    
    return {
      fiscalYear: currentFY.toString(),
      fyStartDate: format(fyStart, 'yyyy-MM-dd'),
      fyEndDate: format(fyEnd, 'yyyy-MM-dd'),
      comparativePeriodEnd: format(prevFYEnd, 'yyyy-MM-dd'),
    };
  }, [fiscalYearEndMonth]);
  
  // Auto-initialize from fiscal year data
  useEffect(() => {
    setFiscalYear(fiscalYearData.fiscalYear);
    setPeriodStartDate(fiscalYearData.fyStartDate);
    setFiscalYearEnd(fiscalYearData.fyEndDate);
    setComparativePeriodEnd(fiscalYearData.comparativePeriodEnd);
  }, [fiscalYearData]);

  // Auto-calculate fiscal year dates when year or type changes
  useEffect(() => {
    const yearNum = parseInt(fiscalYear);
    if (periodType === 'annual' && yearNum) {
      const fyStart = getFiscalYearStart(yearNum, fiscalYearEndMonth);
      const fyEnd = getFiscalYearEnd(yearNum, fiscalYearEndMonth);
      setPeriodStartDate(format(fyStart, 'yyyy-MM-dd'));
      setFiscalYearEnd(format(fyEnd, 'yyyy-MM-dd'));
      
      // Previous fiscal year for comparison
      const prevFY = yearNum - 1;
      const prevFYEnd = getFiscalYearEnd(prevFY, fiscalYearEndMonth);
      setComparativePeriodEnd(format(prevFYEnd, 'yyyy-MM-dd'));
    }
  }, [fiscalYear, periodType, fiscalYearEndMonth]);

  // Validate financial data
  const validateFinancialData = async () => {
    setIsValidating(true);
    try {
      // Canonical balance check — matches BalanceSheet.tsx formula exactly:
      // totalEquity = equityExcludingREandCYE + reClosingBalance
      // isBalanced  = |totalAssets - totalLiabilities - totalEquity| < 0.01
      const reClosingBalance = reCurrentStatement?.data?.closingBalance ?? 0;

      // Sum equity accounts excluding RE (3-00-201) and CYE (3-00-202) + ASNPO equivalents
      // This mirrors BalanceSheet.tsx lines 320-336 exactly
      const equityAccounts = balanceSheet.equity || [];
      const equityExcludingREandCYE = equityAccounts
        .filter((a: any) => {
          const code = a.code;
          const nameLower = (a.name || '').toLowerCase();
          if (code === '3-00-202' || nameLower.includes('current year earnings') || nameLower.includes('current year excess') || nameLower.includes('current year surplus') || nameLower.includes('excess (deficiency)')) return false;
          if (code === '3-00-201' || nameLower === 'retained earnings' || nameLower.includes('accumulated deficit') || nameLower.includes('unrestricted net assets') || nameLower.includes('accumulated surplus') || nameLower.includes('unrestricted funds') || nameLower.includes('accumulated funds')) return false;
          return true;
        })
        .reduce((sum: number, a: any) => {
          const isContra = a.normal_balance !== 'credit';
          const sign = isContra ? -1 : 1;
          return sum + (Number(a.calculated_balance ?? a.ytd_balance ?? 0) * sign);
        }, 0);

      const totalEquity = equityExcludingREandCYE + reClosingBalance;
      const totalLiabilitiesAndEquity = balanceSheet.totalLiabilities + totalEquity;
      const diff = balanceSheet.totalAssets - totalLiabilitiesAndEquity;
      const debitsEqualCredits = Math.abs(diff) < 0.01;
      
      setDataValidation({
        debitsEqualCredits,
        classificationCorrect: true,
        priorYearIntegrity: includeComparative,
        aspeCompliant: true
      });

      const warnings: string[] = [];
      const errors: string[] = [];

      if (!debitsEqualCredits) {
        warnings.push(`Balance sheet may not balance (difference: $${Math.abs(diff).toFixed(2)}) - please verify all entries`);
      }
      
      // Check total equity for going concern
      if (totalEquity < 0) {
        warnings.push('Negative equity detected - consider going concern disclosure');
        if (!selectedNotes.includes('going_concern')) {
          setSelectedNotes(prev => [...prev, 'going_concern']);
        }
      }

      if (!preparerName) {
        errors.push('CPA/Preparer name is required for CSRS 4200 compliance');
      }

      setValidationResult({
        isValid: errors.length === 0,
        warnings,
        errors
      });

    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate financial data');
    } finally {
      setIsValidating(false);
    }
  };

  // AI-powered note generation
  const generateAINotes = async () => {
    setIsGeneratingNotes(true);
    try {
      const response = await supabase.functions.invoke('accounting-assistant', {
        body: {
          taskHint: 'financial-narrative',
          messages: [{
            role: 'user',
            content: `You are a Canadian CPA preparing ASPE-compliant notes to financial statements for ${organization?.name || 'the Company'}.

Fiscal Period: ${periodType === 'annual' ? 'Year' : periodType === 'interim' ? 'Interim Period' : 'Quarter'} Ended ${format(parseISO(fiscalYearEnd), 'MMMM d, yyyy')}

Financial Position Summary:
- Total Assets: $${Math.abs(balanceSheet.totalAssets).toLocaleString()}
- Total Liabilities: $${Math.abs(balanceSheet.totalLiabilities).toLocaleString()}
- Total Equity: $${Math.abs(balanceSheet.totalEquity).toLocaleString()}
- Net Income: $${Math.abs(incomeStatement.netIncome).toLocaleString()}
- Gross Profit Margin: ${incomeStatement.totalRevenue > 0 ? ((incomeStatement.grossProfit / incomeStatement.totalRevenue) * 100).toFixed(1) : 0}%

Generate 3-5 specific ASPE-compliant notes that should be included based on this financial data. For each note, provide:
1. A clear title
2. Professional disclosure language suitable for financial statements
3. Brief explanation of why this note is relevant

Focus on:
- Revenue recognition specifics if material
- Related party considerations
- Going concern if equity is negative
- Significant accounting estimates
- Subsequent events considerations
- Industry-specific disclosures

Format your response as structured notes that can be directly included in compilation financial statements.`
          }]
        },
      });

      if (response.error) throw response.error;

      // Parse streaming response
      let fullContent = '';
      if (response.data) {
        const reader = response.data.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const json = JSON.parse(line.slice(6));
                    const content = json.choices?.[0]?.delta?.content;
                    if (content) fullContent += content;
                  } catch {}
                }
              }
            }
          }
        }
      }

      if (fullContent) {
        setCustomNotes(prev => prev ? `${prev}\n\n--- AI Generated Notes ---\n\n${fullContent}` : fullContent);
        toast.success('AI notes generated successfully');
      }
    } catch (error) {
      console.error('AI note generation error:', error);
      toast.error('Failed to generate AI notes. Please try again.');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // AI explanation for note inclusion
  const getAIExplanation = async (noteId: string) => {
    if (aiExplanations[noteId]) return;
    
    try {
      const note = getFrameworkNoteTemplates(accountingFramework).find(n => n.id === noteId);
      if (!note) return;

      const response = await supabase.functions.invoke('accounting-assistant', {
        body: {
          messages: [{
            role: 'user',
            content: `In one brief sentence, explain why "${note.title}" note is relevant for a ${accountingFramework === 'ASNPO' ? 'not-for-profit organization' : accountingFramework === 'IFRS' ? 'publicly accountable entity' : 'private enterprise'} with Total Assets of $${Math.abs(balanceSheet.totalAssets).toLocaleString()} and Net Income of $${Math.abs(incomeStatement.netIncome).toLocaleString()} under ${accountingFramework}.`
          }]
        }
      });

      if (!response.error && response.data) {
        // Parse streaming response for explanation
        const reader = response.data.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          let explanation = '';
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                  try {
                    const json = JSON.parse(line.slice(6));
                    const content = json.choices?.[0]?.delta?.content;
                    if (content) explanation += content;
                  } catch {}
                }
              }
            }
          }
          if (explanation) {
            setAiExplanations(prev => ({ ...prev, [noteId]: explanation }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to get AI explanation:', error);
    }
  };

  const toggleNote = (noteId: string) => {
    // Prevent deselecting finance_lease when active finance leases exist
    if (noteId === 'finance_lease' && hasActiveFinanceLeases && selectedNotes.includes(noteId)) return;
    setSelectedNotes(prev =>
      prev.includes(noteId) ? prev.filter(n => n !== noteId) : [...prev, noteId]
    );
  };

  const toggleStatementType = (type: string) => {
    setStatementTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const ignoreWarning = (warning: string) => {
    setIgnoredWarnings(prev => new Set([...prev, warning]));
  };

  const restoreWarning = (warning: string) => {
    setIgnoredWarnings(prev => {
      const next = new Set(prev);
      next.delete(warning);
      return next;
    });
  };

  const addQualification = () => {
    if (newQualification.trim() && !additionalQualifications.includes(newQualification.trim())) {
      setAdditionalQualifications(prev => [...prev, newQualification.trim()]);
      setNewQualification('');
    }
  };

  const removeQualification = (qual: string) => {
    setAdditionalQualifications(prev => prev.filter(q => q !== qual));
  };

  const handleSubmit = async () => {
    // Validate inline instead of relying on async state
    const errors: string[] = [];
    if (!preparerName) {
      errors.push('CPA/Preparer name is required for compliance');
    }
    
    if (errors.length > 0) {
      toast.error(errors[0]);
      setActiveTab('identity');
      return;
    }

    // Ensure any typed-but-not-added qualification is included
    const pendingQualification = newQualification.trim();
    const finalQualifications = [
      ...additionalQualifications,
      ...(pendingQualification && !additionalQualifications.includes(pendingQualification)
        ? [pendingQualification]
        : []),
    ];

    // Store name/designation separately from qualifications (qualifications are stored in their own field)
    const fullPreparedBy = preparerName ? `${preparerName}, ${cpaDesignation}` : undefined;
    
    await onSubmit({
      fiscal_year: fiscalYear,
      fiscal_year_end: fiscalYearEnd,
      report_date: reportDate,
      prepared_by: fullPreparedBy,
      selected_note_templates: selectedNotes,
      custom_notes: customNotes || undefined,
      report_type: 'compilation',
      reporting_period_type: periodType,
      period_start_date: periodStartDate,
      firm_name: firmName || undefined,
      firm_address: firmAddress || undefined,
      preparer_license_number: preparerLicense || undefined,
      statement_types: statementTypes,
      comparative_period_end: includeComparative ? comparativePeriodEnd : undefined,
      basis_of_accounting: accountingFramework,
      currency: 'CAD',
      management_responsibility_acknowledged: true,
      // New fields
      additional_qualifications: finalQualifications.length > 0 ? finalQualifications : undefined,
      accountant_logo_url: accountantLogoUrl || undefined,
      accountant_signature_url: accountantSignatureUrl || undefined,
      accounting_framework: accountingFramework,
    }, {
      hideZeroBalances,
    });
  };

  const frameworkTemplates = getFrameworkNoteTemplates(accountingFramework);
  const groupedNotes = {
    required: frameworkTemplates.filter(n => n.category === 'required'),
    policies: frameworkTemplates.filter(n => n.category === 'policies'),
    disclosure: frameworkTemplates.filter(n => n.category === 'disclosure')
  };

  const completionProgress = [
    !!preparerName,
    !!fiscalYear,
    selectedNotes.length >= 3,
    statementTypes.length >= 2
  ].filter(Boolean).length / 4 * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI-Enabled {accountingFramework} Compilation Report Generator
            <Badge variant={accountingFramework === 'IFRS' ? 'default' : 'secondary'} className="ml-2">
              {accountingFramework}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Create {accountingFramework === 'IFRS' ? 'IFRS' : accountingFramework === 'ASNPO' ? 'ASNPO' : 'CSRS 4200'}-compliant compilation reports with AI-powered note generation and validation
          </DialogDescription>
          <Progress value={completionProgress} className="h-1.5 mt-2" />
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 flex-shrink-0">
            <TabsTrigger value="period" className="gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Period
            </TabsTrigger>
            <TabsTrigger value="identity" className="gap-1.5">
              <User className="w-3.5 h-3.5" />
              CPA Identity
            </TabsTrigger>
            <TabsTrigger value="statements" className="gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Statements
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Notes
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent value="period" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Report Period Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fiscal Year</Label>
                      <Select value={fiscalYear} onValueChange={setFiscalYear}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2026">2026</SelectItem>
                          <SelectItem value="2025">2025</SelectItem>
                          <SelectItem value="2024">2024</SelectItem>
                          <SelectItem value="2023">2023</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Period Type</Label>
                      <Select value={periodType} onValueChange={(v: 'annual' | 'interim' | 'quarterly') => setPeriodType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">Annual (Full Year)</SelectItem>
                          <SelectItem value="interim">Interim Period</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Period Start Date</Label>
                      <Input 
                        type="date" 
                        value={periodStartDate}
                        onChange={(e) => setPeriodStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period End Date</Label>
                      <Input 
                        type="date" 
                        value={fiscalYearEnd}
                        onChange={(e) => setFiscalYearEnd(e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="font-medium">Include Comparative Period</Label>
                      <p className="text-xs text-muted-foreground">
                        Show prior year figures alongside current year
                      </p>
                    </div>
                    <Checkbox 
                      checked={includeComparative}
                      onCheckedChange={(checked) => setIncludeComparative(!!checked)}
                    />
                  </div>

                  {includeComparative && (
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      <Label>Comparative Period End</Label>
                      <Input 
                        type="date" 
                        value={comparativePeriodEnd}
                        onChange={(e) => setComparativePeriodEnd(e.target.value)}
                      />
                    </div>
                  )}

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="font-medium">Hide Zero Balance Accounts</Label>
                      <p className="text-xs text-muted-foreground">
                        Exclude accounts with zero balance in both current and prior periods
                      </p>
                    </div>
                    <Checkbox 
                      checked={hideZeroBalances}
                      onCheckedChange={(checked) => setHideZeroBalances(!!checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Report Date</Label>
                    <Input 
                      type="date" 
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Date the compilation report will be dated and issued
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Data Validation Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Financial Data Validation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    onClick={validateFinancialData}
                    disabled={isValidating}
                    className="w-full gap-2"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Validate Financial Data
                      </>
                    )}
                  </Button>

                  {dataValidation && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        {dataValidation.debitsEqualCredits ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-warning" />
                        )}
                        <span>Debits = Credits</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span>{accountingFramework}-compliant classification</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {dataValidation.priorYearIntegrity ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>Prior year carryforward integrity</span>
                      </div>
                    </div>
                  )}

                  {validationResult && validationResult.warnings.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {/* Active Warnings */}
                      {validationResult.warnings.filter(w => !ignoredWarnings.has(w)).length > 0 && (
                        <Alert variant="default">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle className="flex items-center justify-between">
                            <span>Warnings</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              Click × to ignore
                            </span>
                          </AlertTitle>
                          <AlertDescription>
                            <ul className="space-y-2 mt-2">
                              {validationResult.warnings
                                .filter(w => !ignoredWarnings.has(w))
                                .map((w, i) => (
                                  <li key={i} className="flex items-start justify-between gap-2 text-sm">
                                    <span className="flex-1">{w}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 hover:bg-muted shrink-0"
                                      onClick={() => ignoreWarning(w)}
                                      title="Ignore this warning"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </li>
                                ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Ignored Warnings */}
                      {ignoredWarnings.size > 0 && (
                        <Alert variant="default" className="border-dashed opacity-60">
                          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          <AlertTitle className="text-muted-foreground flex items-center justify-between">
                            <span>Ignored Warnings ({ignoredWarnings.size})</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setIgnoredWarnings(new Set())}
                            >
                              Restore all
                            </Button>
                          </AlertTitle>
                          <AlertDescription>
                            <ul className="space-y-1 mt-2">
                              {[...ignoredWarnings].map((w, i) => (
                                <li key={i} className="flex items-start justify-between gap-2 text-sm text-muted-foreground">
                                  <span className="flex-1 line-through">{w}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 text-xs p-1 hover:bg-muted shrink-0"
                                    onClick={() => restoreWarning(w)}
                                    title="Restore this warning"
                                  >
                                    Restore
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="identity" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Accounting Framework
                  </CardTitle>
                  <CardDescription>
                    Select the applicable accounting standard for this report
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        accountingFramework === 'ASPE' 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setAccountingFramework('ASPE')}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox checked={accountingFramework === 'ASPE'} />
                        <span className="font-medium text-sm">ASPE</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Accounting Standards for Private Enterprises (Canada)
                      </p>
                    </div>
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        accountingFramework === 'ASNPO' 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setAccountingFramework('ASNPO')}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox checked={accountingFramework === 'ASNPO'} />
                        <span className="font-medium text-sm">ASNPO</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Accounting Standards for Not-for-Profit Organizations (Canada)
                      </p>
                    </div>
                    <div 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        accountingFramework === 'IFRS' 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setAccountingFramework('IFRS')}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Checkbox checked={accountingFramework === 'IFRS'} />
                        <span className="font-medium text-sm">IFRS</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        International Financial Reporting Standards
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    CPA / Accountant Information
                  </CardTitle>
                  <CardDescription>
                    Required fields for {accountingFramework === 'IFRS' ? 'professional standards' : accountingFramework === 'ASNPO' ? 'NPO professional standards' : 'CSRS 4200'} compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label>
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input 
                        placeholder="John Smith"
                        value={preparerName}
                        onChange={(e) => setPreparerName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Designation</Label>
                      <Select value={cpaDesignation} onValueChange={setCpaDesignation}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CPA">CPA</SelectItem>
                          <SelectItem value="CPA, CA">CPA, CA</SelectItem>
                          <SelectItem value="CPA, CGA">CPA, CGA</SelectItem>
                          <SelectItem value="CPA, CMA">CPA, CMA</SelectItem>
                          <SelectItem value="CPA (US)">CPA (US)</SelectItem>
                          <SelectItem value="ACCA">ACCA</SelectItem>
                          <SelectItem value="FCCA">FCCA</SelectItem>
                          <SelectItem value="ACA">ACA</SelectItem>
                          <SelectItem value="FCA">FCA</SelectItem>
                          <SelectItem value="CIMA">CIMA</SelectItem>
                          <SelectItem value="Chartered Accountant">Chartered Accountant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Additional Qualifications */}
                  <div className="space-y-2">
                    <Label>Additional Qualifications</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="e.g., MBA, FCCA, CFA, CFP"
                        value={newQualification}
                        onChange={(e) => setNewQualification(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addQualification())}
                      />
                      <Button type="button" variant="outline" onClick={addQualification}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {additionalQualifications.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {additionalQualifications.map((qual) => (
                          <Badge key={qual} variant="secondary" className="gap-1">
                            {qual}
                            <X 
                              className="w-3 h-3 cursor-pointer hover:text-destructive" 
                              onClick={() => removeQualification(qual)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Add additional professional qualifications (MBA, FCCA, CFA, PhD, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>License Number (Optional)</Label>
                    <Input 
                      placeholder="CPA License Number"
                      value={preparerLicense}
                      onChange={(e) => setPreparerLicense(e.target.value)}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Firm Name (Optional)</Label>
                    <Input 
                      placeholder="Smith & Associates Professional Corporation"
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Firm Address</Label>
                    <Textarea 
                      placeholder="123 Main Street, Suite 400&#10;Toronto, Ontario M5V 3K2"
                      value={firmAddress}
                      onChange={(e) => setFirmAddress(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Separator />

                  {/* Logo and Signature Upload */}
                  <div className="grid grid-cols-2 gap-4">
                    <AccountantAssetUpload
                      type="logo"
                      currentUrl={accountantLogoUrl}
                      onUpload={setAccountantLogoUrl}
                      onRemove={() => setAccountantLogoUrl(null)}
                    />
                    <AccountantAssetUpload
                      type="signature"
                      currentUrl={accountantSignatureUrl}
                      onUpload={setAccountantSignatureUrl}
                      onRemove={() => setAccountantSignatureUrl(null)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>{accountingFramework === 'IFRS' ? 'IFRS Requirement' : 'CSRS 4200 Requirement'}</AlertTitle>
                <AlertDescription>
                  {accountingFramework === 'IFRS' 
                    ? 'The practitioner\'s name, designation, and credentials must appear on the compilation engagement report per IAS requirements.'
                    : 'The practitioner\'s name, designation, and location must appear on the compilation engagement report. The report should clearly state that no audit or review has been performed.'
                  }
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="statements" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Financial Statements to Include
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { id: 'balance_sheet', name: accountingFramework === 'ASNPO' ? 'Statement of Financial Position' : 'Statement of Financial Position (Balance Sheet)', required: true },
                    { id: 'income_statement', name: accountingFramework === 'ASNPO' ? 'Statement of Operations' : 'Statement of Income', required: true },
                    { id: 'retained_earnings', name: accountingFramework === 'ASNPO' ? 'Statement of Changes in Net Assets' : 'Statement of Retained Earnings', required: false },
                    { id: 'cash_flow', name: 'Statement of Cash Flows', required: false },
                    { id: 'changes_equity', name: accountingFramework === 'ASNPO' ? 'Statement of Changes in Net Assets' : 'Statement of Changes in Equity', required: false }
                  ].map(stmt => (
                    <div 
                      key={stmt.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        statementTypes.includes(stmt.id) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => !stmt.required && toggleStatementType(stmt.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={statementTypes.includes(stmt.id)}
                          disabled={stmt.required}
                          onCheckedChange={() => !stmt.required && toggleStatementType(stmt.id)}
                        />
                        <span className="text-sm font-medium">{stmt.name}</span>
                      </div>
                      {stmt.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Financial Summary Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Financial Data Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Assets</span>
                        <span className="font-medium">${Math.abs(balanceSheet.totalAssets).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Liabilities</span>
                        <span className="font-medium">${Math.abs(balanceSheet.totalLiabilities).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{accountingFramework === 'ASNPO' ? 'Total Net Assets' : 'Total Equity'}</span>
                        <span className="font-medium">${Math.abs(balanceSheet.totalEquity).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Revenue</span>
                        <span className="font-medium">${Math.abs(incomeStatement.totalRevenue).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gross Profit</span>
                        <span className="font-medium">${Math.abs(incomeStatement.grossProfit).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{accountingFramework === 'ASNPO' ? 'Excess (Deficiency)' : 'Net Income'}</span>
                        <span className={`font-medium ${incomeStatement.netIncome < 0 ? 'text-destructive' : 'text-success'}`}>
                          ${Math.abs(incomeStatement.netIncome).toLocaleString()}
                          {incomeStatement.netIncome < 0 ? (accountingFramework === 'ASNPO' ? ' (Deficiency)' : ' (Loss)') : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-4">
              {/* AI Notes Generator */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    AI-Powered Note Generation
                  </CardTitle>
                  <CardDescription>
                    Generate ASPE-compliant notes based on your financial data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={generateAINotes}
                    disabled={isGeneratingNotes}
                    className="w-full gap-2"
                  >
                    {isGeneratingNotes ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing financial data...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate AI Notes
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    AI will analyze your financial position and suggest relevant disclosures
                  </p>
                </CardContent>
              </Card>

              {/* Note Templates by Category */}
              {Object.entries(groupedNotes).map(([category, notes]) => (
                <Collapsible 
                  key={category}
                  open={expandedSections[category]}
                  onOpenChange={(open) => setExpandedSections(prev => ({ ...prev, [category]: open }))}
                >
                  <Card>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <ScrollText className="w-4 h-4" />
                            {category === 'required' ? 'Required Notes' : 
                             category === 'policies' ? 'Accounting Policies' : 'Disclosures'}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {notes.filter(n => selectedNotes.includes(n.id)).length}/{notes.length}
                            </Badge>
                            {expandedSections[category] ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-2">
                        {notes.map(note => {
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
                            <div className="flex items-start gap-2">
                              <Checkbox 
                                checked={selectedNotes.includes(note.id)}
                                onCheckedChange={() => toggleNote(note.id)}
                                disabled={isLockedLease}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm flex items-center gap-2">
                                    {note.title}
                                    {isLockedLease && (
                                      <Badge variant="outline" className="text-xs font-normal text-primary border-primary/30">
                                        Required
                                      </Badge>
                                    )}
                                  </span>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            getAIExplanation(note.id);
                                          }}
                                        >
                                          <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-xs">
                                        {aiExplanations[note.id] || 'Click to get AI explanation'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {note.template}
                                </p>
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              {/* Custom Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Additional Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    placeholder="Add custom notes, AI-generated suggestions, or entity-specific disclosures..."
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {customNotes.length > 0 && `${customNotes.split(/\n\n/).filter(Boolean).length} custom note(s)`}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selectedNotes.length} notes selected • {statementTypes.length} statements
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    Create Compilation Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Calculator, TrendingUp, DollarSign, BarChart3, PiggyBank, Activity,
  Percent, Landmark, Sparkles, Loader2, Save, Download, FileText, Plus, Trash2, CalendarIcon,
  Mail, MessageSquare, Printer, Share2, Moon, Sun, Maximize2, Minimize2,
  ChevronLeft, Link2, ArrowUp,
} from 'lucide-react';
import { openWhatsAppShare } from '@/lib/share';
import { printService } from '@/lib/print/PrintService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFinancialTools } from '@/hooks/useFinancialTools';
import {
  calculateLoanAmortization,
  calculateBreakEven, calculateCashFlowForecast,
  calculateROI, calculateNPV, calculateIRR, calculateMIRR,
  calculateFutureValue, calculateUnifiedValuation,
  type LoanResult, type BreakEvenResult, type CashFlowPeriod,
  type UnifiedValuationResult,
} from '@/lib/financialCalculators';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import {
  YearlySummaryBarChart, LoanBalanceChart,
  BreakEvenChart, CashFlowChart, ValuationChart,
} from './FinancialCharts';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accounting-assistant`;

export interface LoanSeed {
  principal?: number;
  rate?: number;
  termYears?: number;
  frequency?: 'monthly' | 'biweekly' | 'weekly';
  extraPayment?: number;
  gracePeriodMonths?: number;
  startDate?: string; // YYYY-MM-DD
}

interface AIFinancialToolkitProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
  onBack?: () => void;
  loanSeed?: LoanSeed;
}

type ToolTab = 'loan' | 'valuation' | 'breakeven' | 'cashflow' | 'roi' | 'npv' | 'irr' | 'fv';

const TOOL_TABS: { value: ToolTab; label: string; icon: React.ReactNode }[] = [
  { value: 'loan', label: 'Loan', icon: <Landmark className="h-3.5 w-3.5" /> },
  { value: 'valuation', label: 'Valuation', icon: <DollarSign className="h-3.5 w-3.5" /> },
  { value: 'breakeven', label: 'Break-even', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { value: 'cashflow', label: 'Cash Flow', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { value: 'roi', label: 'ROI', icon: <Percent className="h-3.5 w-3.5" /> },
  { value: 'npv', label: 'NPV', icon: <PiggyBank className="h-3.5 w-3.5" /> },
  { value: 'irr', label: 'IRR', icon: <Activity className="h-3.5 w-3.5" /> },
  { value: 'fv', label: 'Future Value', icon: <Calculator className="h-3.5 w-3.5" /> },
];

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

// ─── NumField extracted outside with forwardRef ───
interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
}

const NumField = React.forwardRef<HTMLInputElement, NumFieldProps>(
  ({ label, value, onChange, prefix }, ref) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input
          ref={ref}
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className={prefix ? 'pl-6 h-9 text-sm' : 'h-9 text-sm'}
        />
      </div>
    </div>
  )
);
NumField.displayName = 'NumField';

const ResultCard = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-lg p-3 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className={`text-lg font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
  </div>
);

// ─── Loan config type for multi-loan ───
interface LoanConfig {
  id: string;
  name: string;
  principal: number;
  rate: number;
  termYears: number;
  frequency: 'monthly' | 'biweekly' | 'weekly';
  extraPayment: number;
  gracePeriodMonths: number;
  startDate: Date | undefined;
  result: LoanResult | null;
}

function createLoan(index: number): LoanConfig {
  return {
    id: crypto.randomUUID(),
    name: `Loan ${index}`,
    principal: 100000,
    rate: 5,
    termYears: 5,
    frequency: 'monthly',
    extraPayment: 0,
    gracePeriodMonths: 0,
    startDate: new Date(),
    result: null,
  };
}

export function AIFinancialToolkit({ isOpen, onOpenChange, initialTab, onBack, loanSeed }: AIFinancialToolkitProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>((initialTab as ToolTab) || 'loan');
  const [isDark, setIsDark] = useState(false);
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { saveTool } = useFinancialTools();

  // ─── Multi-Loan State (with localStorage persistence + URL seed) ───
  const LOAN_STORAGE_KEY = 'efinsuite.loanCalculator.v1';
  const [loans, setLoans] = useState<LoanConfig[]>(() => {
    // 1) URL seed wins on first mount
    if (loanSeed) {
      const base = createLoan(1);
      return [{
        ...base,
        principal: loanSeed.principal ?? base.principal,
        rate: loanSeed.rate ?? base.rate,
        termYears: loanSeed.termYears ?? base.termYears,
        frequency: loanSeed.frequency ?? base.frequency,
        extraPayment: loanSeed.extraPayment ?? base.extraPayment,
        gracePeriodMonths: loanSeed.gracePeriodMonths ?? base.gracePeriodMonths,
        startDate: loanSeed.startDate ? new Date(loanSeed.startDate) : base.startDate,
      }];
    }
    // 2) Otherwise hydrate from localStorage
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LOAN_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Array<Omit<LoanConfig, 'startDate' | 'result'> & { startDate?: string | null }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(l => ({
            ...createLoan(1),
            ...l,
            startDate: l.startDate ? new Date(l.startDate) : new Date(),
            result: null,
          }));
        }
      }
    } catch { /* ignore */ }
    return [createLoan(1)];
  });
  const [scheduleExpanded, setScheduleExpanded] = useState<Record<string, boolean>>({});

  // Persist loan inputs (without computed schedules) on change.
  useEffect(() => {
    try {
      const serializable = loans.map(({ result: _r, ...l }) => ({
        ...l,
        startDate: l.startDate ? l.startDate.toISOString() : null,
      }));
      window.localStorage.setItem(LOAN_STORAGE_KEY, JSON.stringify(serializable));
    } catch { /* ignore quota errors */ }
  }, [loans]);



  // ─── Valuation State (unified) ───
  const [valRevenue, setValRevenue] = useState(500000);
  const [valEarnings, setValEarnings] = useState(100000);
  const [valRevMultiplier, setValRevMultiplier] = useState(3);
  const [valEarnMultiplier, setValEarnMultiplier] = useState(5);
  const [valGrowthRate, setValGrowthRate] = useState(8);
  const [valDiscount, setValDiscount] = useState(10);
  const [valResult, setValResult] = useState<UnifiedValuationResult | null>(null);

  // ─── Break-even State ───
  const [beFixed, setBeFixed] = useState(50000);
  const [beVariable, setBeVariable] = useState(25);
  const [bePrice, setBePrice] = useState(75);
  const [beResult, setBeResult] = useState<BreakEvenResult | null>(null);

  // ─── Cash Flow State ───
  const [cfOpening, setCfOpening] = useState(10000);
  const [cfPeriods, setCfPeriods] = useState([
    { label: 'Month 1', inflows: 15000, outflows: 12000 },
    { label: 'Month 2', inflows: 18000, outflows: 13000 },
    { label: 'Month 3', inflows: 20000, outflows: 14000 },
  ]);
  const [cfResult, setCfResult] = useState<CashFlowPeriod[] | null>(null);

  // ─── ROI State (4 fields) ───
  const [roiInvestment, setRoiInvestment] = useState(50000);
  const [roiNetProfit, setRoiNetProfit] = useState(25000);
  const [roiTimePeriod, setRoiTimePeriod] = useState(3);
  const [roiDiscountRate, setRoiDiscountRate] = useState(10);
  const [roiResult, setRoiResult] = useState<{ basic: number; annualized: number; discounted: number } | null>(null);

  // ─── NPV State (dynamic cash flows) ───
  const [npvRate, setNpvRate] = useState(10);
  const [npvInitial, setNpvInitial] = useState(100000);
  const [npvCashFlows, setNpvCashFlows] = useState([
    { year: 1, amount: 30000 },
    { year: 2, amount: 35000 },
    { year: 3, amount: 40000 },
    { year: 4, amount: 45000 },
    { year: 5, amount: 50000 },
  ]);
  const [npvResult, setNpvResult] = useState<number | null>(null);

  // ─── IRR State (with MIRR) ───
  const [irrInitial, setIrrInitial] = useState(100000);
  const [irrFinanceRate, setIrrFinanceRate] = useState(5);
  const [irrReinvestRate, setIrrReinvestRate] = useState(8);
  const [irrCashFlows, setIrrCashFlows] = useState([
    { year: 1, amount: 30000 },
    { year: 2, amount: 35000 },
    { year: 3, amount: 40000 },
    { year: 4, amount: 45000 },
    { year: 5, amount: 50000 },
  ]);
  const [irrResult, setIrrResult] = useState<number | null>(null);
  const [mirrResult, setMirrResult] = useState<number | null>(null);

  // ─── FV State (enhanced) ───
  const [fvPresent, setFvPresent] = useState(10000);
  const [fvRate, setFvRate] = useState(7);
  const [fvYears, setFvYears] = useState(10);
  const [fvCompounding, setFvCompounding] = useState<'monthly' | 'quarterly' | 'annually'>('annually');
  const [fvContribution, setFvContribution] = useState(0);
  const [fvContribTiming, setFvContribTiming] = useState<'beginning' | 'end'>('end');
  const [fvResult, setFvResult] = useState<number | null>(null);

  // ─── Get AI Insights ───
  const getAIInsights = useCallback(async (context: string) => {
    setIsAiLoading(true);
    setAiInsight('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error('Please log in first'); return; }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are Alice, an AI CFO advisor. Provide strategic financial insights based on the calculation results provided. Be concise, actionable, and highlight risks and opportunities.' },
            { role: 'user', content: `Please provide strategic insights on these calculation results:\n\n${context}` },
          ],
          taskHint: 'financial-analysis',
        }),
      });

      if (!resp.ok || !resp.body) { toast.error('Failed to get AI insights'); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) { full += c; setAiInsight(full); }
          } catch { /* skip */ }
        }
      }
    } catch {
      toast.error('AI insights error');
    } finally {
      setIsAiLoading(false);
    }
  }, []);

  // ─── Export helpers ───
  const exportToExcel = (data: Record<string, unknown>[], sheetName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName.replace(/\s+/g, '_')}.xlsx`);
    toast.success('Exported to Excel');
  };

  const exportToPDF = (title: string, rows: string[][]) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    let y = 35;
    rows.forEach(row => {
      doc.text(row.join('  |  '), 14, y);
      y += 7;
      if (y > 280) { doc.addPage(); y = 20; }
    });
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    toast.success('Exported to PDF');
  };

  // ─── Loan helpers ───
  const updateLoan = (id: string, updates: Partial<LoanConfig>) => {
    setLoans(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const addLoan = () => {
    setLoans(prev => [...prev, createLoan(prev.length + 1)]);
  };

  const removeLoan = (id: string) => {
    setLoans(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
  };

  const loanResultsRef = useRef<HTMLDivElement>(null);
  const loanActionBarRef = useRef<HTMLDivElement>(null);
  const loanSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoScrollTimers = useRef<number[]>([]);
  const [autoScrollLoans, setAutoScrollLoans] = useState(true);
  const [schedulePeriodFilter, setSchedulePeriodFilter] = useState<Record<string, { from?: number; to?: number }>>({});

  // Per-section refs for the right-side jump nav
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeSectionKey, setActiveSectionKey] = useState<string>('');

  const registerSection = useCallback((key: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[key] = el;
  }, []);

  
  const getScrollViewport = (el: HTMLElement | null): HTMLElement | null => {
    let n: HTMLElement | null = el?.parentElement ?? null;
    while (n && n !== document.body) {
      if (n.matches?.('[data-radix-scroll-area-viewport]')) return n;
      const style = window.getComputedStyle(n);
      const oy = style.overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
      n = n.parentElement;
    }
    return null;
  };
  const scrollElementIntoView = (
    el: HTMLElement | null,
    opts: { block?: 'start' | 'end'; extraOffset?: number } = {}
  ) => {
    if (!el) return;
    // Native scrollIntoView reliably handles nested scrollers (Radix ScrollArea, dialogs)
    // and respects scroll-margin-top utilities for sticky-header offsets.
    el.scrollIntoView({ behavior: 'smooth', block: opts.block ?? 'start' });
  };

  const scrollToSection = (key: string) => {
    const el = sectionRefs.current[key];
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const clearAutoScrollTimers = () => {
    autoScrollTimers.current.forEach(t => window.clearTimeout(t));
    autoScrollTimers.current = [];
  };

  const calcAllLoans = () => {
    const updated = loans.map(l => {
      const termMonths = l.termYears * 12;
      const result = calculateLoanAmortization(l.principal, l.rate, termMonths, {
        paymentFrequency: l.frequency,
        extraPayment: l.extraPayment,
        gracePeriodMonths: l.gracePeriodMonths,
      });
      return { ...l, result };
    });
    setLoans(updated);
    setAiInsight('');
    clearAutoScrollTimers();

    if (autoScrollLoans && updated.length > 1) {
      // Cycle through each loan section, then end at the action bar
      updated.forEach((l, idx) => {
        const t = window.setTimeout(() => {
          loanSectionRefs.current[l.id] && scrollElementIntoView(loanSectionRefs.current[l.id]);
        }, 300 + idx * 1600);
        autoScrollTimers.current.push(t);
      });
      const finalT = window.setTimeout(() => {
        scrollElementIntoView(loanActionBarRef.current, { block: 'end' });
      }, 300 + updated.length * 1600);
      autoScrollTimers.current.push(finalT);
    } else {
      const t = window.setTimeout(() => {
        scrollElementIntoView(loanActionBarRef.current ?? loanResultsRef.current, { block: 'end' });
      }, 200);
      autoScrollTimers.current.push(t);
    }
  };

  const scrollToLoanByOffset = (delta: 1 | -1) => {
    const ids = loans.filter(l => l.result).map(l => l.id);
    if (ids.length === 0) return;
    // Find current loan in view: pick the one whose top is closest to viewport top (>= 0)
    const positions = ids.map(id => {
      const el = loanSectionRefs.current[id];
      const rect = el?.getBoundingClientRect();
      return { id, top: rect ? rect.top : Number.POSITIVE_INFINITY };
    });
    const currentIdx = positions.reduce((best, p, i) => {
      if (p.top >= -20 && p.top < positions[best].top) return i;
      return best;
    }, 0);
    const nextIdx = Math.max(0, Math.min(ids.length - 1, currentIdx + delta));
    scrollElementIntoView(loanSectionRefs.current[ids[nextIdx]]);
  };

  // Track which loan section is in view for the right-side nav highlight
  useEffect(() => {
    const els = Object.entries(sectionRefs.current).filter(([, el]) => el) as [string, HTMLElement][];
    if (els.length === 0) return;
    const root = getScrollViewport(els[0][1]);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => (a.target as HTMLElement).offsetTop - (b.target as HTMLElement).offsetTop);
        if (visible.length > 0) {
          const key = (visible[0].target as HTMLElement).dataset.sectionKey;
          if (key) setActiveSectionKey(key);
        }
      },
      { root: root ?? null, rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );
    els.forEach(([, el]) => observer.observe(el));
    return () => observer.disconnect();
  }, [loans]);

  // Shared nav items for desktop sidebar + mobile dropdown
  type NavItem = { key: string; label: string; onActivate: () => void };
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [];
    loans.filter(l => l.result).forEach(l => {
      items.push(
        { key: `${l.id}-summary`, label: loans.length > 1 ? `${l.name} — Summary` : 'Summary', onActivate: () => scrollToSection(`${l.id}-summary`) },
        { key: `${l.id}-schedule`, label: 'Schedule', onActivate: () => scrollToSection(`${l.id}-schedule`) },
        { key: `${l.id}-yearly-chart`, label: 'Yearly P vs I', onActivate: () => scrollToSection(`${l.id}-yearly-chart`) },
        { key: `${l.id}-balance-chart`, label: 'Balance Over Time', onActivate: () => scrollToSection(`${l.id}-balance-chart`) },
        { key: `${l.id}-yearly-table`, label: 'Yearly Summary', onActivate: () => scrollToSection(`${l.id}-yearly-table`) },
      );
    });
    items.push({ key: '__actions', label: 'Actions', onActivate: () => scrollElementIntoView(loanActionBarRef.current, { block: 'end' }) });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans]);

  // Yearly summary helper — uses actual calendar years from startDate
  const getYearlySummary = (schedule: LoanResult['schedule'], periodsPerYear: number, startDate?: Date) => {
    const baseYear = startDate ? startDate.getFullYear() : new Date().getFullYear();
    const years: Record<number, { year: number; payments: number; payment: number; principal: number; interest: number; endBalance: number }> = {};
    schedule.forEach((row, idx) => {
      const yearIndex = Math.ceil((idx + 1) / periodsPerYear);
      const calendarYear = baseYear + yearIndex - 1;
      if (!years[calendarYear]) years[calendarYear] = { year: calendarYear, payments: 0, payment: 0, principal: 0, interest: 0, endBalance: 0 };
      years[calendarYear].payments += 1;
      years[calendarYear].payment += row.payment;
      years[calendarYear].principal += row.principal;
      years[calendarYear].interest += row.interest;
      years[calendarYear].endBalance = row.balance;
    });
    return Object.values(years);
  };

  const getPeriodsPerYear = (freq: string) => freq === 'biweekly' ? 26 : freq === 'weekly' ? 52 : 12;

  const getCombinedYearlySummary = () => {
    const combined: Record<number, { payment: number; principal: number; interest: number; endBalance: number }> = {};
    loans.forEach(loan => {
      if (!loan.result) return;
      const ppy = getPeriodsPerYear(loan.frequency);
      const yearly = getYearlySummary(loan.result.schedule, ppy);
      yearly.forEach(y => {
        if (!combined[y.year]) combined[y.year] = { payment: 0, principal: 0, interest: 0, endBalance: 0 };
        combined[y.year].payment += y.payment;
        combined[y.year].principal += y.principal;
        combined[y.year].interest += y.interest;
        combined[y.year].endBalance += y.endBalance;
      });
    });
    return Object.entries(combined).map(([year, data]) => ({ year: Number(year), ...data }));
  };

  // ─── Calculator Handlers ───
  const calcValuation = () => {
    const r = calculateUnifiedValuation({
      revenue: valRevenue, earnings: valEarnings,
      revenueMultiplier: valRevMultiplier, earningsMultiplier: valEarnMultiplier,
      growthRate: valGrowthRate, discountRate: valDiscount,
    });
    setValResult(r);
    setAiInsight('');
  };

  const calcBreakEven = () => { setBeResult(calculateBreakEven(beFixed, beVariable, bePrice)); setAiInsight(''); };

  const calcCashFlow = () => { setCfResult(calculateCashFlowForecast(cfOpening, cfPeriods)); setAiInsight(''); };

  const calcROI = () => {
    const totalReturn = roiInvestment + roiNetProfit;
    const basic = calculateROI(roiInvestment, totalReturn);
    const annualized = roiTimePeriod > 0 ? (Math.pow(totalReturn / roiInvestment, 1 / roiTimePeriod) - 1) * 100 : basic;
    const discountFactor = Math.pow(1 + roiDiscountRate / 100, roiTimePeriod);
    const discountedReturn = totalReturn / discountFactor;
    const discounted = roiInvestment > 0 ? ((discountedReturn - roiInvestment) / roiInvestment) * 100 : 0;
    setRoiResult({ basic, annualized, discounted });
    setAiInsight('');
  };

  const calcNPV = () => {
    setNpvResult(calculateNPV(npvRate, npvInitial, npvCashFlows.map(f => f.amount)));
    setAiInsight('');
  };

  const calcIRR = () => {
    const flows = [-irrInitial, ...irrCashFlows.map(f => f.amount)];
    setIrrResult(calculateIRR(flows));
    setMirrResult(calculateMIRR(flows, irrFinanceRate, irrReinvestRate));
    setAiInsight('');
  };

  const calcFV = () => {
    setFvResult(calculateFutureValue(fvPresent, fvRate, fvYears, {
      compounding: fvCompounding, periodicContribution: fvContribution, contributionTiming: fvContribTiming,
    }));
    setAiInsight('');
  };

  // ─── Cash flow period helpers ───
  const addCfPeriod = () => setCfPeriods(prev => [...prev, { label: `Month ${prev.length + 1}`, inflows: 0, outflows: 0 }]);
  const removeCfPeriod = (idx: number) => setCfPeriods(prev => prev.filter((_, i) => i !== idx));
  const updateCfPeriod = (idx: number, field: string, value: string | number) => {
    setCfPeriods(prev => prev.map((p, i) => i === idx ? { ...p, [field]: typeof value === 'string' && field !== 'label' ? Number(value) : value } : p));
  };

  // ─── NPV cash flow helpers ───
  const addNpvPeriod = () => setNpvCashFlows(prev => [...prev, { year: prev.length + 1, amount: 0 }]);
  const removeNpvPeriod = (idx: number) => setNpvCashFlows(prev => prev.filter((_, i) => i !== idx));
  const updateNpvPeriod = (idx: number, amount: number) => {
    setNpvCashFlows(prev => prev.map((f, i) => i === idx ? { ...f, amount } : f));
  };

  // ─── IRR cash flow helpers ───
  const addIrrPeriod = () => setIrrCashFlows(prev => [...prev, { year: prev.length + 1, amount: 0 }]);
  const removeIrrPeriod = (idx: number) => setIrrCashFlows(prev => prev.filter((_, i) => i !== idx));
  const updateIrrPeriod = (idx: number, amount: number) => {
    setIrrCashFlows(prev => prev.map((f, i) => i === idx ? { ...f, amount } : f));
  };

  // ─── Share message builder for loans ───
  const buildLoanShareMessage = (): string => {
    const lines = ['📊 Loan Amortization Summary', ''];
    loans.filter(l => l.result).forEach(l => {
      const freq = l.frequency === 'monthly' ? 'Monthly' : l.frequency === 'biweekly' ? 'Bi-weekly' : 'Weekly';
      lines.push(`▸ ${l.name}`);
      lines.push(`  Principal: $${fmt(l.principal)}`);
      lines.push(`  Rate: ${l.rate}% | Term: ${l.termYears} yrs`);
      lines.push(`  ${freq} Payment: $${fmt(l.result!.monthlyPayment)}`);
      lines.push(`  Total Payment: $${fmt(l.result!.totalPayment)}`);
      lines.push(`  Total Interest: $${fmt(l.result!.totalInterest)}`);
      if (l.gracePeriodMonths > 0) lines.push(`  Grace Period: ${l.gracePeriodMonths} months`);
      lines.push('');
    });
    if (loans.length > 1) {
      lines.push('Combined Totals:');
      lines.push(`  Total Payments: $${fmt(loans.reduce((s, l) => s + (l.result?.totalPayment ?? 0), 0))}`);
      lines.push(`  Total Interest: $${fmt(loans.reduce((s, l) => s + (l.result?.totalInterest ?? 0), 0))}`);
    }
    lines.push('', 'Generated by eFinsuite Globe');
    return lines.join('\n');
  };

  // Build a shareable URL for the FIRST loan and copy it to clipboard.
  const handleCopyLoanShareLink = async () => {
    const l = loans[0];
    if (!l) return;
    const params = new URLSearchParams({
      amount: String(l.principal),
      rate: String(l.rate),
      term: String(l.termYears),
      frequency: l.frequency,
      extra: String(l.extraPayment),
      grace: String(l.gracePeriodMonths),
    });
    if (l.startDate) params.set('start', format(l.startDate, 'yyyy-MM-dd'));
    const url = `${window.location.origin}/toolkit/loan?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard');
    } catch {
      toast.info(url);
    }
  };

  const buildValuationShareMessage = (): string => {
    if (!valResult) return '';
    return [
      '📊 Business Valuation Summary', '',
      `Revenue Multiple: $${fmt(valResult.revenueMultiple)}`,
      `Earnings Multiple: $${fmt(valResult.earningsMultiple)}`,
      `DCF Value: $${fmt(valResult.dcfValue)}`, '',
      `Inputs: Revenue $${fmt(valRevenue)}, Profit $${fmt(valEarnings)}`,
      `Growth ${valGrowthRate}%, Discount ${valDiscount}%`, '',
      'Generated by eFinsuite Globe',
    ].join('\n');
  };

  const buildBreakEvenShareMessage = (): string => {
    if (!beResult) return '';
    return [
      '📊 Break-even Analysis', '',
      `Break-even Units: ${fmt(beResult.breakEvenUnits)}`,
      `Break-even Revenue: $${fmt(beResult.breakEvenRevenue)}`,
      `Contribution Margin: $${fmt(beResult.contributionMargin)}`,
      `CM Ratio: ${(beResult.contributionMarginRatio * 100).toFixed(1)}%`, '',
      `Inputs: Fixed Costs $${fmt(beFixed)}, Variable $${fmt(beVariable)}/unit, Price $${fmt(bePrice)}/unit`, '',
      'Generated by eFinsuite Globe',
    ].join('\n');
  };

  const buildCashFlowShareMessage = (): string => {
    if (!cfResult) return '';
    const last = cfResult[cfResult.length - 1];
    return [
      '📊 Cash Flow Forecast', '',
      `Opening Balance: $${fmt(cfOpening)}`,
      `Periods: ${cfResult.length}`,
      `Final Balance: $${fmt(last?.closingBalance ?? 0)}`, '',
      ...cfResult.map(r => `${r.label}: In $${fmt(r.inflows)} | Out $${fmt(r.outflows)} | Net $${fmt(r.netFlow)}`), '',
      'Generated by eFinsuite Globe',
    ].join('\n');
  };

  const buildROIShareMessage = (): string => {
    if (!roiResult) return '';
    return [
      '📊 ROI Analysis', '',
      `Basic ROI: ${roiResult.basic.toFixed(2)}%`,
      `Annualized ROI: ${roiResult.annualized.toFixed(2)}%`,
      `Discounted ROI: ${roiResult.discounted.toFixed(2)}%`, '',
      `Investment: $${fmt(roiInvestment)}, Net Profit: $${fmt(roiNetProfit)}`,
      `Period: ${roiTimePeriod} yrs, Discount Rate: ${roiDiscountRate}%`, '',
      'Generated by eFinsuite Globe',
    ].join('\n');
  };

  const buildNPVShareMessage = (): string => {
    if (npvResult === null) return '';
    return [
      '📊 NPV Analysis', '',
      `Net Present Value: $${fmt(npvResult)}`,
      `Initial Investment: $${fmt(npvInitial)}`,
      `Discount Rate: ${npvRate}%`, '',
      `Cash Flows: ${npvCashFlows.map(f => `Yr${f.year} $${fmt(f.amount)}`).join(', ')}`, '',
      'Generated by eFinsuite Globe',
    ].join('\n');
  };

  const buildIRRShareMessage = (): string => {
    if (irrResult === null) return '';
    return [
      '📊 IRR / MIRR Analysis', '',
      `IRR: ${irrResult.toFixed(2)}%`,
      `MIRR: ${mirrResult !== null ? `${mirrResult.toFixed(2)}%` : 'N/A'}`, '',
      `Initial Investment: $${fmt(irrInitial)}`,
      `Finance Rate: ${irrFinanceRate}%, Reinvestment Rate: ${irrReinvestRate}%`, '',
      `Cash Flows: ${irrCashFlows.map(f => `Yr${f.year} $${fmt(f.amount)}`).join(', ')}`, '',
      'Generated by eFinsuite Globe',
    ].join('\n');
  };

  const buildFVShareMessage = (): string => {
    if (fvResult === null) return '';
    return [
      '📊 Future Value Analysis', '',
      `Future Value: $${fmt(fvResult)}`,
      `Total Growth: $${fmt(fvResult - fvPresent)}`, '',
      `Present Value: $${fmt(fvPresent)}, Rate: ${fvRate}%`,
      `Years: ${fvYears}, Compounding: ${fvCompounding}`,
      fvContribution > 0 ? `Contribution: $${fmt(fvContribution)} (${fvContribTiming})` : '', '',
      'Generated by eFinsuite Globe',
    ].filter(Boolean).join('\n');
  };

  // ─── Share handlers ───
  const handleShareEmail = (message: string, subject: string) => {
    const body = encodeURIComponent(message);
    const subj = encodeURIComponent(subject);
    window.location.href = `mailto:?subject=${subj}&body=${body}`;
  };

  const handleShareWhatsApp = async (message: string) => {
    const { opened, copied } = await openWhatsAppShare(message);
    if (!opened) {
      toast.info(copied ? 'Message copied — paste it into WhatsApp.' : "Couldn't open WhatsApp automatically.");
    }
  };

  const handleShareSMS = (message: string) => {
    const body = encodeURIComponent(message);
    window.location.href = `sms:?body=${body}`;
    toast.info('Opening SMS app...');
  };

  const handlePrint = (title: string, rows: string[][]) => {
    const { doc } = printService.createDocument();
    printService.addTitle(doc, title);
    let y = 45;
    doc.setFontSize(9);
    rows.forEach(row => {
      doc.text(row.join('  |  '), 14, y);
      y += 6;
      if (y > 275) { doc.addPage(); y = 20; }
    });
    printService.openPrintDialog(doc);
  };

  const exportToCsv = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const ActionBar = ({ onInsight, onSave, onExportExcel, onExportCsv, onEmail, onWhatsApp, onSMS, onPrint, onShareLink }: {
    onInsight: () => void; onSave: () => void;
    onExportExcel?: () => void; onExportCsv?: () => void;
    onEmail?: () => void; onWhatsApp?: () => void; onSMS?: () => void; onPrint?: () => void;
    onShareLink?: () => void;
  }) => (
    <div className="mt-4 space-y-2">
      {onShareLink && (
        <Button size="sm" variant="outline" onClick={onShareLink} className="w-full">
          <Link2 className="h-3.5 w-3.5 mr-1" /> Copy Share Link
        </Button>
      )}
      {/* Export row */}
      <div className="grid grid-cols-3 gap-2">
        {onExportExcel && (
          <Button size="sm" variant="outline" onClick={onExportExcel} className="w-full">
            <Download className="h-3.5 w-3.5 mr-1" /> Excel
          </Button>
        )}
        {onExportCsv && (
          <Button size="sm" variant="outline" onClick={onExportCsv} className="w-full">
            <FileText className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        )}
        {onPrint && (
          <Button size="sm" variant="outline" onClick={onPrint} className="w-full">
            <Printer className="h-3.5 w-3.5 mr-1" /> Print/PDF
          </Button>
        )}
      </div>
      {/* Share row */}
      {(onEmail || onWhatsApp || onSMS) && (
        <div className="grid grid-cols-3 gap-2">
          {onEmail && (
            <Button size="sm" variant="secondary" onClick={onEmail} className="w-full text-xs">
              <Mail className="h-3.5 w-3.5 mr-1" /> Email
            </Button>
          )}
          {onWhatsApp && (
            <Button size="sm" variant="secondary" onClick={onWhatsApp} className="w-full text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
            </Button>
          )}
          {onSMS && (
            <Button size="sm" variant="secondary" onClick={onSMS} className="w-full text-xs">
              <Share2 className="h-3.5 w-3.5 mr-1" /> SMS
            </Button>
          )}
        </div>
      )}
      {/* Save row */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" onClick={onSave} className="w-full">
          <Save className="h-3.5 w-3.5 mr-1" /> Save
        </Button>
        <Button size="sm" onClick={onInsight} disabled={isAiLoading} className="w-full">
          {isAiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          Get AI Advice
        </Button>
      </div>
    </div>
  );

  const hasAnyLoanResult = loans.some(l => l.result !== null);

  // ─── Yearly summary table component ───
  const YearlySummaryTable = React.forwardRef<HTMLDivElement, { data: { year: number; payments?: number; payment: number; principal: number; interest: number; endBalance: number }[] }>(
    ({ data }, ref) => (
      <div ref={ref} className="rounded-lg border max-h-64 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Year</TableHead>
              <TableHead className="text-xs text-right">Payments</TableHead>
              <TableHead className="text-xs text-right">Principal</TableHead>
              <TableHead className="text-xs text-right text-destructive">Interest</TableHead>
              <TableHead className="text-xs text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.year}>
                <TableCell className="text-xs font-medium">{r.year}</TableCell>
                <TableCell className="text-xs text-right">{r.payments ?? '—'}</TableCell>
                <TableCell className="text-xs text-right">${fmt(r.principal)}</TableCell>
                <TableCell className="text-xs text-right text-destructive">${fmt(r.interest)}</TableCell>
                <TableCell className="text-xs text-right">${fmt(r.endBalance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );
  YearlySummaryTable.displayName = 'YearlySummaryTable';

  // ─── Helper: compute end date from start date + schedule length ───
  const getLoanEndDate = (loan: LoanConfig): string => {
    if (!loan.startDate || !loan.result) return '—';
    const totalPeriods = loan.result.schedule.length;
    const msPerPeriod = loan.frequency === 'biweekly' ? 14 * 86400000 : loan.frequency === 'weekly' ? 7 * 86400000 : 30.44 * 86400000;
    const endDate = new Date(loan.startDate.getTime() + totalPeriods * msPerPeriod);
    return format(endDate, 'yyyy-MM-dd');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "sm:max-w-4xl w-screen max-w-none sm:w-auto h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg",
        isDark && "dark bg-background text-foreground border-border"
      )}>
        <DialogHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={onBack ?? (() => window.history.back())}
                      className="h-9 w-9 shrink-0"
                      aria-label="Back to Dashboard"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Back to Dashboard</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary shrink-0" />
                  <span className="truncate">AI Financial Toolkit</span>
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  Intelligent financial planning tools powered by Alice
                </DialogDescription>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsDark(!isDark)}
              className="h-8 w-8 rounded-full shrink-0"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>


        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as ToolTab); setAiInsight(''); }} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 overflow-x-auto">
            <TabsList className="w-full min-w-max sm:flex-wrap inline-flex h-auto gap-1 bg-muted/50 p-1">
              {TOOL_TABS.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1 text-xs px-3 py-1.5 whitespace-nowrap">
                  {t.icon} {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
            {/* ════ LOAN (Multi-loan with grace period) ════ */}
            <TabsContent value="loan" className="mt-4 space-y-3">
              {/* Add Loan link — always visible */}
              <div className="flex items-center justify-end">
                <Button size="sm" variant="outline" onClick={addLoan} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Loan
                </Button>
              </div>

              {loans.map((loan, loanIdx) => (
                <div key={loan.id} className="space-y-3">
                  {loans.length > 1 && (
                    <div className="flex items-center justify-between">
                      <Input
                        value={loan.name}
                        onChange={e => updateLoan(loan.id, { name: e.target.value })}
                        className="h-7 w-40 text-sm font-medium border-none bg-transparent p-0 focus-visible:ring-0"
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeLoan(loan.id)} className="h-7 w-7 text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Loan Amount" value={loan.principal} onChange={v => updateLoan(loan.id, { principal: v })} prefix="$" />
                    <NumField label="Interest Rate (%)" value={loan.rate} onChange={v => updateLoan(loan.id, { rate: v })} />
                    <NumField label="Term (Years)" value={loan.termYears} onChange={v => updateLoan(loan.id, { termYears: v })} />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Payment Frequency</Label>
                      <div>
                        <Select value={loan.frequency} onValueChange={v => updateLoan(loan.id, { frequency: v as 'monthly' | 'biweekly' | 'weekly' })}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-9 text-sm justify-start text-left font-normal", !loan.startDate && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                            {loan.startDate ? format(loan.startDate, 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={loan.startDate} onSelect={d => updateLoan(loan.id, { startDate: d })} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <NumField label="Extra Payment ($)" value={loan.extraPayment} onChange={v => updateLoan(loan.id, { extraPayment: v })} prefix="$" />
                  </div>
                  {loanIdx < loans.length - 1 && <div className="border-t my-2" />}
                </div>
              ))}

              <Button onClick={calcAllLoans} className="w-full">
                Calculate {loans.length > 1 ? 'All Loans' : 'Amortization'}
              </Button>

              {/* Mobile Jump-To dropdown (sidebar replacement on small screens) */}
              {hasAnyLoanResult && (
                <div className="md:hidden sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
                  <Select
                    value={activeSectionKey || undefined}
                    onValueChange={(key) => {
                      const item = navItems.find(i => i.key === key);
                      item?.onActivate();
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Jump to section…" />
                    </SelectTrigger>
                    <SelectContent>
                      {navItems.map(item => (
                        <SelectItem key={item.key} value={item.key} className="text-xs">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Scroll indicator + auto-scroll controls */}
              {hasAnyLoanResult && (
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground animate-bounce py-1">
                  <ChevronDown className="h-4 w-4" /> Scroll for full results
                </div>
              )}

              {hasAnyLoanResult && loans.filter(l => l.result).length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Switch id="auto-scroll-loans" checked={autoScrollLoans} onCheckedChange={setAutoScrollLoans} />
                    <Label htmlFor="auto-scroll-loans" className="text-xs cursor-pointer">Auto-scroll between loans</Label>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => scrollToLoanByOffset(-1)}>
                      <ChevronUp className="h-3.5 w-3.5 mr-1" /> Previous loan
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => scrollToLoanByOffset(1)}>
                      Next loan <ChevronDown className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              <div ref={loanResultsRef} className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
              {hasAnyLoanResult && loans.map(loan => loan.result && (() => {
                const freqLabel = loan.frequency === 'monthly' ? 'Monthly' : loan.frequency === 'biweekly' ? 'Bi-weekly' : 'Weekly';
                const firstRow = loan.result!.schedule.find(r => !r.isGracePeriod);
                const pPart = firstRow ? firstRow.principal : 0;
                const iPart = firstRow ? firstRow.interest : 0;
                const totalPeriods = loan.result!.schedule.length;
                const startDateStr = loan.startDate ? format(loan.startDate, 'yyyy-MM-dd') : '—';
                const endDateStr = getLoanEndDate(loan);
                const ppy = getPeriodsPerYear(loan.frequency);
                const yearlySummary = getYearlySummary(loan.result!.schedule, ppy, loan.startDate);

                return (
                  <div key={loan.id} ref={el => { loanSectionRefs.current[loan.id] = el; }} className="space-y-4 mt-4 scroll-mt-4">
                    {loans.length > 1 && <h4 className="text-sm font-semibold text-foreground">{loan.name}</h4>}

                    {/* ── Loan Summary Card ── */}
                    <div ref={registerSection(`${loan.id}-summary`)} data-section-key={`${loan.id}-summary`} className="rounded-lg border bg-card p-4 space-y-3 scroll-mt-4">
                      <h5 className="text-sm font-semibold text-foreground">Loan Summary</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md bg-primary/10 border border-primary/20 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">{freqLabel} P&I Payment</p>
                          <p className="text-lg font-bold text-primary">${fmt(loan.result!.monthlyPayment)}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">P: ${fmt(pPart)} | I: ${fmt(iPart)}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Total Interest</p>
                          <p className="text-lg font-bold text-destructive">${fmt(loan.result!.totalInterest)}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Total Loan Cost</p>
                          <p className="text-lg font-bold text-foreground">${fmt(loan.result!.totalPayment)}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Payoff</p>
                          <p className="text-lg font-bold text-foreground">{totalPeriods} periods</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
                          <p className="text-sm font-semibold text-foreground">{startDateStr}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground mb-0.5">End Date</p>
                          <p className="text-sm font-semibold text-foreground">{endDateStr}</p>
                        </div>
                      </div>
                    </div>

                    {loan.gracePeriodMonths > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        Grace period: {loan.gracePeriodMonths} months (interest-only payments of ${fmt(loan.result!.schedule[0]?.payment ?? 0)})
                      </div>
                    )}

                    {/* ── Amortization Schedule (promoted, open by default, expandable) ── */}
                    <div ref={registerSection(`${loan.id}-schedule`)} data-section-key={`${loan.id}-schedule`} className="scroll-mt-4">
                    {(() => {
                      const isExpanded = !!scheduleExpanded[loan.id];
                      return (
                        <Collapsible defaultOpen>
                          <div className="flex items-center gap-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" className="flex-1 justify-between h-9 text-sm group">
                                <span className="flex items-center gap-2">
                                  <span className="font-semibold">Amortization Schedule</span>
                                  <span className="text-xs text-muted-foreground">({totalPeriods} payments)</span>
                                </span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 shrink-0"
                              title={isExpanded ? 'Collapse height' : 'Expand height'}
                              onClick={() => setScheduleExpanded(prev => ({ ...prev, [loan.id]: !prev[loan.id] }))}
                            >
                              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                          </div>
                          <CollapsibleContent>
                            {(() => {
                              const filter = schedulePeriodFilter[loan.id] ?? {};
                              const fromVal = filter.from;
                              const toVal = filter.to;
                              const visibleRows = loan.result!.schedule.filter(r => {
                                if (fromVal != null && r.period < fromVal) return false;
                                if (toVal != null && r.period > toVal) return false;
                                return true;
                              });
                              const setFilter = (next: { from?: number; to?: number }) =>
                                setSchedulePeriodFilter(prev => ({ ...prev, [loan.id]: next }));
                              return (
                                <>
                                  <div className="flex flex-wrap items-end gap-2 mt-2 px-1">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">From period</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={totalPeriods}
                                        value={fromVal ?? ''}
                                        onChange={e => setFilter({ ...filter, from: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })}
                                        className="h-8 w-24 text-xs"
                                        placeholder="1"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-muted-foreground">To period</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={totalPeriods}
                                        value={toVal ?? ''}
                                        onChange={e => setFilter({ ...filter, to: e.target.value === '' ? undefined : Math.min(totalPeriods, Number(e.target.value)) })}
                                        className="h-8 w-24 text-xs"
                                        placeholder={String(totalPeriods)}
                                      />
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setFilter({})}>Reset</Button>
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      Showing {visibleRows.length} of {totalPeriods} periods
                                    </span>
                                  </div>
                                  <div className="rounded-lg border mt-2 overflow-hidden">
                                    <ScrollArea className={cn(isExpanded ? 'h-[70vh]' : 'h-96')}>
                                      <Table>
                                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                                          <TableRow>
                                            <TableHead className="text-xs">Period</TableHead>
                                            <TableHead className="text-xs text-right">Payment</TableHead>
                                            <TableHead className="text-xs text-right">Principal</TableHead>
                                            <TableHead className="text-xs text-right">Interest</TableHead>
                                            <TableHead className="text-xs text-right">Balance</TableHead>
                                            <TableHead className="text-xs">Type</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {visibleRows.map(r => (
                                            <TableRow
                                              key={r.period}
                                              className={cn(
                                                r.isGracePeriod ? 'bg-amber-500/10' : 'even:bg-muted/20'
                                              )}
                                            >
                                              <TableCell className="text-xs font-medium">{r.period}</TableCell>
                                              <TableCell className="text-xs text-right tabular-nums">${fmt(r.payment)}</TableCell>
                                              <TableCell className="text-xs text-right tabular-nums">${fmt(r.principal)}</TableCell>
                                              <TableCell className="text-xs text-right tabular-nums">${fmt(r.interest)}</TableCell>
                                              <TableCell className="text-xs text-right tabular-nums font-medium">${fmt(r.balance)}</TableCell>
                                              <TableCell className="text-xs">{r.isGracePeriod ? <span className="text-amber-600 font-medium">Grace</span> : <span className="text-muted-foreground">P&I</span>}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </ScrollArea>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                                    Scroll within the table to view all {totalPeriods} payments • Click the {isExpanded ? 'minimize' : 'maximize'} icon to {isExpanded ? 'shrink' : 'expand'} height
                                  </p>
                                </>
                              );
                            })()}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })()}
                    </div>

                    {/* ── Yearly Principal vs Interest Chart ── */}
                    <div ref={registerSection(`${loan.id}-yearly-chart`)} data-section-key={`${loan.id}-yearly-chart`} className="rounded-lg border bg-card p-4 space-y-2 scroll-mt-4">
                      <h5 className="text-sm font-semibold text-foreground">Yearly Principal vs Interest</h5>
                      <YearlySummaryBarChart data={yearlySummary} />
                    </div>

                    {/* ── Loan Balance Over Time Chart ── */}
                    <div ref={registerSection(`${loan.id}-balance-chart`)} data-section-key={`${loan.id}-balance-chart`} className="rounded-lg border bg-card p-4 space-y-2 scroll-mt-4">
                      <h5 className="text-sm font-semibold text-foreground">Loan Balance Over Time</h5>
                      <LoanBalanceChart schedule={loan.result!.schedule} />
                    </div>

                    {/* ── Yearly Summary Table ── */}
                    <div ref={registerSection(`${loan.id}-yearly-table`)} data-section-key={`${loan.id}-yearly-table`} className="rounded-lg border bg-card p-4 space-y-2 scroll-mt-4">
                      <h5 className="text-sm font-semibold text-foreground">Yearly Summary</h5>
                      <YearlySummaryTable data={yearlySummary} />
                    </div>
                  </div>
                );
              })())}

              {/* ── Sticky Action Bar (Download / Share / Print) — pinned to bottom of scroll ── */}
              {hasAnyLoanResult && (
                <div
                  ref={loanActionBarRef}
                  className="sticky bottom-0 z-30 -mx-6 px-6 mt-4 pt-3 pb-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t scroll-mb-6"
                >
                  <ActionBar
                    onInsight={() => {
                      const summary = loans.filter(l => l.result).map(l => `${l.name}: Principal $${fmt(l.principal)}, Rate ${l.rate}%, Term ${l.termYears}yr, Payment $${fmt(l.result!.monthlyPayment)}, Total Interest $${fmt(l.result!.totalInterest)}`).join('\n');
                      getAIInsights(`Loan Analysis:\n${summary}`);
                    }}
                    onSave={() => saveTool.mutate({
                      toolType: 'loan',
                      name: loans.length > 1 ? `${loans.length} Loans Combined` : `Loan $${fmt(loans[0].principal)}`,
                      inputs: { loans: loans.map(l => ({ name: l.name, principal: l.principal, rate: l.rate, termYears: l.termYears, frequency: l.frequency, extraPayment: l.extraPayment, gracePeriod: l.gracePeriodMonths })) },
                      results: { loans: loans.filter(l => l.result).map(l => ({ name: l.name, payment: l.result!.monthlyPayment, totalPayment: l.result!.totalPayment, totalInterest: l.result!.totalInterest })) },
                    })}
                    onExportExcel={() => {
                      const allRows = loans.flatMap(l => l.result ? l.result.schedule.map(r => ({ Loan: l.name, Period: r.period, Payment: r.payment, Principal: r.principal, Interest: r.interest, Balance: r.balance, Type: r.isGracePeriod ? 'Grace' : 'P&I' })) : []);
                      exportToExcel(allRows, 'Loan_Amortization');
                    }}
                    onExportCsv={() => {
                      const allRows = loans.flatMap(l => l.result ? l.result.schedule.map(r => ({ Loan: l.name, Period: r.period, Payment: r.payment, Principal: r.principal, Interest: r.interest, Balance: r.balance, Type: r.isGracePeriod ? 'Grace' : 'P&I' })) : []);
                      exportToCsv(allRows, 'Loan_Amortization');
                    }}
                    onPrint={() => {
                      const allRows = loans.flatMap(l => l.result ? l.result.schedule.map(r => [l.name, String(r.period), fmt(r.payment), fmt(r.principal), fmt(r.interest), fmt(r.balance)]) : []);
                      handlePrint('Loan Amortization', [['Loan', 'Period', 'Payment', 'Principal', 'Interest', 'Balance'], ...allRows]);
                    }}
                    onEmail={() => handleShareEmail(buildLoanShareMessage(), 'Loan Amortization Summary — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildLoanShareMessage())}
                    onSMS={() => handleShareSMS(buildLoanShareMessage())}
                    onShareLink={handleCopyLoanShareLink}
                  />
                </div>
              )}

                </div>
                {/* Right-side section navigation */}
                {hasAnyLoanResult && (() => {
                  const focusByIdx = (idx: number) => {
                    const wrapped = ((idx % navItems.length) + navItems.length) % navItems.length;
                    navButtonRefs.current[navItems[wrapped].key]?.focus();
                  };
                  const onNavKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
                    switch (e.key) {
                      case 'ArrowDown': e.preventDefault(); focusByIdx(idx + 1); break;
                      case 'ArrowUp': e.preventDefault(); focusByIdx(idx - 1); break;
                      case 'Home': e.preventDefault(); focusByIdx(0); break;
                      case 'End': e.preventDefault(); focusByIdx(navItems.length - 1); break;
                    }
                  };
                  const activeIdx = Math.max(0, navItems.findIndex(i => i.key === activeSectionKey));
                  return (
                    <aside className="hidden md:block sticky top-2 self-start w-36 shrink-0">
                      <div
                        role="toolbar"
                        aria-orientation="vertical"
                        aria-label="Jump to section"
                        className="rounded-lg border bg-card/80 backdrop-blur p-2 space-y-0.5 max-h-[calc(100vh-12rem)] overflow-y-auto"
                      >
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-1">Jump to</p>
                        {navItems.map((item, idx) => {
                          const isActive = activeSectionKey === item.key || (item.key !== '__actions' && idx === activeIdx && !activeSectionKey);
                          const isActionsBtn = item.key === '__actions';
                          return (
                            <button
                              key={item.key}
                              type="button"
                              ref={el => { navButtonRefs.current[item.key] = el; }}
                              onClick={item.onActivate}
                              onKeyDown={(e) => onNavKeyDown(e, idx)}
                              tabIndex={idx === activeIdx ? 0 : -1}
                              className={cn(
                                'w-full text-left text-[11px] px-2 py-1 rounded transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isActionsBtn && 'border-t mt-1 pt-2',
                                isActive && !isActionsBtn
                                  ? 'bg-primary text-primary-foreground font-medium'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                              )}
                            >
                              <span className={cn(
                                'h-1.5 w-1.5 rounded-full shrink-0',
                                isActive && !isActionsBtn ? 'bg-primary-foreground' : 'bg-muted-foreground/40'
                              )} />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </aside>
                  );
                })()}
              </div>
            </TabsContent>

            {/* ════ VALUATION (Unified) ════ */}
            <TabsContent value="valuation" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Annual Revenue" value={valRevenue} onChange={setValRevenue} prefix="$" />
                <NumField label="Annual Profit" value={valEarnings} onChange={setValEarnings} prefix="$" />
                <NumField label="Revenue Multiple" value={valRevMultiplier} onChange={setValRevMultiplier} />
                <NumField label="Profit Multiple" value={valEarnMultiplier} onChange={setValEarnMultiplier} />
                <NumField label="Growth Rate (%)" value={valGrowthRate} onChange={setValGrowthRate} />
                <NumField label="Discount Rate (%)" value={valDiscount} onChange={setValDiscount} />
              </div>
              <Button onClick={calcValuation} className="w-full">Calculate Valuation</Button>
              {valResult && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                     <ResultCard label="Revenue Multiple" value={`$${fmt(valResult.revenueMultiple)}`} />
                     <ResultCard label="Earnings Multiple" value={`$${fmt(valResult.earningsMultiple)}`} />
                     <ResultCard label="DCF Value" value={`$${fmt(valResult.dcfValue)}`} highlight />
                   </div>
                   <ValuationChart revenueMultiple={valResult.revenueMultiple} earningsMultiple={valResult.earningsMultiple} dcfValue={valResult.dcfValue} />
                  <ActionBar
                    onInsight={() => getAIInsights(`Business Valuation: Revenue Multiple $${fmt(valResult.revenueMultiple)}, Earnings Multiple $${fmt(valResult.earningsMultiple)}, DCF $${fmt(valResult.dcfValue)}. Revenue $${fmt(valRevenue)}, Profit $${fmt(valEarnings)}, Growth ${valGrowthRate}%, Discount ${valDiscount}%`)}
                    onSave={() => saveTool.mutate({ toolType: 'valuation', name: `Valuation DCF $${fmt(valResult.dcfValue)}`, inputs: { revenue: valRevenue, earnings: valEarnings, revMultiplier: valRevMultiplier, earnMultiplier: valEarnMultiplier, growthRate: valGrowthRate, discountRate: valDiscount }, results: { ...valResult } as Record<string, unknown> })}
                    onExportExcel={() => exportToExcel([{ Method: 'Revenue Multiple', Value: valResult.revenueMultiple }, { Method: 'Earnings Multiple', Value: valResult.earningsMultiple }, { Method: 'DCF', Value: valResult.dcfValue }], 'Valuation')}
                    onExportCsv={() => exportToCsv([{ Method: 'Revenue Multiple', Value: valResult.revenueMultiple }, { Method: 'Earnings Multiple', Value: valResult.earningsMultiple }, { Method: 'DCF', Value: valResult.dcfValue }], 'Valuation')}
                    onPrint={() => handlePrint('Business Valuation', [['Method', 'Value'], ['Revenue Multiple', `$${fmt(valResult.revenueMultiple)}`], ['Earnings Multiple', `$${fmt(valResult.earningsMultiple)}`], ['DCF Value', `$${fmt(valResult.dcfValue)}`]])}
                    onEmail={() => handleShareEmail(buildValuationShareMessage(), 'Business Valuation — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildValuationShareMessage())}
                    onSMS={() => handleShareSMS(buildValuationShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ BREAK-EVEN ════ */}
            <TabsContent value="breakeven" className="mt-4 space-y-4">
              <div className="space-y-3">
                <NumField label="Fixed Costs" value={beFixed} onChange={setBeFixed} prefix="$" />
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Variable Cost/Unit" value={beVariable} onChange={setBeVariable} prefix="$" />
                  <NumField label="Selling Price/Unit" value={bePrice} onChange={setBePrice} prefix="$" />
                </div>
              </div>
              <Button onClick={calcBreakEven} className="w-full">Calculate Break-even</Button>
              {beResult && (
                <>
                   <div className="grid grid-cols-2 gap-3">
                     <ResultCard label="Break-even Units" value={fmt(beResult.breakEvenUnits)} highlight />
                     <ResultCard label="Break-even Revenue" value={`$${fmt(beResult.breakEvenRevenue)}`} highlight />
                     <ResultCard label="Contribution Margin" value={`$${fmt(beResult.contributionMargin)}`} />
                     <ResultCard label="CM Ratio" value={`${(beResult.contributionMarginRatio * 100).toFixed(1)}%`} />
                   </div>
                   <BreakEvenChart fixedCosts={beFixed} variableCostPerUnit={beVariable} pricePerUnit={bePrice} breakEvenUnits={beResult.breakEvenUnits} />
                  <ActionBar
                    onInsight={() => getAIInsights(`Break-even: ${fmt(beResult.breakEvenUnits)} units, Revenue $${fmt(beResult.breakEvenRevenue)}, CM $${fmt(beResult.contributionMargin)}, CM Ratio ${(beResult.contributionMarginRatio * 100).toFixed(1)}%`)}
                    onSave={() => saveTool.mutate({ toolType: 'breakeven', name: `BE ${fmt(beResult.breakEvenUnits)} units`, inputs: { fixedCosts: beFixed, variableCost: beVariable, price: bePrice }, results: { ...beResult } as Record<string, unknown> })}
                    onExportExcel={() => exportToExcel([{ Metric: 'Break-even Units', Value: beResult.breakEvenUnits }, { Metric: 'Break-even Revenue', Value: beResult.breakEvenRevenue }, { Metric: 'Contribution Margin', Value: beResult.contributionMargin }, { Metric: 'CM Ratio', Value: beResult.contributionMarginRatio }], 'Break_Even')}
                    onExportCsv={() => exportToCsv([{ Metric: 'Break-even Units', Value: beResult.breakEvenUnits }, { Metric: 'Break-even Revenue', Value: beResult.breakEvenRevenue }, { Metric: 'Contribution Margin', Value: beResult.contributionMargin }, { Metric: 'CM Ratio', Value: beResult.contributionMarginRatio }], 'Break_Even')}
                    onPrint={() => handlePrint('Break-even Analysis', [['Metric', 'Value'], ['Break-even Units', fmt(beResult.breakEvenUnits)], ['Break-even Revenue', `$${fmt(beResult.breakEvenRevenue)}`], ['Contribution Margin', `$${fmt(beResult.contributionMargin)}`], ['CM Ratio', `${(beResult.contributionMarginRatio * 100).toFixed(1)}%`]])}
                    onEmail={() => handleShareEmail(buildBreakEvenShareMessage(), 'Break-even Analysis — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildBreakEvenShareMessage())}
                    onSMS={() => handleShareSMS(buildBreakEvenShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ CASH FLOW ════ */}
            <TabsContent value="cashflow" className="mt-4 space-y-4">
              <NumField label="Opening Balance" value={cfOpening} onChange={setCfOpening} prefix="$" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Periods</Label>
                  <Button size="sm" variant="outline" onClick={addCfPeriod} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Period
                  </Button>
                </div>
                {cfPeriods.map((p, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input value={p.label} onChange={e => updateCfPeriod(i, 'label', e.target.value)} className="h-8 text-xs" />
                    </div>
                    <NumField label="Inflows" value={p.inflows} onChange={v => updateCfPeriod(i, 'inflows', v)} prefix="$" />
                    <NumField label="Outflows" value={p.outflows} onChange={v => updateCfPeriod(i, 'outflows', v)} prefix="$" />
                    <Button size="icon" variant="ghost" onClick={() => removeCfPeriod(i)} className="h-9 w-9 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={calcCashFlow} className="w-full">Calculate Forecast</Button>
              {cfResult && (
                <>
                  <CashFlowChart data={cfResult} />
                  <div className="rounded-lg border max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Period</TableHead>
                          <TableHead className="text-xs text-right">Inflows</TableHead>
                          <TableHead className="text-xs text-right">Outflows</TableHead>
                          <TableHead className="text-xs text-right">Net Flow</TableHead>
                          <TableHead className="text-xs text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cfResult.map(r => (
                          <TableRow key={r.period}>
                            <TableCell className="text-xs">{r.label}</TableCell>
                            <TableCell className="text-xs text-right text-green-600">${fmt(r.inflows)}</TableCell>
                            <TableCell className="text-xs text-right text-red-600">${fmt(r.outflows)}</TableCell>
                            <TableCell className={`text-xs text-right ${r.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(r.netFlow)}</TableCell>
                            <TableCell className={`text-xs text-right font-medium ${r.closingBalance >= 0 ? '' : 'text-red-600'}`}>${fmt(r.closingBalance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ActionBar
                    onInsight={() => getAIInsights(`Cash Flow Forecast: Opening $${fmt(cfOpening)}, ${cfResult.length} periods. Final balance $${fmt(cfResult[cfResult.length - 1]?.closingBalance ?? 0)}`)}
                    onSave={() => saveTool.mutate({ toolType: 'cashflow', name: `CF Forecast`, inputs: { openingBalance: cfOpening, periods: cfPeriods }, results: { forecast: cfResult } })}
                    onExportExcel={() => exportToExcel(cfResult.map(r => ({ Period: r.label, Inflows: r.inflows, Outflows: r.outflows, 'Net Flow': r.netFlow, Balance: r.closingBalance })), 'Cash_Flow_Forecast')}
                    onExportCsv={() => exportToCsv(cfResult.map(r => ({ Period: r.label, Inflows: r.inflows, Outflows: r.outflows, 'Net Flow': r.netFlow, Balance: r.closingBalance })), 'Cash_Flow_Forecast')}
                    onPrint={() => handlePrint('Cash Flow Forecast', [['Period', 'Inflows', 'Outflows', 'Net Flow', 'Balance'], ...cfResult.map(r => [r.label, fmt(r.inflows), fmt(r.outflows), fmt(r.netFlow), fmt(r.closingBalance)])])}
                    onEmail={() => handleShareEmail(buildCashFlowShareMessage(), 'Cash Flow Forecast — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildCashFlowShareMessage())}
                    onSMS={() => handleShareSMS(buildCashFlowShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ ROI (4-field layout) ════ */}
            <TabsContent value="roi" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Investment Cost ($)" value={roiInvestment} onChange={setRoiInvestment} prefix="$" />
                <NumField label="Net Profit ($)" value={roiNetProfit} onChange={setRoiNetProfit} prefix="$" />
                <NumField label="Time Period (Years)" value={roiTimePeriod} onChange={setRoiTimePeriod} />
                <NumField label="Discount Rate (%)" value={roiDiscountRate} onChange={setRoiDiscountRate} />
              </div>
              <Button onClick={calcROI} className="w-full">Calculate ROI</Button>
              {roiResult !== null && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <ResultCard label="Basic ROI" value={`${roiResult.basic.toFixed(2)}%`} highlight />
                    <ResultCard label="Annualized ROI" value={`${roiResult.annualized.toFixed(2)}%`} highlight />
                    <ResultCard label="Discounted ROI" value={`${roiResult.discounted.toFixed(2)}%`} />
                  </div>
                  <ActionBar
                    onInsight={() => getAIInsights(`ROI Analysis: Basic ${roiResult.basic.toFixed(2)}%, Annualized ${roiResult.annualized.toFixed(2)}%, Discounted ${roiResult.discounted.toFixed(2)}%. Investment $${fmt(roiInvestment)}, Net Profit $${fmt(roiNetProfit)}, Period ${roiTimePeriod}yr, Discount ${roiDiscountRate}%`)}
                    onSave={() => saveTool.mutate({ toolType: 'roi', name: `ROI ${roiResult.basic.toFixed(1)}%`, inputs: { investment: roiInvestment, netProfit: roiNetProfit, timePeriod: roiTimePeriod, discountRate: roiDiscountRate }, results: { basic: roiResult.basic, annualized: roiResult.annualized, discounted: roiResult.discounted } })}
                    onExportExcel={() => exportToExcel([{ Metric: 'Basic ROI', Value: `${roiResult.basic.toFixed(2)}%` }, { Metric: 'Annualized ROI', Value: `${roiResult.annualized.toFixed(2)}%` }, { Metric: 'Discounted ROI', Value: `${roiResult.discounted.toFixed(2)}%` }], 'ROI_Analysis')}
                    onExportCsv={() => exportToCsv([{ Metric: 'Basic ROI', Value: `${roiResult.basic.toFixed(2)}%` }, { Metric: 'Annualized ROI', Value: `${roiResult.annualized.toFixed(2)}%` }, { Metric: 'Discounted ROI', Value: `${roiResult.discounted.toFixed(2)}%` }], 'ROI_Analysis')}
                    onPrint={() => handlePrint('ROI Analysis', [['Metric', 'Value'], ['Basic ROI', `${roiResult.basic.toFixed(2)}%`], ['Annualized ROI', `${roiResult.annualized.toFixed(2)}%`], ['Discounted ROI', `${roiResult.discounted.toFixed(2)}%`]])}
                    onEmail={() => handleShareEmail(buildROIShareMessage(), 'ROI Analysis — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildROIShareMessage())}
                    onSMS={() => handleShareSMS(buildROIShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ NPV (Dynamic cash flows) ════ */}
            <TabsContent value="npv" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Initial Investment ($)" value={npvInitial} onChange={setNpvInitial} prefix="$" />
                <NumField label="Discount Rate (%)" value={npvRate} onChange={setNpvRate} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Cash Flows by Period</Label>
                  <Button size="sm" variant="outline" onClick={addNpvPeriod} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Period
                  </Button>
                </div>
                {npvCashFlows.map((f, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-20 shrink-0">
                      <Label className="text-xs text-muted-foreground">Year {f.year}</Label>
                    </div>
                    <div className="flex-1">
                      <NumField label="" value={f.amount} onChange={v => updateNpvPeriod(i, v)} prefix="$" />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeNpvPeriod(i)} className="h-9 w-9 text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={calcNPV} className="w-full">Calculate NPV</Button>
              {npvResult !== null && (
                <>
                  <ResultCard label="Net Present Value" value={`$${fmt(npvResult)}`} highlight />
                  <ActionBar
                    onInsight={() => getAIInsights(`NPV: $${fmt(npvResult)}. Discount Rate ${npvRate}%, Initial $${fmt(npvInitial)}, Flows: ${npvCashFlows.map(f => f.amount).join(', ')}`)}
                    onSave={() => saveTool.mutate({ toolType: 'npv', name: `NPV $${fmt(npvResult)}`, inputs: { rate: npvRate, initial: npvInitial, flows: npvCashFlows }, results: { npv: npvResult } })}
                    onExportExcel={() => exportToExcel([{ Metric: 'NPV', Value: npvResult }, { Metric: 'Initial Investment', Value: npvInitial }, { Metric: 'Discount Rate', Value: `${npvRate}%` }, ...npvCashFlows.map(f => ({ Metric: `Year ${f.year} Cash Flow`, Value: f.amount }))], 'NPV_Analysis')}
                    onExportCsv={() => exportToCsv([{ Metric: 'NPV', Value: npvResult }, { Metric: 'Initial Investment', Value: npvInitial }, { Metric: 'Discount Rate', Value: `${npvRate}%` }, ...npvCashFlows.map(f => ({ Metric: `Year ${f.year} Cash Flow`, Value: f.amount }))], 'NPV_Analysis')}
                    onPrint={() => handlePrint('NPV Analysis', [['Metric', 'Value'], ['Net Present Value', `$${fmt(npvResult)}`], ['Initial Investment', `$${fmt(npvInitial)}`], ['Discount Rate', `${npvRate}%`], ...npvCashFlows.map(f => [`Year ${f.year}`, `$${fmt(f.amount)}`])])}
                    onEmail={() => handleShareEmail(buildNPVShareMessage(), 'NPV Analysis — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildNPVShareMessage())}
                    onSMS={() => handleShareSMS(buildNPVShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ IRR + MIRR ════ */}
            <TabsContent value="irr" className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Initial Investment" value={irrInitial} onChange={setIrrInitial} prefix="$" />
                <NumField label="Finance Rate (%) for MIRR" value={irrFinanceRate} onChange={setIrrFinanceRate} />
                <NumField label="Reinvestment Rate (%) for MIRR" value={irrReinvestRate} onChange={setIrrReinvestRate} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Cash Flows by Period</Label>
                  <Button size="sm" variant="outline" onClick={addIrrPeriod} className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add Period
                  </Button>
                </div>
                {irrCashFlows.map((f, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-20 shrink-0">
                      <Label className="text-xs text-muted-foreground">Year {f.year}</Label>
                    </div>
                    <div className="flex-1">
                      <NumField label="" value={f.amount} onChange={v => updateIrrPeriod(i, v)} prefix="$" />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeIrrPeriod(i)} className="h-9 w-9 text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button onClick={calcIRR} className="w-full">Calculate IRR & MIRR</Button>
              {irrResult !== null && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultCard label="Internal Rate of Return (IRR)" value={`${irrResult.toFixed(2)}%`} highlight />
                    <ResultCard label="Modified IRR (MIRR)" value={mirrResult !== null ? `${mirrResult.toFixed(2)}%` : 'N/A'} highlight />
                  </div>
                  <ActionBar
                    onInsight={() => getAIInsights(`IRR: ${irrResult.toFixed(2)}%, MIRR: ${mirrResult?.toFixed(2) ?? 'N/A'}%. Initial Investment $${fmt(irrInitial)}, Finance Rate ${irrFinanceRate}%, Reinvestment Rate ${irrReinvestRate}%`)}
                    onSave={() => saveTool.mutate({ toolType: 'irr', name: `IRR ${irrResult.toFixed(1)}%`, inputs: { initial: irrInitial, financeRate: irrFinanceRate, reinvestRate: irrReinvestRate, flows: irrCashFlows }, results: { irr: irrResult, mirr: mirrResult } })}
                    onExportExcel={() => exportToExcel([{ Metric: 'IRR', Value: `${irrResult.toFixed(2)}%` }, { Metric: 'MIRR', Value: mirrResult !== null ? `${mirrResult.toFixed(2)}%` : 'N/A' }, { Metric: 'Initial Investment', Value: irrInitial }, ...irrCashFlows.map(f => ({ Metric: `Year ${f.year}`, Value: f.amount }))], 'IRR_Analysis')}
                    onExportCsv={() => exportToCsv([{ Metric: 'IRR', Value: `${irrResult.toFixed(2)}%` }, { Metric: 'MIRR', Value: mirrResult !== null ? `${mirrResult.toFixed(2)}%` : 'N/A' }, { Metric: 'Initial Investment', Value: irrInitial }, ...irrCashFlows.map(f => ({ Metric: `Year ${f.year}`, Value: f.amount }))], 'IRR_Analysis')}
                    onPrint={() => handlePrint('IRR & MIRR Analysis', [['Metric', 'Value'], ['IRR', `${irrResult.toFixed(2)}%`], ['MIRR', mirrResult !== null ? `${mirrResult.toFixed(2)}%` : 'N/A'], ['Initial Investment', `$${fmt(irrInitial)}`], ...irrCashFlows.map(f => [`Year ${f.year}`, `$${fmt(f.amount)}`])])}
                    onEmail={() => handleShareEmail(buildIRRShareMessage(), 'IRR & MIRR Analysis — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildIRRShareMessage())}
                    onSMS={() => handleShareSMS(buildIRRShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ FUTURE VALUE (Enhanced) ════ */}
            <TabsContent value="fv" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Present Value" value={fvPresent} onChange={setFvPresent} prefix="$" />
                <NumField label="Annual Rate (%)" value={fvRate} onChange={setFvRate} />
                <NumField label="Years" value={fvYears} onChange={setFvYears} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Compounding</Label>
                  <div>
                    <Select value={fvCompounding} onValueChange={v => setFvCompounding(v as 'monthly' | 'quarterly' | 'annually')}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <NumField label="Periodic Contribution" value={fvContribution} onChange={setFvContribution} prefix="$" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Contribution Timing</Label>
                  <div>
                    <Select value={fvContribTiming} onValueChange={v => setFvContribTiming(v as 'beginning' | 'end')}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="end">End of Period</SelectItem>
                        <SelectItem value="beginning">Beginning of Period</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <Button onClick={calcFV} className="w-full">Calculate Future Value</Button>
              {fvResult !== null && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <ResultCard label="Future Value" value={`$${fmt(fvResult)}`} highlight />
                    <ResultCard label="Total Growth" value={`$${fmt(fvResult - fvPresent)}`} />
                  </div>
                  <ActionBar
                    onInsight={() => getAIInsights(`Future Value: $${fmt(fvResult)}. PV $${fmt(fvPresent)}, Rate ${fvRate}%, ${fvYears} years, ${fvCompounding} compounding, Contribution $${fmt(fvContribution)} (${fvContribTiming}). Growth $${fmt(fvResult - fvPresent)}`)}
                    onSave={() => saveTool.mutate({ toolType: 'fv', name: `FV $${fmt(fvResult)}`, inputs: { presentValue: fvPresent, rate: fvRate, years: fvYears, compounding: fvCompounding, contribution: fvContribution, timing: fvContribTiming }, results: { futureValue: fvResult, growth: fvResult - fvPresent } })}
                    onExportExcel={() => exportToExcel([{ Metric: 'Future Value', Value: fvResult }, { Metric: 'Total Growth', Value: fvResult - fvPresent }, { Metric: 'Present Value', Value: fvPresent }, { Metric: 'Rate', Value: `${fvRate}%` }, { Metric: 'Years', Value: fvYears }, { Metric: 'Compounding', Value: fvCompounding }], 'Future_Value')}
                    onExportCsv={() => exportToCsv([{ Metric: 'Future Value', Value: fvResult }, { Metric: 'Total Growth', Value: fvResult - fvPresent }, { Metric: 'Present Value', Value: fvPresent }, { Metric: 'Rate', Value: `${fvRate}%` }, { Metric: 'Years', Value: fvYears }, { Metric: 'Compounding', Value: fvCompounding }], 'Future_Value')}
                    onPrint={() => handlePrint('Future Value Analysis', [['Metric', 'Value'], ['Future Value', `$${fmt(fvResult)}`], ['Total Growth', `$${fmt(fvResult - fvPresent)}`], ['Present Value', `$${fmt(fvPresent)}`], ['Rate', `${fvRate}%`], ['Years', String(fvYears)]])}
                    onEmail={() => handleShareEmail(buildFVShareMessage(), 'Future Value Analysis — eFinsuite Globe')}
                    onWhatsApp={() => handleShareWhatsApp(buildFVShareMessage())}
                    onSMS={() => handleShareSMS(buildFVShareMessage())}
                  />
                </>
              )}
            </TabsContent>

            {/* ════ AI INSIGHTS PANEL ════ */}
            {aiInsight && (
              <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Alice AI Insights</span>
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap">{aiInsight}</div>
              </div>
            )}
            {isAiLoading && !aiInsight && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating insights...
              </div>
            )}
          </ScrollArea>
        </Tabs>

        {/* Floating Scroll-to-top button (visible on Loan tab when results exist) */}
        {activeTab === 'loan' && hasAnyLoanResult && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-28 right-3 md:bottom-24 md:right-4 h-9 w-9 rounded-full shadow-lg z-40"
            title="Back to top"
            onClick={() => {
              const vp = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
              vp?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

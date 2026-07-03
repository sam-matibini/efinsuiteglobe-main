import { useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  RefreshCw,
  X,
  Info,
  CalendarClock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isValid, parse, isFuture, isPast, differenceInYears, differenceInDays } from 'date-fns';

// ============= Type Definitions =============

export interface DateValidationIssue {
  rowIndex: number;
  originalValue: string;
  parsedDate: Date | null;
  issue: 'invalid_format' | 'future_date' | 'too_old' | 'inconsistent_format' | 'suspicious_year' | 'outside_range';
  severity: 'error' | 'warning';
  suggestedFix?: string;
  correctedValue?: string;
}

export interface DateValidationConfig {
  maxFutureDays: number;
  maxPastYears: number;
  allowWeekends: boolean;
  expectedDateRange?: {
    start: Date;
    end: Date;
  };
}

export interface StatementDateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateValidationPanelProps {
  sampleData: Record<string, unknown>[];
  dateColumn: string;
  dateFormat: string;
  onDateCorrections: (corrections: Map<number, string>) => void;
  onClose?: () => void;
  statementDateRange?: StatementDateRange;
  onStatementDateRangeChange?: (range: StatementDateRange) => void;
}

// ============= Constants =============

const DATE_PARSE_FORMATS = [
  { format: 'yyyy-MM-dd', label: 'YYYY-MM-DD', regex: /^\d{4}-\d{2}-\d{2}$/ },
  { format: 'dd-MM-yyyy', label: 'DD-MM-YYYY', regex: /^\d{2}-\d{2}-\d{4}$/ },
  { format: 'MM-dd-yyyy', label: 'MM-DD-YYYY', regex: /^\d{2}-\d{2}-\d{4}$/ },
  { format: 'yyyy/MM/dd', label: 'YYYY/MM/DD', regex: /^\d{4}\/\d{2}\/\d{2}$/ },
  { format: 'dd/MM/yyyy', label: 'DD/MM/YYYY', regex: /^\d{2}\/\d{2}\/\d{4}$/ },
  { format: 'MM/dd/yyyy', label: 'MM/DD/YYYY', regex: /^\d{2}\/\d{2}\/\d{4}$/ },
  { format: 'dd.MM.yyyy', label: 'DD.MM.YYYY', regex: /^\d{2}\.\d{2}\.\d{4}$/ },
  { format: 'MMM dd, yyyy', label: 'Mon DD, YYYY', regex: /^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/ },
  { format: 'd MMM yyyy', label: 'D Mon YYYY', regex: /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/ },
];

// Month name to number mapping
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const DEFAULT_VALIDATION_CONFIG: DateValidationConfig = {
  maxFutureDays: 1,
  maxPastYears: 10,
  allowWeekends: true,
};

// ============= Utility Functions =============

function parseMonthName(str: string): number | null {
  const normalized = str.toLowerCase().trim();
  return MONTH_NAMES[normalized] ?? null;
}

function inferYearFromStatementPeriod(
  month: number,
  day: number,
  statementRange?: StatementDateRange
): number {
  // If no statement range, use current year
  if (!statementRange?.startDate && !statementRange?.endDate) {
    return new Date().getFullYear();
  }
  
  const startDate = statementRange.startDate;
  const endDate = statementRange.endDate;
  
  // Use the end date's year as primary reference
  if (endDate) {
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    
    // If statement spans year boundary (e.g., Dec to Jan)
    if (startDate) {
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      
      // Handle year boundary: Dec-Jan or similar
      if (startYear !== endYear) {
        // If parsed month is closer to end of year, use start year
        // If parsed month is closer to start of year, use end year
        if (month >= startMonth) {
          return startYear;
        } else if (month <= endMonth) {
          return endYear;
        }
      }
    }
    
    return endYear;
  }
  
  if (startDate) {
    return startDate.getFullYear();
  }
  
  return new Date().getFullYear();
}

function tryParseDate(
  value: string, 
  formatHint?: string,
  statementRange?: StatementDateRange
): { date: Date | null; detectedFormat: string | null } {
  if (!value || typeof value !== 'string') {
    return { date: null, detectedFormat: null };
  }

  const clean = value.trim();
  
  // First, try to parse dates with month names (e.g., "DEC 6", "Dec 06", "6 Dec")
  const monthNamePatterns = [
    // "DEC 6", "Dec 06", "December 6", "Dec 6, 2024"
    /^([A-Za-z]+)\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?$/,
    // "6 DEC", "06 Dec", "6 December", "6 Dec 2024"
    /^(\d{1,2})\s+([A-Za-z]+)(?:[,\s]+(\d{2,4}))?$/,
    // "6-Dec", "06-DEC", "6-Dec-24"
    /^(\d{1,2})[-\/]([A-Za-z]+)(?:[-\/](\d{2,4}))?$/,
    // "Dec-6", "DEC-06", "Dec-6-24"
    /^([A-Za-z]+)[-\/](\d{1,2})(?:[-\/](\d{2,4}))?$/,
  ];
  
  for (const pattern of monthNamePatterns) {
    const match = clean.match(pattern);
    if (match) {
      const [, g1, g2, g3] = match;
      
      const monthFromG1 = parseMonthName(g1);
      const monthFromG2 = parseMonthName(g2);
      
      let month: number;
      let day: number;
      let year: number;
      
      if (monthFromG1 !== null) {
        month = monthFromG1;
        day = parseInt(g2, 10);
      } else if (monthFromG2 !== null) {
        day = parseInt(g1, 10);
        month = monthFromG2;
      } else {
        continue;
      }
      
      if (g3) {
        year = parseInt(g3, 10);
        if (year < 100) {
          year = year >= 50 ? 1900 + year : 2000 + year;
        }
      } else {
        year = inferYearFromStatementPeriod(month, day, statementRange);
      }
      
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        const date = new Date(year, month - 1, day);
        if (isValid(date) && !isNaN(date.getTime())) {
          return { date, detectedFormat: 'month-name' };
        }
      }
    }
  }
  
  // Try parsing with provided format first
  if (formatHint) {
    const matchingFormat = DATE_PARSE_FORMATS.find(f => 
      f.format.toLowerCase().replace(/[^a-z]/g, '') === formatHint.toLowerCase().replace(/[^a-z]/g, '')
    );
    if (matchingFormat) {
      try {
        const parsed = parse(clean, matchingFormat.format, new Date());
        if (isValid(parsed)) {
          return { date: parsed, detectedFormat: matchingFormat.format };
        }
      } catch {}
    }
  }

  // Try each format
  for (const fmt of DATE_PARSE_FORMATS) {
    if (fmt.regex.test(clean)) {
      try {
        const parsed = parse(clean, fmt.format, new Date());
        if (isValid(parsed)) {
          return { date: parsed, detectedFormat: fmt.format };
        }
      } catch {}
    }
  }

  // Try native Date parsing
  const nativeDate = new Date(clean);
  if (isValid(nativeDate) && !isNaN(nativeDate.getTime())) {
    return { date: nativeDate, detectedFormat: 'native' };
  }

  return { date: null, detectedFormat: null };
}

function validateDate(
  date: Date,
  config: DateValidationConfig,
  statementRange?: StatementDateRange
): { valid: boolean; issues: Array<{ type: DateValidationIssue['issue']; severity: 'error' | 'warning' }> } {
  const issues: Array<{ type: DateValidationIssue['issue']; severity: 'error' | 'warning' }> = [];

  // Check if date is outside statement range (if range is provided)
  if (statementRange?.startDate && statementRange?.endDate) {
    const startTime = statementRange.startDate.getTime();
    const endTime = statementRange.endDate.getTime();
    const dateTime = date.getTime();
    
    if (dateTime < startTime || dateTime > endTime) {
      issues.push({ type: 'outside_range', severity: 'error' });
    }
  }

  // Check for future dates
  if (isFuture(date)) {
    const daysInFuture = differenceInDays(date, new Date());
    if (daysInFuture > config.maxFutureDays) {
      issues.push({ type: 'future_date', severity: 'error' });
    }
  }

  // Check for too old dates
  const yearsAgo = differenceInYears(new Date(), date);
  if (yearsAgo > config.maxPastYears) {
    issues.push({ type: 'too_old', severity: 'warning' });
  }

  // Check for suspicious years (typos like 2204 instead of 2024)
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  if (year > currentYear + 100 || year < 1900) {
    issues.push({ type: 'suspicious_year', severity: 'error' });
  }

  return { valid: issues.length === 0, issues };
}

// ============= Main Component =============

export function DateValidationPanel({
  sampleData,
  dateColumn,
  dateFormat,
  onDateCorrections,
  onClose,
  statementDateRange,
  onStatementDateRangeChange,
}: DateValidationPanelProps) {
  const [validationConfig, setValidationConfig] = useState<DateValidationConfig>(DEFAULT_VALIDATION_CONFIG);
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showOnlyIssues, setShowOnlyIssues] = useState(true);

  // Analyze all dates and find issues
  const validationResults = useMemo(() => {
    const results: DateValidationIssue[] = [];
    const formatCounts = new Map<string, number>();

    sampleData.forEach((row, index) => {
      const rawValue = String(row[dateColumn] ?? '');
      
      // Check if there's a correction for this row
      const correctedValue = corrections.get(index);
      const valueToValidate = correctedValue ?? rawValue;
      
      const { date, detectedFormat } = tryParseDate(valueToValidate, dateFormat, statementDateRange);
      
      if (detectedFormat) {
        formatCounts.set(detectedFormat, (formatCounts.get(detectedFormat) || 0) + 1);
      }

      if (!date) {
        results.push({
          rowIndex: index,
          originalValue: rawValue,
          parsedDate: null,
          issue: 'invalid_format',
          severity: 'error',
          correctedValue,
        });
        return;
      }

      const { issues } = validateDate(date, validationConfig, statementDateRange);
      
      for (const issue of issues) {
        results.push({
          rowIndex: index,
          originalValue: rawValue,
          parsedDate: date,
          issue: issue.type,
          severity: issue.severity,
          suggestedFix: format(date, 'yyyy-MM-dd'),
          correctedValue,
        });
      }
    });

    // Check for inconsistent formats
    if (formatCounts.size > 1) {
      const dominantFormat = [...formatCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0][0];

      sampleData.forEach((row, index) => {
        const rawValue = String(row[dateColumn] ?? '');
        const { detectedFormat } = tryParseDate(rawValue, dateFormat);
        
        if (detectedFormat && detectedFormat !== dominantFormat && !results.some(r => r.rowIndex === index)) {
          results.push({
            rowIndex: index,
            originalValue: rawValue,
            parsedDate: tryParseDate(rawValue, dateFormat).date,
            issue: 'inconsistent_format',
            severity: 'warning',
          });
        }
      });
    }

    return results;
  }, [sampleData, dateColumn, dateFormat, validationConfig, corrections, statementDateRange]);

  // Summary stats
  const stats = useMemo(() => {
    const errors = validationResults.filter(r => r.severity === 'error');
    const warnings = validationResults.filter(r => r.severity === 'warning');
    const corrected = corrections.size;

    return {
      total: sampleData.length,
      errors: errors.length,
      warnings: warnings.length,
      corrected,
      valid: sampleData.length - errors.length - warnings.length,
    };
  }, [validationResults, sampleData.length, corrections.size]);

  // Handle date correction
  const handleCorrection = useCallback((rowIndex: number, newValue: string) => {
    setCorrections(prev => {
      const next = new Map(prev);
      if (newValue.trim()) {
        next.set(rowIndex, newValue);
      } else {
        next.delete(rowIndex);
      }
      return next;
    });
  }, []);

  // Auto-fix suggestion
  const applySuggestedFix = useCallback((issue: DateValidationIssue) => {
    if (issue.suggestedFix) {
      handleCorrection(issue.rowIndex, issue.suggestedFix);
      toast.success('Date corrected');
    }
  }, [handleCorrection]);

  // Fix all fixable dates
  const handleFixAll = useCallback(() => {
    const fixable = validationResults.filter(r => r.suggestedFix && r.issue !== 'invalid_format');
    fixable.forEach(issue => {
      if (issue.suggestedFix) {
        handleCorrection(issue.rowIndex, issue.suggestedFix);
      }
    });
    toast.success(`Fixed ${fixable.length} dates`);
  }, [validationResults, handleCorrection]);

  // Apply all corrections
  const handleApplyCorrections = useCallback(() => {
    onDateCorrections(corrections);
    toast.success(`Applied ${corrections.size} date corrections`);
    onClose?.();
  }, [corrections, onDateCorrections, onClose]);

  // Group issues by type
  const issueGroups = useMemo(() => {
    const groups: Record<DateValidationIssue['issue'], DateValidationIssue[]> = {
      invalid_format: [],
      future_date: [],
      too_old: [],
      inconsistent_format: [],
      suspicious_year: [],
      outside_range: [],
    };

    validationResults.forEach(issue => {
      groups[issue.issue].push(issue);
    });

    return groups;
  }, [validationResults]);

  const getIssueLabel = (issue: DateValidationIssue['issue']) => {
    switch (issue) {
      case 'invalid_format': return 'Invalid Format';
      case 'future_date': return 'Future Date';
      case 'too_old': return 'Too Old';
      case 'inconsistent_format': return 'Inconsistent Format';
      case 'suspicious_year': return 'Suspicious Year';
      case 'outside_range': return 'Outside Statement Range';
    }
  };

  const getIssueIcon = (issue: DateValidationIssue['issue']) => {
    switch (issue) {
      case 'invalid_format': return <AlertTriangle className="h-4 w-4" />;
      case 'future_date': return <CalendarClock className="h-4 w-4" />;
      case 'too_old': return <Clock className="h-4 w-4" />;
      case 'inconsistent_format': return <AlertCircle className="h-4 w-4" />;
      case 'suspicious_year': return <AlertTriangle className="h-4 w-4" />;
      case 'outside_range': return <CalendarClock className="h-4 w-4" />;
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background border-l border-border">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Date Validation</h3>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-lg bg-background">
              <p className="text-lg font-semibold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className={cn(
              "text-center p-2 rounded-lg",
              stats.errors > 0 ? "bg-destructive/10 text-destructive" : "bg-background"
            )}>
              <p className="text-lg font-semibold">{stats.errors}</p>
              <p className="text-[10px] text-muted-foreground">Errors</p>
            </div>
            <div className={cn(
              "text-center p-2 rounded-lg",
              stats.warnings > 0 ? "bg-yellow-500/10 text-yellow-600" : "bg-background"
            )}>
              <p className="text-lg font-semibold">{stats.warnings}</p>
              <p className="text-[10px] text-muted-foreground">Warnings</p>
            </div>
            <div className={cn(
              "text-center p-2 rounded-lg",
              stats.corrected > 0 ? "bg-primary/10 text-primary" : "bg-background"
            )}>
              <p className="text-lg font-semibold">{stats.corrected}</p>
              <p className="text-[10px] text-muted-foreground">Corrected</p>
            </div>
          </div>
        </div>

        {/* Statement Date Range */}
        <Collapsible defaultOpen={true}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-3 border-b border-border hover:bg-muted/50 transition-colors text-left">
              <span className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Statement Date Range
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-3 border-b border-border bg-primary/5">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Set the expected date range for this statement to help identify incorrect dates.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Start Date</Label>
                  <Input
                    type="date"
                    value={statementDateRange?.startDate ? format(statementDateRange.startDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const newDate = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                      onStatementDateRangeChange?.({
                        startDate: newDate,
                        endDate: statementDateRange?.endDate || null,
                      });
                    }}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">End Date</Label>
                  <Input
                    type="date"
                    value={statementDateRange?.endDate ? format(statementDateRange.endDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) => {
                      const newDate = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                      onStatementDateRangeChange?.({
                        startDate: statementDateRange?.startDate || null,
                        endDate: newDate,
                      });
                    }}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
              {statementDateRange?.startDate && statementDateRange?.endDate && (
                <div className="flex items-center gap-2 text-xs text-primary">
                  <Check className="h-3 w-3" />
                  <span>
                    Validating dates between {format(statementDateRange.startDate, 'MMM d, yyyy')} and {format(statementDateRange.endDate, 'MMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Validation Settings */}
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-3 border-b border-border hover:bg-muted/50 transition-colors text-left">
              <span className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Advanced Settings
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-3 border-b border-border bg-muted/20">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Max Future Days</Label>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={validationConfig.maxFutureDays}
                    onChange={(e) => setValidationConfig(prev => ({
                      ...prev,
                      maxFutureDays: parseInt(e.target.value) || 0
                    }))}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Max Past Years</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={validationConfig.maxPastYears}
                    onChange={(e) => setValidationConfig(prev => ({
                      ...prev,
                      maxPastYears: parseInt(e.target.value) || 10
                    }))}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-issues-only"
              checked={showOnlyIssues}
              onCheckedChange={(c) => setShowOnlyIssues(!!c)}
            />
            <Label htmlFor="show-issues-only" className="text-xs cursor-pointer">
              Show issues only
            </Label>
          </div>
          <div className="flex-1" />
          {validationResults.some(r => r.suggestedFix) && (
            <Button variant="outline" size="sm" onClick={handleFixAll}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Auto-fix All
            </Button>
          )}
        </div>

        {/* Issues List */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {validationResults.length === 0 ? (
              <div className="text-center py-8">
                <Check className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-sm font-medium text-green-600">All dates are valid!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No issues detected in {sampleData.length} transaction dates
                </p>
              </div>
            ) : (
              Object.entries(issueGroups).map(([issueType, issues]) => {
                if (issues.length === 0) return null;
                
                return (
                  <Collapsible key={issueType} defaultOpen={issues.some(i => i.severity === 'error')}>
                    <CollapsibleTrigger asChild>
                      <button className={cn(
                        "flex items-center justify-between w-full p-3 rounded-lg transition-colors text-left",
                        issues[0]?.severity === 'error' 
                          ? "bg-destructive/10 hover:bg-destructive/15 text-destructive"
                          : "bg-yellow-500/10 hover:bg-yellow-500/15 text-yellow-600"
                      )}>
                        <div className="flex items-center gap-2">
                          {getIssueIcon(issueType as DateValidationIssue['issue'])}
                          <span className="text-sm font-medium">
                            {getIssueLabel(issueType as DateValidationIssue['issue'])}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {issues.length}
                          </Badge>
                        </div>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {issues.map((issue) => {
                        const isExpanded = expandedRow === issue.rowIndex;
                        const hasCorrectionApplied = corrections.has(issue.rowIndex);
                        
                        return (
                          <div
                            key={issue.rowIndex}
                            className={cn(
                              "p-3 rounded-lg border transition-colors",
                              hasCorrectionApplied 
                                ? "border-green-500/50 bg-green-500/5"
                                : issue.severity === 'error'
                                  ? "border-destructive/30 bg-destructive/5"
                                  : "border-yellow-500/30 bg-yellow-500/5"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-[10px]">
                                    Row {issue.rowIndex + 1}
                                  </Badge>
                                  {hasCorrectionApplied && (
                                    <Badge className="text-[10px] bg-green-500">
                                      <Check className="h-3 w-3 mr-1" />
                                      Corrected
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <code className={cn(
                                    "px-2 py-0.5 rounded text-xs",
                                    hasCorrectionApplied 
                                      ? "bg-muted line-through text-muted-foreground"
                                      : "bg-muted"
                                  )}>
                                    {issue.originalValue}
                                  </code>
                                  {hasCorrectionApplied && (
                                    <>
                                      <span className="text-muted-foreground">→</span>
                                      <code className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-700">
                                        {corrections.get(issue.rowIndex)}
                                      </code>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {issue.suggestedFix && !hasCorrectionApplied && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => applySuggestedFix(issue)}
                                      >
                                        <Check className="h-4 w-4 text-green-600" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Apply fix: {issue.suggestedFix}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setExpandedRow(isExpanded ? null : issue.rowIndex)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {hasCorrectionApplied && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleCorrection(issue.rowIndex, '')}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t border-border">
                                <Label className="text-xs mb-1 block">Enter correct date:</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="date"
                                    value={corrections.get(issue.rowIndex) || ''}
                                    onChange={(e) => handleCorrection(issue.rowIndex, e.target.value)}
                                    className="h-8 flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setExpandedRow(null)}
                                  >
                                    Done
                                  </Button>
                                </div>
                                {issue.parsedDate && (
                                  <p className="text-[10px] text-muted-foreground mt-2">
                                    Parsed as: {format(issue.parsedDate, 'PPP')}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {corrections.size > 0 
              ? `${corrections.size} correction${corrections.size !== 1 ? 's' : ''} pending`
              : 'No corrections pending'
            }
          </p>
          <div className="flex items-center gap-2">
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleApplyCorrections}
              disabled={corrections.size === 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Apply Corrections
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

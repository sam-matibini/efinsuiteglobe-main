import { useState, useMemo, useCallback, useRef, useEffect, DragEvent } from 'react';
import { 
  Plus, X, ChevronDown, ChevronRight, Search, GripVertical, 
  AlertTriangle, Check, Wand2, Save, FileText, RefreshCw,
  Calendar, Hash, Type, DollarSign, Building2, CreditCard,
  Eye, EyeOff, Info, ChevronUp, Filter, Settings2, 
  Sparkles, BookOpen, Zap, Brain, Sliders, CalendarCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableColumnSelect } from './SearchableColumnSelect';
import { DateValidationPanel, StatementDateRange } from './DateValidationPanel';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ============= Type Definitions =============

export type DateFormat = 
  | 'yyyy-mm-dd' 
  | 'dd-mm-yyyy' 
  | 'mm-dd-yyyy' 
  | 'yyyy/mm/dd' 
  | 'dd/mm/yyyy'
  | 'mm/dd/yyyy'
  | 'auto';

export type NumberFormat = 
  | 'standard'           // -250.00
  | 'accounting'         // (250.00)
  | 'european'           // 1.250,00
  | 'space-separated'    // 1 250.00
  | 'auto';

export type TransformType = 
  | 'none' 
  | 'trim' 
  | 'uppercase' 
  | 'lowercase' 
  | 'abs' 
  | 'negate'
  | 'date'
  | 'number'
  | 'currency';

export interface ColumnMappingAdvanced {
  id: string;
  sourceColumn: string;
  targetField: string;
  transform: TransformType;
  dateFormat?: DateFormat;
  numberFormat?: NumberFormat;
  invertSign?: boolean;
  treatBracketsAsNegative?: boolean;
  defaultValue?: string;
  isRequired?: boolean;
  aiConfidence?: number;
  aiSuggested?: boolean;
  validationErrors?: string[];
}

export interface MappingGroup {
  id: string;
  name: string;
  icon: React.ReactNode;
  fields: TargetField[];
  collapsed?: boolean;
}

export interface TargetField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'amount';
  required?: boolean;
  description?: string;
  group: string;
}

export interface MappingTemplate {
  id: string;
  name: string;
  statementType: 'bank' | 'creditcard';
  bankName?: string;
  mappings: ColumnMappingAdvanced[];
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  invertSign: boolean;
  treatBracketsAsNegative: boolean;
  createdAt: string;
  updatedAt: string;
  organizationId?: string;
}

export interface ParsePreview {
  original: string;
  parsed: string | number | Date | null;
  isValid: boolean;
  error?: string;
}

interface AdvancedMappingEngineProps {
  sourceColumns: string[];
  sampleData: Record<string, unknown>[];
  statementType: 'bank' | 'creditcard';
  onMappingsChange: (mappings: ColumnMappingAdvanced[]) => void;
  onComplete: (config: MappingConfig) => void;
  onCancel: () => void;
  existingTemplates?: MappingTemplate[];
  onSaveTemplate?: (template: MappingTemplate) => void;
  initialTemplateId?: string;
}

export interface MappingConfig {
  mappings: ColumnMappingAdvanced[];
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  invertSign: boolean;
  treatBracketsAsNegative: boolean;
}

// ============= Constants =============

const DATE_FORMATS: { value: DateFormat; label: string; example: string }[] = [
  { value: 'auto', label: 'Auto-detect', example: 'AI detects format' },
  { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD', example: '2024-01-15' },
  { value: 'dd-mm-yyyy', label: 'DD-MM-YYYY', example: '15-01-2024' },
  { value: 'mm-dd-yyyy', label: 'MM-DD-YYYY', example: '01-15-2024' },
  { value: 'yyyy/mm/dd', label: 'YYYY/MM/DD', example: '2024/01/15' },
  { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY', example: '15/01/2024' },
  { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY', example: '01/15/2024' },
];

const NUMBER_FORMATS: { value: NumberFormat; label: string; example: string }[] = [
  { value: 'auto', label: 'Auto-detect', example: 'AI detects format' },
  { value: 'standard', label: 'Standard', example: '-1,250.00' },
  { value: 'accounting', label: 'Accounting (brackets)', example: '(1,250.00)' },
  { value: 'european', label: 'European', example: '-1.250,00' },
  { value: 'space-separated', label: 'Space separated', example: '-1 250,00' },
];

const BANK_TARGET_FIELDS: TargetField[] = [
  { id: 'transaction_date', label: 'Transaction Date', type: 'date', required: true, group: 'dates', description: 'Date when transaction occurred' },
  { id: 'posting_date', label: 'Posting Date', type: 'date', group: 'dates', description: 'Date when transaction was posted' },
  { id: 'description', label: 'Description', type: 'string', required: true, group: 'transaction', description: 'Transaction description or narrative' },
  { id: 'payee_payor', label: 'Payee/Payor', type: 'string', group: 'transaction', description: 'Name of payee or payor' },
  { id: 'reference', label: 'Reference/ID', type: 'string', group: 'transaction', description: 'Transaction reference number' },
  { id: 'amount', label: 'Amount', type: 'amount', group: 'amounts', description: 'Single amount column (+ or -)' },
  { id: 'debit', label: 'Debit', type: 'amount', group: 'amounts', description: 'Debit amount (money out)' },
  { id: 'credit', label: 'Credit', type: 'amount', group: 'amounts', description: 'Credit amount (money in)' },
  { id: 'balance', label: 'Balance', type: 'amount', group: 'amounts', description: 'Running balance' },
  { id: 'category', label: 'Category', type: 'string', group: 'advanced', description: 'Transaction category' },
  { id: 'memo', label: 'Memo/Notes', type: 'string', group: 'advanced', description: 'Additional notes' },
  { id: 'check_number', label: 'Check Number', type: 'string', group: 'advanced', description: 'Check number if applicable' },
];

const CREDIT_CARD_TARGET_FIELDS: TargetField[] = [
  { id: 'transaction_date', label: 'Transaction Date', type: 'date', required: true, group: 'dates', description: 'Date when transaction occurred' },
  { id: 'posted_date', label: 'Posted Date', type: 'date', group: 'dates', description: 'Date when transaction was posted' },
  { id: 'description', label: 'Description', type: 'string', required: true, group: 'transaction', description: 'Transaction description' },
  { id: 'payee_payor', label: 'Payee/Payor', type: 'string', group: 'transaction', description: 'Payee or payor name' },
  { id: 'reference', label: 'Reference', type: 'string', group: 'transaction', description: 'Transaction reference' },
  { id: 'amount', label: 'Amount', type: 'amount', group: 'amounts', description: 'Transaction amount' },
  { id: 'debit', label: 'Charges', type: 'amount', group: 'amounts', description: 'Charges / purchases (money out of card)' },
  { id: 'credit', label: 'Payments / Credits', type: 'amount', group: 'amounts', description: 'Payments and refunds into the card (reduce balance)' },
  { id: 'merchant_category_code', label: 'MCC', type: 'string', group: 'advanced', description: 'Merchant category code' },
  { id: 'category', label: 'Category', type: 'string', group: 'advanced', description: 'Transaction category' },
  { id: 'memo', label: 'Memo', type: 'string', group: 'advanced', description: 'Additional notes' },
  { id: 'foreign_amount', label: 'Foreign Amount', type: 'amount', group: 'advanced', description: 'Amount in foreign currency' },
  { id: 'foreign_currency', label: 'Foreign Currency', type: 'string', group: 'advanced', description: 'Foreign currency code' },
];

const MAPPING_GROUPS = (statementType: 'bank' | 'creditcard'): MappingGroup[] => [
  {
    id: 'transaction',
    name: 'Transaction Fields',
    icon: <FileText className="h-4 w-4" />,
    fields: (statementType === 'bank' ? BANK_TARGET_FIELDS : CREDIT_CARD_TARGET_FIELDS)
      .filter(f => f.group === 'transaction'),
  },
  {
    id: 'amounts',
    name: 'Amount & Balance',
    icon: <DollarSign className="h-4 w-4" />,
    fields: (statementType === 'bank' ? BANK_TARGET_FIELDS : CREDIT_CARD_TARGET_FIELDS)
      .filter(f => f.group === 'amounts'),
  },
  {
    id: 'dates',
    name: 'Dates & Formats',
    icon: <Calendar className="h-4 w-4" />,
    fields: (statementType === 'bank' ? BANK_TARGET_FIELDS : CREDIT_CARD_TARGET_FIELDS)
      .filter(f => f.group === 'dates'),
  },
  {
    id: 'ai_rules',
    name: 'AI Rules & Overrides',
    icon: <Brain className="h-4 w-4" />,
    fields: [], // Dynamic - populated from AI suggestions
  },
  {
    id: 'advanced',
    name: 'Advanced Accounting Rules',
    icon: <Sliders className="h-4 w-4" />,
    fields: (statementType === 'bank' ? BANK_TARGET_FIELDS : CREDIT_CARD_TARGET_FIELDS)
      .filter(f => f.group === 'advanced'),
  },
];

// ============= Utility Functions =============

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[_\s-]/g, '');
  const s2 = str2.toLowerCase().replace(/[_\s-]/g, '');
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Levenshtein-based similarity
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  const costs: number[] = [];
  for (let i = 0; i <= shorter.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= longer.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (shorter.charAt(i - 1) !== longer.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[longer.length] = lastValue;
  }
  
  return (longer.length - costs[longer.length]) / longer.length;
}

function detectDateFormat(value: string): DateFormat {
  const patterns: { pattern: RegExp; format: DateFormat }[] = [
    { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'yyyy-mm-dd' },
    { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'dd-mm-yyyy' },
    { pattern: /^\d{4}\/\d{2}\/\d{2}$/, format: 'yyyy/mm/dd' },
    { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'dd/mm/yyyy' },
  ];
  
  for (const { pattern, format } of patterns) {
    if (pattern.test(value)) return format;
  }
  
  return 'auto';
}

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

function excelSerialToDate(serial: number): Date | null {
  if (!isFinite(serial) || serial < 10000 || serial > 80000) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function parseDate(
  value: unknown,
  format: DateFormat,
  statementRange?: StatementDateRange
): { date: Date | null; parsed: string } {
  if (value === null || value === undefined || value === '') return { date: null, parsed: '' };

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return { date: null, parsed: '' };
    return { date: value, parsed: value.toISOString().split('T')[0] };
  }

  if (typeof value === 'number') {
    const d = excelSerialToDate(value);
    return d ? { date: d, parsed: d.toISOString().split('T')[0] } : { date: null, parsed: '' };
  }

  if (typeof value !== 'string') return { date: null, parsed: '' };

  
  const clean = value.trim();
  if (!clean) return { date: null, parsed: '' };

  // Numeric string that looks like an Excel serial
  if (/^\d+(\.\d+)?$/.test(clean)) {
    const n = parseFloat(clean);
    const d = excelSerialToDate(n);
    if (d) return { date: d, parsed: d.toISOString().split('T')[0] };
  }

  let day: number = 0, month: number = 0, year: number = 0;
  let yearMissing = false;

  
  try {
    // First, try to parse dates with month names (e.g., "DEC 6", "Dec 06", "6 Dec", "December 6")
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
        // Determine which group is month vs day
        const [, g1, g2, g3] = match;
        
        const monthFromG1 = parseMonthName(g1);
        const monthFromG2 = parseMonthName(g2);
        
        if (monthFromG1 !== null) {
          // Pattern: Month Day [Year]
          month = monthFromG1;
          day = parseInt(g2, 10);
        } else if (monthFromG2 !== null) {
          // Pattern: Day Month [Year]
          day = parseInt(g1, 10);
          month = monthFromG2;
        } else {
          continue; // Neither is a valid month name
        }
        
        // Handle year
        if (g3) {
          year = parseInt(g3, 10);
          // Handle 2-digit years
          if (year < 100) {
            year = year >= 50 ? 1900 + year : 2000 + year;
          }
        } else {
          // No year provided - infer from statement period
          yearMissing = true;
          year = inferYearFromStatementPeriod(month, day, statementRange);
        }
        
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            return { date, parsed: date.toISOString().split('T')[0] };
          }
        }
      }
    }
    
    // Standard date parsing with separators
    const parts = clean.split(/[-\/\.]/);
    if (parts.length !== 3) {
      // Try parsing as ISO or native date
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return { date: d, parsed: d.toISOString().split('T')[0] };
      }
      return { date: null, parsed: '' };
    }
    
    switch (format) {
      case 'yyyy-mm-dd':
      case 'yyyy/mm/dd':
        [year, month, day] = parts.map(Number);
        break;
      case 'dd-mm-yyyy':
      case 'dd/mm/yyyy':
        [day, month, year] = parts.map(Number);
        break;
      case 'mm-dd-yyyy':
      case 'mm/dd/yyyy':
        [month, day, year] = parts.map(Number);
        break;
      case 'auto':
      default:
        // Check if any part is a month name
        for (let i = 0; i < parts.length; i++) {
          const monthNum = parseMonthName(parts[i]);
          if (monthNum !== null) {
            month = monthNum;
            // Determine day and year from remaining parts
            const remaining = parts.filter((_, idx) => idx !== i).map(Number);
            if (remaining[0] > 31) {
              [year, day] = remaining;
            } else if (remaining[1] > 31) {
              [day, year] = remaining;
            } else {
              [day, year] = remaining;
            }
            break;
          }
        }
        
        // If no month name found, use numeric auto-detect
        if (month === 0) {
          const nums = parts.map(Number);
          if (nums[0] > 31) {
            [year, month, day] = nums;
          } else if (nums[2] > 31) {
            [day, month, year] = nums;
          } else {
            [month, day, year] = nums;
          }
        }
        break;
    }
    
    // Handle 2-digit years
    if (year < 100) {
      year = year >= 50 ? 1900 + year : 2000 + year;
    }
    
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return { date: null, parsed: '' };
    
    return { date, parsed: date.toISOString().split('T')[0] };
  } catch {
    return { date: null, parsed: '' };
  }
}

function parseNumber(
  value: unknown,
  format: NumberFormat,
  treatBracketsAsNegative: boolean
): { number: number | null; parsed: string } {
  if (value === null || value === undefined || value === '') return { number: null, parsed: '' };

  if (typeof value === 'number') {
    if (!isFinite(value)) return { number: null, parsed: '' };
    return { number: value, parsed: value.toFixed(2) };
  }

  if (typeof value !== 'string') return { number: null, parsed: '' };

  let clean = value.trim();
  if (!clean) return { number: null, parsed: '' };
  let isNegative = false;

  
  // Handle bracketed negatives
  if (/^\([^)]+\)$/.test(clean)) {
    if (treatBracketsAsNegative || format === 'accounting') {
      isNegative = true;
      clean = clean.slice(1, -1);
    }
  }
  
  // Handle minus sign
  if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.slice(1);
  }
  
  // Remove currency symbols
  clean = clean.replace(/[$€£¥₹]/g, '');
  
  // Handle different number formats
  switch (format) {
    case 'european':
      clean = clean.replace(/\./g, '').replace(',', '.');
      break;
    case 'space-separated':
      clean = clean.replace(/\s/g, '').replace(',', '.');
      break;
    case 'standard':
    case 'accounting':
    default:
      clean = clean.replace(/,/g, '');
      break;
  }
  
  const num = parseFloat(clean);
  if (isNaN(num)) return { number: null, parsed: '' };
  
  const result = isNegative ? -Math.abs(num) : num;
  return { number: result, parsed: result.toFixed(2) };
}

// ============= Main Component =============

export function AdvancedMappingEngine({
  sourceColumns,
  sampleData,
  statementType,
  onMappingsChange,
  onComplete,
  onCancel,
  existingTemplates = [],
  onSaveTemplate,
  initialTemplateId,
}: AdvancedMappingEngineProps) {
  // State
  const [mappings, setMappings] = useState<ColumnMappingAdvanced[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFormat, setDateFormat] = useState<DateFormat>('auto');
  const [numberFormat, setNumberFormat] = useState<NumberFormat>('auto');
  const [invertSign, setInvertSign] = useState(false);
  const [treatBracketsAsNegative, setTreatBracketsAsNegative] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showDateValidation, setShowDateValidation] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [draggedMappingId, setDraggedMappingId] = useState<string | null>(null);
  const [dragOverMappingId, setDragOverMappingId] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<TargetField[]>([]);
  const [customColumnNames, setCustomColumnNames] = useState<string[]>([]);
  const [dateCorrections, setDateCorrections] = useState<Map<number, string>>(new Map());
  const [statementDateRange, setStatementDateRange] = useState<StatementDateRange>({
    startDate: null,
    endDate: null,
  });
  const addCustomColumnName = useCallback((name: string) => {
    setCustomColumnNames(prev => [...prev, name]);
  }, []);
  
  const baseTargetFields = useMemo(() =>
    statementType === 'bank' ? BANK_TARGET_FIELDS : CREDIT_CARD_TARGET_FIELDS,
    [statementType]
  );
  
  // Combine base fields with custom fields
  const targetFields = useMemo(() => 
    [...baseTargetFields, ...customFields],
    [baseTargetFields, customFields]
  );
  
  // Build groups including custom fields
  const groups = useMemo(() => {
    const baseGroups = MAPPING_GROUPS(statementType);
    // Add custom fields to the transaction group
    return baseGroups.map(group => {
      if (group.id === 'transaction') {
        return {
          ...group,
          fields: [
            ...group.fields,
            ...customFields.filter(f => f.group === 'transaction'),
          ],
        };
      }
      if (group.id === 'amounts') {
        return {
          ...group,
          fields: [
            ...group.fields,
            ...customFields.filter(f => f.group === 'amounts'),
          ],
        };
      }
      if (group.id === 'advanced') {
        return {
          ...group,
          fields: [
            ...group.fields,
            ...customFields.filter(f => f.group === 'advanced'),
          ],
        };
      }
      return group;
    });
  }, [statementType, customFields]);
  
  // Add custom field handler
  const addCustomField = useCallback((groupId: string, fieldType: 'string' | 'number' | 'date' | 'amount' = 'string') => {
    const fieldId = `custom_${generateId()}`;
    const newField: TargetField = {
      id: fieldId,
      label: `Custom Field ${customFields.length + 1}`,
      type: fieldType,
      group: groupId,
      description: 'User-defined custom field',
    };
    setCustomFields(prev => [...prev, newField]);
    
    // Also add a mapping for it
    setMappings(prev => [...prev, {
      id: generateId(),
      sourceColumn: '',
      targetField: fieldId,
      transform: fieldType === 'date' ? 'date' : fieldType === 'amount' ? 'number' : 'none',
      isRequired: false,
    }]);
    
    toast.success('Custom field added');
  }, [customFields.length]);
  
  // Remove custom field handler
  const removeCustomField = useCallback((fieldId: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== fieldId));
    setMappings(prev => prev.filter(m => m.targetField !== fieldId));
    toast.info('Custom field removed');
  }, []);
  
  // Update custom field label
  const updateCustomFieldLabel = useCallback((fieldId: string, newLabel: string) => {
    setCustomFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, label: newLabel } : f
    ));
  }, []);

  // AI-powered auto-mapping
  const runAiAutoMapping = useCallback(async () => {
    setAiAnalyzing(true);
    
    try {
      // Local AI-like matching based on column name similarity
      const autoMappings: ColumnMappingAdvanced[] = [];
      
      for (const field of targetFields) {
        let bestMatch = { column: '', similarity: 0 };
        
        for (const sourceCol of sourceColumns) {
          const similarity = calculateSimilarity(sourceCol, field.label);
          const idSimilarity = calculateSimilarity(sourceCol, field.id);
          const maxSim = Math.max(similarity, idSimilarity);
          
          if (maxSim > bestMatch.similarity && maxSim > 0.4) {
            bestMatch = { column: sourceCol, similarity: maxSim };
          }
        }
        
        if (bestMatch.column) {
          // Detect date format from sample data
          let detectedDateFormat: DateFormat | undefined;
          if (field.type === 'date' && sampleData.length > 0) {
            const sampleValue = String(sampleData[0][bestMatch.column] || '');
            detectedDateFormat = detectDateFormat(sampleValue);
          }
          
          autoMappings.push({
            id: generateId(),
            sourceColumn: bestMatch.column,
            targetField: field.id,
            transform: field.type === 'date' ? 'date' : field.type === 'amount' ? 'number' : 'none',
            dateFormat: detectedDateFormat,
            aiConfidence: bestMatch.similarity,
            aiSuggested: true,
            isRequired: field.required,
          });
        } else if (field.required) {
          autoMappings.push({
            id: generateId(),
            sourceColumn: '',
            targetField: field.id,
            transform: 'none',
            aiConfidence: 0,
            aiSuggested: false,
            isRequired: true,
            validationErrors: ['Required field not mapped'],
          });
        }
      }
      
      setMappings(autoMappings);
      toast.success('AI mapping complete', {
        description: `Matched ${autoMappings.filter(m => m.sourceColumn).length} of ${targetFields.length} fields`,
      });
    } catch (error) {
      console.error('AI mapping error:', error);
      toast.error('AI mapping failed');
    } finally {
      setAiAnalyzing(false);
    }
  }, [sourceColumns, targetFields, sampleData]);

  // Update parent when mappings change
  useEffect(() => {
    onMappingsChange(mappings);
  }, [mappings, onMappingsChange]);

  // Handlers
  const updateMapping = useCallback((id: string, updates: Partial<ColumnMappingAdvanced>) => {
    setMappings(prev => prev.map(m => 
      m.id === id ? { ...m, ...updates, aiSuggested: false } : m
    ));
  }, []);

  const removeMapping = useCallback((id: string) => {
    setMappings(prev => prev.filter(m => m.id !== id));
  }, []);

  const addMapping = useCallback((targetField: string) => {
    const field = targetFields.find(f => f.id === targetField);
    if (!field || mappings.some(m => m.targetField === targetField)) return;
    
    setMappings(prev => [...prev, {
      id: generateId(),
      sourceColumn: '',
      targetField,
      transform: field.type === 'date' ? 'date' : field.type === 'amount' ? 'number' : 'none',
      isRequired: field.required,
    }]);
  }, [mappings, targetFields]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  // Drag & Drop handlers for reordering mappings
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, mappingId: string) => {
    setDraggedMappingId(mappingId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', mappingId);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, mappingId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (mappingId !== draggedMappingId) {
      setDragOverMappingId(mappingId);
    }
  }, [draggedMappingId]);

  const handleDragLeave = useCallback(() => {
    setDragOverMappingId(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetMappingId: string) => {
    e.preventDefault();
    setDragOverMappingId(null);
    
    if (!draggedMappingId || draggedMappingId === targetMappingId) {
      setDraggedMappingId(null);
      return;
    }
    
    setMappings(prev => {
      const draggedIndex = prev.findIndex(m => m.id === draggedMappingId);
      const targetIndex = prev.findIndex(m => m.id === targetMappingId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;
      
      const newMappings = [...prev];
      const [draggedItem] = newMappings.splice(draggedIndex, 1);
      newMappings.splice(targetIndex, 0, draggedItem);
      
      return newMappings;
    });
    
    setDraggedMappingId(null);
    toast.success('Mapping reordered');
  }, [draggedMappingId]);

  const handleDragEnd = useCallback(() => {
    setDraggedMappingId(null);
    setDragOverMappingId(null);
  }, []);

  const applyTemplate = useCallback((template: MappingTemplate) => {
    setMappings(template.mappings);
    setDateFormat(template.dateFormat);
    setNumberFormat(template.numberFormat);
    setInvertSign(template.invertSign);
    setTreatBracketsAsNegative(template.treatBracketsAsNegative);
    toast.success(`Applied template: ${template.name}`);
  }, []);

  // Initialize with template or AI mapping on mount
  useEffect(() => {
    if (sourceColumns.length > 0 && mappings.length === 0) {
      // Check if we have an initial template to apply
      if (initialTemplateId) {
        const template = existingTemplates.find(t => t.id === initialTemplateId);
        if (template) {
          applyTemplate(template);
          return;
        }
      }
      // Otherwise run AI auto-mapping
      runAiAutoMapping();
    }
  }, [sourceColumns, mappings.length, runAiAutoMapping, initialTemplateId, existingTemplates, applyTemplate]);

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim() || !onSaveTemplate) return;
    
    const template: MappingTemplate = {
      id: generateId(),
      name: templateName.trim(),
      statementType,
      mappings,
      dateFormat,
      numberFormat,
      invertSign,
      treatBracketsAsNegative,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    onSaveTemplate(template);
    setShowSaveTemplate(false);
    setTemplateName('');
    toast.success('Template saved');
  }, [templateName, statementType, mappings, dateFormat, numberFormat, invertSign, treatBracketsAsNegative, onSaveTemplate]);

  const handleComplete = useCallback(() => {
    // Validate required fields
    const missingRequired = mappings
      .filter(m => m.isRequired && !m.sourceColumn)
      .map(m => targetFields.find(f => f.id === m.targetField)?.label || m.targetField);
    
    if (missingRequired.length > 0) {
      toast.error('Missing required fields', {
        description: missingRequired.join(', '),
      });
      return;
    }
    
    onComplete({
      mappings,
      dateFormat,
      numberFormat,
      invertSign,
      treatBracketsAsNegative,
    });
  }, [mappings, dateFormat, numberFormat, invertSign, treatBracketsAsNegative, targetFields, onComplete]);

  // Compute preview data
  const previewData = useMemo(() => {
    if (sampleData.length === 0) return [];
    
    return sampleData.slice(0, 5).map(row => {
      const result: Record<string, ParsePreview> = {};
      
      for (const mapping of mappings) {
        if (!mapping.sourceColumn) continue;
        
        const rawValue = row[mapping.sourceColumn];
        const originalValue = typeof rawValue === 'string'
          ? rawValue
          : (rawValue == null ? '' : (rawValue instanceof Date ? rawValue.toISOString() : String(rawValue)));
        let parsed: string | number | Date | null = null;
        let isValid = true;
        let error: string | undefined;
        
        const field = targetFields.find(f => f.id === mapping.targetField);
        
        if (field?.type === 'date') {
          // Pass statement date range to help infer year for dates without year
          const { date, parsed: parsedStr } = parseDate(
            rawValue,
            mapping.dateFormat || dateFormat,
            statementDateRange
          );
          parsed = parsedStr;
          isValid = !!date;
          if (!date) error = 'Invalid date';
        } else if (field?.type === 'amount' || field?.type === 'number') {
          let { number: num, parsed: parsedStr } = parseNumber(
            rawValue,
            mapping.numberFormat || numberFormat,
            mapping.treatBracketsAsNegative ?? treatBracketsAsNegative
          );
          if (num !== null && (mapping.invertSign ?? invertSign)) {
            num = -num;
            parsedStr = num.toFixed(2);
          }
          parsed = parsedStr;
          isValid = num !== null;
          if (num === null) error = 'Invalid number';
        } else {
          parsed = originalValue;
        }
        
        result[mapping.targetField] = { original: originalValue, parsed: String(parsed || ''), isValid, error };
      }
      
      return result;
    });
  }, [sampleData, mappings, dateFormat, numberFormat, invertSign, treatBracketsAsNegative, targetFields, statementDateRange]);

  // Filter mappings by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    
    const query = searchQuery.toLowerCase();
    return groups.map(group => ({
      ...group,
      fields: group.fields.filter(field => {
        const mapping = mappings.find(m => m.targetField === field.id);
        return field.label.toLowerCase().includes(query) ||
               field.id.toLowerCase().includes(query) ||
               (mapping?.sourceColumn || '').toLowerCase().includes(query);
      }),
    })).filter(g => g.fields.length > 0);
  }, [groups, mappings, searchQuery]);

  // Validation status per group
  const groupStatus = useMemo(() => {
    const status: Record<string, { mapped: number; total: number; errors: number }> = {};
    
    for (const group of groups) {
      const groupMappings = mappings.filter(m => 
        group.fields.some(f => f.id === m.targetField)
      );
      
      status[group.id] = {
        mapped: groupMappings.filter(m => m.sourceColumn).length,
        total: group.fields.length,
        errors: groupMappings.filter(m => 
          m.isRequired && !m.sourceColumn
        ).length,
      };
    }
    
    return status;
  }, [groups, mappings]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-[calc(100vh-120px)] min-h-[600px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            {statementType === 'bank' ? (
              <Building2 className="h-5 w-5 text-primary" />
            ) : (
              <CreditCard className="h-5 w-5 text-primary" />
            )}
            <div>
              <h3 className="font-semibold">
                {statementType === 'bank' ? 'Bank Statement' : 'Credit Card Statement'} Mapping
              </h3>
              <p className="text-xs text-muted-foreground">
                {sourceColumns.length} source columns • {sampleData.length} rows to import
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showDateValidation ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDateValidation(!showDateValidation)}
                  className="gap-1"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Validate Dates
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Check for invalid or future dates before import
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              onClick={runAiAutoMapping}
              disabled={aiAnalyzing}
            >
              {aiAnalyzing ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-1" />
              )}
              AI Auto-Map
            </Button>
            {existingTemplates.length > 0 && (
              <Select onValueChange={(id) => {
                const template = existingTemplates.find(t => t.id === id);
                if (template) applyTemplate(template);
              }}>
                <SelectTrigger className="w-[180px] h-9">
                  <BookOpen className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Apply Template" />
                </SelectTrigger>
                <SelectContent>
                  {existingTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Statement Date Range & Search */}
        <div className="flex items-center gap-4 p-3 border-b border-border bg-background">
          {/* Statement Date Range */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Statement Period:</span>
            <Input
              type="date"
              value={statementDateRange.startDate ? statementDateRange.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const newDate = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                setStatementDateRange(prev => ({ ...prev, startDate: newDate }));
              }}
              className="h-7 w-32 text-xs"
              placeholder="Start"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={statementDateRange.endDate ? statementDateRange.endDate.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const newDate = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                setStatementDateRange(prev => ({ ...prev, endDate: newDate }));
              }}
              className="h-7 w-32 text-xs"
              placeholder="End"
            />
            {statementDateRange.startDate && statementDateRange.endDate && (
              <Badge variant="secondary" className="text-[10px]">
                <Check className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search fields or columns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Switch
              id="show-preview"
              checked={showPreview}
              onCheckedChange={setShowPreview}
            />
            <Label htmlFor="show-preview" className="text-xs cursor-pointer">
              Show Preview
            </Label>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Mapping Panel */}
          <ScrollArea className="flex-1 border-r border-border h-full">
            <div className="p-4 space-y-4 pb-8">
              {/* Global Format Settings */}
              <Collapsible
                open={!collapsedGroups['formats']}
                onOpenChange={() => toggleGroupCollapse('formats')}
              >
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Format Settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {dateFormat !== 'auto' || numberFormat !== 'auto' ? 'Custom' : 'Auto'}
                      </Badge>
                      {collapsedGroups['formats'] ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Date Format</Label>
                      <Select value={dateFormat} onValueChange={(v) => setDateFormat(v as DateFormat)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_FORMATS.map(f => (
                            <SelectItem key={f.value} value={f.value}>
                              <div className="flex items-center justify-between w-full">
                                <span>{f.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">{f.example}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Number Format</Label>
                      <Select value={numberFormat} onValueChange={(v) => setNumberFormat(v as NumberFormat)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NUMBER_FORMATS.map(f => (
                            <SelectItem key={f.value} value={f.value}>
                              <div className="flex items-center justify-between w-full">
                                <span>{f.label}</span>
                                <span className="text-xs text-muted-foreground ml-2">{f.example}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 pl-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="brackets-negative"
                        checked={treatBracketsAsNegative}
                        onCheckedChange={(c) => setTreatBracketsAsNegative(!!c)}
                      />
                      <Label htmlFor="brackets-negative" className="text-xs cursor-pointer">
                        Treat (brackets) as negative
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="invert-sign"
                        checked={invertSign}
                        onCheckedChange={(c) => setInvertSign(!!c)}
                      />
                      <Label htmlFor="invert-sign" className="text-xs cursor-pointer">
                        Invert signs (credit card charges as positive)
                      </Label>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Mapping Groups */}
              {filteredGroups.map(group => {
                const status = groupStatus[group.id] || { mapped: 0, total: 0, errors: 0 };
                const isCollapsed = collapsedGroups[group.id];
                
                // Special handling for AI Rules group
                const isAiRulesGroup = group.id === 'ai_rules';
                const aiSuggestedMappings = mappings.filter(m => m.aiSuggested && m.aiConfidence && m.aiConfidence > 0);
                
                return (
                  <Collapsible
                    key={group.id}
                    open={!isCollapsed}
                    onOpenChange={() => toggleGroupCollapse(group.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2">
                          {group.icon}
                          <span className="font-medium text-sm">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAiRulesGroup ? (
                            <Badge variant={aiSuggestedMappings.length > 0 ? 'default' : 'secondary'} className="text-xs">
                              {aiSuggestedMappings.length} AI suggestions
                            </Badge>
                          ) : (
                            <Badge 
                              variant={status.errors > 0 ? 'destructive' : status.mapped === status.total ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {status.errors > 0 ? (
                                <>
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  {status.errors} missing
                                </>
                              ) : (
                                <>
                                  {status.mapped}/{status.total} mapped
                                  {status.mapped === status.total && <Check className="h-3 w-3 ml-1" />}
                                </>
                              )}
                            </Badge>
                          )}
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2 pr-4 pb-2">
                          {/* AI Rules & Overrides special content */}
                          {isAiRulesGroup && (
                            <div className="ml-4 space-y-3">
                              {aiSuggestedMappings.length > 0 ? (
                                <>
                                  <p className="text-xs text-muted-foreground">
                                    AI has suggested the following mappings. You can override them by editing the source column.
                                  </p>
                                  {aiSuggestedMappings.map(mapping => {
                                    const field = targetFields.find(f => f.id === mapping.targetField);
                                    return (
                                      <div key={mapping.id} className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-medium">{field?.label || mapping.targetField}</span>
                                            <Badge variant="outline" className="text-[10px]">
                                              {Math.round((mapping.aiConfidence || 0) * 100)}% confidence
                                            </Badge>
                                          </div>
                                          <span className="text-xs text-muted-foreground">
                                            → {mapping.sourceColumn}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                      // Clear all AI suggestions
                                      setMappings(prev => prev.map(m => ({ ...m, aiSuggested: false })));
                                      toast.info('AI suggestions cleared');
                                    }}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Clear All AI Suggestions
                                  </Button>
                                </>
                              ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                  No AI suggestions available. Click "AI Auto-Map" to generate suggestions.
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Regular field mappings */}
                          {group.fields.map(field => {
                            const mapping = mappings.find(m => m.targetField === field.id);
                        const hasMapping = !!mapping;
                        const isCustomField = field.id.startsWith('custom_');
                        
                        return (
                          <div
                            key={field.id}
                            draggable={!!mapping}
                            onDragStart={(e) => mapping && handleDragStart(e, mapping.id)}
                            onDragOver={(e) => mapping && handleDragOver(e, mapping.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => mapping && handleDrop(e, mapping.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "ml-4 p-3 rounded-lg border transition-colors",
                              mapping?.validationErrors?.length 
                                ? "border-destructive/50 bg-destructive/5"
                                : mapping?.sourceColumn 
                                  ? "border-primary/30 bg-primary/5"
                                  : "border-border bg-card",
                              draggedMappingId === mapping?.id && "opacity-50",
                              dragOverMappingId === mapping?.id && "border-primary border-2"
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              {/* Drag Handle */}
                              {mapping && (
                                <div className="cursor-grab active:cursor-grabbing pt-1">
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {isCustomField ? (
                                    <Input
                                      value={field.label}
                                      onChange={(e) => updateCustomFieldLabel(field.id, e.target.value)}
                                      className="h-6 text-sm font-medium w-40 px-1"
                                      placeholder="Field name..."
                                    />
                                  ) : (
                                    <Label className="text-sm font-medium">
                                      {field.label}
                                      {field.required && (
                                        <span className="text-destructive ml-1">*</span>
                                      )}
                                    </Label>
                                  )}
                                  {mapping?.aiSuggested && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-[10px] gap-1">
                                          <Sparkles className="h-3 w-3" />
                                          {Math.round((mapping.aiConfidence || 0) * 100)}%
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        AI confidence: {Math.round((mapping.aiConfidence || 0) * 100)}%
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {field.description && !isCustomField && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>{field.description}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {isCustomField && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive hover:text-destructive"
                                      onClick={() => removeCustomField(field.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <SearchableColumnSelect
                                    value={mapping?.sourceColumn || ''}
                                    onChange={(v) => {
                                      if (hasMapping) {
                                        updateMapping(mapping.id, { sourceColumn: v });
                                      } else {
                                        addMapping(field.id);
                                        setTimeout(() => {
                                          setMappings(prev => prev.map(m => 
                                            m.targetField === field.id ? { ...m, sourceColumn: v } : m
                                          ));
                                        }, 0);
                                      }
                                    }}
                                    sourceColumns={sourceColumns}
                                    customNames={customColumnNames}
                                    onAddCustomName={addCustomColumnName}
                                    className="flex-1"
                                  />
                                  
                                  {hasMapping && mapping.sourceColumn && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => updateMapping(mapping.id, { sourceColumn: '' })}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                
                                {/* Field-specific format override */}
                                {hasMapping && mapping.sourceColumn && (field.type === 'date' || field.type === 'amount') && (
                                  <div className="mt-2 flex items-center gap-2">
                                    {field.type === 'date' && (
                                      <Select
                                        value={mapping.dateFormat || 'auto'}
                                        onValueChange={(v) => updateMapping(mapping.id, { dateFormat: v as DateFormat })}
                                      >
                                        <SelectTrigger className="h-8 text-xs w-36">
                                          <Calendar className="h-3 w-3 mr-1" />
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {DATE_FORMATS.map(f => (
                                            <SelectItem key={f.value} value={f.value} className="text-xs">
                                              {f.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                    {field.type === 'amount' && (
                                      <>
                                        <Select
                                          value={mapping.numberFormat || 'auto'}
                                          onValueChange={(v) => updateMapping(mapping.id, { numberFormat: v as NumberFormat })}
                                        >
                                          <SelectTrigger className="h-8 text-xs w-32">
                                            <Hash className="h-3 w-3 mr-1" />
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {NUMBER_FORMATS.map(f => (
                                              <SelectItem key={f.value} value={f.value} className="text-xs">
                                                {f.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1">
                                              <Checkbox
                                                id={`invert-${mapping.id}`}
                                                checked={mapping.invertSign ?? invertSign}
                                                onCheckedChange={(c) => updateMapping(mapping.id, { invertSign: !!c })}
                                              />
                                              <Label htmlFor={`invert-${mapping.id}`} className="text-[10px] cursor-pointer">
                                                Invert
                                              </Label>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>Invert sign for this field</TooltipContent>
                                        </Tooltip>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {mapping?.validationErrors?.map((err, i) => (
                              <p key={i} className="text-xs text-destructive mt-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {err}
                              </p>
                            ))}
                          </div>
                          );
                        })}
                        
                        {/* Add Custom Field Button - only for transaction, amounts, and advanced groups */}
                        {['transaction', 'amounts', 'advanced'].includes(group.id) && (
                          <div className="ml-4 mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-dashed text-muted-foreground hover:text-foreground"
                              onClick={() => addCustomField(
                                group.id, 
                                group.id === 'amounts' ? 'amount' : 'string'
                              )}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add {group.id === 'amounts' ? 'Amount' : 'Custom'} Field
                            </Button>
                          </div>
                        )}
                        </div>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>

          {/* Preview Panel */}
          {showPreview && !showDateValidation && (
            <div className="w-[500px] min-w-[400px] border-l border-border bg-muted/20 flex flex-col">
              <div className="p-3 border-b border-border bg-background shrink-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Live Preview
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {previewData.length} sample rows
                  </Badge>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {previewData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No preview data available
                    </p>
                  ) : (
                    previewData.map((row, rowIdx) => (
                      <div key={rowIdx} className="p-3 rounded-lg border border-border bg-card">
                        <div className="text-[10px] text-muted-foreground mb-2">
                          Row {rowIdx + 1}
                        </div>
                        <div className="space-y-1.5">
                          {Object.entries(row).map(([field, preview]) => {
                            const fieldDef = targetFields.find(f => f.id === field);
                            
                            // For Type (credit) field, show only transaction type label
                            const isTypeField = field === 'credit';
                            
                            // Determine transaction type for amount fields
                            const getTransactionTypeLabel = () => {
                              if (!fieldDef || (fieldDef.type !== 'amount' && fieldDef.type !== 'number')) return null;
                              if (!preview.isValid || !preview.parsed) return null;
                              
                              const numValue = parseFloat(String(preview.parsed).replace(/[^0-9.-]/g, ''));
                              if (isNaN(numValue) || numValue === 0) return null;
                              
                              // Bank: positive = deposit, negative = withdrawal
                              // Credit card: positive = charge/withdrawal, negative = payment/deposit
                              if (statementType === 'bank') {
                                return numValue > 0
                                  ? { label: 'Deposit', color: 'text-green-600' }
                                  : { label: 'Withdrawal', color: 'text-red-600' };
                              }
                              return numValue > 0
                                ? { label: 'Charge', color: 'text-red-600' }
                                : { label: 'Payment', color: 'text-green-600' };
                            };
                            
                            const txnType = getTransactionTypeLabel();
                            
                            return (
                              <div key={field} className="flex items-center justify-between text-xs gap-3">
                                <span className="text-muted-foreground truncate min-w-[100px] max-w-[140px]">
                                  {fieldDef?.label || field}
                                </span>
                                <div className="flex items-center gap-2 flex-1 justify-end">
                                  <span className="text-muted-foreground line-through text-[10px] truncate max-w-[100px]">
                                    {preview.original}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">→</span>
                                  
                                  {/* For Type field, show only the transaction type label; for Amount field, show only the amount */}
                                  {isTypeField && txnType ? (
                                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", txnType.color)}>
                                      {txnType.label}
                                    </Badge>
                                  ) : (
                                    <>
                                      <span className={cn(
                                        "font-medium truncate max-w-[100px]",
                                        preview.isValid ? "text-foreground" : "text-destructive"
                                      )}>
                                        {String(preview.parsed) || '—'}
                                      </span>
                                      {/* Show type badge only on Amount field when it's not the Type field */}
                                      {field === 'amount' && txnType && (
                                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 shrink-0", txnType.color)}>
                                          {txnType.label}
                                        </Badge>
                                      )}
                                    </>
                                  )}
                                  
                                  {preview.isValid ? (
                                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent>{preview.error}</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Date Validation Panel */}
          {showDateValidation && (
            <div className="w-[500px] min-w-[400px] flex flex-col">
              <DateValidationPanel
                sampleData={sampleData}
                dateColumn={mappings.find(m => m.targetField === 'transaction_date')?.sourceColumn || ''}
                dateFormat={dateFormat}
                onDateCorrections={(corrections) => {
                  setDateCorrections(corrections);
                  toast.success(`${corrections.size} date corrections applied`);
                }}
                onClose={() => setShowDateValidation(false)}
                statementDateRange={statementDateRange}
                onStatementDateRangeChange={setStatementDateRange}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {onSaveTemplate && (
              <>
                {showSaveTemplate ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Template name..."
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="h-9 w-48"
                    />
                    <Button size="sm" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(true)}>
                    <Save className="h-4 w-4 mr-1" />
                    Save as Template
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleComplete}>
              <Zap className="h-4 w-4 mr-1" />
              Import {sampleData.length} Transactions
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

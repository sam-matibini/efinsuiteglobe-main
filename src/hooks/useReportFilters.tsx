import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { getFiscalYearStart, getFiscalYearEnd, getFiscalYearForDate } from '@/lib/fiscalYearUtils';

interface ReportFiltersState {
  startDate: Date;
  endDate: Date;
  showZeroBalances: boolean;
  compareSettings: CompareSettings | null;
  collapseSubAccounts: boolean;
}

interface CompareSettings {
  compareType: 'period' | 'year';
  numberOfPeriods: number;
  latestToOldest: boolean;
}

interface ReportFiltersContextType extends ReportFiltersState {
  setDateRange: (startDate: Date, endDate: Date) => void;
  setShowZeroBalances: (show: boolean) => void;
  setCompareSettings: (settings: CompareSettings | null) => void;
  setCollapseSubAccounts: (collapse: boolean) => void;
  fiscalYearEndMonth: number;
  setFiscalYearEndMonth: (month: number) => void;
}

const STORAGE_KEY = 'report-filters';

// Helper to format date for storage
const formatDateForStorage = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Helper to parse date from storage
const parseDateFromStorage = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Get initial state from localStorage or defaults - fiscal year aware
const getInitialState = (fiscalYearEndMonth: number = 12): ReportFiltersState => {
  const now = new Date();
  const currentFY = getFiscalYearForDate(now, fiscalYearEndMonth);
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const storedStartDate = parseDateFromStorage(parsed.startDate);
      const storedEndDate = parseDateFromStorage(parsed.endDate);
      
      // Get the fiscal year of stored dates
      const storedFY = getFiscalYearForDate(storedEndDate, fiscalYearEndMonth);
      
      // Reset to last fiscal year if:
      // 1. Stored dates are from a different fiscal year cycle
      // 2. Stored dates don't make sense (end before start)
      const isStaleFY = storedFY < currentFY - 1;
      const isFutureFY = storedFY > currentFY;
      const isInvalidRange = storedEndDate < storedStartDate;
      
      if (isStaleFY || isFutureFY || isInvalidRange) {
        console.info('Report filters: Resetting to Last Fiscal Year (stored dates were from a different fiscal year)');
        // Default to the previous full fiscal year
        const lastFY = currentFY - 1;
        return {
          startDate: getFiscalYearStart(lastFY, fiscalYearEndMonth),
          endDate: getFiscalYearEnd(lastFY, fiscalYearEndMonth),
          showZeroBalances: parsed.showZeroBalances ?? false,
          compareSettings: null,
          collapseSubAccounts: parsed.collapseSubAccounts ?? false,
        };
      }
      
      return {
        startDate: storedStartDate,
        endDate: storedEndDate,
        showZeroBalances: parsed.showZeroBalances ?? false,
        compareSettings: parsed.compareSettings ?? null,
        collapseSubAccounts: parsed.collapseSubAccounts ?? false,
      };
    }
  } catch (e) {
    console.warn('Failed to parse stored report filters:', e);
  }
  
  // Defaults: Last full fiscal year (most common for financial reporting)
  const lastFY = currentFY - 1;
  return {
    startDate: getFiscalYearStart(lastFY, fiscalYearEndMonth),
    endDate: getFiscalYearEnd(lastFY, fiscalYearEndMonth),
    showZeroBalances: false,
    compareSettings: null,
    collapseSubAccounts: false,
  };
};

const ReportFiltersContext = createContext<ReportFiltersContextType | undefined>(undefined);

export function ReportFiltersProvider({ children }: { children: ReactNode }) {
  // Get fiscal year end month from localStorage initially (will be updated from org context)
  const [fiscalYearEndMonth, setFiscalYearEndMonthState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('fiscal_year_end_month');
      return stored ? parseInt(stored, 10) : 12;
    } catch {
      return 12;
    }
  });
  
  const [state, setState] = useState<ReportFiltersState>(() => getInitialState(fiscalYearEndMonth));

  // Update state when fiscal year end month changes
  const setFiscalYearEndMonth = useCallback((month: number) => {
    setFiscalYearEndMonthState(month);
    localStorage.setItem('fiscal_year_end_month', String(month));
    
    // Recalculate dates based on new fiscal year
    const now = new Date();
    const currentFY = getFiscalYearForDate(now, month);
    const lastFY = currentFY - 1;
    
    setState(prev => ({
      ...prev,
      startDate: getFiscalYearStart(lastFY, month),
      endDate: getFiscalYearEnd(lastFY, month),
    }));
  }, []);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startDate: formatDateForStorage(state.startDate),
        endDate: formatDateForStorage(state.endDate),
        showZeroBalances: state.showZeroBalances,
        compareSettings: state.compareSettings,
        collapseSubAccounts: state.collapseSubAccounts,
      }));
    } catch (e) {
      console.warn('Failed to persist report filters:', e);
    }
  }, [state]);

  const setDateRange = useCallback((startDate: Date, endDate: Date) => {
    setState(prev => ({ ...prev, startDate, endDate }));
  }, []);

  const setShowZeroBalances = useCallback((showZeroBalances: boolean) => {
    setState(prev => ({ ...prev, showZeroBalances }));
  }, []);

  const setCompareSettings = useCallback((compareSettings: CompareSettings | null) => {
    setState(prev => ({ ...prev, compareSettings }));
  }, []);

  const setCollapseSubAccounts = useCallback((collapseSubAccounts: boolean) => {
    setState(prev => ({ ...prev, collapseSubAccounts }));
  }, []);

  return (
    <ReportFiltersContext.Provider
      value={{
        ...state,
        setDateRange,
        setShowZeroBalances,
        setCompareSettings,
        setCollapseSubAccounts,
        fiscalYearEndMonth,
        setFiscalYearEndMonth,
      }}
    >
      {children}
    </ReportFiltersContext.Provider>
  );
}

export function useReportFilters(): ReportFiltersContextType {
  const context = useContext(ReportFiltersContext);
  if (!context) {
    throw new Error('useReportFilters must be used within a ReportFiltersProvider');
  }
  return context;
}

// Re-export CompareSettings for use in other components
export type { CompareSettings };

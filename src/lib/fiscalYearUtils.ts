import { startOfMonth, endOfMonth, addMonths, subMonths, setMonth, setYear, isBefore, isAfter, format } from 'date-fns';

/**
 * Fiscal Year Utilities
 * 
 * These utilities help calculate fiscal year periods based on an organization's
 * fiscal_year_end_month setting. For example, if fiscal_year_end_month = 9 (September):
 * - FY2024 runs from Oct 1, 2023 to Sep 30, 2024
 * - FY2025 runs from Oct 1, 2024 to Sep 30, 2025
 */

/**
 * Get the start date of a fiscal year
 * @param fiscalYear - The fiscal year number (e.g., 2024)
 * @param fiscalYearEndMonth - The month number (1-12) when the fiscal year ends (e.g., 9 for September)
 * @returns The first day of the fiscal year
 */
export function getFiscalYearStart(fiscalYear: number, fiscalYearEndMonth: number = 12): Date {
  // If fiscal year ends in December (12), it's a calendar year
  if (fiscalYearEndMonth === 12) {
    return new Date(fiscalYear, 0, 1); // Jan 1 of the fiscal year
  }
  
  // Otherwise, fiscal year starts in the month AFTER the end month of the PREVIOUS calendar year
  // E.g., if FY ends in September (9), FY starts in October (10) of the previous calendar year
  const startMonth = fiscalYearEndMonth; // The month after end month (0-indexed: 9 means October)
  return new Date(fiscalYear - 1, startMonth, 1);
}

/**
 * Get the end date of a fiscal year
 * @param fiscalYear - The fiscal year number (e.g., 2024)
 * @param fiscalYearEndMonth - The month number (1-12) when the fiscal year ends (e.g., 9 for September)
 * @returns The last day of the fiscal year
 */
export function getFiscalYearEnd(fiscalYear: number, fiscalYearEndMonth: number = 12): Date {
  // If fiscal year ends in December (12), it's a calendar year
  if (fiscalYearEndMonth === 12) {
    return new Date(fiscalYear, 11, 31); // Dec 31 of the fiscal year
  }
  
  // Otherwise, fiscal year ends on the last day of the end month
  // E.g., if FY ends in September (9), FY ends on Sep 30 of the fiscal year
  const endMonth = fiscalYearEndMonth - 1; // Convert to 0-indexed
  const lastDayOfMonth = new Date(fiscalYear, endMonth + 1, 0); // Last day of the month
  return lastDayOfMonth;
}

/**
 * Determine which fiscal year a given date falls into
 * @param date - The date to check
 * @param fiscalYearEndMonth - The month number (1-12) when the fiscal year ends
 * @returns The fiscal year number
 */
export function getFiscalYearForDate(date: Date, fiscalYearEndMonth: number = 12): number {
  const month = date.getMonth() + 1; // Convert to 1-indexed
  const year = date.getFullYear();
  
  // If fiscal year ends in December, it's a calendar year
  if (fiscalYearEndMonth === 12) {
    return year;
  }
  
  // If the date's month is AFTER the fiscal year end month, it belongs to the NEXT fiscal year
  // E.g., October 2023 (month 10) with FY end in September (9) -> FY2024
  if (month > fiscalYearEndMonth) {
    return year + 1;
  }
  
  // Otherwise, it belongs to the current calendar year's fiscal year
  // E.g., March 2024 (month 3) with FY end in September (9) -> FY2024
  return year;
}

/**
 * Check if a date is within a specific fiscal year
 * @param date - The date to check
 * @param fiscalYear - The fiscal year to check against
 * @param fiscalYearEndMonth - The month number (1-12) when the fiscal year ends
 * @returns True if the date is within the fiscal year
 */
export function isInFiscalYear(date: Date, fiscalYear: number, fiscalYearEndMonth: number = 12): boolean {
  const fyStart = getFiscalYearStart(fiscalYear, fiscalYearEndMonth);
  const fyEnd = getFiscalYearEnd(fiscalYear, fiscalYearEndMonth);
  
  return date >= fyStart && date <= fyEnd;
}

/**
 * Format a fiscal year period string
 * @param fiscalYear - The fiscal year number
 * @param fiscalYearEndMonth - The month number (1-12) when the fiscal year ends
 * @returns A formatted string like "Oct 2023 - Sep 2024" or "Jan 2024 - Dec 2024"
 */
export function formatFiscalYearPeriod(fiscalYear: number, fiscalYearEndMonth: number = 12): string {
  const start = getFiscalYearStart(fiscalYear, fiscalYearEndMonth);
  const end = getFiscalYearEnd(fiscalYear, fiscalYearEndMonth);
  
  return `${format(start, 'MMM yyyy')} - ${format(end, 'MMM yyyy')}`;
}

/**
 * Get an array of available fiscal years for selection
 * @param fiscalYearEndMonth - The month number (1-12) when the fiscal year ends
 * @param yearsBack - Number of years to go back from current
 * @param yearsForward - Number of years to go forward from current
 * @returns Array of fiscal year objects with year number and formatted period
 */
export function getAvailableFiscalYears(
  fiscalYearEndMonth: number = 12,
  yearsBack: number = 3,
  yearsForward: number = 2
): { year: number; period: string }[] {
  const currentFY = getFiscalYearForDate(new Date(), fiscalYearEndMonth);
  const years: { year: number; period: string }[] = [];
  
  for (let i = currentFY - yearsBack; i <= currentFY + yearsForward; i++) {
    years.push({
      year: i,
      period: formatFiscalYearPeriod(i, fiscalYearEndMonth),
    });
  }
  
  return years;
}

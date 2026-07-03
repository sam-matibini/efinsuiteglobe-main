import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a YYYY-MM-DD date string as local midnight, avoiding timezone offset issues.
 * This prevents the common "off-by-one day" bug when parsing ISO date strings.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object set to local midnight
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Handle full ISO datetime strings (e.g., "2025-01-15T00:00:00.000Z")
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Fallback for other formats
  return new Date(dateStr);
}

/**
 * Format a date string to YYYY-MM-DD in local timezone.
 * Use this when storing dates to the database.
 * 
 * @param date - Date object or date string
 * @returns Date string in YYYY-MM-DD format
 */
export function formatLocalDateString(date: Date | string): string {
  const d = typeof date === 'string' ? parseLocalDate(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

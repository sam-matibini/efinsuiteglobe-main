import { describe, it, expect } from 'vitest';
import {
  getFiscalYearStart,
  getFiscalYearEnd,
  getFiscalYearForDate,
  isInFiscalYear,
  formatFiscalYearPeriod,
  getAvailableFiscalYears,
} from '../fiscalYearUtils';

describe('Fiscal Year Utilities', () => {
  describe('Calendar year (end month 12)', () => {
    it('start is Jan 1', () => {
      const start = getFiscalYearStart(2024, 12);
      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(1);
    });

    it('end is Dec 31', () => {
      const end = getFiscalYearEnd(2024, 12);
      expect(end.getFullYear()).toBe(2024);
      expect(end.getMonth()).toBe(11);
      expect(end.getDate()).toBe(31);
    });
  });

  describe('Non-calendar year (end month 9 = September)', () => {
    it('FY2024 starts Oct 1, 2023', () => {
      const start = getFiscalYearStart(2024, 9);
      expect(start.getFullYear()).toBe(2023);
      expect(start.getMonth()).toBe(9); // October
      expect(start.getDate()).toBe(1);
    });

    it('FY2024 ends Sep 30, 2024', () => {
      const end = getFiscalYearEnd(2024, 9);
      expect(end.getFullYear()).toBe(2024);
      expect(end.getMonth()).toBe(8); // September
      expect(end.getDate()).toBe(30);
    });
  });

  describe('getFiscalYearForDate', () => {
    it('date after end month maps to next FY', () => {
      // October 2023 with FY end in September → FY2024
      expect(getFiscalYearForDate(new Date(2023, 9, 15), 9)).toBe(2024);
    });

    it('date before end month maps to current FY', () => {
      // March 2024 with FY end in September → FY2024
      expect(getFiscalYearForDate(new Date(2024, 2, 15), 9)).toBe(2024);
    });

    it('calendar year returns same year', () => {
      expect(getFiscalYearForDate(new Date(2024, 5, 1), 12)).toBe(2024);
    });
  });

  describe('isInFiscalYear', () => {
    it('returns true for date within FY', () => {
      expect(isInFiscalYear(new Date(2024, 2, 15), 2024, 9)).toBe(true);
    });

    it('returns false for date outside FY', () => {
      expect(isInFiscalYear(new Date(2022, 0, 1), 2024, 9)).toBe(false);
    });
  });

  describe('formatFiscalYearPeriod', () => {
    it('formats calendar year', () => {
      expect(formatFiscalYearPeriod(2024, 12)).toBe('Jan 2024 - Dec 2024');
    });

    it('formats non-calendar year', () => {
      expect(formatFiscalYearPeriod(2024, 9)).toBe('Oct 2023 - Sep 2024');
    });
  });

  describe('getAvailableFiscalYears', () => {
    it('returns correct range', () => {
      const years = getAvailableFiscalYears(12, 2, 1);
      expect(years.length).toBe(4); // 2 back + current + 1 forward
      expect(years[0].year).toBeLessThan(years[years.length - 1].year);
      years.forEach(y => {
        expect(y.period).toContain('-');
      });
    });
  });
});

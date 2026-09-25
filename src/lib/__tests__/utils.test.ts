import { describe, it, expect } from 'vitest';
import { cn, parseLocalDate, formatLocalDateString } from '../utils';

describe('Utils', () => {
  describe('parseLocalDate', () => {
    it('parses YYYY-MM-DD as local midnight', () => {
      const d = parseLocalDate('2025-01-15');
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(0); // January
      expect(d.getDate()).toBe(15);
    });

    it('handles full ISO datetime strings', () => {
      const d = parseLocalDate('2025-06-30T00:00:00.000Z');
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(5); // June
      expect(d.getDate()).toBe(30);
    });

    it('returns valid Date for empty string', () => {
      const d = parseLocalDate('');
      expect(d instanceof Date).toBe(true);
      expect(isNaN(d.getTime())).toBe(false);
    });
  });

  describe('formatLocalDateString', () => {
    it('round-trips with parseLocalDate', () => {
      const original = '2025-03-22';
      const parsed = parseLocalDate(original);
      expect(formatLocalDateString(parsed)).toBe(original);
    });

    it('formats Date object correctly', () => {
      const d = new Date(2024, 11, 25); // Dec 25
      expect(formatLocalDateString(d)).toBe('2024-12-25');
    });
  });

  describe('cn', () => {
    it('merges Tailwind classes correctly', () => {
      expect(cn('px-4', 'px-6')).toBe('px-6');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('handles conditional classes', () => {
      expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
    });
  });
});

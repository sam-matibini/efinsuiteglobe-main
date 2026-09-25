import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  extractKeyWords,
  levenshteinDistance,
  stringSimilarity,
  containsAllWords,
  containsAnyWord,
  fuzzyContains,
  matchText,
  extractVendorName,
  getMatchConfidence,
} from '../transactionMatcher';

describe('Transaction Matcher', () => {
  describe('normalizeText', () => {
    it('removes special chars and extra spaces', () => {
      expect(normalizeText('Hello, World!!  Test')).toBe('hello world test');
    });
    it('handles null/undefined', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });
  });

  describe('extractKeyWords', () => {
    it('filters stop words', () => {
      const words = extractKeyWords('The quick payment to Amazon Inc');
      expect(words).not.toContain('the');
      expect(words).not.toContain('to');
      expect(words).not.toContain('inc');
      expect(words).toContain('quick');
      expect(words).toContain('amazon');
      expect(words).toContain('payment');
    });
  });

  describe('levenshteinDistance', () => {
    it('kitten/sitting = 3', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });
    it('empty strings', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });
  });

  describe('stringSimilarity', () => {
    it('exact match = 1.0', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1);
    });
    it('empty = 0', () => {
      expect(stringSimilarity('hello', '')).toBe(0);
    });
    it('similar strings have high score', () => {
      expect(stringSimilarity('amazon', 'amazn')).toBeGreaterThan(0.7);
    });
  });

  describe('containsAllWords', () => {
    it('order-independent matching', () => {
      expect(containsAllWords('payment to amazon for books', 'amazon payment')).toBe(true);
    });
    it('returns false when word missing', () => {
      expect(containsAllWords('payment to amazon', 'google payment')).toBe(false);
    });
  });

  describe('containsAnyWord', () => {
    it('partial matching', () => {
      expect(containsAnyWord('payment to amazon', 'google amazon')).toBe(true);
    });
    it('returns false when no match', () => {
      expect(containsAnyWord('payment to amazon', 'google facebook')).toBe(false);
    });
  });

  describe('fuzzyContains', () => {
    it('exact substring match returns true', () => {
      expect(fuzzyContains('Amazon Marketplace Purchase', 'amazon marketplace')).toBe(true);
    });

    it('dissimilar strings return false', () => {
      expect(fuzzyContains('Walmart Grocery', 'costco wholesale')).toBe(false);
    });
  });

  describe('matchText', () => {
    it('contains operator', () => {
      expect(matchText('hello world', 'contains', 'world')).toBe(true);
      expect(matchText('hello world', 'contains', 'xyz')).toBe(false);
    });

    it('equals operator', () => {
      expect(matchText('hello', 'equals', 'hello')).toBe(true);
      expect(matchText('hello world', 'equals', 'hello')).toBe(false);
    });

    it('starts_with operator', () => {
      expect(matchText('hello world', 'starts_with', 'hello')).toBe(true);
    });

    it('fuzzy_match operator', () => {
      expect(matchText('Amazon Store', 'fuzzy_match', 'amazn store')).toBe(true);
    });

    it('matches_regex operator', () => {
      expect(matchText('INV-2024-001', 'matches_regex', 'INV-\\d{4}-\\d+')).toBe(true);
    });
  });

  describe('extractVendorName', () => {
    it('strips common prefixes and returns cleaned text', () => {
      const vendor = extractVendorName('ONLINE PAYMENT SHOPIFY');
      expect(vendor).not.toContain('online payment');
      expect(vendor.length).toBeGreaterThan(0);
    });

    it('removes long reference numbers', () => {
      const vendor = extractVendorName('AMAZON 123456789 SEATTLE');
      expect(vendor).not.toMatch(/\d{4,}/);
    });
  });

  describe('getMatchConfidence', () => {
    it('exact substring returns 1.0', () => {
      expect(getMatchConfidence('Amazon Payment', 'amazon')).toBe(1.0);
    });

    it('no match returns low confidence', () => {
      expect(getMatchConfidence('Amazon', 'xyz completely different')).toBeLessThan(0.5);
    });
  });
});

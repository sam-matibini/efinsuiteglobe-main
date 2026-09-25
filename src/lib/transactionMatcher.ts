// Enhanced transaction matching utilities with fuzzy and intelligent matching

/**
 * Normalize text for better matching:
 * - Lowercase
 * - Remove extra spaces
 * - Normalize special characters
 * - Handle common variations
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace special chars with spaces
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
}

/**
 * Extract meaningful words from text (removes common stop words)
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'inc', 'ltd', 'llc', 'corp', 'co', 'limited', 'corporation', 'company',
]);

export function extractKeyWords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length > 1);
  return words.filter(w => !STOP_WORDS.has(w));
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // deletion
        matrix[j - 1][i] + 1,      // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  
  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;
  
  const maxLen = Math.max(normA.length, normB.length);
  const distance = levenshteinDistance(normA, normB);
  
  return 1 - (distance / maxLen);
}

/**
 * Check if text contains all specified words (order-independent)
 */
export function containsAllWords(text: string, searchWords: string): boolean {
  const textNorm = normalizeText(text);
  const searchTerms = normalizeText(searchWords).split(' ').filter(w => w.length > 0);
  
  return searchTerms.every(term => textNorm.includes(term));
}

/**
 * Check if text contains any of the specified words
 */
export function containsAnyWord(text: string, searchWords: string): boolean {
  const textNorm = normalizeText(text);
  const searchTerms = normalizeText(searchWords).split(' ').filter(w => w.length > 0);
  
  return searchTerms.some(term => textNorm.includes(term));
}

/**
 * Fuzzy contains - checks if the search term is approximately contained in the text
 * Uses word-level matching with similarity threshold
 */
export function fuzzyContains(text: string, searchValue: string, threshold = 0.7): boolean {
  const textNorm = normalizeText(text);
  const searchNorm = normalizeText(searchValue);
  
  // Direct contains check first
  if (textNorm.includes(searchNorm)) return true;
  
  // Check if normalized versions match after removing common suffixes
  const textWords = textNorm.split(' ');
  const searchWords = searchNorm.split(' ').filter(w => w.length > 1);
  
  // For each search word, check if any text word is similar enough
  const matchedWords = searchWords.filter(searchWord => {
    return textWords.some(textWord => {
      // Exact match
      if (textWord === searchWord) return true;
      
      // One contains the other
      if (textWord.includes(searchWord) || searchWord.includes(textWord)) return true;
      
      // Fuzzy match for longer words
      if (searchWord.length >= 4 && textWord.length >= 4) {
        const similarity = stringSimilarity(textWord, searchWord);
        return similarity >= threshold;
      }
      
      return false;
    });
  });
  
  // Consider a match if most search words are found
  const matchRatio = matchedWords.length / searchWords.length;
  return matchRatio >= 0.6; // At least 60% of words must match
}

/**
 * Extract vendor/company name from transaction description
 * Common patterns in bank statements
 */
export function extractVendorName(description: string): string {
  const normalized = normalizeText(description);
  
  // Remove common transaction prefixes
  const prefixes = [
    'payment to', 'purchase at', 'pos purchase', 'pos debit', 'debit card',
    'credit card', 'online payment', 'eft payment', 'wire transfer',
    'interac purchase', 'interac e transfer', 'pre authorized',
    'automatic payment', 'recurring payment', 'bill payment',
    'check cashed', 'cheque', 'payroll', 'direct deposit',
  ];
  
  let cleaned = normalized;
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length).trim();
    }
  }
  
  // Remove common suffixes (dates, reference numbers, locations)
  cleaned = cleaned
    .replace(/\d{4,}/g, '') // Remove long numbers
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '') // Remove dates
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d+/gi, '') // Remove month-day
    .replace(/\s*(ontario|quebec|alberta|bc|british columbia|manitoba|saskatchewan|ns|nb|nl|pei|nunavut|nwt|yukon|on|qc|ab|mb|sk)\s*/gi, ' ') // Remove provinces
    .replace(/\s*(canada|usa|us|united states)\s*/gi, ' ') // Remove countries
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
}

/**
 * Enhanced matching operators for transaction rules
 */
export type EnhancedOperator = 
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'contains_words'    // All words must be present (order-independent)
  | 'contains_any_word' // At least one word present
  | 'fuzzy_match'       // Fuzzy matching with similarity threshold
  | 'matches_regex';    // Regex pattern matching

export interface MatchOptions {
  fuzzyThreshold?: number;
  caseSensitive?: boolean;
  normalizeBeforeMatch?: boolean;
  /** Optional cash-flow direction of the transaction: 'inflow' (deposit/credit/payment) or 'outflow' (withdrawal/charge/fee). */
  txDirection?: 'inflow' | 'outflow' | null;
}

/** Synonym map: when a user types one of these keywords, also accept it as a hit
 * if the transaction's cash-flow direction matches. Lets a rule like
 * `Description contains "deposit"` fire on an Interac e-Transfer credit even if
 * the bank's description never literally says "deposit". */
const INFLOW_SYNONYMS = new Set([
  'deposit', 'deposits', 'credit', 'credits', 'inflow', 'inflows',
  'received', 'refund', 'refunded', 'payment received', 'incoming',
  'e transfer', 'etransfer', 'interac credit',
]);
const OUTFLOW_SYNONYMS = new Set([
  'withdrawal', 'withdrawals', 'debit', 'debits', 'outflow', 'outflows',
  'purchase', 'purchases', 'charge', 'charges', 'paid', 'payment sent',
  'fee', 'fees', 'interest', 'outgoing',
]);

function matchesIntent(searchValue: string, txDirection?: 'inflow' | 'outflow' | null): boolean {
  if (!txDirection) return false;
  const term = normalizeText(searchValue);
  if (!term) return false;
  const bag = txDirection === 'inflow' ? INFLOW_SYNONYMS : OUTFLOW_SYNONYMS;
  return bag.has(term);
}

/** Lenient fuzzy: relaxes coverage when the search is a single word so things like
 * `fuzzy "deposit"` can approximate against typos / partials. */
function fuzzyContainsLenient(text: string, searchValue: string, threshold = 0.7): boolean {
  if (fuzzyContains(text, searchValue, threshold)) return true;
  const textNorm = normalizeText(text);
  const searchWords = normalizeText(searchValue).split(' ').filter((w) => w.length > 1);
  if (searchWords.length !== 1) return false;
  const term = searchWords[0];
  return textNorm.split(' ').some((w) => {
    if (!w) return false;
    if (w.includes(term) || term.includes(w)) return true;
    if (w.length >= 4 && term.length >= 4) {
      return stringSimilarity(w, term) >= Math.min(threshold, 0.7);
    }
    return false;
  });
}

/**
 * Enhanced text matching function supporting multiple operators
 */
export function matchText(
  text: string,
  operator: EnhancedOperator | string,
  searchValue: string,
  options: MatchOptions = {}
): boolean {
  const { 
    fuzzyThreshold = 0.7, 
    caseSensitive = false,
    normalizeBeforeMatch = true,
    txDirection = null,
  } = options;
  
  let textToMatch = text || '';
  let valueToSearch = searchValue || '';
  
  if (normalizeBeforeMatch) {
    textToMatch = normalizeText(textToMatch);
    valueToSearch = normalizeText(valueToSearch);
  } else if (!caseSensitive) {
    textToMatch = textToMatch.toLowerCase();
    valueToSearch = valueToSearch.toLowerCase();
  }
  
  switch (operator) {
    case 'contains':
      // Strict substring first, then intent synonyms (cash-flow direction)
      if (textToMatch.includes(valueToSearch)) return true;
      return matchesIntent(searchValue, txDirection);
      
    case 'not_contains':
      return !textToMatch.includes(valueToSearch);
      
    case 'equals':
      return textToMatch === valueToSearch;
      
    case 'not_equals':
      return textToMatch !== valueToSearch;
      
    case 'starts_with':
      return textToMatch.startsWith(valueToSearch);
      
    case 'ends_with':
      return textToMatch.endsWith(valueToSearch);
      
    case 'contains_words':
      return containsAllWords(text, searchValue);
      
    case 'contains_any_word':
      return containsAnyWord(text, searchValue);
      
    case 'fuzzy_match':
      if (fuzzyContainsLenient(text, searchValue, fuzzyThreshold)) return true;
      return matchesIntent(searchValue, txDirection);
      
    case 'matches_regex':
      try {
        const regex = new RegExp(searchValue, caseSensitive ? '' : 'i');
        return regex.test(text);
      } catch {
        return false;
      }
      
    default:
      return textToMatch.includes(valueToSearch);
  }
}

/**
 * Get confidence score for a match
 */
export function getMatchConfidence(
  text: string,
  searchValue: string
): number {
  const textNorm = normalizeText(text);
  const searchNorm = normalizeText(searchValue);
  
  // Exact match
  if (textNorm.includes(searchNorm)) return 1.0;
  
  // Extract vendor and compare
  const vendor = extractVendorName(text);
  if (vendor.includes(searchNorm)) return 0.95;
  
  // Fuzzy similarity
  const similarity = stringSimilarity(vendor, searchNorm);
  if (similarity >= 0.8) return similarity;
  
  // Word-based matching
  const searchWords = searchNorm.split(' ').filter(w => w.length > 2);
  const vendorWords = vendor.split(' ').filter(w => w.length > 2);
  
  if (searchWords.length === 0) return 0;
  
  const matchedCount = searchWords.filter(sw =>
    vendorWords.some(vw => vw.includes(sw) || sw.includes(vw) || stringSimilarity(sw, vw) >= 0.8)
  ).length;
  
  return matchedCount / searchWords.length * 0.8;
}

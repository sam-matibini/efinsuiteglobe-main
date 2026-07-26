import { useCallback, useEffect, useState } from 'react';

/**
 * Country scope (ISO alpha-2) — the primary D365-style scope.
 * When set, the org switcher and every localized module is restricted
 * to organizations/data for that country. `null` means "not yet chosen".
 */
const KEY = 'efs.country_filter';
const EVENT = 'efs:country-filter-change';

function read(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function useCountryFilter() {
  const [country, setCountryState] = useState<string | null>(() => read());

  useEffect(() => {
    const sync = () => setCountryState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setCountry = useCallback((code: string | null) => {
    try {
      if (code) localStorage.setItem(KEY, code.toUpperCase());
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const clear = useCallback(() => setCountry(null), [setCountry]);

  return { country, setCountry, clear };
}

/** Alias — country scope is now the primary selector, not just a filter. */
export const useCountryScope = useCountryFilter;

/** Best-effort normalization of an Organization.country string to ISO alpha-2. */
const NAME_TO_CODE: Record<string, string> = {
  canada: 'CA',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  america: 'US',
  nigeria: 'NG',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  australia: 'AU',
  india: 'IN',
  germany: 'DE',
  france: 'FR',
  ireland: 'IE',
  'south africa': 'ZA',
  ghana: 'GH',
  kenya: 'KE',
};

export function normalizeCountryCode(raw?: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const hit = NAME_TO_CODE[t.toLowerCase()];
  return hit ?? null;
}

const CODE_TO_NAME: Record<string, string> = {
  CA: 'Canada',
  US: 'United States',
  NG: 'Nigeria',
  GB: 'United Kingdom',
  AU: 'Australia',
  IN: 'India',
  DE: 'Germany',
  FR: 'France',
  IE: 'Ireland',
  ZA: 'South Africa',
  GH: 'Ghana',
  KE: 'Kenya',
};

export function countryName(code: string): string {
  return CODE_TO_NAME[code] ?? code;
}

/** Flag emoji from ISO alpha-2 code. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🏳️';
  const cc = code.toUpperCase();
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
]);

export function isEuCountry(code?: string | null): boolean {
  return !!code && EU_COUNTRIES.has(code.toUpperCase());
}

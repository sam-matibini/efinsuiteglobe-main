import { useCallback, useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization, COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { parseLocalDate } from '@/lib/utils';

export interface LocalizedCurrencyOptions {
  showSymbol?: boolean;
  showZeroAsDash?: boolean;
  forceNegativeFormat?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  compact?: boolean;
}

// Locale mapping for Intl.NumberFormat
const LOCALE_MAP: Record<string, string> = {
  CA: 'en-CA',
  US: 'en-US',
  ZM: 'en-ZM',
  KE: 'en-KE',
  BI: 'fr-BI',
};

// Financial institution names by country
const FINANCIAL_INSTITUTIONS: Record<string, string[]> = {
  CA: ['TD Canada Trust', 'RBC Royal Bank', 'BMO Bank of Montreal', 'Scotiabank', 'CIBC', 'National Bank', 'Desjardins', 'ATB Financial'],
  US: ['Bank of America', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One', 'US Bank', 'PNC Bank', 'Truist'],
  ZM: ['Zanaco', 'Stanbic Bank Zambia', 'Standard Chartered Zambia', 'First National Bank Zambia', 'Absa Zambia', 'Access Bank Zambia'],
  KE: ['Kenya Commercial Bank', 'Equity Bank', 'Cooperative Bank', 'Absa Kenya', 'Standard Chartered Kenya', 'NCBA', 'Stanbic Kenya'],
  BI: ['Banque de la République du Burundi', 'Interbank Burundi', 'Kenya Commercial Bank Burundi', 'Ecobank Burundi', 'Diamond Trust Bank Burundi'],
};

// Accounting standards by country
const ACCOUNTING_STANDARDS: Record<string, { standard: string; label: string }> = {
  CA: { standard: 'ASPE/IFRS', label: 'Canadian GAAP' },
  US: { standard: 'US GAAP', label: 'US GAAP' },
  ZM: { standard: 'IFRS', label: 'IFRS' },
  KE: { standard: 'IFRS', label: 'IFRS' },
  BI: { standard: 'OHADA/IFRS', label: 'SYSCOHADA / IFRS' },
  NG: { standard: 'IFRS/IFRS for SMEs', label: 'Nigerian GAAP (IFRS)' },
};

// NPO-specific accounting standards (ASNPO for Canadian NPOs)
export const NPO_ACCOUNTING_STANDARDS: Record<string, { standard: string; label: string }> = {
  CA: { standard: 'ASNPO', label: 'Accounting Standards for Not-for-Profit Organizations' },
  US: { standard: 'FASB ASC 958', label: 'Not-for-Profit Entities' },
  ZM: { standard: 'IFRS for NPOs', label: 'IFRS for Not-for-Profit' },
  KE: { standard: 'IFRS for NPOs', label: 'IFRS for Not-for-Profit' },
  BI: { standard: 'SYSCOHADA NPO', label: 'SYSCOHADA for Associations' },
};

// Financial terminology by country
export const FINANCIAL_TERMINOLOGY: Record<string, {
  incomeStatement: string;
  balanceSheet: string;
  cashFlow: string;
  trialBalance: string;
  journalEntry: string;
  generalLedger: string;
  accountsReceivable: string;
  accountsPayable: string;
  netIncome: string;
  grossProfit: string;
  operatingExpenses: string;
  currentAssets: string;
  fixedAssets: string;
  currentLiabilities: string;
  equity: string;
  bankAccount: string;
  reconciliation: string;
}> = {
  CA: {
    incomeStatement: 'Income Statement',
    balanceSheet: 'Balance Sheet',
    cashFlow: 'Cash Flow Statement',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Accounts Receivable',
    accountsPayable: 'Accounts Payable',
    netIncome: 'Net Income',
    grossProfit: 'Gross Profit',
    operatingExpenses: 'Operating Expenses',
    currentAssets: 'Current Assets',
    fixedAssets: 'Fixed Assets',
    currentLiabilities: 'Current Liabilities',
    equity: 'Shareholders\' Equity',
    bankAccount: 'Bank Account',
    reconciliation: 'Reconciliation',
  },
  US: {
    incomeStatement: 'Profit & Loss Statement',
    balanceSheet: 'Balance Sheet',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Accounts Receivable',
    accountsPayable: 'Accounts Payable',
    netIncome: 'Net Income',
    grossProfit: 'Gross Profit',
    operatingExpenses: 'Operating Expenses',
    currentAssets: 'Current Assets',
    fixedAssets: 'Property, Plant & Equipment',
    currentLiabilities: 'Current Liabilities',
    equity: 'Stockholders\' Equity',
    bankAccount: 'Bank Account',
    reconciliation: 'Reconciliation',
  },
  ZM: {
    incomeStatement: 'Statement of Comprehensive Income',
    balanceSheet: 'Statement of Financial Position',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Trade Receivables',
    accountsPayable: 'Trade Payables',
    netIncome: 'Profit/(Loss) for the Period',
    grossProfit: 'Gross Profit',
    operatingExpenses: 'Administrative Expenses',
    currentAssets: 'Current Assets',
    fixedAssets: 'Property, Plant and Equipment',
    currentLiabilities: 'Current Liabilities',
    equity: 'Equity',
    bankAccount: 'Bank Account',
    reconciliation: 'Bank Reconciliation',
  },
  KE: {
    incomeStatement: 'Statement of Comprehensive Income',
    balanceSheet: 'Statement of Financial Position',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Trade Receivables',
    accountsPayable: 'Trade Payables',
    netIncome: 'Profit/(Loss) for the Period',
    grossProfit: 'Gross Profit',
    operatingExpenses: 'Administrative Expenses',
    currentAssets: 'Current Assets',
    fixedAssets: 'Property, Plant and Equipment',
    currentLiabilities: 'Current Liabilities',
    equity: 'Equity',
    bankAccount: 'Bank Account',
    reconciliation: 'Bank Reconciliation',
  },
  BI: {
    incomeStatement: 'Compte de Résultat',
    balanceSheet: 'Bilan',
    cashFlow: 'Tableau des Flux de Trésorerie',
    trialBalance: 'Balance Générale',
    journalEntry: 'Écriture Comptable',
    generalLedger: 'Grand Livre',
    accountsReceivable: 'Créances Clients',
    accountsPayable: 'Dettes Fournisseurs',
    netIncome: 'Résultat Net',
    grossProfit: 'Marge Brute',
    operatingExpenses: 'Charges d\'Exploitation',
    currentAssets: 'Actifs Circulants',
    fixedAssets: 'Immobilisations',
    currentLiabilities: 'Passif Circulant',
    equity: 'Capitaux Propres',
    bankAccount: 'Compte Bancaire',
    reconciliation: 'Rapprochement Bancaire',
  },
};

// NPO/ASNPO-specific financial terminology by country
export const NPO_FINANCIAL_TERMINOLOGY: Record<string, {
  incomeStatement: string;
  balanceSheet: string;
  cashFlow: string;
  trialBalance: string;
  journalEntry: string;
  generalLedger: string;
  accountsReceivable: string;
  accountsPayable: string;
  netIncome: string;
  grossProfit: string;
  operatingExpenses: string;
  currentAssets: string;
  fixedAssets: string;
  currentLiabilities: string;
  equity: string;
  bankAccount: string;
  reconciliation: string;
  // NPO-specific terms
  netAssets: string;
  unrestrictedNetAssets: string;
  restrictedNetAssets: string;
  endowmentNetAssets: string;
  deferredContributions: string;
  excessRevenue: string;
  deficiencyRevenue: string;
  donationRevenue: string;
  grantRevenue: string;
  programExpenses: string;
  fundraisingExpenses: string;
  managementExpenses: string;
  totalRevenue?: string;
  beginningBalance?: string;
  endingBalance?: string;
  interfundTransfers?: string;
}> = {
  CA: {
    incomeStatement: 'Statement of Operations',
    balanceSheet: 'Statement of Financial Position',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Pledges & Grants Receivable',
    accountsPayable: 'Accounts Payable',
    netIncome: 'Excess (Deficiency) of Revenue over Expenses',
    grossProfit: 'Total Revenue',
    operatingExpenses: 'Expenses',
    totalRevenue: 'Total Revenue',
    beginningBalance: 'Balance, beginning of year',
    endingBalance: 'Balance, end of year',
    interfundTransfers: 'Interfund transfers',
    currentAssets: 'Current Assets',
    fixedAssets: 'Capital Assets',
    currentLiabilities: 'Current Liabilities',
    equity: 'Net Assets',
    bankAccount: 'Bank Account',
    reconciliation: 'Reconciliation',
    // NPO-specific
    netAssets: 'Net Assets',
    unrestrictedNetAssets: 'Unrestricted Net Assets',
    restrictedNetAssets: 'Externally Restricted Net Assets',
    endowmentNetAssets: 'Endowment Net Assets',
    deferredContributions: 'Deferred Contributions',
    excessRevenue: 'Excess of Revenue over Expenses',
    deficiencyRevenue: 'Deficiency of Revenue over Expenses',
    donationRevenue: 'Donation Revenue',
    grantRevenue: 'Grant Revenue',
    programExpenses: 'Program Expenses',
    fundraisingExpenses: 'Fundraising Expenses',
    managementExpenses: 'Management & General Expenses',
  },
  US: {
    incomeStatement: 'Statement of Activities',
    balanceSheet: 'Statement of Financial Position',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Pledges Receivable',
    accountsPayable: 'Accounts Payable',
    netIncome: 'Change in Net Assets',
    grossProfit: 'Total Revenue',
    operatingExpenses: 'Total Expenses',
    currentAssets: 'Current Assets',
    fixedAssets: 'Property and Equipment',
    currentLiabilities: 'Current Liabilities',
    equity: 'Net Assets',
    bankAccount: 'Bank Account',
    reconciliation: 'Reconciliation',
    // NPO-specific
    netAssets: 'Net Assets',
    unrestrictedNetAssets: 'Net Assets Without Donor Restrictions',
    restrictedNetAssets: 'Net Assets With Donor Restrictions',
    endowmentNetAssets: 'Endowment Funds',
    deferredContributions: 'Refundable Advances',
    excessRevenue: 'Increase in Net Assets',
    deficiencyRevenue: 'Decrease in Net Assets',
    donationRevenue: 'Contributions',
    grantRevenue: 'Government Grants',
    programExpenses: 'Program Services',
    fundraisingExpenses: 'Fundraising',
    managementExpenses: 'Management and General',
  },
  ZM: {
    incomeStatement: 'Statement of Comprehensive Income',
    balanceSheet: 'Statement of Financial Position',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Grants Receivable',
    accountsPayable: 'Accounts Payable',
    netIncome: 'Surplus/(Deficit)',
    grossProfit: 'Total Income',
    operatingExpenses: 'Total Expenditure',
    currentAssets: 'Current Assets',
    fixedAssets: 'Property, Plant and Equipment',
    currentLiabilities: 'Current Liabilities',
    equity: 'Accumulated Funds',
    bankAccount: 'Bank Account',
    reconciliation: 'Reconciliation',
    // NPO-specific
    netAssets: 'Accumulated Funds',
    unrestrictedNetAssets: 'Unrestricted Funds',
    restrictedNetAssets: 'Restricted Funds',
    endowmentNetAssets: 'Endowment Funds',
    deferredContributions: 'Deferred Income',
    excessRevenue: 'Surplus for the Period',
    deficiencyRevenue: 'Deficit for the Period',
    donationRevenue: 'Donations and Contributions',
    grantRevenue: 'Grant Income',
    programExpenses: 'Programme Costs',
    fundraisingExpenses: 'Fundraising Costs',
    managementExpenses: 'Administrative Costs',
  },
  KE: {
    incomeStatement: 'Statement of Comprehensive Income',
    balanceSheet: 'Statement of Financial Position',
    cashFlow: 'Statement of Cash Flows',
    trialBalance: 'Trial Balance',
    journalEntry: 'Journal Entry',
    generalLedger: 'General Ledger',
    accountsReceivable: 'Grants Receivable',
    accountsPayable: 'Accounts Payable',
    netIncome: 'Surplus/(Deficit)',
    grossProfit: 'Total Income',
    operatingExpenses: 'Total Expenditure',
    currentAssets: 'Current Assets',
    fixedAssets: 'Property, Plant and Equipment',
    currentLiabilities: 'Current Liabilities',
    equity: 'Accumulated Funds',
    bankAccount: 'Bank Account',
    reconciliation: 'Reconciliation',
    // NPO-specific
    netAssets: 'Accumulated Funds',
    unrestrictedNetAssets: 'Unrestricted Funds',
    restrictedNetAssets: 'Restricted Funds',
    endowmentNetAssets: 'Endowment Funds',
    deferredContributions: 'Deferred Income',
    excessRevenue: 'Surplus for the Period',
    deficiencyRevenue: 'Deficit for the Period',
    donationRevenue: 'Donations and Contributions',
    grantRevenue: 'Grant Income',
    programExpenses: 'Programme Costs',
    fundraisingExpenses: 'Fundraising Costs',
    managementExpenses: 'Administrative Costs',
  },
  BI: {
    incomeStatement: 'Compte de Résultat',
    balanceSheet: 'Bilan',
    cashFlow: 'Tableau des Flux de Trésorerie',
    trialBalance: 'Balance Générale',
    journalEntry: 'Écriture Comptable',
    generalLedger: 'Grand Livre',
    accountsReceivable: 'Subventions à Recevoir',
    accountsPayable: 'Dettes Fournisseurs',
    netIncome: 'Excédent/(Déficit)',
    grossProfit: 'Total des Produits',
    operatingExpenses: 'Total des Charges',
    currentAssets: 'Actifs Circulants',
    fixedAssets: 'Immobilisations',
    currentLiabilities: 'Passif Circulant',
    equity: 'Fonds Propres',
    bankAccount: 'Compte Bancaire',
    reconciliation: 'Rapprochement Bancaire',
    // NPO-specific
    netAssets: 'Fonds Propres',
    unrestrictedNetAssets: 'Fonds Non Affectés',
    restrictedNetAssets: 'Fonds Affectés',
    endowmentNetAssets: 'Fonds de Dotation',
    deferredContributions: 'Produits Différés',
    excessRevenue: 'Excédent de l\'Exercice',
    deficiencyRevenue: 'Déficit de l\'Exercice',
    donationRevenue: 'Dons et Contributions',
    grantRevenue: 'Subventions',
    programExpenses: 'Charges de Programme',
    fundraisingExpenses: 'Charges de Collecte de Fonds',
    managementExpenses: 'Charges Administratives',
  },
};

export function useLocalizedCurrency() {
  const { organization } = useCurrentOrganization();
  const { preferences } = useUserPreferences();
  
  // Get country code from organization, default to CA
  const countryCode = useMemo(() => {
    // Try to get from organization's country field
    if (organization?.country) {
      return organization.country;
    }
    // Fallback to CA
    return 'CA';
  }, [organization?.country]);
  
  const localization = useMemo(() => getCountryLocalization(countryCode), [countryCode]);
  const locale = useMemo(() => LOCALE_MAP[countryCode] || 'en-US', [countryCode]);
  const negativeFormat = preferences?.negative_format || 'minus';
  
  // Format currency with full localization
  const formatCurrency = useCallback((value: number, options: LocalizedCurrencyOptions = {}) => {
    const {
      showSymbol = true,
      showZeroAsDash = false,
      forceNegativeFormat = false,
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
      compact = false,
    } = options;
    
    // Handle zero display
    if (showZeroAsDash && value === 0) {
      return '-';
    }
    
    const absValue = Math.abs(value);
    
    // Format the absolute value
    let formatted: string;
    if (showSymbol) {
      formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: localization.currency,
        minimumFractionDigits,
        maximumFractionDigits,
        notation: compact ? 'compact' : 'standard',
      }).format(absValue);
    } else {
      formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits,
        maximumFractionDigits,
        notation: compact ? 'compact' : 'standard',
      }).format(absValue);
    }
    
    // Apply negative formatting
    const isNegative = value < 0 || forceNegativeFormat;
    if (isNegative && value !== 0) {
      if (negativeFormat === 'brackets') {
        return `(${formatted})`;
      } else {
        return `-${formatted}`;
      }
    }
    
    return formatted;
  }, [locale, localization.currency, negativeFormat]);
  
  // Format with symbol (for totals, headlines)
  const formatWithSymbol = useCallback((value: number, forceNegative = false) => {
    return formatCurrency(value, { showSymbol: true, forceNegativeFormat: forceNegative });
  }, [formatCurrency]);
  
  // Format without symbol but show zero as dash (for report rows)
  const formatForReport = useCallback((value: number) => {
    return formatCurrency(value, { showZeroAsDash: true, showSymbol: false });
  }, [formatCurrency]);
  
  // Format for compact display (e.g., 1.2K, 3.5M)
  const formatCompact = useCallback((value: number) => {
    return formatCurrency(value, { showSymbol: true, compact: true });
  }, [formatCurrency]);
  
  // Format date according to locale - uses parseLocalDate to avoid timezone issues
  const formatDate = useCallback((date: string | Date, style: 'short' | 'medium' | 'long' = 'medium') => {
    // Parse string dates as local to prevent timezone offset issues
    const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
    const options: Intl.DateTimeFormatOptions = style === 'short' 
      ? { month: 'numeric', day: 'numeric', year: '2-digit' }
      : style === 'medium'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { month: 'long', day: 'numeric', year: 'numeric' };
    return new Intl.DateTimeFormat(locale, options).format(dateObj);
  }, [locale]);
  
  // Get financial terminology for the country
  const terminology = useMemo(() => {
    return FINANCIAL_TERMINOLOGY[countryCode] || FINANCIAL_TERMINOLOGY.CA;
  }, [countryCode]);
  
  // Get accounting standard
  const accountingStandard = useMemo(() => {
    return ACCOUNTING_STANDARDS[countryCode] || ACCOUNTING_STANDARDS.CA;
  }, [countryCode]);
  
  // Get financial institutions for the country
  const financialInstitutions = useMemo(() => {
    return FINANCIAL_INSTITUTIONS[countryCode] || FINANCIAL_INSTITUTIONS.CA;
  }, [countryCode]);
  
  return {
    formatCurrency,
    formatWithSymbol,
    formatForReport,
    formatCompact,
    formatDate,
    countryCode,
    locale,
    localization,
    terminology,
    accountingStandard,
    financialInstitutions,
    currencyCode: localization.currency,
    currencySymbol: localization.currencySymbol,
    negativeFormat,
  };
}

// Helper to get localized currencies list for dropdowns
export function getLocalizedCurrencies(countryCode: string): Array<{ code: string; name: string; symbol: string }> {
  const localization = getCountryLocalization(countryCode);
  
  // Primary currency for the country
  const primary = {
    code: localization.currency,
    name: localization.currencyName,
    symbol: localization.currencySymbol,
  };
  
  // Common international currencies
  const international = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
  ];
  
  // Combine and deduplicate
  const all = [primary, ...international];
  return all.filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i);
}

/**
 * Returns the full list of currencies from all supported countries,
 * with the primary country's currency hoisted to the top, followed
 * by major internationals (USD, EUR, GBP), then the rest alphabetically.
 */
export function getAllLocalizedCurrencies(
  primaryCountryCode?: string
): Array<{ code: string; name: string; symbol: string }> {
  const all = Object.values(COUNTRY_LOCALIZATIONS).map(loc => ({
    code: loc.currency,
    name: loc.currencyName,
    symbol: loc.currencySymbol,
  }));
  const unique = all.filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i);
  unique.sort((a, b) => a.code.localeCompare(b.code));

  const primaryCode = primaryCountryCode
    ? getCountryLocalization(primaryCountryCode).currency
    : undefined;
  const priority = [primaryCode, 'USD', 'EUR', 'GBP'].filter(Boolean) as string[];
  const seen = new Set<string>();
  const top: typeof unique = [];
  for (const code of priority) {
    if (seen.has(code)) continue;
    const found = unique.find(c => c.code === code);
    if (found) {
      top.push(found);
      seen.add(code);
    }
  }
  const rest = unique.filter(c => !seen.has(c.code));
  return [...top, ...rest];
}

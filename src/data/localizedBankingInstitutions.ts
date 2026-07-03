// Localized Banking Institutions, Credit Card Issuers, and Clearing Houses by Country

export interface BankingInstitution {
  code: string;
  name: string;
  swiftCode?: string;
  type: 'commercial' | 'central' | 'clearing' | 'microfinance' | 'mobile' | 'mobile_money' | 'ewallet';
}

export interface CreditCardIssuer {
  code: string;
  name: string;
  network: 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'other';
  type: 'bank' | 'independent' | 'retail' | 'fleet';
}

export interface ClearingHouse {
  code: string;
  name: string;
  type: 'ach' | 'rtgs' | 'mobile' | 'cards';
  description: string;
}

export interface CountryBankingConfig {
  countryCode: string;
  countryName: string;
  centralBank: BankingInstitution;
  clearingHouses: ClearingHouse[];
  institutions: BankingInstitution[];
  creditCardIssuers: CreditCardIssuer[];
  accountNumberFormat: {
    label: string;
    placeholder: string;
    maxLength: number;
  };
  routingFormat?: {
    label: string;
    placeholder: string;
    maxLength: number;
  };
  transitFormat?: {
    label: string;
    placeholder: string;
    maxLength: number;
  };
  complianceLabels: {
    encryption: string;
    regulation: string;
  };
}

export const BANKING_INSTITUTIONS: Record<string, CountryBankingConfig> = {
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    centralBank: {
      code: 'BOC',
      name: 'Bank of Canada',
      swiftCode: 'BKCHCATT',
      type: 'central',
    },
    clearingHouses: [
      { code: 'PAYMENTS_CANADA', name: 'Payments Canada', type: 'ach', description: 'National clearing and settlement system' },
      { code: 'ACSS', name: 'Automated Clearing Settlement System', type: 'ach', description: 'Batch payment processing' },
      { code: 'LVTS', name: 'Large Value Transfer System', type: 'rtgs', description: 'Real-time gross settlement' },
      { code: 'INTERAC', name: 'Interac', type: 'mobile', description: 'e-Transfer and debit network' },
    ],
    institutions: [
      { code: '001', name: 'Bank of Montreal (BMO)', swiftCode: 'BOFMCAM2', type: 'commercial' },
      { code: '002', name: 'Bank of Nova Scotia (Scotiabank)', swiftCode: 'NOSCCATT', type: 'commercial' },
      { code: '003', name: 'Royal Bank of Canada (RBC)', swiftCode: 'ROYCCAT2', type: 'commercial' },
      { code: '004', name: 'Toronto-Dominion Bank (TD)', swiftCode: 'TDOMCATT', type: 'commercial' },
      { code: '010', name: 'Canadian Imperial Bank of Commerce (CIBC)', swiftCode: 'CIBCCATT', type: 'commercial' },
      { code: '016', name: 'HSBC Bank Canada', swiftCode: 'HKBCCATT', type: 'commercial' },
      { code: '030', name: 'Canadian Western Bank', swiftCode: 'CWBKCA', type: 'commercial' },
      { code: '039', name: 'Laurentian Bank of Canada', swiftCode: 'BLCMCAM', type: 'commercial' },
      { code: '614', name: 'Tangerine Bank', swiftCode: 'ITCCCATT', type: 'commercial' },
      { code: '815', name: 'Desjardins Group', swiftCode: 'CCDQCAMM', type: 'commercial' },
      { code: '310', name: 'National Bank of Canada', swiftCode: 'BNDCCAM', type: 'commercial' },
      { code: 'INTERAC_ETRANSFER', name: 'Interac e-Transfer', type: 'mobile_money' },
      { code: 'WISE_CA', name: 'Wise (CAD)', type: 'ewallet' },
      { code: 'PAYPAL_CA', name: 'PayPal Canada', type: 'ewallet' },
      { code: 'WEALTHSIMPLE_CASH', name: 'Wealthsimple Cash', type: 'ewallet' },
      { code: 'KOHO', name: 'KOHO', type: 'ewallet' },
      { code: 'STRIPE_BAL_CA', name: 'Stripe Balance (CAD)', type: 'ewallet' },
    ],
    creditCardIssuers: [
      { code: 'TD_VISA', name: 'TD Visa', network: 'visa', type: 'bank' },
      { code: 'RBC_VISA', name: 'RBC Visa', network: 'visa', type: 'bank' },
      { code: 'CIBC_VISA', name: 'CIBC Visa', network: 'visa', type: 'bank' },
      { code: 'BMO_MC', name: 'BMO Mastercard', network: 'mastercard', type: 'bank' },
      { code: 'SCOTIA_VISA', name: 'Scotiabank Visa', network: 'visa', type: 'bank' },
      { code: 'AMEX_CA', name: 'American Express Canada', network: 'amex', type: 'independent' },
      { code: 'CAPITAL_ONE_CA', name: 'Capital One Canada', network: 'mastercard', type: 'independent' },
      { code: 'MBNA_CA', name: 'MBNA Canada', network: 'mastercard', type: 'independent' },
      { code: 'DESJ_VISA', name: 'Desjardins Visa', network: 'visa', type: 'bank' },
      { code: 'CTFS', name: 'Canadian Tire Financial Services', network: 'mastercard', type: 'retail' },
      { code: 'PC_MC', name: 'PC Mastercard (President\'s Choice)', network: 'mastercard', type: 'retail' },
      { code: 'PETRO_CANADA', name: 'Petro-Canada', network: 'other', type: 'fleet' },
      { code: 'ESSO', name: 'Esso Fleet Card', network: 'other', type: 'fleet' },
      { code: 'SHELL', name: 'Shell Fleet Card', network: 'other', type: 'fleet' },
    ],
    accountNumberFormat: {
      label: 'Account Number',
      placeholder: '1234567',
      maxLength: 12,
    },
    transitFormat: {
      label: 'Transit Number',
      placeholder: '12345',
      maxLength: 5,
    },
    complianceLabels: {
      encryption: 'Bank-grade encryption',
      regulation: 'PIPEDA & OSFI compliant',
    },
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    centralBank: {
      code: 'FED',
      name: 'Federal Reserve System',
      swiftCode: 'FRNYUS33',
      type: 'central',
    },
    clearingHouses: [
      { code: 'ACH', name: 'Automated Clearing House (NACHA)', type: 'ach', description: 'Electronic funds transfer network' },
      { code: 'FEDWIRE', name: 'Fedwire Funds Service', type: 'rtgs', description: 'Real-time gross settlement' },
      { code: 'CHIPS', name: 'Clearing House Interbank Payments System', type: 'rtgs', description: 'Large-value USD transfers' },
      { code: 'ZELLE', name: 'Zelle', type: 'mobile', description: 'Digital payments network' },
    ],
    institutions: [
      { code: '021000021', name: 'JPMorgan Chase Bank', swiftCode: 'CHASUS33', type: 'commercial' },
      { code: '026009593', name: 'Bank of America', swiftCode: 'BOFAUS3N', type: 'commercial' },
      { code: '121000358', name: 'Wells Fargo Bank', swiftCode: 'WFBIUS6S', type: 'commercial' },
      { code: '021001088', name: 'Citibank', swiftCode: 'CITIUS33', type: 'commercial' },
      { code: '031101169', name: 'US Bank', swiftCode: 'USBKUS44', type: 'commercial' },
      { code: '071000013', name: 'PNC Bank', swiftCode: 'PNCCUS33', type: 'commercial' },
      { code: '053000219', name: 'Truist Bank', swiftCode: 'SNTRUS3A', type: 'commercial' },
      { code: '091000019', name: 'Capital One Bank', swiftCode: 'HIBKUS44', type: 'commercial' },
      { code: '073000176', name: 'TD Bank USA', swiftCode: 'NABOROBB', type: 'commercial' },
      { code: '124003116', name: 'Ally Bank', swiftCode: 'GLOAUS33', type: 'commercial' },
      { code: 'PAYPAL_US', name: 'PayPal', type: 'ewallet' },
      { code: 'VENMO', name: 'Venmo', type: 'ewallet' },
      { code: 'CASHAPP', name: 'Cash App', type: 'ewallet' },
      { code: 'ZELLE_WALLET', name: 'Zelle', type: 'mobile_money' },
      { code: 'WISE_US', name: 'Wise (USD)', type: 'ewallet' },
      { code: 'CHIME', name: 'Chime', type: 'ewallet' },
      { code: 'REVOLUT_US', name: 'Revolut US', type: 'ewallet' },
      { code: 'STRIPE_BAL_US', name: 'Stripe Balance (USD)', type: 'ewallet' },
    ],
    creditCardIssuers: [
      { code: 'CHASE_VISA', name: 'Chase Visa', network: 'visa', type: 'bank' },
      { code: 'CHASE_MC', name: 'Chase Mastercard', network: 'mastercard', type: 'bank' },
      { code: 'AMEX_US', name: 'American Express', network: 'amex', type: 'independent' },
      { code: 'BOA_VISA', name: 'Bank of America Visa', network: 'visa', type: 'bank' },
      { code: 'CITI_VISA', name: 'Citi Visa', network: 'visa', type: 'bank' },
      { code: 'CITI_MC', name: 'Citi Mastercard', network: 'mastercard', type: 'bank' },
      { code: 'CAPITAL_ONE_US', name: 'Capital One', network: 'visa', type: 'independent' },
      { code: 'DISCOVER', name: 'Discover', network: 'discover', type: 'independent' },
      { code: 'WF_VISA', name: 'Wells Fargo Visa', network: 'visa', type: 'bank' },
      { code: 'US_BANK_VISA', name: 'US Bank Visa', network: 'visa', type: 'bank' },
      { code: 'SYNCHRONY', name: 'Synchrony Financial', network: 'visa', type: 'independent' },
      { code: 'WEX', name: 'WEX Fleet Card', network: 'other', type: 'fleet' },
      { code: 'COMDATA', name: 'Comdata Fleet', network: 'other', type: 'fleet' },
      { code: 'FUELMAN', name: 'Fuelman', network: 'other', type: 'fleet' },
    ],
    accountNumberFormat: {
      label: 'Account Number',
      placeholder: '123456789012',
      maxLength: 17,
    },
    routingFormat: {
      label: 'Routing Number (ABA)',
      placeholder: '021000021',
      maxLength: 9,
    },
    complianceLabels: {
      encryption: 'AES-256 encryption',
      regulation: 'FDIC insured • SOC 2 compliant',
    },
  },
  ZM: {
    countryCode: 'ZM',
    countryName: 'Zambia',
    centralBank: {
      code: 'BOZ',
      name: 'Bank of Zambia',
      swiftCode: 'BKZAZMLX',
      type: 'central',
    },
    clearingHouses: [
      { code: 'ZECHL', name: 'Zambia Electronic Clearing House Limited', type: 'ach', description: 'Electronic cheque clearing and ACH' },
      { code: 'ZIPSS', name: 'Zambia Interbank Payment Settlement System', type: 'rtgs', description: 'Real-time gross settlement' },
      { code: 'ZNNPS', name: 'Zambia National Payment System', type: 'ach', description: 'National payment infrastructure' },
      { code: 'ZAMTEL_MONEY', name: 'Zamtel Money / Mobile Money', type: 'mobile', description: 'Mobile money services' },
    ],
    institutions: [
      { code: 'ZNTB', name: 'Zambia National Commercial Bank (ZANACO)', swiftCode: 'ZABORMLX', type: 'commercial' },
      { code: 'SBZM', name: 'Stanbic Bank Zambia', swiftCode: 'SBICZMLX', type: 'commercial' },
      { code: 'BARZ', name: 'Barclays Bank Zambia (ABSA)', swiftCode: 'BABORMLX', type: 'commercial' },
      { code: 'SCZM', name: 'Standard Chartered Bank Zambia', swiftCode: 'SCBLZMLX', type: 'commercial' },
      { code: 'FNZM', name: 'First National Bank Zambia', swiftCode: 'FIABORMLX', type: 'commercial' },
      { code: 'CBZM', name: 'Citibank Zambia', swiftCode: 'CITIZMLX', type: 'commercial' },
      { code: 'EQZM', name: 'Ecobank Zambia', swiftCode: 'EABORMLX', type: 'commercial' },
      { code: 'ABZM', name: 'Atlas Mara Bank Zambia', swiftCode: 'BABORMLX', type: 'commercial' },
      { code: 'IDBZ', name: 'Indo-Zambia Bank', swiftCode: 'INZAZMLX', type: 'commercial' },
      { code: 'AAZM', name: 'Access Bank Zambia', swiftCode: 'ABNGZMLX', type: 'commercial' },
      { code: 'UBAZ', name: 'United Bank for Africa Zambia', swiftCode: 'UNAFZMLX', type: 'commercial' },
      { code: 'MTN_MOMO_ZM', name: 'MTN MoMo Zambia', type: 'mobile_money' },
      { code: 'AIRTEL_MONEY_ZM', name: 'Airtel Money Zambia', type: 'mobile_money' },
      { code: 'ZAMTEL_KWACHA', name: 'Zamtel Kwacha', type: 'mobile_money' },
      { code: 'KAZANG', name: 'Kazang Wallet', type: 'ewallet' },
      { code: 'BROADPAY_ZM', name: 'Broadpay', type: 'ewallet' },
    ],
    creditCardIssuers: [
      { code: 'ZANACO_VISA', name: 'ZANACO Visa', network: 'visa', type: 'bank' },
      { code: 'STANBIC_MC', name: 'Stanbic Mastercard', network: 'mastercard', type: 'bank' },
      { code: 'ABSA_ZM_VISA', name: 'ABSA Zambia Visa', network: 'visa', type: 'bank' },
      { code: 'SCB_ZM_VISA', name: 'Standard Chartered Zambia Visa', network: 'visa', type: 'bank' },
    ],
    accountNumberFormat: {
      label: 'Account Number',
      placeholder: '0123456789',
      maxLength: 13,
    },
    complianceLabels: {
      encryption: 'Bank-grade encryption',
      regulation: 'BOZ regulated • Anti-Money Laundering Act compliant',
    },
  },
  KE: {
    countryCode: 'KE',
    countryName: 'Kenya',
    centralBank: {
      code: 'CBK',
      name: 'Central Bank of Kenya',
      swiftCode: 'CBKEKENA',
      type: 'central',
    },
    clearingHouses: [
      { code: 'KEPSS', name: 'Kenya Electronic Payment Settlement System', type: 'rtgs', description: 'Real-time gross settlement' },
      { code: 'ACH_KENYA', name: 'ACH Kenya (EFT)', type: 'ach', description: 'Electronic funds transfer' },
      { code: 'PESALINK', name: 'PesaLink', type: 'mobile', description: 'Real-time bank-to-bank transfers' },
      { code: 'MPESA', name: 'M-Pesa (Safaricom)', type: 'mobile', description: 'Mobile money platform' },
      { code: 'IPSL', name: 'Integrated Payment Services Limited', type: 'ach', description: 'Interbank switch operator' },
    ],
    institutions: [
      { code: 'KCB', name: 'Kenya Commercial Bank (KCB)', swiftCode: 'KCABORBB', type: 'commercial' },
      { code: 'EQBL', name: 'Equity Bank Kenya', swiftCode: 'EABORBB', type: 'commercial' },
      { code: 'COOP', name: 'Co-operative Bank of Kenya', swiftCode: 'KABORBB', type: 'commercial' },
      { code: 'ABSA_KE', name: 'ABSA Bank Kenya', swiftCode: 'BABORBB', type: 'commercial' },
      { code: 'SCBK', name: 'Standard Chartered Bank Kenya', swiftCode: 'SCBLKENX', type: 'commercial' },
      { code: 'NCBA', name: 'NCBA Bank Kenya', swiftCode: 'CBAFKENX', type: 'commercial' },
      { code: 'DTB', name: 'Diamond Trust Bank Kenya', swiftCode: 'DABORBB', type: 'commercial' },
      { code: 'STANBIC_KE', name: 'Stanbic Bank Kenya', swiftCode: 'SBICKENX', type: 'commercial' },
      { code: 'I&M', name: 'I&M Bank Kenya', swiftCode: 'IMBLKENX', type: 'commercial' },
      { code: 'FAMILY', name: 'Family Bank Kenya', swiftCode: 'FABORBB', type: 'commercial' },
      { code: 'PRIME', name: 'Prime Bank Kenya', swiftCode: 'PRABORBB', type: 'commercial' },
      { code: 'NIC', name: 'NIC Bank Kenya', swiftCode: 'NINABORBB', type: 'commercial' },
      { code: 'MPESA_KE', name: 'M-Pesa (Safaricom)', type: 'mobile_money' },
      { code: 'AIRTEL_MONEY_KE', name: 'Airtel Money Kenya', type: 'mobile_money' },
      { code: 'TKASH', name: 'T-Kash (Telkom)', type: 'mobile_money' },
      { code: 'EQUITEL', name: 'Equitel', type: 'mobile_money' },
      { code: 'PAYPAL_KE', name: 'PayPal Kenya', type: 'ewallet' },
      { code: 'PESAPAL_KE', name: 'Pesapal Wallet', type: 'ewallet' },
    ],
    creditCardIssuers: [
      { code: 'KCB_VISA', name: 'KCB Visa', network: 'visa', type: 'bank' },
      { code: 'EQUITY_MC', name: 'Equity Mastercard', network: 'mastercard', type: 'bank' },
      { code: 'COOP_VISA', name: 'Co-op Bank Visa', network: 'visa', type: 'bank' },
      { code: 'ABSA_KE_VISA', name: 'ABSA Kenya Visa', network: 'visa', type: 'bank' },
      { code: 'SCB_KE_VISA', name: 'Standard Chartered Kenya Visa', network: 'visa', type: 'bank' },
      { code: 'NCBA_MC', name: 'NCBA Mastercard', network: 'mastercard', type: 'bank' },
    ],
    accountNumberFormat: {
      label: 'Account Number',
      placeholder: '0123456789012',
      maxLength: 14,
    },
    complianceLabels: {
      encryption: 'Bank-grade encryption',
      regulation: 'CBK regulated • AML Act compliant',
    },
  },
  BI: {
    countryCode: 'BI',
    countryName: 'Burundi',
    centralBank: {
      code: 'BRB',
      name: 'Banque de la République du Burundi',
      swiftCode: 'BRBUBUBI',
      type: 'central',
    },
    clearingHouses: [
      { code: 'SIMP', name: 'Système Intégré de Moyens de Paiement', type: 'ach', description: 'Integrated payment system' },
      { code: 'RTGS_BI', name: 'RTGS Burundi', type: 'rtgs', description: 'Real-time gross settlement' },
      { code: 'ECOCASH_BI', name: 'EcoCash Burundi', type: 'mobile', description: 'Mobile money services' },
      { code: 'LUMICASH', name: 'Lumicash (Lumitel)', type: 'mobile', description: 'Mobile money platform' },
    ],
    institutions: [
      { code: 'BCB', name: 'Banque Commerciale du Burundi', swiftCode: 'BCBUBUBI', type: 'commercial' },
      { code: 'BNDE', name: 'Banque Nationale pour le Développement Économique', swiftCode: 'BNDEBUBI', type: 'commercial' },
      { code: 'BCR', name: 'Banque de Crédit de Bujumbura', swiftCode: 'BCRUBUBI', type: 'commercial' },
      { code: 'IBB', name: 'Interbank Burundi', swiftCode: 'IBBUBUBI', type: 'commercial' },
      { code: 'ECOBANK_BI', name: 'Ecobank Burundi', swiftCode: 'ECOBUBUBI', type: 'commercial' },
      { code: 'DTB_BI', name: 'Diamond Trust Bank Burundi', swiftCode: 'DTBUBUBI', type: 'commercial' },
      { code: 'KCB_BI', name: 'Kenya Commercial Bank Burundi', swiftCode: 'KCBUBUBI', type: 'commercial' },
      { code: 'CODEF', name: 'Coopérative d\'Épargne et de Crédit (CODEF)', type: 'microfinance' },
      { code: 'FENACOBU', name: 'Fédération Nationale des COOPEC du Burundi', type: 'microfinance' },
      { code: 'LUMICASH_WALLET', name: 'Lumicash (Lumitel)', type: 'mobile_money' },
      { code: 'ECOCASH_BI_WALLET', name: 'EcoCash Burundi', type: 'mobile_money' },
      { code: 'SMART_PESA_BI', name: 'Smart Pesa', type: 'mobile_money' },
      { code: 'ONATEL_MOBILE', name: 'Onatel Mobile Money', type: 'mobile_money' },
      { code: 'PAYPAL_BI', name: 'PayPal Burundi', type: 'ewallet' },
    ],
    creditCardIssuers: [
      { code: 'BCB_VISA', name: 'BCB Visa', network: 'visa', type: 'bank' },
      { code: 'ECOBANK_BI_MC', name: 'Ecobank Burundi Mastercard', network: 'mastercard', type: 'bank' },
      { code: 'KCB_BI_VISA', name: 'KCB Burundi Visa', network: 'visa', type: 'bank' },
    ],
    accountNumberFormat: {
      label: 'Numéro de Compte',
      placeholder: '12345678901',
      maxLength: 16,
    },
    complianceLabels: {
      encryption: 'Chiffrement bancaire',
      regulation: 'Réglementé par la BRB • Conforme LBC/FT',
    },
  },
};

// Helper function to get banking config for a country
export function getBankingConfig(countryCode: string): CountryBankingConfig | null {
  return BANKING_INSTITUTIONS[countryCode] || null;
}

// Get all institutions for a country
export function getInstitutionsForCountry(countryCode: string): BankingInstitution[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  return config ? config.institutions : [];
}

// Get clearing houses for a country
export function getClearingHousesForCountry(countryCode: string): ClearingHouse[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  return config ? config.clearingHouses : [];
}

// Get mobile money providers for a country
export function getMobileMoneyProviders(countryCode: string): ClearingHouse[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  if (!config) return [];
  return config.clearingHouses.filter(ch => ch.type === 'mobile');
}

// Get credit card issuers for a country
export function getCreditCardIssuersForCountry(countryCode: string): CreditCardIssuer[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  return config ? config.creditCardIssuers : [];
}

// Get credit card issuers by network type
export function getCreditCardIssuersByNetwork(countryCode: string, network: CreditCardIssuer['network']): CreditCardIssuer[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  if (!config) return [];
  return config.creditCardIssuers.filter(issuer => issuer.network === network);
}

// Get fleet/fuel card issuers for a country
export function getFleetCardIssuers(countryCode: string): CreditCardIssuer[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  if (!config) return [];
  return config.creditCardIssuers.filter(issuer => issuer.type === 'fleet');
}

// Get mobile money & e-wallet institutions for a country
export function getMobileWalletInstitutions(countryCode: string): BankingInstitution[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  if (!config) return [];
  return config.institutions.filter(i => i.type === 'mobile_money' || i.type === 'ewallet');
}

// Get only traditional bank institutions for a country
export function getBankInstitutionsOnly(countryCode: string): BankingInstitution[] {
  const config = BANKING_INSTITUTIONS[countryCode];
  if (!config) return [];
  return config.institutions.filter(i => i.type === 'commercial' || i.type === 'microfinance');
}

// Map a banking institution type to bank_accounts.institution_type column value
export function mapInstitutionType(
  type: BankingInstitution['type']
): 'bank' | 'mobile_money' | 'ewallet' | 'microfinance' | 'other' {
  switch (type) {
    case 'mobile_money': return 'mobile_money';
    case 'ewallet': return 'ewallet';
    case 'microfinance': return 'microfinance';
    case 'commercial': return 'bank';
    default: return 'other';
  }
}

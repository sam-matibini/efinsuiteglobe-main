/**
 * Phase 13 — EU VAT scenario resolver.
 *
 * Determines whether a sale is:
 *   - domestic (charge supplier-country VAT)
 *   - OSS B2C cross-border (charge consumer-country VAT)
 *   - B2B reverse charge (zero-rate; customer self-accounts)
 *   - export outside EU (zero-rate)
 *
 * Pure utility — does not call the network. Combine with `validateVatNumber`
 * (VIES) to confirm a VAT ID before treating as B2B reverse charge.
 */
import { EU_COUNTRIES, type EuCountryCode, type EuVatCalcInput, type EuVatCalcResult } from './types';

export function isEuCountry(cc?: string): cc is EuCountryCode {
  if (!cc) return false;
  return (EU_COUNTRIES as readonly string[]).includes(cc.toUpperCase());
}

export function calculateEuVat(
  input: EuVatCalcInput,
  rateLookup: (countryCode: string, rateType?: 'standard' | 'reduced') => number | null,
  vatNumberIsValid: boolean = false,
): EuVatCalcResult {
  const supplier = (input.supplierCountry || '').toUpperCase();
  const customer = (input.customerCountry || '').toUpperCase();
  const net = Number(input.netAmount) || 0;
  const notes: string[] = [];

  const supplierEu = isEuCountry(supplier);
  const customerEu = isEuCountry(customer);

  // Outside-EU export — zero rate
  if (supplierEu && !customerEu) {
    notes.push('Export to non-EU country — zero-rated supply.');
    return {
      scenario: 'export_outside_eu',
      vatCountry: '', vatRate: 0, vatAmount: 0,
      netAmount: net, grossAmount: net, reverseCharge: false, notes,
    };
  }

  // Neither party in EU
  if (!supplierEu && !customerEu) {
    notes.push('Neither supplier nor customer is in the EU — no EU VAT applies.');
    return {
      scenario: 'no_eu_context',
      vatCountry: '', vatRate: 0, vatAmount: 0,
      netAmount: net, grossAmount: net, reverseCharge: false, notes,
    };
  }

  // Domestic
  if (supplierEu && customerEu && supplier === customer) {
    const rate = rateLookup(supplier, input.rateType ?? 'standard') ?? 0;
    const vat = round2(net * rate / 100);
    notes.push(`Domestic supply in ${supplier} — applying ${rate}% VAT.`);
    return {
      scenario: 'domestic',
      vatCountry: supplier, vatRate: rate, vatAmount: vat,
      netAmount: net, grossAmount: round2(net + vat), reverseCharge: false, notes,
    };
  }

  // EU cross-border
  if (supplierEu && customerEu && supplier !== customer) {
    const hasVatId = !!(input.customerVatNumber && input.customerVatNumber.trim());

    // B2B reverse charge — requires VIES-valid VAT ID
    if (hasVatId && vatNumberIsValid) {
      notes.push(`B2B intra-EU supply to ${customer} with VIES-valid VAT ID — reverse charge applies (zero-rated; customer self-accounts).`);
      return {
        scenario: 'reverse_charge_b2b',
        vatCountry: '', vatRate: 0, vatAmount: 0,
        netAmount: net, grossAmount: net, reverseCharge: true, notes,
      };
    }
    if (hasVatId && !vatNumberIsValid) {
      notes.push(`Customer VAT ID provided but NOT VIES-validated — treating as B2C until validated.`);
    }

    // B2C OSS — destination-country VAT
    const rate = rateLookup(customer, input.rateType ?? 'standard') ?? 0;
    const vat = round2(net * rate / 100);
    notes.push(`Cross-border B2C to ${customer} under OSS — applying destination-country ${rate}% VAT.`);
    return {
      scenario: 'oss_b2c',
      vatCountry: customer, vatRate: rate, vatAmount: vat,
      netAmount: net, grossAmount: round2(net + vat), reverseCharge: false, notes,
    };
  }

  // Supplier non-EU, customer in EU — typically import; outside scope of OSS unless IOSS
  notes.push('Supplier outside EU selling to EU customer — IOSS (low-value) or import VAT may apply; not auto-calculated.');
  return {
    scenario: 'no_eu_context',
    vatCountry: '', vatRate: 0, vatAmount: 0,
    netAmount: net, grossAmount: net, reverseCharge: false, notes,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

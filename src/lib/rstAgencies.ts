/**
 * Maps GST/HST/PST tax rows to QuickBooks-style sales-tax agencies.
 *
 * GST/HST net = collected − ITCs.
 * Provincial sales tax net = collected + tax paid on purchases (self-assessed).
 */
export type RstAgencyModel = 'input_credit' | 'self_assessed';

export interface RstAgencyRef {
  id: string;
  agency: string;
  taxLabel: string;
  jurisdiction: string | null;
  model: RstAgencyModel;
}

export interface RstAgencyTotals extends RstAgencyRef {
  collected: number;
  paidOnPurchases: number;
  adjustment: number;
  net: number;
}

const CRA_GST_HST: RstAgencyRef = {
  id: 'cra-gst-hst',
  agency: 'Canada Revenue Agency',
  taxLabel: 'GST/HST',
  jurisdiction: 'CA',
  model: 'input_credit',
};

export function isGstHstAgencyRow(row: {
  tax_type?: string | null;
  tax_code?: string | null;
  authority?: string | null;
}): boolean {
  if (/^(gst|hst)$/i.test(String(row.tax_type ?? ''))) return true;
  const code = String(row.tax_code ?? '').toUpperCase();
  if (code.startsWith('GST') || code.startsWith('HST')) return true;
  const auth = String(row.authority ?? '').toUpperCase();
  return auth.includes('GST') || auth.includes('HST') || auth.includes('CRA');
}

export function resolveRstAgency(row: {
  tax_type?: string | null;
  tax_code?: string | null;
  authority?: string | null;
  jurisdiction?: string | null;
}): RstAgencyRef {
  if (isGstHstAgencyRow(row) && !/^(pst|qst|rst|tvq)$/i.test(String(row.tax_type ?? ''))) {
    return CRA_GST_HST;
  }

  const hay = `${row.tax_code ?? ''} ${row.authority ?? ''} ${row.tax_type ?? ''} ${row.jurisdiction ?? ''}`.toUpperCase();

  if (hay.includes('QST') || hay.includes('TVQ') || /\bQC\b/.test(hay) || hay.includes('QUÉBEC') || hay.includes('QUEBEC')) {
    return {
      id: 'qst-rq',
      agency: 'Revenu Québec',
      taxLabel: 'QST',
      jurisdiction: 'QC',
      model: 'input_credit',
    };
  }
  if (hay.includes('MANITOBA') || /\bMB\b/.test(hay) || hay.includes('PST-MB')) {
    return {
      id: 'pst-mb',
      agency: 'Manitoba Finance',
      taxLabel: 'PST',
      jurisdiction: 'MB',
      model: 'self_assessed',
    };
  }
  if (hay.includes('SASK') || /\bSK\b/.test(hay) || hay.includes('PST-SK')) {
    return {
      id: 'pst-sk',
      agency: 'Saskatchewan Ministry of Finance',
      taxLabel: 'PST',
      jurisdiction: 'SK',
      model: 'self_assessed',
    };
  }
  if (hay.includes('BRITISH') || /\bBC\b/.test(hay) || hay.includes('PST-BC')) {
    return {
      id: 'pst-bc',
      agency: 'British Columbia Ministry of Finance',
      taxLabel: 'PST',
      jurisdiction: 'BC',
      model: 'self_assessed',
    };
  }

  const code = String(row.tax_code || row.authority || 'PST').trim() || 'PST';
  return {
    id: `pst-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    agency: String(row.authority || code),
    taxLabel: code,
    jurisdiction: row.jurisdiction ?? null,
    model: 'self_assessed',
  };
}

export function emptyRstAgency(ref: RstAgencyRef): RstAgencyTotals {
  return { ...ref, collected: 0, paidOnPurchases: 0, adjustment: 0, net: 0 };
}

export function rstAgencyNet(agency: Pick<RstAgencyTotals, 'model' | 'collected' | 'paidOnPurchases' | 'adjustment'>): number {
  if (agency.model === 'input_credit') {
    return Math.round((agency.collected - agency.paidOnPurchases + agency.adjustment + Number.EPSILON) * 100) / 100;
  }
  return Math.round((agency.collected + agency.paidOnPurchases + agency.adjustment + Number.EPSILON) * 100) / 100;
}

export function bumpRstAgency(
  map: Map<string, RstAgencyTotals>,
  row: Parameters<typeof resolveRstAgency>[0],
  side: 'collected' | 'paid' | 'adjustment',
  amount: number,
) {
  const ref = resolveRstAgency(row);
  if (!map.has(ref.id)) map.set(ref.id, emptyRstAgency(ref));
  const agency = map.get(ref.id)!;
  if (side === 'collected') agency.collected += amount;
  else if (side === 'paid') agency.paidOnPurchases += amount;
  else agency.adjustment += amount;
  agency.net = rstAgencyNet(agency);
}

export function finalizeRstAgencies(map: Map<string, RstAgencyTotals>, ensureCra = true): RstAgencyTotals[] {
  if (ensureCra && !map.has(CRA_GST_HST.id)) {
    map.set(CRA_GST_HST.id, emptyRstAgency(CRA_GST_HST));
  }
  return Array.from(map.values())
    .map((agency) => ({
      ...agency,
      collected: Math.round((agency.collected + Number.EPSILON) * 100) / 100,
      paidOnPurchases: Math.round((agency.paidOnPurchases + Number.EPSILON) * 100) / 100,
      adjustment: Math.round((agency.adjustment + Number.EPSILON) * 100) / 100,
      net: rstAgencyNet(agency),
    }))
    .sort((a, b) => {
      if (a.id === CRA_GST_HST.id) return -1;
      if (b.id === CRA_GST_HST.id) return 1;
      return a.agency.localeCompare(b.agency);
    });
}

export { CRA_GST_HST };

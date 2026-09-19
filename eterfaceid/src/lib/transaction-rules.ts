export type TxInput = {
  direction: "inbound" | "outbound";
  method: "cash" | "eft" | "wire" | "card" | "interac" | "crypto" | "cheque";
  amount: number;
  currency: string;
  amountCad: number;
  counterpartyName?: string | undefined;
  counterpartyCountry?: string | undefined;
  occurredAt: string;
};

export type TxHistoryRow = {
  amount_cad: number;
  direction: string;
  method: string;
  occurred_at: string;
  counterparty_name: string | null;
  counterparty_country: string | null;
};

export type TxAlert = {
  code: string;
  name: string;
  severity: "low" | "medium" | "high";
  citation: string;
  detail: string;
  weight: number;
};

/** FATF "call for action" jurisdictions — verify against the current FATF publication. */
export const FATF_CALL_FOR_ACTION = ["IR", "KP", "MM"];

/** FATF increased-monitoring ("grey") list — verify against the current FATF publication. */
export const FATF_INCREASED_MONITORING = [
  "AO", "BF", "BG", "CM", "CI", "CD", "HT", "LB", "ML", "MC", "MZ", "MM", "NA", "NP",
  "NG", "PH", "SN", "SS", "SY", "TZ", "TR", "UG", "VU", "VN", "YE", "ZA", "DZ",
];

export const CASH_REPORT_THRESHOLD_CAD = 10_000;
export const EFT_REPORT_THRESHOLD_CAD = 10_000;
export const TRAVEL_RULE_THRESHOLD_CAD = 1_000;
export const STRUCTURING_FLOOR = 7_500;

function hoursBetween(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 3_600_000;
}

export function evaluateTransaction(tx: TxInput, history: TxHistoryRow[]): TxAlert[] {
  const alerts: TxAlert[] = [];
  const within24h = history.filter((h) => hoursBetween(h.occurred_at, tx.occurredAt) <= 24);
  const within48h = history.filter((h) => hoursBetween(h.occurred_at, tx.occurredAt) <= 48);
  const within30d = history.filter((h) => hoursBetween(h.occurred_at, tx.occurredAt) <= 24 * 30);

  // 1. Large cash transaction — FINTRAC LCTR / FinCEN CTR
  const cash24h = within24h
    .filter((h) => h.method === "cash" && h.direction === tx.direction)
    .reduce((sum, h) => sum + Number(h.amount_cad), 0);
  if (tx.method === "cash" && tx.amountCad + cash24h >= CASH_REPORT_THRESHOLD_CAD) {
    alerts.push({
      code: "LCTR_CASH_10K",
      name: "Large cash transaction — reportable",
      severity: "high",
      citation: "PCMLTFA / PCMLTFR large cash transaction report; FinCEN CTR 31 CFR 1010.311",
      detail: `Cash of ${(tx.amountCad + cash24h).toLocaleString()} CAD in a 24-hour period reaches the reporting threshold.`,
      weight: 25,
    });
  }

  // 2. Electronic funds transfer threshold — FINTRAC EFTR
  const international =
    tx.counterpartyCountry !== undefined && tx.counterpartyCountry !== "" && tx.counterpartyCountry !== "CA";
  if ((tx.method === "eft" || tx.method === "wire") && international && tx.amountCad >= EFT_REPORT_THRESHOLD_CAD) {
    alerts.push({
      code: "EFTR_10K",
      name: "International electronic funds transfer — reportable",
      severity: "high",
      citation: "PCMLTFR electronic funds transfer report",
      detail: `Cross-border transfer of ${tx.amountCad.toLocaleString()} CAD to or from ${tx.counterpartyCountry}.`,
      weight: 20,
    });
  }

  // 3. Travel rule for virtual currency
  if (tx.method === "crypto" && tx.amountCad >= TRAVEL_RULE_THRESHOLD_CAD) {
    alerts.push({
      code: "TRAVEL_RULE",
      name: "Virtual currency transfer above the travel-rule threshold",
      severity: "medium",
      citation: "FATF R.16; PCMLTFR travel rule; FinCEN Travel Rule; EU Regulation 2023/1113",
      detail: "Originator and beneficiary information must accompany this transfer.",
      weight: 12,
    });
  }

  // 4. Structuring — repeated amounts just under the threshold
  const nearThreshold = [...within24h.map((h) => Number(h.amount_cad)), tx.amountCad].filter(
    (a) => a >= STRUCTURING_FLOOR && a < CASH_REPORT_THRESHOLD_CAD,
  );
  if (nearThreshold.length >= 2) {
    alerts.push({
      code: "STRUCTURING",
      name: "Possible structuring below the reporting threshold",
      severity: "high",
      citation: "FATF R.20; PCMLTFA s.7 suspicious transaction report",
      detail: `${nearThreshold.length} transactions between ${STRUCTURING_FLOOR.toLocaleString()} and ${CASH_REPORT_THRESHOLD_CAD.toLocaleString()} CAD within 24 hours.`,
      weight: 30,
    });
  }

  // 5. High-risk jurisdiction
  const country = (tx.counterpartyCountry ?? "").toUpperCase();
  if (FATF_CALL_FOR_ACTION.includes(country)) {
    alerts.push({
      code: "FATF_CALL_FOR_ACTION",
      name: "Counterparty in a FATF call-for-action jurisdiction",
      severity: "high",
      citation: "FATF high-risk jurisdictions statement",
      detail: `Counterparty country ${country} is subject to countermeasures.`,
      weight: 35,
    });
  } else if (FATF_INCREASED_MONITORING.includes(country)) {
    alerts.push({
      code: "FATF_GREY",
      name: "Counterparty in a FATF increased-monitoring jurisdiction",
      severity: "medium",
      citation: "FATF jurisdictions under increased monitoring",
      detail: `Counterparty country ${country} requires enhanced due diligence.`,
      weight: 15,
    });
  }

  // 6. Rapid movement of funds (pass-through)
  if (tx.direction === "outbound") {
    const inbound48 = within48h
      .filter((h) => h.direction === "inbound")
      .reduce((sum, h) => sum + Number(h.amount_cad), 0);
    if (inbound48 > 0 && tx.amountCad >= inbound48 * 0.8 && tx.amountCad >= 1_000) {
      alerts.push({
        code: "PASS_THROUGH",
        name: "Funds moved out shortly after being received",
        severity: "medium",
        citation: "FATF R.20 suspicious transaction indicators",
        detail: `Outbound ${tx.amountCad.toLocaleString()} CAD against ${inbound48.toLocaleString()} CAD received in the previous 48 hours.`,
        weight: 18,
      });
    }
  }

  // 7. Velocity
  if (within24h.length >= 9) {
    alerts.push({
      code: "VELOCITY",
      name: "Unusual transaction velocity",
      severity: "medium",
      citation: "FATF R.1 risk-based monitoring",
      detail: `${within24h.length + 1} transactions in 24 hours.`,
      weight: 12,
    });
  }

  // 8. Behavioural deviation from the customer's normal pattern
  if (within30d.length >= 3) {
    const avg = within30d.reduce((s, h) => s + Number(h.amount_cad), 0) / within30d.length;
    if (avg > 0 && tx.amountCad > avg * 5 && tx.amountCad >= 2_500) {
      alerts.push({
        code: "DEVIATION",
        name: "Amount far above the customer's normal activity",
        severity: "medium",
        citation: "FATF R.1; AMLR risk scoring",
        detail: `${tx.amountCad.toLocaleString()} CAD against a 30-day average of ${Math.round(avg).toLocaleString()} CAD.`,
        weight: 14,
      });
    }
  }

  // 9. New counterparty at a material amount
  if (tx.counterpartyName) {
    const seen = within30d.some(
      (h) => (h.counterparty_name ?? "").toLowerCase() === tx.counterpartyName!.toLowerCase(),
    );
    if (!seen && tx.amountCad >= 5_000) {
      alerts.push({
        code: "NEW_COUNTERPARTY",
        name: "First material transaction with this counterparty",
        severity: "low",
        citation: "FATF R.1 risk-based approach",
        detail: `No prior activity with ${tx.counterpartyName} in the last 30 days.`,
        weight: 6,
      });
    }
  }

  return alerts;
}

export function transactionRisk(alerts: TxAlert[]) {
  const score = Math.min(100, alerts.reduce((sum, a) => sum + a.weight, 0));
  const status = score >= 60 ? "review" : score >= 25 ? "monitor" : "cleared";
  return { score, status };
}

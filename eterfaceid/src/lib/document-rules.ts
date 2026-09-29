/**
 * In-house document validation rules: Canadian provincial ID/licence number
 * formats, expiry and issue-date sanity, issuing-authority checks and
 * cross-checks against what the subject claimed.
 */

export type DocCheck = {
  name: string;
  ok: boolean;
  severity: "info" | "warn" | "fail";
  detail?: string | undefined;
};

export const CANADIAN_REGIONS: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

/** Driver's licence / photo-card number formats by province. */
const REGION_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
  AB: { pattern: /^\d{6,9}$/, hint: "6 to 9 digits" },
  BC: { pattern: /^\d{7}$/, hint: "7 digits" },
  MB: { pattern: /^[A-Z]{2}[A-Z*-]{5}[A-Z]{5}\d{2}$|^[A-Z0-9*-]{12}$/, hint: "12 characters" },
  NB: { pattern: /^\d{5,7}$/, hint: "5 to 7 digits" },
  NL: { pattern: /^[A-Z]\d{9}$/, hint: "a letter then 9 digits" },
  NS: { pattern: /^[A-Z]{5}\d{9}$/, hint: "5 letters then 9 digits" },
  NT: { pattern: /^\d{6}$/, hint: "6 digits" },
  NU: { pattern: /^\d{6}$/, hint: "6 digits" },
  ON: { pattern: /^[A-Z]\d{4}-?\d{5}-?\d{5}$/, hint: "a letter then 14 digits" },
  PE: { pattern: /^\d{1,6}$/, hint: "up to 6 digits" },
  QC: { pattern: /^[A-Z]\d{12}$/, hint: "a letter then 12 digits" },
  SK: { pattern: /^\d{8}$/, hint: "8 digits" },
  YT: { pattern: /^\d{1,6}$/, hint: "up to 6 digits" },
};

const ISO3_TO_ISO2: Record<string, string> = {
  CAN: "CA",
  USA: "US",
  GBR: "GB",
  FRA: "FR",
  DEU: "DE",
  IND: "IN",
  CHN: "CN",
  PHL: "PH",
  NGA: "NG",
  MEX: "MX",
  BRA: "BR",
  PAK: "PK",
  UKR: "UA",
  AUS: "AU",
};

export function toIso2(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (upper.length === 2) return upper;
  return ISO3_TO_ISO2[upper] ?? upper.slice(0, 2);
}

function days(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export type DocumentInput = {
  docType: string;
  issuingCountry?: string | null;
  issuingRegion?: string | null;
  documentNumber?: string | null;
  surname?: string | null;
  givenNames?: string | null;
  birthDate?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  mrzValid?: boolean | null;
};

export type ClaimedIdentity = {
  fullName?: string | null;
  birthDate?: string | null;
  country?: string | null;
};

export function validateDocument(doc: DocumentInput, claimed: ClaimedIdentity = {}): DocCheck[] {
  const checks: DocCheck[] = [];
  const now = new Date();

  if (doc.mrzValid === true) {
    checks.push({ name: "Machine-readable zone", ok: true, severity: "info", detail: "All check digits valid" });
  } else if (doc.mrzValid === false) {
    checks.push({
      name: "Machine-readable zone",
      ok: false,
      severity: "fail",
      detail: "One or more check digits failed — the document data has been altered or misread",
    });
  }

  if (doc.expiryDate) {
    const expiry = new Date(doc.expiryDate);
    const remaining = days(now, expiry);
    if (remaining < 0) {
      checks.push({ name: "Document expiry", ok: false, severity: "fail", detail: `Expired ${Math.abs(remaining)} days ago` });
    } else if (remaining < 30) {
      checks.push({ name: "Document expiry", ok: true, severity: "warn", detail: `Expires in ${remaining} days` });
    } else {
      checks.push({ name: "Document expiry", ok: true, severity: "info", detail: doc.expiryDate });
    }
  } else {
    checks.push({ name: "Document expiry", ok: false, severity: "warn", detail: "No expiry date read" });
  }

  if (doc.issueDate) {
    const issue = new Date(doc.issueDate);
    if (issue > now) {
      checks.push({ name: "Issue date", ok: false, severity: "fail", detail: "Issue date is in the future" });
    } else {
      checks.push({ name: "Issue date", ok: true, severity: "info", detail: doc.issueDate });
    }
    if (doc.expiryDate && new Date(doc.expiryDate) <= issue) {
      checks.push({ name: "Validity period", ok: false, severity: "fail", detail: "Expiry is not after issue" });
    }
  }

  if (doc.birthDate) {
    const birth = new Date(doc.birthDate);
    const age = Math.floor(days(birth, now) / 365.25);
    if (age < 0 || age > 120) {
      checks.push({ name: "Date of birth", ok: false, severity: "fail", detail: "Implausible date of birth" });
    } else if (age < 18) {
      checks.push({ name: "Age", ok: true, severity: "warn", detail: `Subject is ${age} — under 18` });
    } else {
      checks.push({ name: "Age", ok: true, severity: "info", detail: `${age} years` });
    }
  }

  const country = toIso2(doc.issuingCountry);
  if (country === "CA" && doc.issuingRegion) {
    const region = doc.issuingRegion.toUpperCase();
    const rule = REGION_PATTERNS[region];
    if (!rule) {
      checks.push({ name: "Issuing province", ok: false, severity: "warn", detail: `${region} is not a Canadian province or territory` });
    } else if (doc.documentNumber) {
      const value = doc.documentNumber.toUpperCase().replace(/\s/g, "");
      const ok = rule.pattern.test(value);
      checks.push({
        name: `${CANADIAN_REGIONS[region]} number format`,
        ok,
        severity: ok ? "info" : "fail",
        detail: ok ? "Matches the provincial format" : `Expected ${rule.hint}`,
      });
    }
  } else if (!country) {
    checks.push({ name: "Issuing authority", ok: false, severity: "warn", detail: "No issuing country read" });
  }

  if (claimed.birthDate && doc.birthDate) {
    const ok = claimed.birthDate === doc.birthDate;
    checks.push({
      name: "Date of birth matches the application",
      ok,
      severity: ok ? "info" : "fail",
      detail: ok ? undefined : `Application says ${claimed.birthDate}, document says ${doc.birthDate}`,
    });
  }

  if (claimed.fullName && (doc.surname || doc.givenNames)) {
    const docName = `${doc.givenNames ?? ""} ${doc.surname ?? ""}`.toLowerCase().replace(/[^a-z ]/g, "").trim();
    const claim = claimed.fullName.toLowerCase().replace(/[^a-z ]/g, "").trim();
    const docParts = new Set(docName.split(/\s+/).filter(Boolean));
    const claimParts = claim.split(/\s+/).filter(Boolean);
    const overlap = claimParts.filter((p) => docParts.has(p)).length;
    const ok = claimParts.length > 0 && overlap >= Math.min(2, claimParts.length);
    checks.push({
      name: "Name matches the application",
      ok,
      severity: ok ? "info" : "fail",
      detail: ok ? undefined : `Application says "${claimed.fullName}", document says "${docName}"`,
    });
  }

  return checks;
}

export function documentResult(checks: DocCheck[]): "pass" | "fail" | "review" | "not_run" {
  if (!checks.length) return "not_run";
  if (checks.some((c) => !c.ok && c.severity === "fail")) return "fail";
  if (checks.some((c) => !c.ok || c.severity === "warn")) return "review";
  return "pass";
}

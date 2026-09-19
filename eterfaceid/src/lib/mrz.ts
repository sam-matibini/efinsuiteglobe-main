/**
 * In-house machine-readable zone parser.
 * Supports TD1 (3x30, most ID cards), TD2 (2x36) and TD3 (2x44, passports).
 * Every field guarded by a check digit is validated with the ICAO 7-3-1 weighting.
 */

const WEIGHTS = [7, 3, 1];

export function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0; // '<' and anything unexpected
}

export function checkDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    sum += charValue(input[i] ?? "<") * (WEIGHTS[i % 3] ?? 1);
  }
  return sum % 10;
}

function verify(field: string, digit: string): boolean {
  if (!/^\d$/.test(digit)) return false;
  return checkDigit(field) === Number(digit);
}

function clean(value: string): string {
  return value.replace(/</g, " ").trim().replace(/\s+/g, " ");
}

function parseNames(field: string): { surname: string; givenNames: string } {
  const [surnamePart = "", givenPart = ""] = field.split("<<");
  return { surname: clean(surnamePart), givenNames: clean(givenPart) };
}

/** YYMMDD -> ISO date. `pivot` decides the century for birth dates vs expiry dates. */
export function mrzDate(value: string, kind: "birth" | "expiry"): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const nowYY = new Date().getUTCFullYear() % 100;
  const century = kind === "birth" ? (yy > nowYY ? 1900 : 2000) : yy < 70 ? 2000 : 1900;
  const iso = `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export type MrzCheck = { name: string; ok: boolean; detail?: string };

export type MrzResult = {
  format: "TD1" | "TD2" | "TD3" | null;
  valid: boolean;
  documentType: string | null;
  issuingCountry: string | null;
  documentNumber: string | null;
  surname: string | null;
  givenNames: string | null;
  nationality: string | null;
  birthDate: string | null;
  expiryDate: string | null;
  sex: string | null;
  optionalData: string | null;
  checks: MrzCheck[];
};

function empty(): MrzResult {
  return {
    format: null,
    valid: false,
    documentType: null,
    issuingCountry: null,
    documentNumber: null,
    surname: null,
    givenNames: null,
    nationality: null,
    birthDate: null,
    expiryDate: null,
    sex: null,
    optionalData: null,
    checks: [{ name: "Machine-readable zone recognised", ok: false, detail: "Unrecognised layout" }],
  };
}

export function parseMrz(raw: string): MrzResult {
  const lines = raw
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ""))
    .filter(Boolean);

  if (lines.length === 3 && lines.every((l) => l.length === 30)) return parseTd1(lines as [string, string, string]);
  if (lines.length === 2 && lines.every((l) => l.length === 44)) return parseTd3(lines as [string, string], "TD3");
  if (lines.length === 2 && lines.every((l) => l.length === 36)) return parseTd3(lines as [string, string], "TD2");
  return empty();
}

function parseTd1(lines: [string, string, string]): MrzResult {
  const [l1, l2, l3] = lines;
  const documentNumber = l1.slice(5, 14);
  const docCheck = l1.charAt(14);
  const birth = l2.slice(0, 6);
  const birthCheck = l2.charAt(6);
  const expiry = l2.slice(8, 14);
  const expiryCheck = l2.charAt(14);
  const composite = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const compositeCheck = l2.charAt(29);
  const names = parseNames(l3);

  const checks: MrzCheck[] = [
    { name: "Document number check digit", ok: verify(documentNumber, docCheck) },
    { name: "Date of birth check digit", ok: verify(birth, birthCheck) },
    { name: "Expiry date check digit", ok: verify(expiry, expiryCheck) },
    { name: "Composite check digit", ok: verify(composite, compositeCheck) },
  ];

  return {
    format: "TD1",
    valid: checks.every((c) => c.ok),
    documentType: clean(l1.slice(0, 2)) || null,
    issuingCountry: clean(l1.slice(2, 5)) || null,
    documentNumber: clean(documentNumber) || null,
    surname: names.surname || null,
    givenNames: names.givenNames || null,
    nationality: clean(l2.slice(15, 18)) || null,
    birthDate: mrzDate(birth, "birth"),
    expiryDate: mrzDate(expiry, "expiry"),
    sex: clean(l2.charAt(7)) || null,
    optionalData: clean(l2.slice(18, 29)) || null,
    checks,
  };
}

function parseTd3(lines: [string, string], format: "TD2" | "TD3"): MrzResult {
  const [l1, l2] = lines;
  const wide = format === "TD3";
  const documentNumber = l2.slice(0, 9);
  const docCheck = l2.charAt(9);
  const birth = l2.slice(13, 19);
  const birthCheck = l2.charAt(19);
  const expiry = l2.slice(21, 27);
  const expiryCheck = l2.charAt(27);
  const optional = wide ? l2.slice(28, 42) : l2.slice(28, 35);
  const optionalCheck = wide ? l2.charAt(42) : "";
  const composite = wide
    ? l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43)
    : l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 35);
  const compositeCheck = wide ? l2.charAt(43) : l2.charAt(35);
  const names = parseNames(l1.slice(5));

  const checks: MrzCheck[] = [
    { name: "Document number check digit", ok: verify(documentNumber, docCheck) },
    { name: "Date of birth check digit", ok: verify(birth, birthCheck) },
    { name: "Expiry date check digit", ok: verify(expiry, expiryCheck) },
    { name: "Composite check digit", ok: verify(composite, compositeCheck) },
  ];
  if (wide && optionalCheck) {
    checks.push({ name: "Personal number check digit", ok: verify(optional, optionalCheck) });
  }

  return {
    format,
    valid: checks.every((c) => c.ok),
    documentType: clean(l1.slice(0, 2)) || null,
    issuingCountry: clean(l1.slice(2, 5)) || null,
    documentNumber: clean(documentNumber) || null,
    surname: names.surname || null,
    givenNames: names.givenNames || null,
    nationality: clean(l2.slice(10, 13)) || null,
    birthDate: mrzDate(birth, "birth"),
    expiryDate: mrzDate(expiry, "expiry"),
    sex: clean(l2.charAt(20)) || null,
    optionalData: clean(optional) || null,
    checks,
  };
}

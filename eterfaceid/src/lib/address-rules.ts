export type AddressInput = {
  line1: string;
  line2?: string | undefined;
  city?: string | undefined;
  region?: string | undefined;
  postalCode?: string | undefined;
  country: string;
};

export type AddressCheck = { name: string; ok: boolean; severity: "info" | "warn" | "fail"; detail?: string | undefined };

const CA_POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
const US_ZIP = /^\d{5}(-\d{4})?$/;
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/** First letter of a Canadian postal code maps to a forward sortation area region. */
const CA_POSTAL_REGION: Record<string, string[]> = {
  A: ["NL"], B: ["NS"], C: ["PE"], E: ["NB"], G: ["QC"], H: ["QC"], J: ["QC"],
  K: ["ON"], L: ["ON"], M: ["ON"], N: ["ON"], P: ["ON"], R: ["MB"], S: ["SK"],
  T: ["AB"], V: ["BC"], X: ["NT", "NU"], Y: ["YT"],
};

export function validateAddress(addr: AddressInput, documentAddress?: string | undefined): AddressCheck[] {
  const checks: AddressCheck[] = [];
  const country = addr.country.toUpperCase();

  checks.push({
    name: "Street address present",
    ok: addr.line1.trim().length >= 4 && /\d/.test(addr.line1),
    severity: "fail",
    detail: "A street number and name are required",
  });

  checks.push({
    name: "City present",
    ok: Boolean(addr.city && addr.city.trim().length >= 2),
    severity: "warn",
  });

  const postal = (addr.postalCode ?? "").trim();
  if (country === "CA") {
    const ok = CA_POSTAL.test(postal);
    checks.push({ name: "Canadian postal code format", ok, severity: "fail", detail: ok ? postal.toUpperCase() : "Expected format A1A 1A1" });
    const first = postal.charAt(0).toUpperCase();
    const expected = CA_POSTAL_REGION[first];
    if (ok && expected) {
      const region = (addr.region ?? "").toUpperCase();
      const matches = region === "" || expected.includes(region);
      checks.push({
        name: "Postal code matches the province",
        ok: matches,
        severity: "warn",
        detail: matches ? `${first} is used in ${expected.join(", ")}` : `${first} belongs to ${expected.join(", ")}, not ${region}`,
      });
    }
    if (/^[HXY]/i.test(postal) === false && /po box/i.test(addr.line1)) {
      checks.push({ name: "Post office box used as a residential address", ok: false, severity: "warn" });
    }
  } else if (country === "US") {
    checks.push({ name: "US ZIP code format", ok: US_ZIP.test(postal), severity: "fail", detail: "Expected 12345 or 12345-6789" });
  } else if (country === "GB") {
    checks.push({ name: "UK postcode format", ok: UK_POSTCODE.test(postal), severity: "fail" });
  } else {
    checks.push({ name: "Postal code present", ok: postal.length >= 3, severity: "warn" });
  }

  checks.push({
    name: "Country supplied",
    ok: /^[A-Z]{2}$/.test(country),
    severity: "fail",
    detail: "Two-letter country code",
  });

  if (documentAddress) {
    const a = addr.line1.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    const b = documentAddress.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    const overlap = a.filter((t) => b.includes(t)).length;
    checks.push({
      name: "Address matches the document",
      ok: overlap >= 2,
      severity: "warn",
      detail: `${overlap} matching parts`,
    });
  }

  return checks;
}

export function addressResult(checks: AddressCheck[]): "pass" | "fail" | "review" {
  if (checks.some((c) => !c.ok && c.severity === "fail")) return "fail";
  if (checks.some((c) => !c.ok)) return "review";
  return "pass";
}

/** Age and date-of-birth validation (CDD age thresholds and plausibility). */
export function validateAge(birthDate: string, minimumAge = 18) {
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) {
    return { valid: false, age: null as number | null, detail: "Date of birth could not be read" };
  }
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  if (age < 0 || age > 120) return { valid: false, age, detail: "Date of birth is not plausible" };
  if (age < minimumAge) return { valid: false, age, detail: `Under the minimum age of ${minimumAge}` };
  return { valid: true, age, detail: `${age} years old` };
}

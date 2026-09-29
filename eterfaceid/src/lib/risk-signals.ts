/**
 * In-house risk signals: email, phone and device/network heuristics.
 * No vendor call is required. Optional add-ons can add factors later.
 */

export type RiskFactor = {
  category: "email" | "phone" | "device" | "network" | "document" | "screening" | "behaviour";
  code: string;
  label: string;
  weight: number; // positive raises risk, negative lowers it
  detail?: string;
  source?: string;
};

/* ------------------------------------------------------------------ email */

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org",
  "throwawaymail.com", "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com",
  "sharklasers.com", "maildrop.cc", "fakeinbox.com", "mintemail.com", "mohmal.com",
  "emailondeck.com", "spamgourmet.com", "mailnesia.com", "tempinbox.com", "burnermail.io",
]);

const FREE_DOMAINS = new Set([
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "live.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "yandex.com",
]);

const ROLE_LOCALS = new Set(["admin", "info", "support", "sales", "billing", "contact", "office", "noreply", "no-reply"]);

export function emailFactors(email: string | null | undefined): RiskFactor[] {
  if (!email) return [];
  const value = email.trim().toLowerCase();
  const factors: RiskFactor[] = [];
  const match = /^([^@\s]+)@([^@\s]+\.[a-z]{2,})$/.exec(value);
  if (!match) {
    return [{ category: "email", code: "email_invalid", label: "Email address is not well formed", weight: 20 }];
  }
  const local = match[1]!;
  const domain = match[2]!;

  if (DISPOSABLE_DOMAINS.has(domain)) {
    factors.push({ category: "email", code: "email_disposable", label: "Disposable email domain", weight: 30, detail: domain });
  } else if (FREE_DOMAINS.has(domain)) {
    factors.push({ category: "email", code: "email_free", label: "Free consumer mailbox", weight: 4, detail: domain });
  } else {
    factors.push({ category: "email", code: "email_domain_own", label: "Own or corporate domain", weight: -4, detail: domain });
  }

  if (ROLE_LOCALS.has(local.split("+")[0] ?? "")) {
    factors.push({ category: "email", code: "email_role", label: "Shared role mailbox, not a person", weight: 8, detail: local });
  }
  if (local.includes("+")) {
    factors.push({ category: "email", code: "email_subaddress", label: "Sub-addressed mailbox (plus tag)", weight: 5 });
  }
  const digits = (local.match(/\d/g) ?? []).length;
  if (digits >= 5) {
    factors.push({ category: "email", code: "email_numeric", label: "Mailbox name is mostly digits", weight: 6, detail: local });
  }
  const consonantRun = /[bcdfghjklmnpqrstvwxz]{6,}/.test(local);
  if (consonantRun) {
    factors.push({ category: "email", code: "email_random", label: "Mailbox name looks machine generated", weight: 8, detail: local });
  }
  return factors;
}

/* ------------------------------------------------------------------ phone */

/** Canadian and US area codes that are valid under the North American numbering plan. */
const CA_AREA_CODES: Record<string, string> = {
  "204": "MB", "226": "ON", "236": "BC", "249": "ON", "250": "BC", "263": "QC", "289": "ON",
  "306": "SK", "343": "ON", "354": "QC", "365": "ON", "367": "QC", "368": "AB", "382": "ON",
  "403": "AB", "416": "ON", "418": "QC", "428": "NB", "431": "MB", "437": "ON", "438": "QC",
  "450": "QC", "468": "QC", "474": "SK", "506": "NB", "514": "QC", "519": "ON", "548": "ON",
  "579": "QC", "581": "QC", "584": "MB", "587": "AB", "604": "BC", "613": "ON", "639": "SK",
  "647": "ON", "672": "BC", "683": "ON", "705": "ON", "709": "NL", "742": "ON", "753": "ON",
  "778": "BC", "780": "AB", "782": "NS", "807": "ON", "819": "QC", "825": "AB", "867": "NT",
  "873": "QC", "902": "NS", "905": "ON",
};

export type PhoneAssessment = {
  e164: string | null;
  valid: boolean;
  country: string | null;
  region: string | null;
  lineTypeHint: "mobile" | "landline" | "voip" | "toll-free" | "unknown";
  factors: RiskFactor[];
};

const TOLL_FREE = new Set(["800", "833", "844", "855", "866", "877", "888"]);
const KNOWN_VOIP_PREFIXES = new Set(["600", "622"]); // Canadian non-geographic / VoIP ranges

export function assessPhone(input: string | null | undefined, claimedCountry?: string | null): PhoneAssessment {
  const factors: RiskFactor[] = [];
  if (!input) return { e164: null, valid: false, country: null, region: null, lineTypeHint: "unknown", factors };
  const digits = input.replace(/\D/g, "");
  let national = digits;
  if (national.length === 11 && national.startsWith("1")) national = national.slice(1);

  if (national.length !== 10) {
    // Not North American — do a length sanity check only.
    const ok = digits.length >= 8 && digits.length <= 15;
    factors.push({
      category: "phone",
      code: ok ? "phone_international" : "phone_invalid",
      label: ok ? "International number, format accepted" : "Phone number length is not valid",
      weight: ok ? 2 : 20,
      detail: digits,
    });
    return { e164: ok ? `+${digits}` : null, valid: ok, country: null, region: null, lineTypeHint: "unknown", factors };
  }

  const area = national.slice(0, 3);
  const exchange = national.slice(3, 6);
  const valid = /^[2-9]\d\d$/.test(area) && /^[2-9]\d\d$/.test(exchange);
  if (!valid) {
    factors.push({ category: "phone", code: "phone_invalid", label: "Number is impossible under the numbering plan", weight: 25, detail: national });
    return { e164: null, valid: false, country: null, region: null, lineTypeHint: "unknown", factors };
  }

  const region = CA_AREA_CODES[area] ?? null;
  const country = region ? "CA" : "US";
  let lineTypeHint: PhoneAssessment["lineTypeHint"] = "unknown";
  if (TOLL_FREE.has(area)) {
    lineTypeHint = "toll-free";
    factors.push({ category: "phone", code: "phone_tollfree", label: "Toll-free number, not a personal line", weight: 18, detail: area });
  } else if (KNOWN_VOIP_PREFIXES.has(area)) {
    lineTypeHint = "voip";
    factors.push({ category: "phone", code: "phone_voip", label: "Non-geographic / VoIP range", weight: 15, detail: area });
  } else if (exchange === "555") {
    factors.push({ category: "phone", code: "phone_reserved", label: "Reserved 555 exchange", weight: 30 });
  } else {
    factors.push({ category: "phone", code: "phone_geographic", label: `Geographic number${region ? ` in ${region}` : ""}`, weight: -3, detail: area });
  }

  const claimed = (claimedCountry ?? "").toUpperCase().slice(0, 2);
  if (claimed && claimed !== country) {
    factors.push({
      category: "phone",
      code: "phone_country_mismatch",
      label: "Phone country does not match the claimed country",
      weight: 12,
      detail: `${country} number, ${claimed} claimed`,
    });
  }

  return { e164: `+1${national}`, valid: true, country, region, lineTypeHint, factors };
}

/* ------------------------------------------------------- device / network */

export type DeviceInput = {
  fingerprint?: string | null;
  userAgent?: string | null;
  platform?: string | null;
  timezone?: string | null;
  languages?: string[] | null;
  ipAddress?: string | null;
  ipCountry?: string | null;
  claimedCountry?: string | null;
  repeatDeviceCases?: number;
  velocity24h?: number;
  isDatacenter?: boolean;
  isVpn?: boolean;
  isTor?: boolean;
};

const COUNTRY_TIMEZONE_PREFIX: Record<string, string[]> = {
  CA: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax", "America/St_Johns", "America/Regina", "America/Montreal", "America/Moncton", "America/Whitehorse", "America/Yellowknife", "America/Iqaluit"],
  US: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu"],
};

export function deviceFactors(input: DeviceInput): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const claimed = (input.claimedCountry ?? "").toUpperCase().slice(0, 2);
  const ipCountry = (input.ipCountry ?? "").toUpperCase().slice(0, 2);

  if (claimed && ipCountry && claimed !== ipCountry) {
    factors.push({
      category: "network",
      code: "ip_country_mismatch",
      label: "Connecting from a different country than claimed",
      weight: 18,
      detail: `${ipCountry} connection, ${claimed} claimed`,
    });
  } else if (claimed && ipCountry) {
    factors.push({ category: "network", code: "ip_country_match", label: "Connection country matches the application", weight: -5, detail: ipCountry });
  }

  if (input.isTor) factors.push({ category: "network", code: "net_tor", label: "Connecting over the Tor network", weight: 35 });
  if (input.isVpn) factors.push({ category: "network", code: "net_vpn", label: "Connecting over a VPN or proxy", weight: 15 });
  if (input.isDatacenter) factors.push({ category: "network", code: "net_datacenter", label: "Connection from a hosting provider, not a home network", weight: 20 });

  if (claimed && input.timezone) {
    const expected = COUNTRY_TIMEZONE_PREFIX[claimed];
    if (expected && !expected.includes(input.timezone)) {
      factors.push({
        category: "device",
        code: "timezone_mismatch",
        label: "Device time zone does not fit the claimed country",
        weight: 10,
        detail: input.timezone,
      });
    }
  }

  const repeat = input.repeatDeviceCases ?? 0;
  if (repeat >= 3) {
    factors.push({ category: "device", code: "device_shared", label: "Same device used by several applicants", weight: 22, detail: `${repeat} other cases` });
  } else if (repeat > 0) {
    factors.push({ category: "device", code: "device_seen", label: "Device seen on another case", weight: 8, detail: `${repeat} other case(s)` });
  }

  const velocity = input.velocity24h ?? 0;
  if (velocity >= 5) {
    factors.push({ category: "behaviour", code: "velocity_high", label: "Many verification attempts in 24 hours", weight: 20, detail: `${velocity} attempts` });
  } else if (velocity >= 3) {
    factors.push({ category: "behaviour", code: "velocity_medium", label: "Repeated verification attempts", weight: 10, detail: `${velocity} attempts` });
  }

  const ua = (input.userAgent ?? "").toLowerCase();
  if (ua && /(headless|phantom|puppeteer|selenium|bot|curl|python-requests)/.test(ua)) {
    factors.push({ category: "device", code: "device_automation", label: "Automation tool detected in the browser signature", weight: 30 });
  }
  if (input.languages && input.languages.length === 0) {
    factors.push({ category: "device", code: "device_no_language", label: "Browser reports no language — unusual for a real device", weight: 8 });
  }

  return factors;
}

/* --------------------------------------------------------------- scoring */

export function combineRisk(factors: RiskFactor[]): { score: number; level: "low" | "medium" | "high" } {
  const total = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.max(0, Math.min(100, total));
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { score, level };
}

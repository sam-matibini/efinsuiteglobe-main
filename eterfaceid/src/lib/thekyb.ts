/**
 * Pure helpers for The KYB (thekyb.com) — country codes, profile parsing,
 * and owner import. Safe to import from client or server.
 */

export const THEKYB_AML_CATEGORIES = [
  "PEP Level 1",
  "PEP Level 2",
  "PEP Level 3",
  "PEP Level 4",
  "Fitness and Probity",
  "Insolvency",
  "Sanctions",
  "SIP",
  "SIE",
  "Warnings and Regulatory Enforcement",
  "Adverse Media",
] as const;

const NAME_TO_CODE: Record<string, string> = {
  canada: "CA",
  united_states: "US",
  united_kingdom: "GB",
  great_britain: "GB",
  england: "GB",
  france: "FR",
  germany: "DE",
  ireland: "IE",
  australia: "AU",
  new_zealand: "NZ",
  singapore: "SG",
  india: "IN",
  south_africa: "ZA",
  netherlands: "NL",
  belgium: "BE",
  switzerland: "CH",
  spain: "ES",
  italy: "IT",
  portugal: "PT",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  japan: "JP",
  china: "CN",
  hong_kong: "HK",
  mexico: "MX",
  brazil: "BR",
  uae: "AE",
  united_arab_emirates: "AE",
};

const CODE_TO_NAME: Record<string, string> = {
  CA: "canada",
  US: "united_states",
  GB: "united_kingdom",
  FR: "france",
  DE: "germany",
  IE: "ireland",
  AU: "australia",
  NZ: "new_zealand",
  SG: "singapore",
  IN: "india",
  ZA: "south_africa",
  NL: "netherlands",
  BE: "belgium",
  CH: "switzerland",
  ES: "spain",
  IT: "italy",
  PT: "portugal",
  SE: "sweden",
  NO: "norway",
  DK: "denmark",
  FI: "finland",
  JP: "japan",
  CN: "china",
  HK: "hong_kong",
  MX: "mexico",
  BR: "brazil",
  AE: "united_arab_emirates",
};

/** Maps a case country (ISO-2, name, or The KYB v2 code) to a v2 country_codes value. */
export function toTheKybCountryCode(input?: string | null): string {
  const raw = (input ?? "").trim();
  if (!raw) return "CA";
  const squashed = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (NAME_TO_CODE[squashed]) return NAME_TO_CODE[squashed]!;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (upper === "UK") return "GB";
  if (/^[A-Z]{2}(_[A-Z]{2})?$/.test(upper)) return upper;
  return "CA";
}

/** Maps a country to The KYB v1 `country_names` slug used by AML search. */
export function toTheKybCountryName(input?: string | null): string {
  const code = toTheKybCountryCode(input);
  return CODE_TO_NAME[code] ?? code.toLowerCase();
}

export type ImportedOwner = {
  name: string;
  entity_type: "person" | "business";
  ownership_pct: number | null;
  control_role: string | null;
  country: string | null;
  is_ubo: boolean;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function entityKind(value: unknown): "person" | "business" {
  const text = String(value ?? "").toLowerCase();
  if (
    /\b(company|corporation|ltd|llc|inc|plc|gmbh|sarl|holdco|trust|partnership|entity|organisation|organization)\b/.test(
      text,
    )
  ) {
    return "business";
  }
  return "person";
}

function sharePct(
  shares?: { ownership_min_shares?: unknown; ownership_max_shares?: unknown } | null,
) {
  const max = asNumber(shares?.ownership_max_shares);
  const min = asNumber(shares?.ownership_min_shares);
  return max ?? min;
}

/**
 * Pulls officers, beneficial owners and parent companies from a The KYB
 * enhanced / v2 company profile into eterfaceID owner rows.
 */
export function ownersFromTheKybProfile(
  profile: Record<string, unknown> | null | undefined,
): ImportedOwner[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const out: ImportedOwner[] = [];

  function add(owner: ImportedOwner) {
    const name = owner.name.trim();
    if (!name) return;
    const key = `${name.toLowerCase()}|${owner.control_role ?? ""}|${owner.entity_type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...owner, name });
  }

  const ubos =
    (profile["beneficial_owners_detail"] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const row of ubos) {
    add({
      name: String(row["name"] ?? ""),
      entity_type: entityKind(row["legal_form"] ?? row["entity_type"]),
      ownership_pct: sharePct(row["shares_detail"] as never),
      control_role: String(row["designation"] ?? "Beneficial owner") || "Beneficial owner",
      country: String(row["nationality"] ?? "") || null,
      is_ubo: true,
    });
  }

  const shares =
    (profile["ownership_shares_detail"] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const row of shares) {
    add({
      name: String(row["name"] ?? ""),
      entity_type: entityKind(row["name"]),
      ownership_pct: asNumber(row["ownership_max_shares"] ?? row["ownership_min_shares"]),
      control_role: "Shareholder",
      country: null,
      is_ubo: (asNumber(row["ownership_max_shares"] ?? row["ownership_min_shares"]) ?? 0) >= 25,
    });
  }

  const people = (profile["people_detail"] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const row of people) {
    const role = String(row["designation"] ?? row["employment_status"] ?? "Officer");
    add({
      name: String(row["name"] ?? ""),
      entity_type: "person",
      ownership_pct: null,
      control_role: role || "Officer",
      country: String(row["nationality"] ?? "") || null,
      is_ubo: /director|officer|ceo|cfo|president|manager|signing/i.test(role),
    });
  }

  const parents = (profile["parent_companies"] as Array<Record<string, unknown>> | undefined) ?? [];
  for (const row of parents) {
    add({
      name: String(row["name"] ?? ""),
      entity_type: "business",
      ownership_pct: asNumber(
        (row["meta_detail"] as Record<string, unknown> | undefined)?.["percentage"],
      ),
      control_role: "Parent company",
      country: String(row["country_name"] ?? row["jurisdiction_code"] ?? "") || null,
      is_ubo: false,
    });
  }

  return out;
}

export type TheKybAmlHit = {
  name: string;
  categories: string[];
  match_score: number | null;
  risk_level: string | null;
  match_status: string;
  countries: string[];
  detail: string;
};

export function mapAmlCategory(
  category: string,
): "sanctions" | "pep" | "watchlist" | "adverse_media" {
  const c = category.toLowerCase();
  if (c.includes("sanction")) return "sanctions";
  if (c.includes("pep")) return "pep";
  if (c.includes("adverse")) return "adverse_media";
  return "watchlist";
}

export function summariseAmlHits(
  rows: Array<Record<string, unknown>> | undefined,
  matchStatus?: string | null,
): TheKybAmlHit[] {
  return (rows ?? []).map((row) => {
    const matched =
      (row["matched_names"] as
        Array<{ matched_name?: string; score?: string | number }> | undefined) ?? [];
    const best = matched[0];
    const categories = Array.isArray(row["categories"]) ? (row["categories"] as string[]) : [];
    const countries = Array.isArray(row["countries"]) ? (row["countries"] as string[]) : [];
    const scoreRaw = best?.score ?? null;
    const score =
      scoreRaw == null || scoreRaw === ""
        ? null
        : Number(scoreRaw) / (Number(scoreRaw) > 1 ? 100 : 1);
    return {
      name: String(row["name"] ?? best?.matched_name ?? ""),
      categories,
      match_score: Number.isFinite(score) ? Number(score) : null,
      risk_level: row["risk_level"] ? String(row["risk_level"]) : null,
      match_status: matchStatus ?? "potential match",
      countries,
      detail: categories.length ? categories.join(", ") : "The KYB AML profile",
    };
  });
}

export type TheKybSearchHit = {
  kyb_response_id: string;
  kyb_request_id?: string;
  name: string;
  registration_number: string | null;
  country_code: string | null;
  type: string | null;
  status: string | null;
  risk_level: string | null;
  verification_status: string | null;
  fetch_status: string | null;
};

export function registryCheckResult(
  status?: string | null,
  verification?: string | null,
): "pass" | "fail" | "review" {
  const s = (status ?? "").toLowerCase();
  const v = (verification ?? "").toLowerCase();
  if (/dissolv|inactiv|struck|ceased|liquidat|bankrupt/.test(s) || v === "failed") return "fail";
  if (/active|live|good/.test(s) && (v === "verified" || v === "" || v === "unknown"))
    return "pass";
  return "review";
}

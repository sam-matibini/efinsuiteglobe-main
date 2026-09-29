/**
 * eterfaceID in-house name matching engine.
 *
 * No vendor scoring service is involved. Every score is produced here and is
 * fully explainable: each contributing factor is returned as a reason string so
 * a reviewer (or an examiner) can see exactly why a hit was raised.
 */

export const ENGINE_VERSION = "eid-match-1";

const ORG_SUFFIXES = new Set([
  "ltd", "ltda", "limited", "llc", "lc", "inc", "incorporated", "corp", "corporation",
  "co", "company", "plc", "gmbh", "ag", "sa", "sas", "sarl", "bv", "nv", "oy", "ab",
  "as", "pte", "pty", "spa", "srl", "kft", "zao", "ooo", "oao", "pjsc", "jsc", "llp",
  "lp", "holdings", "holding", "group", "trust", "fund", "foundation", "assoc",
  "association", "societe", "sociedad", "company's", "enterprises", "enterprise",
]);

const PERSON_NOISE = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sir", "hon", "sheikh", "shaykh", "haji", "al",
  "el", "bin", "ibn", "binti", "bint", "van", "von", "de", "del", "della", "da",
  "di", "du", "la", "le", "der", "den", "abu", "umm", "ben",
]);

const NICKNAMES: Record<string, string> = {
  bill: "william", billy: "william", will: "william", liam: "william",
  bob: "robert", rob: "robert", bobby: "robert",
  dick: "richard", rick: "richard", rich: "richard",
  jim: "james", jimmy: "james", jamie: "james",
  joe: "joseph", joey: "joseph",
  mike: "michael", mick: "michael",
  tony: "anthony", tom: "thomas", tommy: "thomas",
  dave: "david", dan: "daniel", danny: "daniel",
  chris: "christopher", steve: "stephen", stevphen: "stephen",
  ed: "edward", eddie: "edward", ted: "edward",
  alex: "alexander", sasha: "alexander", sacha: "alexander",
  nick: "nicholas", kolya: "nikolai", misha: "mikhail", volodya: "vladimir",
  sanya: "alexander", katya: "ekaterina", kate: "katherine", kathy: "katherine",
  liz: "elizabeth", beth: "elizabeth", betty: "elizabeth",
  peggy: "margaret", maggie: "margaret", meg: "margaret",
  sue: "susan", suzy: "susan", jen: "jennifer", jenny: "jennifer",
  abe: "abraham", moe: "mohammed", mo: "mohammed",
  mohamed: "mohammed", muhammad: "mohammed", muhammed: "mohammed", mohammad: "mohammed",
  yousef: "yusuf", youssef: "yusuf", josef: "joseph", yosef: "joseph",
  ahmad: "ahmed", hamid: "hameed", abdul: "abd", abdel: "abd",
};

/** Latin-ise the most common non-Latin scripts we see on official lists. */
const TRANSLIT: Array<[RegExp, string]> = [
  [/[àáâãäåāăą]/g, "a"], [/[çćĉċč]/g, "c"], [/[ďđ]/g, "d"],
  [/[èéêëēĕėęě]/g, "e"], [/[ĝğġģ]/g, "g"], [/[ĥħ]/g, "h"],
  [/[ìíîïĩīĭįı]/g, "i"], [/[ĵ]/g, "j"], [/[ķ]/g, "k"],
  [/[ĺļľŀł]/g, "l"], [/[ñńņňŉ]/g, "n"], [/[òóôõöøōŏő]/g, "o"],
  [/[ŕŗř]/g, "r"], [/[śŝşšș]/g, "s"], [/[ţťŧț]/g, "t"],
  [/[ùúûüũūŭůűų]/g, "u"], [/[ŵ]/g, "w"], [/[ýÿŷ]/g, "y"],
  [/[źżž]/g, "z"], [/[æ]/g, "ae"], [/[œ]/g, "oe"], [/[ß]/g, "ss"],
  [/[đ]/g, "d"], [/[þ]/g, "th"], [/[ð]/g, "d"],
];

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y",
  ь: "", э: "e", ю: "yu", я: "ya",
};

const ARABIC: Record<string, string> = {
  ا: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r",
  ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f",
  ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y", ى: "a", ئ: "y",
  ء: "", آ: "a", أ: "a", إ: "i", ة: "h",
};

export function transliterate(input: string): string {
  let out = input.toLowerCase();
  for (const [re, rep] of TRANSLIT) out = out.replace(re, rep);
  out = out.replace(/[\u0400-\u04FF]/g, (ch) => CYRILLIC[ch] ?? "");
  out = out.replace(/[\u0600-\u06FF]/g, (ch) => ARABIC[ch] ?? "");
  return out;
}

/** Canonical form used for both storage and query. Keep the two identical. */
export function normalizeName(input: string): string {
  return transliterate(input)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(name: string, kind: "person" | "business" = "person"): string[] {
  const raw = normalizeName(name).split(" ").filter(Boolean);
  const dropped = kind === "business" ? ORG_SUFFIXES : PERSON_NOISE;
  const kept = raw.filter((t) => !dropped.has(t) && t.length > 0);
  const tokens = kept.length ? kept : raw;
  return tokens.map((t) => NICKNAMES[t] ?? t);
}

/** Damerau-Levenshtein, capped for speed. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  let prev = new Array<number>(bl + 1);
  let prevPrev = new Array<number>(bl + 1);
  let cur = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2]! + 1);
      }
      cur[j] = v;
    }
    prevPrev = prev;
    prev = cur;
    cur = new Array<number>(bl + 1);
  }
  return prev[bl]!;
}

export function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.length === 1 || b.length === 1) return a[0] === b[0] ? 0.82 : 0;
  const d = editDistance(a, b);
  const sim = 1 - d / Math.max(a.length, b.length);
  return sim < 0 ? 0 : sim;
}

/** Double-metaphone-lite: a cheap phonetic key that survives spelling drift. */
export function phoneticKey(token: string): string {
  return token
    .replace(/[^a-z]/g, "")
    .replace(/^(kn|gn|pn|wr|ps)/, (m) => m[1]!)
    .replace(/ough/g, "of")
    .replace(/[aeiouy]+/g, "a")
    .replace(/ph/g, "f")
    .replace(/[wh]/g, "")
    .replace(/ck|q|kh/g, "k")
    .replace(/[sz]+/g, "s")
    .replace(/[dt]+/g, "t")
    .replace(/[bpv]+/g, "b")
    .replace(/[gj]+/g, "j")
    .replace(/(.)\1+/g, "$1");
}

export interface MatchInput {
  query: string;
  candidate: string;
  kind?: "person" | "business";
  queryBirthDate?: string | null;
  candidateBirthDate?: string | null;
  queryCountry?: string | null;
  candidateCountries?: string[] | null;
}

export interface MatchOutcome {
  score: number;
  nameScore: number;
  reasons: string[];
}

/**
 * Score a query name against one candidate name.
 * Name similarity carries the score; date of birth and country nudge it.
 */
export function scoreMatch(input: MatchInput): MatchOutcome {
  const kind = input.kind ?? "person";
  const q = tokenize(input.query, kind);
  const c = tokenize(input.candidate, kind);
  const reasons: string[] = [];

  if (!q.length || !c.length) return { score: 0, nameScore: 0, reasons: ["No comparable name tokens"] };

  const qNorm = normalizeName(input.query);
  const cNorm = normalizeName(input.candidate);
  if (qNorm === cNorm) reasons.push("Exact name match after normalisation");

  // Greedy best-pair token alignment in both directions.
  const used = new Set<number>();
  let matched = 0;
  let simTotal = 0;
  let phonetic = 0;
  let initialOnly = 0;

  for (const qt of q) {
    let bestIdx = -1;
    let best = 0;
    for (let i = 0; i < c.length; i++) {
      if (used.has(i)) continue;
      const s = tokenSimilarity(qt, c[i]!);
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && best >= 0.72) {
      used.add(bestIdx);
      matched += 1;
      simTotal += best;
      if (best < 1) {
        if (qt.length === 1 || c[bestIdx]!.length === 1) initialOnly += 1;
        else if (phoneticKey(qt) === phoneticKey(c[bestIdx]!)) phonetic += 1;
      }
    }
  }

  const coverage = matched / Math.max(q.length, c.length);
  const quality = matched ? simTotal / matched : 0;
  let nameScore = coverage * 0.62 + quality * 0.38;

  // A candidate carrying extra tokens (e.g. a middle name) should not be punished
  // as hard as a candidate missing tokens the query has.
  if (matched === q.length && c.length > q.length) {
    nameScore = Math.min(1, nameScore + 0.08);
    reasons.push(`Listed name carries ${c.length - q.length} extra name part(s)`);
  }

  if (matched === q.length && matched === c.length && quality === 1) {
    nameScore = 1;
  }

  if (matched) {
    reasons.push(`${matched} of ${Math.max(q.length, c.length)} name parts aligned`);
  }
  if (phonetic) reasons.push(`${phonetic} name part(s) matched phonetically`);
  if (initialOnly) reasons.push(`${initialOnly} name part(s) matched on initial only`);

  let score = nameScore;

  // Date of birth: strong confirm, strong deny.
  const qy = birthYear(input.queryBirthDate);
  const cy = birthYear(input.candidateBirthDate);
  if (qy && cy) {
    if (input.queryBirthDate && input.candidateBirthDate &&
        input.queryBirthDate.slice(0, 10) === input.candidateBirthDate.slice(0, 10)) {
      score = Math.min(1, score + 0.12);
      reasons.push("Full date of birth matches");
    } else if (qy === cy) {
      score = Math.min(1, score + 0.07);
      reasons.push("Year of birth matches");
    } else if (Math.abs(qy - cy) <= 1) {
      score = Math.min(1, score + 0.02);
      reasons.push("Year of birth within one year");
    } else {
      score = Math.max(0, score - 0.18);
      reasons.push(`Year of birth differs by ${Math.abs(qy - cy)} years`);
    }
  } else if (cy && !qy) {
    reasons.push("No date of birth supplied for the subject");
  }

  // Country proximity.
  const qc = (input.queryCountry ?? "").trim().toLowerCase();
  const cc = (input.candidateCountries ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (qc && cc.length) {
    if (cc.includes(qc)) {
      score = Math.min(1, score + 0.05);
      reasons.push(`Country matches listed country (${qc.toUpperCase()})`);
    } else {
      reasons.push(`Subject country ${qc.toUpperCase()} not on the listed countries`);
    }
  }

  return { score: Math.round(Math.max(0, Math.min(1, score)) * 1000) / 1000, nameScore, reasons };
}

function birthYear(value?: string | null): number | null {
  if (!value) return null;
  const m = /(\d{4})/.exec(value);
  if (!m) return null;
  const y = Number(m[1]);
  return y > 1850 && y < 2030 ? y : null;
}

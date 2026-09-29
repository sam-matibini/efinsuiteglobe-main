/**
 * Sandbox behaviour for API keys issued as `eid_test_*`.
 *
 * Sandbox calls must never touch the real sanctions and PEP lists or a real
 * bank connection. Instead they return predictable, realistic results driven by
 * the subject name so partners can build and test every branch of their code.
 */

export const SANDBOX_TRIGGERS = {
  sanctioned: "test-sanctioned",
  pep: "test-pep",
  review: "test-review",
  fail: "test-fail",
} as const;

export type SandboxScreeningResult = {
  runId: string;
  candidates: number;
  hits: Array<{
    list_name: string;
    matched_name: string;
    match_score: number;
    category: "sanctions" | "pep" | "watchlist";
    detail: string;
    reasons: Array<{ code: string; label: string; weight: number }>;
  }>;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
};

function contains(name: string, needle: string) {
  return name.toLowerCase().includes(needle);
}

/** Deterministic screening outcome for a sandbox subject name. */
export function sandboxScreening(subjectName: string): SandboxScreeningResult {
  const runId = crypto.randomUUID();
  const base = {
    runId,
    candidates: 12,
    hits: [] as SandboxScreeningResult["hits"],
    riskScore: 5,
    riskLevel: "low" as const,
  };

  if (contains(subjectName, SANDBOX_TRIGGERS.sanctioned)) {
    return {
      runId,
      candidates: 12,
      hits: [
        {
          list_name: "Sandbox sanctions list",
          matched_name: subjectName,
          match_score: 0.96,
          category: "sanctions",
          detail: "Simulated sanctions match — sandbox only, not a real listing.",
          reasons: [
            { code: "exact_name", label: "Full name matches the listed name", weight: 60 },
            { code: "country_match", label: "Country matches the listing", weight: 20 },
          ],
        },
      ],
      riskScore: 92,
      riskLevel: "high",
    };
  }

  if (contains(subjectName, SANDBOX_TRIGGERS.pep)) {
    return {
      runId,
      candidates: 9,
      hits: [
        {
          list_name: "Sandbox politically exposed persons list",
          matched_name: subjectName,
          match_score: 0.88,
          category: "pep",
          detail: "Simulated politically exposed person — sandbox only.",
          reasons: [{ code: "strong_name", label: "Close name match", weight: 45 }],
        },
      ],
      riskScore: 58,
      riskLevel: "medium",
    };
  }

  return base;
}

/** Deterministic bank-confirmed identity outcome for sandbox. */
export function sandboxBankIdentity(subjectName: string) {
  const different = contains(subjectName, SANDBOX_TRIGGERS.fail);
  const close = contains(subjectName, SANDBOX_TRIGGERS.review);
  const state = different ? "different" : close ? "close" : "match";
  return {
    institution_name: "Sandbox Bank of Canada",
    bank_names: [subjectName],
    bank_emails: ["sandbox@example.com"],
    bank_phones: ["+14165550100"],
    bank_addresses: [
      {
        street: "1 Sandbox Way",
        city: "Toronto",
        region: "ON",
        postal_code: "M5H 1A1",
        country: "CA",
      },
    ],
    comparisons: [
      { field: "name", claimed: subjectName, bank: subjectName, state },
      { field: "email", claimed: "", bank: "sandbox@example.com", state },
      { field: "phone", claimed: "", bank: "+14165550100", state },
      { field: "address", claimed: "", bank: "1 Sandbox Way, Toronto ON", state },
    ],
    result: different ? "fail" : close ? "review" : "pass",
  } as const;
}

/** Simulated official-registry KYB — sandbox keys never call The KYB. */
export function sandboxRegistrySearch(subjectName: string, country = "CA") {
  const sanctioned = contains(subjectName, SANDBOX_TRIGGERS.sanctioned);
  return {
    kyb_request_id: `sandbox-kyb-${crypto.randomUUID()}`,
    status: "resolved",
    hits: [
      {
        kyb_response_id: `sandbox-resp-${crypto.randomUUID()}`,
        name: subjectName || "Sandbox Holdings Ltd",
        registration_number: "BN-123456789",
        country_code: country,
        type: "Corporation",
        status: "active",
        risk_level: sanctioned ? "high" : "low",
        verification_status: "verified",
        fetch_status: "resolved",
      },
    ],
  };
}

export function sandboxRegistryProfile(subjectName: string, country = "CA") {
  return {
    name: subjectName || "Sandbox Holdings Ltd",
    registration_number: "BN-123456789",
    country_code: country,
    status: "active",
    type: "Corporation",
    verification_status: "verified",
    fetch_status: "resolved",
    risk_level: contains(subjectName, SANDBOX_TRIGGERS.sanctioned) ? "high" : "low",
    people_detail: [
      {
        name: "Alex Reviewer",
        designation: "Director",
        nationality: "CA",
        employment_status: "current",
      },
    ],
    beneficial_owners_detail: [
      {
        name: "Jordan Owner",
        designation: "Beneficial owner",
        nationality: "CA",
        shares_detail: { ownership_min_shares: 40, ownership_max_shares: 40 },
      },
    ],
  };
}

export function sandboxTheKybAml(subjectName: string) {
  if (contains(subjectName, SANDBOX_TRIGGERS.sanctioned)) {
    return {
      aml_request_id: `sandbox-aml-${crypto.randomUUID()}`,
      status: "resolved",
      match_status: "potential match",
      hits: [
        {
          name: subjectName,
          categories: ["Sanctions"],
          match_score: 0.94,
          risk_level: "high",
          match_status: "potential match",
          countries: ["canada"],
          detail: "Simulated The KYB sanctions match — sandbox only.",
        },
      ],
      result: "fail" as const,
    };
  }
  return {
    aml_request_id: `sandbox-aml-${crypto.randomUUID()}`,
    status: "resolved",
    match_status: "no match",
    hits: [],
    result: "pass" as const,
  };
}

/** A simulated bank link session — no real Plaid call is made in sandbox. */
export function sandboxLinkToken() {
  return {
    link_token: `sandbox-link-${crypto.randomUUID()}`,
    expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    sandbox: true,
  };
}

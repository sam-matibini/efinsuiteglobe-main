/** The KYB REST client (v2 KYB Check + v1 AML). Server-only. */

import {
  toTheKybCountryCode,
  toTheKybCountryName,
  THEKYB_AML_CATEGORIES,
  type TheKybSearchHit,
} from "@/lib/thekyb";

export type { TheKybSearchHit };

const DEFAULT_BASE = "https://api.thekyb.com";

export function thekybConfigured(): boolean {
  return Boolean(process.env["THEKYB_API_TOKEN"]);
}

function credentials() {
  const token = process.env["THEKYB_API_TOKEN"];
  if (!token) {
    throw new Error(
      "The KYB is not configured yet. Add THEKYB_API_TOKEN from backoffice.thekyb.com/settings.",
    );
  }
  return {
    token,
    base: (process.env["THEKYB_API_BASE"] ?? DEFAULT_BASE).replace(/\/$/, ""),
  };
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { token, base } = credentials();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      token,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { message: text };
  }
  if (!response.ok || parsed?.error === true) {
    const message = parsed?.message ?? parsed?.error ?? text ?? `HTTP ${response.status}`;
    console.error(`The KYB ${method} ${path} failed [${response.status}]: ${message}`);
    throw new Error(`The KYB request failed: ${message}`);
  }
  return parsed as T;
}

export type TheKybSearchResult = {
  kyb_request_id: string;
  status: string;
  hits: TheKybSearchHit[];
  pagination?: { total?: number; current_page?: number; last_page?: number };
};

function hitsFromPayload(data: any): TheKybSearchHit[] {
  const requestId = data?.kyb_request?.kyb_request_id ?? data?.request_id ?? "";
  const rows = data?.kyb_responses ?? data?.kyb_request_data ?? [];
  return (rows as any[]).map((row) => ({
    kyb_response_id: String(row.kyb_response_id ?? row.id ?? row.company_id ?? ""),
    kyb_request_id: String(row.kyb_request_id ?? row.request_id ?? requestId),
    name: String(row.name ?? ""),
    registration_number: row.registration_number ? String(row.registration_number) : null,
    country_code: row.country_code ?? row.country_name ?? null,
    type: row.type ?? null,
    status: row.status ?? null,
    risk_level: row.risk_level ?? null,
    verification_status: row.verification_status ?? null,
    fetch_status: row.fetch_status ?? row.company_fetched_data_status ?? null,
  }));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const thekyb = {
  countries() {
    return call<{ error: boolean; data: unknown }>("GET", "/v2/countries");
  },

  async search(input: {
    name?: string;
    registrationNumber?: string;
    country?: string;
    searchType?: "contains" | "start_with" | "fuzzy";
  }): Promise<TheKybSearchResult> {
    const body: Record<string, unknown> = {
      country_codes: [toTheKybCountryCode(input.country)],
      search_type: input.searchType ?? "contains",
    };
    if (input.registrationNumber) body["registration_number"] = input.registrationNumber;
    else body["name"] = input.name;
    const created = await call<any>("POST", "/v2/kyb", body);
    const requestId = String(
      created?.data?.kyb_request?.kyb_request_id ?? created?.request_id ?? "",
    );
    let payload = created?.data ?? created;
    let status = String(payload?.kyb_request?.status ?? "pending");
    let hits = hitsFromPayload(payload);

    for (let i = 0; i < 4 && status === "pending" && hits.length === 0 && requestId; i++) {
      await sleep(1500);
      const polled = await call<any>(
        "GET",
        `/v2/kyb?kyb_request_id=${encodeURIComponent(requestId)}&page=1&limit=25`,
      );
      payload = polled?.data ?? polled;
      status = String(payload?.kyb_request?.status ?? status);
      hits = hitsFromPayload(payload);
    }

    return {
      kyb_request_id: requestId,
      status,
      hits,
      pagination: payload?.pagination,
    };
  },

  searchResults(requestId: string, page = 1, limit = 25) {
    return call<any>(
      "GET",
      `/v2/kyb?kyb_request_id=${encodeURIComponent(requestId)}&page=${page}&limit=${limit}`,
    );
  },

  company(responseId: string) {
    return call<any>("GET", `/v2/kyb/${encodeURIComponent(responseId)}`);
  },

  async amlSearch(input: {
    name: string;
    country?: string;
    entityType?: "Person" | "Company" | "Organization";
  }) {
    const created = await call<any>("POST", "/api/search", {
      search: input.name,
      fuzziness: "90",
      exact_search: false,
      rca_search: "true",
      alias_search: "true",
      services: ["aml"],
      entity_type: [input.entityType ?? "Company", "Organization", "Person"],
      categories: [...THEKYB_AML_CATEGORIES],
      country_names: [toTheKybCountryName(input.country)],
    });
    const amlRequestId = String(created?.aml_request_id ?? created?.data?.aml_request_id ?? "");
    let payload = created?.data ?? null;
    let status = String(payload?.request_status ?? "pending");

    for (let i = 0; i < 4 && amlRequestId && status === "pending"; i++) {
      await sleep(1500);
      const polled = await call<any>(
        "GET",
        `/api/readAmlResponse?aml_request_id=${encodeURIComponent(amlRequestId)}&page=1&limit=25`,
      );
      payload = polled?.data ?? polled;
      status = String(payload?.request_status ?? status);
    }

    return {
      aml_request_id: amlRequestId,
      status,
      match_status: payload?.match_status ?? null,
      rows: (payload?.aml_request_data as Array<Record<string, unknown>> | undefined) ?? [],
    };
  },

  performCompanyAml(companyId: string, requestId: string) {
    return call<any>("POST", "/api/performCompanyAml", {
      company_id: companyId,
      request_id: requestId,
    });
  },

  performOfficersAml(companyId: string, requestId: string, personName?: string) {
    return call<any>("POST", "/api/performOfficersAml", {
      company_id: companyId,
      request_id: requestId,
      ...(personName ? { person_name: personName } : {}),
    });
  },
};

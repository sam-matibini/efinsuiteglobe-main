/**
 * One description of the public API, used by both the developer docs page
 * and the machine-readable OpenAPI file, so the two can never drift apart.
 */
export const API_BASE_PATH = "/api/public/v1";

export type ApiEndpoint = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  summary: string;
  description: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
};

export type ApiGroup = { name: string; blurb: string; endpoints: ApiEndpoint[] };

export const API_GROUPS: ApiGroup[] = [
  {
    name: "Getting started",
    blurb: "Check a key and see which company and environment it belongs to.",
    endpoints: [
      {
        method: "GET",
        path: "/ping",
        summary: "Check your key",
        description: "Confirms the key works and returns the company and environment it belongs to.",
        response: { data: { ok: true, api_version: "v1", environment: "live", organization: { id: "…", name: "eFinMoney" } } },
      },
    ],
  },
  {
    name: "Cases",
    blurb: "A case is one person or one business being checked.",
    endpoints: [
      {
        method: "GET",
        path: "/cases",
        summary: "List cases",
        description: "Newest first. Filter with ?status= and ?case_type=, page with ?limit= and ?offset=.",
        response: { data: [{ id: "…", reference: "API-XYZ", case_type: "person", status: "in_review", risk_level: "low" }] },
      },
      {
        method: "POST",
        path: "/cases",
        summary: "Create a case",
        description: "Send an Idempotency-Key header so a retry never creates a second case.",
        request: { case_type: "person", subject_name: "Jane Doe", country: "CA", reference: "EFIN-10231" },
        response: { data: { id: "…", reference: "EFIN-10231", status: "pending" } },
      },
      {
        method: "GET",
        path: "/cases/{case_id}",
        summary: "Read a case",
        description: "The case with its checks, screening matches, beneficial owners and recent transactions.",
      },
      {
        method: "POST",
        path: "/cases/{case_id}/decision",
        summary: "Approve or reject",
        description: "Records the decision, writes the audit entry and emails the reviewer and case owner.",
        request: { status: "approved", note: "Document and bank details matched." },
      },
    ],
  },
  {
    name: "Identity verification",
    blurb: "Either send us the data yourself, or hand the customer a secure link.",
    endpoints: [
      {
        method: "POST",
        path: "/cases/{case_id}/verification-sessions",
        summary: "Create a hosted link",
        description:
          "Returns a one-time link the customer opens to submit their ID and liveness check. The result arrives on your webhook as verification.completed.",
        request: { expires_in_minutes: 1440, redirect_url: "https://app.efinmoney.com/kyc/done" },
        response: { data: { id: "…", url: "https://eterfaceid.com/verify/…", expires_at: "…" } },
      },
      {
        method: "POST",
        path: "/cases/{case_id}/documents",
        summary: "Submit a document",
        description:
          "Server-to-server document check: machine-readable lines are parsed and validated, dates and ID number formats are checked, and the name is compared with the case.",
        request: { doc_type: "passport", mrz: "P<CANDOE<<JANE<<<<…", document_number: "AB123456", birth_date: "1990-04-12" },
        response: { data: { document_id: "…", result: "pass", checks: [{ name: "MRZ check digits", ok: true }] } },
      },
      {
        method: "POST",
        path: "/cases/{case_id}/selfies",
        summary: "Submit a liveness check",
        description: "Scores liveness from the capture signals. Face-to-document matching is confirmed by a reviewer.",
        request: {
          challenge: "Blink twice",
          signals: { frames_captured: 16, challenge_passed: true, motion_variance: 0.18, brightness_range: 0.12, blur_score: 0.22, face_stable: true },
        },
      },
      {
        method: "POST",
        path: "/cases/{case_id}/addresses",
        summary: "Verify an address and age",
        description: "Checks address structure, postal code and province, and validates date of birth when supplied.",
        request: { line1: "120 King St W", city: "Toronto", region: "ON", postal_code: "M5H 1A1", country: "CA", birth_date: "1990-04-12" },
      },
      {
        method: "POST",
        path: "/cases/{case_id}/risk",
        summary: "Score fraud and device risk",
        description: "Email, phone, device and network signals combined into one score with every factor listed.",
        request: { email: "jane@example.com", phone: "+14165550123", ip_address: "203.0.113.4", ip_country: "CA", fingerprint: "…" },
      },
    ],
  },
  {
    name: "Business verification",
    blurb: "Beneficial ownership under FATF R.24/R.25, the CTA and PCMLTFA.",
    endpoints: [
      { method: "GET", path: "/cases/{case_id}/owners", summary: "List owners", description: "Everyone recorded against the business, with effective percentages." },
      {
        method: "POST",
        path: "/cases/{case_id}/owners",
        summary: "Add an owner",
        description: "Layered holdings are supported through parent_owner_id.",
        request: { name: "Holdco Ltd", entity_type: "business", ownership_pct: 60, country: "CA" },
      },
      {
        method: "POST",
        path: "/cases/{case_id}/ownership",
        summary: "Work out the beneficial owners",
        description: "Multiplies ownership down the chain, flags owners at or above 25%, and applies the OFAC 50 percent rule.",
        response: { data: { owners: [{ name: "Jane Doe", effectivePct: 42, isUbo: true }], rule: { blocked: false } } },
      },
      {
        method: "GET",
        path: "/cases/{case_id}/registry",
        summary: "Read The KYB registry profiles",
        description:
          "Official-registry companies attached to the case through The KYB, including AML match status. Complements bank-confirmed identity from Plaid.",
      },
      {
        method: "POST",
        path: "/cases/{case_id}/registry",
        summary: "Search, attach or AML-screen via The KYB",
        description:
          "action=search looks up a legal name or number in official registries. action=attach imports the chosen company, officers and UBOs. action=aml screens the entity on The KYB lists.",
        request: { action: "search", name: "Acme Payments Inc", country: "CA" },
        response: {
          data: {
            kyb_request_id: "…",
            hits: [{ kyb_response_id: "…", name: "ACME PAYMENTS INC", registration_number: "1001234567", status: "active" }],
          },
        },
      },
    ],
  },
  {
    name: "Screening and monitoring",
    blurb: "Sanctions, PEP and watchlist screening, plus transaction rules and alerts.",
    endpoints: [
      {
        method: "POST",
        path: "/screening",
        summary: "Screen a name",
        description: "Ad-hoc screening with no case attached. Returns every match above the threshold with its reasons.",
        request: { name: "Vladimir Putin", entity_type: "person", country: "RU", threshold: 0.72 },
      },
      {
        method: "POST",
        path: "/cases/{case_id}/screen",
        summary: "Screen or re-screen a case",
        description: "Records new matches against the case and updates its risk score.",
        request: { threshold: 0.72 },
      },
      { method: "GET", path: "/cases/{case_id}/hits", summary: "List matches", description: "Screening matches recorded on the case." },
      {
        method: "PATCH",
        path: "/hits/{hit_id}",
        summary: "Clear or confirm a match",
        description: "Mark a match as a true or false positive, with a note.",
        request: { disposition: "false_positive", note: "Different date of birth." },
      },
      {
        method: "POST",
        path: "/transactions",
        summary: "Record a payment",
        description:
          "Runs FINTRAC, FinCEN and FATF rules (cash and cross-border thresholds, structuring, travel rule, velocity, deviation) and screens the counterparty.",
        request: { case_id: "…", direction: "inbound", method: "cash", amount: 9800, currency: "CAD", counterparty_name: "Acme Ltd" },
        response: { data: { id: "…", risk_score: 72, status: "review", alerts: [{ code: "STRUCTURING" }] } },
      },
      { method: "GET", path: "/transactions", summary: "List payments", description: "Filter with ?case_id=." },
      { method: "GET", path: "/alerts", summary: "List alerts", description: "Filter with ?status= and ?case_id=." },
      {
        method: "PATCH",
        path: "/alerts/{alert_id}",
        summary: "Acknowledge or close an alert",
        description: "Moves an alert to acknowledged or closed.",
        request: { status: "closed", detail: "Reviewed, expected activity." },
      },
    ],
  },
  {
    name: "Bank-confirmed identity",
    blurb: "Available when bank connections are switched on for the platform.",
    endpoints: [
      {
        method: "POST",
        path: "/cases/{case_id}/bank",
        summary: "Start or finish a bank link",
        description:
          "Called with no body it returns a link token your front-end passes to the bank sign-in window. Called with public_token it completes the link.",
        request: { public_token: "public-sandbox-…" },
      },
      { method: "GET", path: "/cases/{case_id}/bank", summary: "Read bank results", description: "Linked banks and the field-by-field identity comparison." },
    ],
  },
  {
    name: "Regulatory reports",
    blurb: "Draft, list and mark filed the reports your regulator expects.",
    endpoints: [
      {
        method: "POST",
        path: "/reports",
        summary: "Draft a report",
        description: "Builds an STR, LCTR, EFTR, SAR, CTR or FIU package from the case, its matches and its payments.",
        request: { case_id: "…", report_type: "str", jurisdiction: "CA", authority: "FINTRAC", narrative: "…" },
      },
      { method: "GET", path: "/reports", summary: "List reports", description: "Filter with ?status=." },
      { method: "GET", path: "/reports/{report_id}", summary: "Read a report", description: "The full report package." },
      {
        method: "PATCH",
        path: "/reports/{report_id}",
        summary: "Mark a report filed",
        description: "Records the authority's reference and fires the report.filed webhook.",
        request: { status: "submitted", reference: "FINTRAC-2026-0091" },
      },
    ],
  },
];

export const WEBHOOK_EVENTS: { event: string; when: string }[] = [
  { event: "case.created", when: "A case is created through the API." },
  { event: "case.decision", when: "A case is approved or rejected." },
  { event: "verification.completed", when: "A document, liveness check or hosted link is finished." },
  { event: "screening.hit", when: "Screening finds a new match on a case." },
  { event: "transaction.flagged", when: "A payment triggers one or more rules." },
  { event: "report.filed", when: "A regulatory report is marked as filed." },
];

export const ERROR_CODES: { code: string; status: number; meaning: string }[] = [
  { code: "missing_api_key", status: 401, meaning: "No key was sent in the Authorization header." },
  { code: "invalid_api_key", status: 401, meaning: "The key does not exist." },
  { code: "revoked_api_key", status: 401, meaning: "The key was revoked in the console." },
  { code: "live_access_required", status: 403, meaning: "Live access has not been approved for this account yet." },
  { code: "live_access_suspended", status: 403, meaning: "Live access for this account is suspended." },
  { code: "contract_required", status: 403, meaning: "The commercial agreement has not been signed." },
  { code: "account_inactive", status: 402, meaning: "The account is suspended or cancelled." },
  { code: "quota_exceeded", status: 402, meaning: "The month's included volume has been used up. Upgrade the plan." },
  { code: "rate_limited", status: 429, meaning: "More than 120 calls in one minute on this key." },
  { code: "invalid_request", status: 422, meaning: "The body failed validation; the issues are listed." },
  { code: "not_found", status: 404, meaning: "No such record for your company." },
  { code: "integration_disabled", status: 409, meaning: "That add-on is switched off." },
  { code: "query_failed", status: 500, meaning: "Something went wrong on our side." },
];

/** Sandbox keys (`eid_test_…`) never touch the real lists — these names drive the result. */
export const SANDBOX_TEST_VALUES: { value: string; effect: string }[] = [
  { value: "test-sanctioned", effect: "Screening returns a high-confidence sanctions match and a high risk score." },
  { value: "test-pep", effect: "Screening returns a politically exposed person match and a medium risk score." },
  { value: "test-review", effect: "Bank-confirmed identity comes back as a close, not exact, match." },
  { value: "test-fail", effect: "Bank-confirmed identity comes back as different." },
  { value: "any other name", effect: "Clean result, no matches. Registry search returns a verified sandbox company." },
];


/** Builds the OpenAPI 3.1 document served at /api/public/v1/openapi.json. */
export function buildOpenApi(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const group of API_GROUPS) {
    for (const ep of group.endpoints) {
      const path = `${API_BASE_PATH}${ep.path.replace(/\{(\w+)\}/g, "{$1}")}`;
      paths[path] = paths[path] ?? {};
      const parameters = [...ep.path.matchAll(/\{(\w+)\}/g)].map((m) => ({
        name: m[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      }));
      paths[path]![ep.method.toLowerCase()] = {
        tags: [group.name],
        summary: ep.summary,
        description: ep.description,
        ...(parameters.length ? { parameters } : {}),
        ...(ep.request
          ? {
              requestBody: {
                required: true,
                content: { "application/json": { schema: { type: "object" }, example: ep.request } },
              },
            }
          : {}),
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { type: "object" },
                ...(ep.response ? { example: ep.response } : {}),
              },
            },
          },
          "401": { description: "Missing or invalid API key" },
        },
        security: [{ ApiKey: [] }],
      };
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "eterfaceID API",
      version: "1.0.0",
      description:
        "KYC, KYB, sanctions screening, transaction monitoring and regulatory reporting. Authenticate with an eterfaceID API key: Authorization: Bearer eid_…",
    },
    servers: [{ url: serverUrl }],
    tags: API_GROUPS.map((g) => ({ name: g.name, description: g.blurb })),
    components: {
      securitySchemes: {
        ApiKey: { type: "http", scheme: "bearer", bearerFormat: "eid_…" },
      },
    },
    security: [{ ApiKey: [] }],
    paths,
    "x-webhooks": WEBHOOK_EVENTS,
  };
}

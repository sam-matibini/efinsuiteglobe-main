/** Minimal Plaid REST client. Server-only: never import from client code. */

type PlaidEnv = "sandbox" | "production";

function credentials() {
  const clientId = process.env["PLAID_CLIENT_ID"];
  const secret = process.env["PLAID_SECRET"];
  const env = (process.env["PLAID_ENV"] ?? "sandbox").toLowerCase() as PlaidEnv;
  if (!clientId || !secret) {
    throw new Error("Plaid is not configured yet. Add the Plaid credentials in App admin.");
  }
  const host = env === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com";
  return { clientId, secret, env, host };
}

export function plaidEnvironment(): PlaidEnv {
  return (process.env["PLAID_ENV"] ?? "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
}

export function plaidConfigured(): boolean {
  return Boolean(process.env["PLAID_CLIENT_ID"] && process.env["PLAID_SECRET"]);
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { clientId, secret, host } = credentials();
  const response = await fetch(`${host}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`Plaid ${path} failed [${response.status}]: ${text}`);
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error_message?: string; error_code?: string };
      message = parsed.error_message ?? parsed.error_code ?? text;
    } catch {
      /* keep raw text */
    }
    throw new Error(`Plaid request failed: ${message}`);
  }
  return JSON.parse(text) as T;
}

export type PlaidAddress = {
  data: { street?: string; city?: string; region?: string; postal_code?: string; country?: string };
  primary?: boolean;
};

export type PlaidIdentityOwner = {
  names: string[];
  emails: { data: string }[];
  phone_numbers: { data: string }[];
  addresses: PlaidAddress[];
};

export const plaid = {
  createLinkToken: (userId: string, products: string[]) =>
    call<{ link_token: string; expiration: string }>("/link/token/create", {
      user: { client_user_id: userId },
      client_name: "eterfaceID",
      products,
      country_codes: ["CA", "US"],
      language: "en",
    }),

  exchangePublicToken: (publicToken: string) =>
    call<{ access_token: string; item_id: string }>("/item/public_token/exchange", {
      public_token: publicToken,
    }),

  identity: (accessToken: string) =>
    call<{ accounts: { owners: PlaidIdentityOwner[] }[]; item: { institution_id?: string } }>("/identity/get", {
      access_token: accessToken,
    }),

  institution: (institutionId: string) =>
    call<{ institution: { name: string } }>("/institutions/get_by_id", {
      institution_id: institutionId,
      country_codes: ["CA", "US"],
    }),

  transactionsSync: (accessToken: string, cursor: string | null) =>
    call<{
      added: PlaidTransaction[];
      next_cursor: string;
      has_more: boolean;
    }>("/transactions/sync", {
      access_token: accessToken,
      ...(cursor ? { cursor } : {}),
      count: 250,
    }),
};

export type PlaidTransaction = {
  transaction_id: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  date: string;
  datetime?: string | null;
  merchant_name?: string | null;
  name: string;
  payment_channel?: string | null;
  payment_meta?: { payer?: string | null; payee?: string | null } | null;
};

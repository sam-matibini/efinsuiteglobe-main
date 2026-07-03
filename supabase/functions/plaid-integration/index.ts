import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlaidAction =
  | "health-check"
  | "test"
  | "create-link-token"
  | "exchange-public-token"
  | "get-accounts"
  | "get-transactions";

interface PlaidRequest {
  action: PlaidAction;
  environment?: string;
  userId?: string;
  publicToken?: string;
  accessToken?: string;
  startDate?: string;
  endDate?: string;
}

const normalizeEnv = (env?: string | null) => {
  const v = (env ?? "").trim().toLowerCase();
  if (!v) return "";
  if (v === "prod" || v === "production") return "production";
  if (v === "dev" || v === "development") return "development";
  if (v === "sandbox") return "sandbox";
  return "";
};

const getPlaidBaseUrl = (environment: string) => {
  switch (normalizeEnv(environment)) {
    case "production":
      return "https://production.plaid.com";
    case "development":
      return "https://development.plaid.com";
    default:
      return "https://sandbox.plaid.com";
  }
};

const PLAID_VERSION = "2020-09-14";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PlaidRequest = await req.json();

    const plaidClientId = Deno.env.get("PLAID_CLIENT_ID")?.trim() ?? "";
    const plaidSecret = Deno.env.get("PLAID_SECRET")?.trim() ?? "";

    const envFromRequest = normalizeEnv(body.environment);
    const envFromSecrets = normalizeEnv(Deno.env.get("PLAID_ENVIRONMENT"));
    const plaidEnvironment = envFromRequest || envFromSecrets || "sandbox";

    const baseUrl = getPlaidBaseUrl(plaidEnvironment);

    // Health check - verify secrets exist
    if (body.action === "health-check") {
      const configured = Boolean(plaidClientId && plaidSecret);
      return new Response(
        JSON.stringify({
          success: true,
          configured,
          environment: plaidEnvironment,
          message: configured ? "Plaid is configured" : "Plaid credentials not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!plaidClientId || !plaidSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Plaid credentials not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const plaidPost = async (
      path: string,
      payload: Record<string, unknown>,
      overrideBaseUrl?: string
    ) => {
      const urlBase = overrideBaseUrl ?? baseUrl;
      const response = await fetch(`${urlBase}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PLAID-CLIENT-ID": plaidClientId,
          "PLAID-SECRET": plaidSecret,
          "Plaid-Version": PLAID_VERSION,
        },
        body: JSON.stringify(payload),
      });

      let result: any = null;
      try {
        result = await response.json();
      } catch {
        result = null;
      }

      return { response, result };
    };

    // Test connection - verify credentials work
    if (body.action === "test") {
      const testPayload = {
        query: "Chase",
        products: ["transactions"],
        country_codes: ["US"],
      };

      const { response, result } = await plaidPost("/institutions/search", testPayload);

      if (response.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Plaid connection verified",
            environment: plaidEnvironment,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (result?.error_code === "INVALID_API_KEYS") {
        const sandboxUrl = getPlaidBaseUrl("sandbox");
        const sandboxAttempt = await plaidPost("/institutions/search", testPayload, sandboxUrl);

        if (sandboxAttempt.response.ok) {
          return new Response(
            JSON.stringify({
              success: false,
              error: result?.error_message || "invalid client_id or secret provided",
              error_code: result?.error_code,
              error_type: result?.error_type,
              request_id: result?.request_id,
              recommendedEnvironment: "sandbox",
              hint:
                "Your Plaid keys are valid in Sandbox, but you selected a non-sandbox environment. Switch Environment to 'sandbox' or replace your credentials with matching Production/Development keys.",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const hint =
        result?.error_code === "INVALID_API_KEYS"
          ? "Credentials do not match the selected environment. If your keys are Sandbox keys, set Environment to 'sandbox'. If you intend to use 'production', generate/enter Production keys (client_id + production secret) and ensure your Plaid account is enabled for Production."
          : undefined;

      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error_message || "Plaid test failed",
          hint,
          error_code: result?.error_code,
          error_type: result?.error_type,
          request_id: result?.request_id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Link token for Plaid Link initialization
    if (body.action === "create-link-token") {
      const userId = body.userId ?? data.claims.sub ?? "";
      const { response, result } = await plaidPost("/link/token/create", {
        user: { client_user_id: userId },
        client_name: "EfinSuite",
        products: ["transactions"],
        country_codes: ["US", "CA"],
        language: "en",
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({ success: true, linkToken: result?.link_token }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error_message || "Failed to create link token",
          error_code: result?.error_code,
          error_type: result?.error_type,
          request_id: result?.request_id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Exchange public token for access token
    if (body.action === "exchange-public-token") {
      const publicToken = body.publicToken ?? "";
      const { response, result } = await plaidPost("/item/public_token/exchange", {
        public_token: publicToken,
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            accessToken: result?.access_token,
            itemId: result?.item_id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error_message || "Failed to exchange public token",
          error_code: result?.error_code,
          error_type: result?.error_type,
          request_id: result?.request_id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get accounts
    if (body.action === "get-accounts") {
      const accessToken = body.accessToken ?? "";
      const { response, result } = await plaidPost("/accounts/get", {
        access_token: accessToken,
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({ success: true, accounts: result?.accounts ?? [] }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error_message || "Failed to fetch accounts",
          error_code: result?.error_code,
          error_type: result?.error_type,
          request_id: result?.request_id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get transactions
    if (body.action === "get-transactions") {
      const accessToken = body.accessToken ?? "";
      const startDate = body.startDate ?? "";
      const endDate = body.endDate ?? "";

      const { response, result } = await plaidPost("/transactions/get", {
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({
            success: true,
            transactions: result?.transactions ?? [],
            accounts: result?.accounts ?? [],
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: result?.error_message || "Failed to fetch transactions",
          error_code: result?.error_code,
          error_type: result?.error_type,
          request_id: result?.request_id,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Plaid integration error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

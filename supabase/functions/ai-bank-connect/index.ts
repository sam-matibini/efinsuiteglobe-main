import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAID_VERSION = "2020-09-14";

type PlaidEnvironment = "sandbox" | "development" | "production";

const normalizePlaidEnvironment = (raw: string): PlaidEnvironment => {
  const v = (raw || "").trim().toLowerCase();
  if (v === "production" || v === "prod" || v === "live") return "production";
  if (v === "development" || v === "dev") return "development";
  return "sandbox";
};

const getPlaidBaseUrl = (environment: string) => {
  switch (environment?.toLowerCase()) {
    case "production":
      return "https://production.plaid.com";
    case "development":
      return "https://development.plaid.com";
    default:
      return "https://sandbox.plaid.com";
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, publicToken, userId, startDate, endDate } = await req.json();
    
    // Get Plaid credentials
    const plaidClientId = Deno.env.get("PLAID_CLIENT_ID")?.trim() ?? "";
    const plaidSecret = Deno.env.get("PLAID_SECRET")?.trim() ?? "";
    const plaidEnvironmentRaw = Deno.env.get("PLAID_ENVIRONMENT")?.trim() || "sandbox";
    const plaidEnvironment = normalizePlaidEnvironment(plaidEnvironmentRaw);
    const plaidConfigured = Boolean(plaidClientId && plaidSecret);
    const baseUrl = getPlaidBaseUrl(plaidEnvironment);

    const plaidPost = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PLAID-CLIENT-ID": plaidClientId,
          "PLAID-SECRET": plaidSecret,
          "Plaid-Version": PLAID_VERSION,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      return { response, result };
    };

    // Health check - verify Plaid is configured
    if (action === 'check-config') {
      return new Response(JSON.stringify({
        plaidConfigured,
        environment: plaidEnvironment,
        environmentRaw: plaidEnvironmentRaw,
        message: plaidConfigured
          ? `Plaid configured for ${plaidEnvironment} environment`
          : "Plaid credentials not configured - please set up in Admin Settings",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require Plaid to be configured
    if (!plaidConfigured) {
      return new Response(JSON.stringify({
        error: "Plaid is not configured. Please set PLAID_CLIENT_ID and PLAID_SECRET in Admin Settings.",
        configured: false
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Product diagnostic - test which products are actually authorized
    if (action === 'check-products') {
      const productsToTest = ['transactions', 'auth', 'identity', 'investments', 'liabilities'];
      const results: Record<string, { authorized: boolean; error?: string }> = {};

      for (const product of productsToTest) {
        try {
          const testPayload = {
            user: { client_user_id: `diag-${Date.now()}` },
            client_name: "EfinSuite",
            products: [product],
            country_codes: ["CA", "US"],
            language: "en",
          };
          const { response, result } = await plaidPost("/link/token/create", testPayload);
          
          if (response.ok) {
            results[product] = { authorized: true };
          } else if (result?.error_code === 'INVALID_PRODUCT') {
            results[product] = { authorized: false, error: 'Not authorized - apply in Plaid Dashboard' };
          } else {
            results[product] = { authorized: false, error: result?.error_message || 'Unknown error' };
          }
        } catch (err) {
          results[product] = { authorized: false, error: err instanceof Error ? err.message : 'Test failed' };
        }
      }

      const transactionsOk = results['transactions']?.authorized === true;

      return new Response(JSON.stringify({
        success: true,
        environment: plaidEnvironment,
        products: results,
        transactionsAuthorized: transactionsOk,
        message: transactionsOk
          ? 'Transactions product is authorized'
          : 'Transactions product is NOT authorized. Apply for production access at dashboard.plaid.com',
        hint: transactionsOk ? null : 'Go to Plaid Dashboard → Production Access and request Transactions product approval.',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Plaid Link token for initiating bank connection
    if (action === 'create-link-token') {
      const { response, result } = await plaidPost("/link/token/create", {
        user: { 
          client_user_id: userId || "user-" + Date.now(),
        },
        client_name: "EfinSuite",
        products: ["transactions"],
        country_codes: ["CA"],
        language: "en",
      });

      if (response.ok) {
        return new Response(JSON.stringify({ 
          success: true, 
          linkToken: result.link_token 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: result?.error_message || "Failed to create link token",
        error_code: result?.error_code
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange public token for access token
    if (action === 'exchange-public-token') {
      const { response, result } = await plaidPost("/item/public_token/exchange", {
        public_token: publicToken,
      });

      if (response.ok) {
        return new Response(JSON.stringify({
          success: true,
          accessToken: result.access_token,
          itemId: result.item_id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: result?.error_message || "Failed to exchange public token",
        error_code: result?.error_code
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get real accounts from Plaid using access token
    if (action === 'discover_accounts') {
      if (!accessToken) {
        return new Response(JSON.stringify({
          error: "Access token required to fetch accounts. Please complete Plaid Link first.",
          accounts: []
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { response, result } = await plaidPost("/accounts/get", {
        access_token: accessToken,
      });

      if (response.ok && result?.accounts) {
        const accounts = result.accounts.map((acc: any) => ({
          id: acc.account_id,
          name: acc.name || acc.official_name,
          type: acc.subtype || acc.type,
          lastFour: acc.mask || "0000",
          balance: acc.balances?.current || 0,
          selected: true,
          plaidAccountId: acc.account_id,
        }));

        return new Response(JSON.stringify({ 
          accounts,
          source: 'plaid',
          institution: result.item?.institution_id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        error: result?.error_message || "Failed to fetch accounts from Plaid",
        error_code: result?.error_code,
        accounts: []
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync transactions from Plaid
    if (action === 'sync_account') {
      if (!accessToken) {
        return new Response(JSON.stringify({
          error: "Access token required to sync transactions",
          transactions: []
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Default to last 30 days if dates not provided
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const start = startDate || thirtyDaysAgo.toISOString().split('T')[0];
      const end = endDate || today.toISOString().split('T')[0];

      const { response, result } = await plaidPost("/transactions/get", {
        access_token: accessToken,
        start_date: start,
        end_date: end,
      });

      if (response.ok) {
        const transactions = (result.transactions || []).map((txn: any) => ({
          id: txn.transaction_id,
          date: txn.date,
          description: txn.name || txn.merchant_name,
          amount: txn.amount * -1, // Plaid uses positive for debits, we want negative for outflows
          type: txn.amount > 0 ? 'withdrawal' : 'deposit',
          category: txn.category?.[0] || 'Uncategorized',
          merchantName: txn.merchant_name,
          pending: txn.pending,
        }));

        return new Response(JSON.stringify({
          transactions,
          accounts: result.accounts || [],
          synced: true,
          source: 'plaid'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const errCode = result?.error_code;
      const requiresReauth = errCode === 'ITEM_LOGIN_REQUIRED'
        || errCode === 'PENDING_EXPIRATION'
        || errCode === 'ITEM_LOCKED'
        || errCode === 'USER_SETUP_REQUIRED';

      return new Response(JSON.stringify({
        error: result?.error_message || "Failed to fetch transactions",
        error_code: errCode,
        requires_reauth: requiresReauth,
        transactions: []
      }), {
        // Return 200 when re-auth is required so the client can handle it
        // gracefully via Plaid Link update mode instead of crashing on a 400.
        status: requiresReauth ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Bank connect error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
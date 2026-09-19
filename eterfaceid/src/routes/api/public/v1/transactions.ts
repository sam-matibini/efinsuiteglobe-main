import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  authenticateApiRequest,
  corsPreflight,
  countUsage,
  dispatchWebhook,
  jsonResponse,
  paging,
} from "@/lib/api-gateway.server";
import { evaluateTransaction, transactionRisk, type TxInput } from "@/lib/transaction-rules";
import { normalizeName, scoreMatch } from "@/lib/name-match";

const schema = z.object({
  case_id: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  method: z.enum(["cash", "eft", "wire", "card", "interac", "crypto", "cheque"]),
  amount: z.number().positive(),
  currency: z.string().length(3).default("CAD"),
  amount_cad: z.number().positive().optional(),
  counterparty_name: z.string().trim().max(200).optional(),
  counterparty_country: z.string().trim().length(2).optional(),
  occurred_at: z.string().optional(),
  external_id: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/public/v1/transactions")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { limit, offset, searchParams } = paging(request);
        let query = auth.admin
          .from("transactions")
          .select(
            "id, case_id, external_id, direction, method, amount, currency, amount_cad, counterparty_name, counterparty_country, occurred_at, channel, risk_score, status",
          )
          .eq("org_id", auth.orgId)
          .order("occurred_at", { ascending: false })
          .range(offset, offset + limit - 1);
        const caseId = searchParams.get("case_id");
        if (caseId) query = query.eq("case_id", caseId);
        const { data, error } = await query;
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);
        return jsonResponse({ data, paging: { limit, offset, count: data?.length ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return jsonResponse({ error: "invalid_request", issues: parsed.error.issues }, 422);
        const body = parsed.data;
        const { data: parentCase } = await auth.admin
          .from("cases")
          .select("id")
          .eq("id", body.case_id)
          .eq("org_id", auth.orgId)
          .maybeSingle();
        if (!parentCase) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        const occurredAt = body.occurred_at ?? new Date().toISOString();
        const amountCad = body.amount_cad ?? body.amount;

        const { data: history } = await auth.admin
          .from("transactions")
          .select("amount_cad, direction, method, occurred_at, counterparty_name, counterparty_country")
          .eq("case_id", body.case_id)
          .order("occurred_at", { ascending: false })
          .limit(500);

        const tx: TxInput = {
          direction: body.direction,
          method: body.method,
          amount: body.amount,
          currency: body.currency,
          amountCad,
          counterpartyName: body.counterparty_name,
          counterpartyCountry: body.counterparty_country?.toUpperCase(),
          occurredAt,
        };
        const alerts = evaluateTransaction(tx, (history ?? []) as any[]);

        if (body.counterparty_name) {
          const { data: matches } = await auth.admin.rpc("match_watchlist_names", {
            _q: normalizeName(body.counterparty_name),
            _threshold: 0.45,
            _limit: 50,
          });
          let best: { name: string; score: number } | null = null;
          for (const m of (matches ?? []) as any[]) {
            const outcome = scoreMatch({ query: body.counterparty_name, candidate: m.matched_name });
            if (!best || outcome.score > best.score) best = { name: m.matched_name, score: outcome.score };
          }
          if (best && best.score >= 0.8) {
            alerts.push({
              code: "SANCTIONED_COUNTERPARTY",
              name: "Counterparty matches a screening list",
              severity: "high",
              citation: "FATF R.6/R.7; OFAC 31 CFR Part 501; Canadian sanctions regime",
              detail: `Closest list name: ${best.name} (score ${best.score.toFixed(2)})`,
              weight: 45,
            });
          }
        }

        const { score, status } = transactionRisk(alerts);
        const { data: inserted, error } = await auth.admin
          .from("transactions")
          .insert({
            org_id: auth.orgId,
            case_id: body.case_id,
            external_id: body.external_id ?? null,
            direction: body.direction,
            method: body.method,
            amount: body.amount,
            currency: body.currency,
            amount_cad: amountCad,
            counterparty_name: body.counterparty_name ?? null,
            counterparty_country: body.counterparty_country?.toUpperCase() ?? null,
            occurred_at: occurredAt,
            channel: "api",
            risk_score: score,
            status,
          })
          .select("id")
          .single();
        if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

        if (alerts.length) {
          await auth.admin.from("transaction_alerts").insert(
            alerts.map((a) => ({
              transaction_id: (inserted as any).id,
              case_id: body.case_id,
              rule_code: a.code,
              rule_name: a.name,
              severity: a.severity,
              citation: a.citation,
              detail: a.detail,
            })),
          );
          await dispatchWebhook(auth.admin, auth.orgId, auth.environment, "transaction.flagged", {
            transaction_id: (inserted as any).id,
            case_id: body.case_id,
            score,
            status,
            rules: alerts.map((a) => a.code),
          });
        }

        if (alerts.some((a) => a.severity === "high")) {
          await auth.admin.from("monitoring_alerts").insert({
            case_id: body.case_id,
            org_id: auth.orgId,
            alert_type: "transaction",
            detail: alerts.filter((a) => a.severity === "high").map((a) => a.name).join("; "),
          } as never);
        }
        await countUsage(auth, "transactions");

        return jsonResponse(
          { data: { id: (inserted as any).id, risk_score: score, status, alerts } },
          201,
        );
      },
    },
  },
});

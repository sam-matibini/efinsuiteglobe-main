import { evaluateTransaction, transactionRisk, type TxInput } from "@/lib/transaction-rules";
import { normalizeName, scoreMatch } from "@/lib/name-match";

type Admin = any;

/**
 * Pulls new bank activity for one linked item and runs it through the same
 * monitoring rules as manually recorded transactions.
 */
export async function syncPlaidItem(admin: Admin, itemId: string) {
  const { plaid } = await import("@/lib/plaid.server");

  const { data: item } = await admin
    .from("plaid_items")
    .select("id, org_id, case_id, access_token, cursor, institution_name")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) throw new Error("That bank connection could not be found");

  let cursor: string | null = item.cursor ?? null;
  let imported = 0;
  let flagged = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const page = await plaid.transactionsSync(item.access_token as string, cursor);
      cursor = page.next_cursor;
      hasMore = page.has_more;

      for (const t of page.added) {
        const { data: existing } = await admin
          .from("transactions")
          .select("id")
          .eq("case_id", item.case_id)
          .eq("external_id", t.transaction_id)
          .maybeSingle();
        if (existing) continue;

        const { data: history } = await admin
          .from("transactions")
          .select("amount_cad, direction, method, occurred_at, counterparty_name, counterparty_country")
          .eq("case_id", item.case_id)
          .order("occurred_at", { ascending: false })
          .limit(500);

        const amount = Math.abs(t.amount);
        const currency = t.iso_currency_code ?? t.unofficial_currency_code ?? "CAD";
        const counterparty = t.merchant_name ?? t.payment_meta?.payee ?? t.payment_meta?.payer ?? t.name;
        const occurredAt = new Date(t.datetime ?? `${t.date}T12:00:00Z`).toISOString();

        const tx: TxInput = {
          direction: t.amount > 0 ? "outbound" : "inbound",
          method: t.payment_channel === "in store" ? "card" : "eft",
          amount,
          currency,
          amountCad: amount,
          counterpartyName: counterparty ?? undefined,
          occurredAt,
        };
        const alerts = evaluateTransaction(tx, history ?? []);

        if (counterparty) {
          const { data: matches } = await admin.rpc("match_watchlist_names", {
            _q: normalizeName(counterparty),
            _threshold: 0.45,
            _limit: 50,
          });
          let best: { name: string; score: number } | null = null;
          for (const m of matches ?? []) {
            const outcome = scoreMatch({ query: counterparty, candidate: m.matched_name });
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
        const { data: inserted, error } = await admin
          .from("transactions")
          .insert({
            org_id: item.org_id,
            case_id: item.case_id,
            external_id: t.transaction_id,
            direction: tx.direction,
            method: tx.method,
            channel: "plaid",
            amount,
            currency,
            amount_cad: amount,
            counterparty_name: counterparty ?? null,
            occurred_at: occurredAt,
            risk_score: score,
            status,
            detail: { source: "plaid", institution: item.institution_name, description: t.name },
          })
          .select("id")
          .single();
        if (error) continue;
        imported += 1;

        if (alerts.length) {
          await admin.from("transaction_alerts").insert(
            alerts.map((a) => ({
              org_id: item.org_id,
              transaction_id: inserted.id,
              case_id: item.case_id,
              rule_code: a.code,
              rule_name: a.name,
              severity: a.severity,
              citation: a.citation,
              detail: a.detail,
            })),
          );
          const high = alerts.filter((a) => a.severity === "high");
          if (high.length) {
            flagged += 1;
            await admin.from("monitoring_alerts").insert({
              org_id: item.org_id,
              case_id: item.case_id,
              alert_type: "transaction",
              detail: high.map((a) => a.name).join("; "),
            });
          }
        }
      }
    }

    await admin
      .from("plaid_items")
      .update({ cursor, last_synced_at: new Date().toISOString(), last_error: null, status: "active" })
      .eq("id", itemId);
  } catch (err) {
    await admin
      .from("plaid_items")
      .update({ last_error: (err as Error).message, status: "error" })
      .eq("id", itemId);
    throw err;
  }

  if (imported) {
    try {
      await admin.rpc("bump_usage", { _org: item.org_id, _kind: "transactions", _amount: imported });
    } catch {
      /* usage counting never blocks */
    }
  }

  if (flagged) {
    try {
      const { notifyOrg } = await import("@/lib/usage.server");
      const { data: kase } = await admin
        .from("cases")
        .select("reference, subject_name")
        .eq("id", item.case_id)
        .maybeSingle();
      await notifyOrg(item.org_id, "alert.opened", {
        subject: kase?.subject_name ?? "A customer",
        reference: kase?.reference ?? "",
        detail: `${flagged} imported bank transaction(s) triggered a high-severity rule`,
        link: `/console/cases/${item.case_id}`,
      });
    } catch {
      /* notifications never block */
    }
  }

  return { imported, flagged };
}

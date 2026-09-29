import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateTransaction, transactionRisk, type TxInput } from "@/lib/transaction-rules";
import { computeEffectiveOwnership, fiftyPercentRule, type OwnerRow } from "@/lib/ownership";
import { validateAddress, addressResult, validateAge } from "@/lib/address-rules";
import { normalizeName, scoreMatch } from "@/lib/name-match";

async function ensureWriter(context: { supabase: any; userId: string }) {
  const { data: allowed } = await context.supabase.rpc("can_write", { _user_id: context.userId });
  if (!allowed) throw new Error("You do not have permission to make this change");
}

export const recordTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        direction: z.enum(["inbound", "outbound"]),
        method: z.enum(["cash", "eft", "wire", "card", "interac", "crypto", "cheque"]),
        amount: z.number().positive(),
        currency: z.string().length(3).default("CAD"),
        amountCad: z.number().positive().optional(),
        counterpartyName: z.string().trim().max(200).optional(),
        counterpartyCountry: z.string().trim().max(2).optional(),
        occurredAt: z.string().optional(),
        externalId: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const occurredAt = data.occurredAt ?? new Date().toISOString();
    const amountCad = data.amountCad ?? data.amount;

    const { data: history } = await context.supabase
      .from("transactions")
      .select("amount_cad, direction, method, occurred_at, counterparty_name, counterparty_country")
      .eq("case_id", data.caseId)
      .order("occurred_at", { ascending: false })
      .limit(500);

    const tx: TxInput = {
      direction: data.direction,
      method: data.method,
      amount: data.amount,
      currency: data.currency,
      amountCad,
      counterpartyName: data.counterpartyName,
      counterpartyCountry: data.counterpartyCountry?.toUpperCase(),
      occurredAt,
    };
    const alerts = evaluateTransaction(tx, history ?? []);

    // Counterparty sanctions screening against our own list warehouse.
    if (data.counterpartyName) {
      const { data: matches } = await context.supabase.rpc("match_watchlist_names", {
        _q: normalizeName(data.counterpartyName),
        _threshold: 0.45,
        _limit: 50,
      });
      let best: { name: string; score: number } | null = null;
      for (const m of matches ?? []) {
        const outcome = scoreMatch({ query: data.counterpartyName, candidate: m.matched_name });
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

    const { data: inserted, error } = await context.supabase
      .from("transactions")
      .insert({
        case_id: data.caseId,
        external_id: data.externalId ?? null,
        direction: data.direction,
        method: data.method,
        amount: data.amount,
        currency: data.currency,
        amount_cad: amountCad,
        counterparty_name: data.counterpartyName ?? null,
        counterparty_country: data.counterpartyCountry?.toUpperCase() ?? null,
        occurred_at: occurredAt,
        risk_score: score,
        status,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (alerts.length) {
      await context.supabase.from("transaction_alerts").insert(
        alerts.map((a) => ({
          transaction_id: inserted.id,
          case_id: data.caseId,
          rule_code: a.code,
          rule_name: a.name,
          severity: a.severity,
          citation: a.citation,
          detail: a.detail,
        })),
      );
      const reportable = alerts.filter((a) => a.severity === "high");
      if (reportable.length) {
        await context.supabase.from("monitoring_alerts").insert({
          case_id: data.caseId,
          alert_type: "transaction",
          detail: reportable.map((a) => a.name).join("; "),
        });
      }
    }

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "transaction.monitored",
      entity_type: "transaction",
      entity_id: inserted.id,
      detail: { score, status, rules: alerts.map((a) => a.code) },
    });

    const { data: kaseOrg } = await context.supabase
      .from("cases")
      .select("org_id, reference, subject_name")
      .eq("id", data.caseId)
      .maybeSingle();
    const orgId = (kaseOrg as any)?.org_id as string | undefined;
    const { recordUsage, notifyOrg } = await import("@/lib/usage.server");
    await recordUsage(context.supabase as never, orgId, "transactions");
    if (orgId && alerts.some((a) => a.severity === "high")) {
      await notifyOrg(orgId, "alert.opened", {
        subject: (kaseOrg as any)?.subject_name ?? "A customer",
        reference: (kaseOrg as any)?.reference ?? "",
        detail: alerts.filter((a) => a.severity === "high").map((a) => a.name).join("; "),
        link: `/console/cases/${data.caseId}`,
      });
    }

    return { transactionId: inserted.id as string, score, status, alerts };
  });

export const computeOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const { data: owners, error } = await context.supabase
      .from("business_owners")
      .select("id, name, entity_type, ownership_pct, parent_owner_id, control_role, screening_status")
      .eq("case_id", data.caseId);
    if (error) throw new Error(error.message);

    const rows = (owners ?? []) as OwnerRow[];
    const computed = computeEffectiveOwnership(rows);
    for (const c of computed) {
      await context.supabase
        .from("business_owners")
        .update({ effective_pct: c.effectivePct, is_ubo: c.isUbo, control_basis: c.controlBasis })
        .eq("id", c.id);
    }
    const rule = fiftyPercentRule(rows, computed);

    await context.supabase.from("case_checks").insert({
      case_id: data.caseId,
      category: "ownership",
      name: "Beneficial ownership calculated",
      result: rule.blocked ? "fail" : computed.some((c) => c.isUbo) ? "pass" : "review",
      detail: rule.blocked
        ? `Blocked persons hold ${rule.sanctionedOwnership}% in aggregate — treat the entity as blocked (${rule.citation}).`
        : `${computed.filter((c) => c.isUbo).length} beneficial owner(s) identified at or above 25%, or through control.`,
      source: "eterfaceID ownership engine",
    });

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "ownership.computed",
      entity_type: "case",
      entity_id: data.caseId,
      detail: { blocked: rule.blocked, sanctionedOwnership: rule.sanctionedOwnership },
    });

    return { owners: computed, rule };
  });

export const verifyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        line1: z.string().trim().min(3),
        line2: z.string().trim().optional(),
        city: z.string().trim().optional(),
        region: z.string().trim().optional(),
        postalCode: z.string().trim().optional(),
        country: z.string().trim().length(2).default("CA"),
        birthDate: z.string().trim().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const checks = validateAddress({
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country.toUpperCase(),
    });
    const result = addressResult(checks);

    const { error } = await context.supabase.from("case_addresses").insert({
      case_id: data.caseId,
      line1: data.line1,
      line2: data.line2 ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      postal_code: data.postalCode ?? null,
      country: data.country.toUpperCase(),
      result,
      checks,
    });
    if (error) throw new Error(error.message);

    await context.supabase.from("case_checks").insert({
      case_id: data.caseId,
      category: "address",
      name: "Address verification",
      result,
      detail: checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || "All address checks passed",
      source: "eterfaceID address engine",
    });

    let age: ReturnType<typeof validateAge> | null = null;
    if (data.birthDate) {
      age = validateAge(data.birthDate);
      await context.supabase.from("case_checks").insert({
        case_id: data.caseId,
        category: "identity",
        name: "Age and date of birth",
        result: age.valid ? "pass" : "fail",
        detail: age.detail,
        source: "eterfaceID identity engine",
      });
    }

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "address.verified",
      entity_type: "case",
      entity_id: data.caseId,
      detail: { result },
    });

    return { result, checks, age };
  });

export const draftReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        reportType: z.enum(["str", "lctr", "eftr", "sar", "ctr", "fiu"]),
        jurisdiction: z.string().trim().max(2).default("CA"),
        authority: z.string().trim().max(60).default("FINTRAC"),
        narrative: z.string().trim().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const [{ data: record }, { data: hits }, { data: txs }, { data: txAlerts }] = await Promise.all([
      context.supabase.from("cases").select("*").eq("id", data.caseId).maybeSingle(),
      context.supabase.from("screening_hits").select("*").eq("case_id", data.caseId),
      context.supabase.from("transactions").select("*").eq("case_id", data.caseId).order("occurred_at", { ascending: false }).limit(50),
      context.supabase.from("transaction_alerts").select("*").eq("case_id", data.caseId),
    ]);
    if (!record) throw new Error("Case not found");

    const payload = {
      subject: {
        reference: record.reference,
        name: record.subject_name,
        type: record.case_type,
        country: record.country,
        riskLevel: record.risk_level,
        riskScore: record.risk_score,
      },
      screening: (hits ?? []).map((h: any) => ({
        name: h.matched_name,
        list: h.list_name,
        version: h.list_version,
        category: h.category,
        score: h.match_score,
        disposition: h.disposition,
      })),
      transactions: (txs ?? []).map((t: any) => ({
        date: t.occurred_at,
        direction: t.direction,
        method: t.method,
        amount: t.amount,
        currency: t.currency,
        amountCad: t.amount_cad,
        counterparty: t.counterparty_name,
        counterpartyCountry: t.counterparty_country,
      })),
      rulesTriggered: (txAlerts ?? []).map((a: any) => ({ code: a.rule_code, name: a.rule_name, citation: a.citation })),
      narrative: data.narrative ?? "",
      preparedAt: new Date().toISOString(),
    };

    const { data: inserted, error } = await context.supabase
      .from("regulatory_reports")
      .insert({
        case_id: data.caseId,
        report_type: data.reportType,
        jurisdiction: data.jurisdiction.toUpperCase(),
        authority: data.authority,
        payload,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "report.drafted",
      entity_type: "report",
      entity_id: inserted.id,
      detail: { reportType: data.reportType, jurisdiction: data.jurisdiction },
    });

    return { reportId: inserted.id as string, payload };
  });

export const markReportSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ reportId: z.string().uuid(), reference: z.string().trim().max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureWriter(context);
    const { error } = await context.supabase
      .from("regulatory_reports")
      .update({ status: "submitted", reference: data.reference, submitted_at: new Date().toISOString() })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_events").insert({
      actor_id: context.userId,
      action: "report.submitted",
      entity_type: "report",
      entity_id: data.reportId,
      detail: { reference: data.reference },
    });

    const { data: report } = await context.supabase
      .from("regulatory_reports")
      .select("org_id, report_type, authority, jurisdiction")
      .eq("id", data.reportId)
      .maybeSingle();
    const orgId = (report as any)?.org_id as string | undefined;
    if (orgId) {
      const { notifyOrg } = await import("@/lib/usage.server");
      await notifyOrg(orgId, "report.filed", {
        report: String((report as any)?.report_type ?? "report").toUpperCase(),
        authority: (report as any)?.authority ?? "",
        reference: data.reference ?? "",
        link: "/console/reports",
      });
    }
    return { ok: true };
  });

// Client-side resolver for AI Sheets formulas (=AI, =CLASSIFY, =EXPLAIN, etc.).
// Detects AI formulas synchronously, returns a "⏳" placeholder until the
// async Gemini call resolves, then triggers a re-render with the cached value.
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

const AI_FORMULA_NAMES = [
  "AI",
  "CLASSIFY",
  "EXPLAIN",
  "SUMMARIZE",
  "PREDICT",
  "FORECAST",
  "ANALYZE",
  "GENERATE_JE",
] as const;
export type AIFormulaName = (typeof AI_FORMULA_NAMES)[number];

const AI_FORMULA_REGEX = new RegExp(
  `^=?\\s*(${AI_FORMULA_NAMES.join("|")})\\s*\\((.*)\\)\\s*$`,
  "i",
);

export function isAIFormula(expr: string | undefined | null): boolean {
  if (!expr) return false;
  return AI_FORMULA_REGEX.test(expr.trim());
}

interface Parsed {
  name: AIFormulaName;
  argsRaw: string;
}

function parseAIFormula(expr: string): Parsed | null {
  const m = expr.trim().match(AI_FORMULA_REGEX);
  if (!m) return null;
  return { name: m[1].toUpperCase() as AIFormulaName, argsRaw: m[2] };
}

// Split top-level commas.
function splitArgs(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let inStr: string | null = null;
  for (const ch of raw) {
    if (inStr) {
      cur += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function resolveArg(
  arg: string,
  row: Record<string, unknown>,
  columns: string[],
): unknown {
  const trimmed = arg.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  const num = Number(trimmed);
  if (Number.isFinite(num) && trimmed !== "") return num;
  // Match a column name (case-insensitive).
  const match = columns.find(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) return row[match];
  return trimmed;
}

interface Context {
  columns: string[];
  sampleRows: Array<Record<string, unknown>>;
}

export const AI_PENDING = "⏳";
export const AI_ERROR_PREFIX = "#AI_ERR";

interface CacheEntry {
  status: "pending" | "done" | "error";
  value?: string | number;
}

export function useAIFormula(context: Context) {
  const { currentOrganization } = useOrganizationContext();
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);

  const cacheKey = (
    formula: AIFormulaName,
    args: unknown[],
  ): string => `${formula}::${JSON.stringify(args)}`;

  const resolve = useCallback(
    (expr: string, row: Record<string, unknown>): string | number => {
      const parsed = parseAIFormula(expr);
      if (!parsed) return "#ERR";
      if (!currentOrganization?.id) return `${AI_ERROR_PREFIX}: no org`;

      const args = splitArgs(parsed.argsRaw).map((a) =>
        resolveArg(a, row, context.columns),
      );
      const key = cacheKey(parsed.name, args);
      const cached = cacheRef.current.get(key);
      if (cached?.status === "done") return cached.value ?? "";
      if (cached?.status === "error") return String(cached.value ?? AI_ERROR_PREFIX);
      if (cached?.status === "pending") return AI_PENDING;

      cacheRef.current.set(key, { status: "pending" });
      (async () => {
        try {
          const { data, error } = await supabase.functions.invoke(
            "ai-sheets-formula",
            {
              body: {
                organization_id: currentOrganization.id,
                formula: parsed.name,
                args,
                context: {
                  columns: context.columns,
                  sampleRows: context.sampleRows.slice(0, 5),
                },
              },
            },
          );
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          cacheRef.current.set(key, {
            status: "done",
            value:
              typeof data?.value === "number" || typeof data?.value === "string"
                ? data.value
                : JSON.stringify(data?.value ?? ""),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          cacheRef.current.set(key, {
            status: "error",
            value: `${AI_ERROR_PREFIX}: ${msg.slice(0, 60)}`,
          });
        } finally {
          rerender();
        }
      })();

      return AI_PENDING;
    },
    [context.columns, context.sampleRows, currentOrganization?.id, rerender],
  );

  const clear = useCallback(() => {
    cacheRef.current.clear();
    rerender();
  }, [rerender]);

  return { resolve, isAIFormula, clear };
}

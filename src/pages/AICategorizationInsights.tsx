// Phase 5 — AI categorization insights page.
import { useMemo } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useCategorizationInsights } from "@/hooks/useAICategorizationInsights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AICategorizationInsights() {
  const { currentOrganization } = useOrganizationContext();
  const { data, isLoading } = useCategorizationInsights(currentOrganization?.id);

  const accountIds = useMemo(() => {
    if (!data) return [] as string[];
    const s = new Set<string>();
    for (const c of data.topCorrections) {
      if (c.suggested_account_id) s.add(c.suggested_account_id);
      if (c.final_account_id) s.add(c.final_account_id);
    }
    return Array.from(s);
  }, [data]);

  const { data: accountMap = new Map<string, { code: string; name: string }>() } = useQuery({
    queryKey: ["insights-accounts", currentOrganization?.id, accountIds.sort().join(",")],
    enabled: !!currentOrganization?.id && accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("id, code, name")
        .in("id", accountIds);
      const m = new Map<string, { code: string; name: string }>();
      for (const a of data ?? []) m.set(a.id, { code: a.code, name: a.name });
      return m;
    },
  });

  const acctLabel = (id: string | null) => {
    if (!id) return "—";
    const a = accountMap.get(id);
    return a ? `${a.code} ${a.name}` : id.slice(0, 8);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Categorization Insights
        </h1>
        <p className="text-sm text-muted-foreground">
          How your AI-suggested categorizations are performing across bank transactions, bills, and expense claims (last 30 days).
        </p>
      </div>

      {isLoading || !data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Acceptance rate"
              value={`${Math.round(data.acceptanceRate * 100)}%`}
              hint={`${data.acceptedCount} of ${data.totalSuggestions} suggestions`}
            />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Overrides"
              value={String(data.overriddenCount)}
              hint="User picked a different account"
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Cache hit rate"
              value={`${Math.round(data.cacheHitRate * 100)}%`}
              hint="Served from formula cache"
            />
            <StatCard
              icon={<Sparkles className="h-4 w-4" />}
              label="Avg confidence"
              value={`${Math.round(data.avgConfidence * 100)}%`}
              hint="Model self-reported"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Daily AI call usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{data.aiCallsToday} calls in the last 24h</span>
                <span className="text-muted-foreground">Cap: {data.dailyCap}/day</span>
              </div>
              <Progress value={Math.min(100, (data.aiCallsToday / data.dailyCap) * 100)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Volume by day</CardTitle>
            </CardHeader>
            <CardContent>
              {data.volumeByDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suggestions recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Bank</TableHead>
                      <TableHead className="text-right">Bills</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.volumeByDay.slice(-14).map((d) => (
                      <TableRow key={d.day}>
                        <TableCell>{d.day}</TableCell>
                        <TableCell className="text-right">{d.bank}</TableCell>
                        <TableCell className="text-right">{d.bill}</TableCell>
                        <TableCell className="text-right">{d.expense}</TableCell>
                        <TableCell className="text-right font-medium">
                          {d.bank + d.bill + d.expense}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Top corrections</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topCorrections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No overrides yet — your AI suggestions are being accepted as-is.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Context</TableHead>
                      <TableHead>Vendor / merchant</TableHead>
                      <TableHead>Suggested</TableHead>
                      <TableHead>Corrected to</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topCorrections.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="outline">{c.context}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {c.vendor_key || c.desc_key || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {acctLabel(c.suggested_account_id)}
                        </TableCell>
                        <TableCell>{acctLabel(c.final_account_id)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={c.count >= 3 ? "default" : "secondary"}>
                            {c.count}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Corrections that reach 3 occurrences are automatically promoted to a categorization rule.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// Phase 6 — AI auto-apply settings panel.
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useAICategorizationSettings } from "@/hooks/useAICategorizationSettings";
import { useCategorizationInsights } from "@/hooks/useAICategorizationInsights";

const SCOPES: Array<{ id: "bank" | "bill" | "expense" | "invoice" | "journal"; label: string; hint?: string }> = [
  { id: "bank", label: "Bank transactions" },
  { id: "bill", label: "Vendor bill lines" },
  { id: "expense", label: "Expense claim lines" },
  { id: "invoice", label: "Invoice lines", hint: "Draft only" },
  { id: "journal", label: "Journal entry lines", hint: "Draft only" },
];

export function AICategorizationAutoApplySettings() {
  const { currentOrganization } = useOrganizationContext();
  const { data: settings, save, isLoading } = useAICategorizationSettings(currentOrganization?.id);
  const { data: insights } = useCategorizationInsights(currentOrganization?.id);

  const enabled = settings?.auto_apply_enabled ?? false;
  const threshold = settings?.auto_apply_threshold ?? 95;
  const scopes = settings?.auto_apply_scopes ?? [];

  const handleSave = async (patch: Parameters<typeof save.mutateAsync>[0]) => {
    try {
      await save.mutateAsync(patch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const acceptancePct =
    insights && insights.totalSuggestions > 0
      ? Math.round(insights.acceptanceRate * 100)
      : null;
  const gateOk = acceptancePct === null || acceptancePct >= 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> AI auto-categorization
        </CardTitle>
        <CardDescription>
          Automatically apply high-confidence AI suggestions to bank transactions, bills, and expense claims. A safety rail keeps auto-apply off if your recent acceptance rate drops below 80%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-apply-enabled">Enable auto-apply</Label>
            {acceptancePct !== null && (
              <div className="text-xs text-muted-foreground">
                Current 30-day acceptance rate:{" "}
                <Badge variant={gateOk ? "default" : "outline"}>{acceptancePct}%</Badge>
                {!gateOk && (
                  <span className="ml-2 text-amber-600">
                    Below 80% — auto-apply will be skipped even if enabled.
                  </span>
                )}
              </div>
            )}
          </div>
          <Switch
            id="auto-apply-enabled"
            checked={enabled}
            disabled={isLoading || save.isPending}
            onCheckedChange={(v) => handleSave({ auto_apply_enabled: !!v })}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Confidence threshold: <span className="font-semibold">{threshold}%</span>
          </Label>
          <Slider
            value={[threshold]}
            min={50}
            max={100}
            step={5}
            disabled={!enabled}
            onValueChange={(v) => v[0] && handleSave({ auto_apply_threshold: v[0] })}
          />
          <p className="text-xs text-muted-foreground">
            Only suggestions at or above this confidence are auto-applied.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Scopes</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {SCOPES.map((s) => {
              const checked = scopes.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={checked}
                    disabled={!enabled}
                    onCheckedChange={(v) => {
                      const next = new Set(scopes);
                      if (v) next.add(s.id);
                      else next.delete(s.id);
                      handleSave({ auto_apply_scopes: Array.from(next) });
                    }}
                  />
                  <span>{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

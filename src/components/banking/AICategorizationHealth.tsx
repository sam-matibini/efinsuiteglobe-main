// Phase 5 — At-a-glance AI categorization health widget.
// Phase 8 — Accepts an optional context filter so revenue lists can show a
// context-scoped acceptance rate separately from bank/AP.
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useCategorizationInsights } from "@/hooks/useAICategorizationInsights";

interface Props {
  context?: "bank" | "ap" | "revenue";
  label?: string;
}

export function AICategorizationHealth({ context, label = "AI acceptance" }: Props = {}) {
  const { currentOrganization } = useOrganizationContext();
  const { data } = useCategorizationInsights(currentOrganization?.id, { context });
  if (!data || data.totalSuggestions === 0) return null;
  const pct = Math.round(data.acceptanceRate * 100);
  return (
    <Link
      to="/ai/categorization-insights"
      className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
      title="AI categorization insights"
    >
      <Sparkles className="h-3 w-3 text-primary" />
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={pct >= 80 ? "default" : pct >= 50 ? "secondary" : "outline"}>
        {pct}%
      </Badge>
    </Link>
  );
}

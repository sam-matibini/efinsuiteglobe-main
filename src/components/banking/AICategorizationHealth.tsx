// Phase 5 — At-a-glance AI categorization health widget.
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useCategorizationInsights } from "@/hooks/useAICategorizationInsights";

export function AICategorizationHealth() {
  const { currentOrganization } = useOrganizationContext();
  const { data } = useCategorizationInsights(currentOrganization?.id);
  if (!data || data.totalSuggestions === 0) return null;
  const pct = Math.round(data.acceptanceRate * 100);
  return (
    <Link
      to="/ai/categorization-insights"
      className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
      title="AI categorization insights"
    >
      <Sparkles className="h-3 w-3 text-primary" />
      <span className="text-muted-foreground">AI acceptance</span>
      <Badge variant={pct >= 80 ? "default" : pct >= 50 ? "secondary" : "outline"}>
        {pct}%
      </Badge>
    </Link>
  );
}

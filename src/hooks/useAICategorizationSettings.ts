// Phase 6 — Auto-apply settings hook.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AICategorizationSettings {
  organization_id: string;
  auto_apply_enabled: boolean;
  auto_apply_threshold: number;
  auto_apply_scopes: string[];
}

const DEFAULTS: Omit<AICategorizationSettings, "organization_id"> = {
  auto_apply_enabled: false,
  auto_apply_threshold: 95,
  auto_apply_scopes: [],
};

export function useAICategorizationSettings(organizationId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-categorization-settings", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<AICategorizationSettings> => {
      const { data } = await supabase
        .from("ai_categorization_settings")
        .select("organization_id, auto_apply_enabled, auto_apply_threshold, auto_apply_scopes")
        .eq("organization_id", organizationId!)
        .maybeSingle();
      return (
        (data as AICategorizationSettings | null) ?? {
          organization_id: organizationId!,
          ...DEFAULTS,
        }
      );
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<Omit<AICategorizationSettings, "organization_id">>) => {
      if (!organizationId) throw new Error("No organization");
      const current = query.data ?? { organization_id: organizationId, ...DEFAULTS };
      const next = { ...current, ...patch };
      const { error } = await supabase
        .from("ai_categorization_settings")
        .upsert(
          {
            organization_id: organizationId,
            auto_apply_enabled: next.auto_apply_enabled,
            auto_apply_threshold: next.auto_apply_threshold,
            auto_apply_scopes: next.auto_apply_scopes,
          },
          { onConflict: "organization_id" },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-categorization-settings", organizationId] });
      qc.invalidateQueries({ queryKey: ["ai-categorization-insights", organizationId] });
    },
  });

  return { ...query, save };
}

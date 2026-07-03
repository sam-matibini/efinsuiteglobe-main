import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useOrganization";
import { toast } from "sonner";

export interface TinMatchBatch {
  id: string;
  organization_id: string;
  batch_reference: string;
  status: "pending" | "submitted" | "completed" | "failed";
  vendor_count: number;
  matched_count: number;
  mismatched_count: number;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TinMatchResult {
  id: string;
  batch_id: string;
  vendor_profile_id: string | null;
  tin_last4: string | null;
  match_status: "matched" | "mismatch" | "invalid" | "not_found" | "pending";
  match_code: string | null;
  notes: string | null;
  created_at: string;
}

export function useTinMatchBatches() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ["tin-match-batches", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("tin_match_batches")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TinMatchBatch[];
    },
    enabled: !!organization?.id,
  });
}

export function useTinMatchResults(batchId: string | null) {
  return useQuery({
    queryKey: ["tin-match-results", batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await supabase
        .from("tin_match_batch_results")
        .select("*")
        .eq("batch_id", batchId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TinMatchResult[];
    },
    enabled: !!batchId,
  });
}

export function useSubmitTinBatch() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: async (profile_ids?: string[]) => {
      if (!organization?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("tin-match-batch", {
        body: { organization_id: organization.id, profile_ids },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tin-match-batches"] });
      toast.success("TIN match batch submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

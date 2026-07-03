import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useOrganization";
import { toast } from "sonner";

export interface SignedFilingRequest {
  id: string;
  organization_id: string;
  filing_type: string;
  filing_reference: string | null;
  period_end: string | null;
  signer_name: string;
  signer_email: string;
  signer_title: string | null;
  status: "pending" | "signed" | "filed" | "rejected" | "cancelled";
  filed_at: string | null;
  filed_reference: string | null;
  created_at: string;
  updated_at: string;
}

export function useSignedFilings() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ["signed-filings", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("signed_filing_requests")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SignedFilingRequest[];
    },
    enabled: !!organization?.id,
  });
}

export function useSignedFilingAction() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown> & { action: "initiate" | "sign" | "file" | "cancel" }) => {
      if (!organization?.id) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("signed-filing-workflow", {
        body: { ...payload, organization_id: organization.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["signed-filings"] });
      toast.success(`Filing ${vars.action} successful`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

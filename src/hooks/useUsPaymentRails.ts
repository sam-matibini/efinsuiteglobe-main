import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "./useOrganization";
import { toast } from "sonner";

export interface UsPaymentRail {
  id: string;
  organization_id: string;
  rail_type: "ach" | "eftps" | "wire";
  nickname: string;
  bank_name: string | null;
  routing_number: string | null;
  account_number_last4: string | null;
  eftps_taxpayer_id: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useUsPaymentRails() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ["us-payment-rails", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("us_payment_rails")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UsPaymentRail[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateUsRail() {
  const qc = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: async (payload: Partial<UsPaymentRail> & { rail_type: UsPaymentRail["rail_type"]; nickname: string }) => {
      if (!organization?.id) throw new Error("No organization");
      const { data, error } = await supabase
        .from("us_payment_rails")
        .insert({ ...payload, organization_id: organization.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["us-payment-rails"] });
      toast.success("Payment rail saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInvokeUsAchEftps() {
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("us-ach-eftps", { body });
      if (error) throw error;
      return data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

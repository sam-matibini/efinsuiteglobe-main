import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/console";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready, user: session?.user ?? null };
}

export function useOrganization() {
  const { user, ready } = useSession();
  const query = useQuery({
    queryKey: ["my-org", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("org_id, role, organizations(id, name, slug)")
        .eq("user_id", user!.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        orgId: data.org_id as string,
        role: data.role as AppRole,
        name: (data.organizations as { name: string } | null)?.name ?? "Your team",
      };
    },
  });
  return {
    organization: query.data ?? null,
    loading: !ready || query.isLoading,
    ready: ready && !query.isLoading,
  };
}

export function useRoles() {
  const { organization, loading } = useOrganization();
  const roles = organization ? [organization.role] : [];
  return {
    roles,
    isAdmin: organization?.role === "admin",
    canWrite: organization?.role === "admin" || organization?.role === "analyst",
    loading,
  };
}


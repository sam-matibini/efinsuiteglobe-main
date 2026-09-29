import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiRequest, corsPreflight, jsonResponse } from "@/lib/api-gateway.server";

export const Route = createFileRoute("/api/public/v1/ping")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data: org } = await auth.admin
          .from("organizations")
          .select("id, name")
          .eq("id", auth.orgId)
          .maybeSingle();
        return jsonResponse({
          data: {
            ok: true,
            api_version: "v1",
            environment: auth.environment,
            organization: org ?? { id: auth.orgId },
            server_time: new Date().toISOString(),
          },
        });
      },
    },
  },
});

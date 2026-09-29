import { createFileRoute } from "@tanstack/react-router";

import { CORS_HEADERS, corsPreflight } from "@/lib/api-gateway.server";
import { buildOpenApi } from "@/lib/api-spec";

export const Route = createFileRoute("/api/public/v1/openapi.json")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(JSON.stringify(buildOpenApi(origin), null, 2), {
          headers: { "content-type": "application/json", "cache-control": "public, max-age=300", ...CORS_HEADERS },
        });
      },
    },
  },
});

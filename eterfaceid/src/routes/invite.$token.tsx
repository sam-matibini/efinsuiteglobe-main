import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a team — eterfaceID" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = useParams({ from: "/invite/$token" });
  const navigate = useNavigate();

  useEffect(() => {
    window.sessionStorage.setItem("eid_invite_token", token);
    void navigate({ to: "/auth", replace: true });
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-6">
      <p className="text-sm text-muted-foreground">Opening your invitation…</p>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Panel, StatusPill } from "@/components/console/shell";
import { useOrganization } from "@/hooks/useSession";
import { fetchTeam, type AppRole } from "@/lib/console";
import { inviteMember, removeMember, revokeInvite, setMemberRole } from "@/lib/teams.functions";

const allRoles: AppRole[] = ["admin", "analyst", "viewer"];

export function TeamPanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const invite = useServerFn(inviteMember);
  const cancelInvite = useServerFn(revokeInvite);
  const changeRole = useServerFn(setMemberRole);
  const kick = useServerFn(removeMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("analyst");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const team = useQuery({ queryKey: ["team"], queryFn: fetchTeam });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["team"] });
    void queryClient.invalidateQueries({ queryKey: ["my-org"] });
    void queryClient.invalidateQueries({ queryKey: ["audit"] });
  };

  const sendInvite = useMutation({
    mutationFn: async () => invite({ data: { email, role } }),
    onSuccess: (result) => {
      setEmail("");
      setInviteLink(`${window.location.origin}/invite/${result.token}`);
      refresh();
    },
  });

  const roleMutation = useMutation({
    mutationFn: async (vars: { userId: string; role: AppRole }) => changeRole({ data: vars }),
    onSuccess: refresh,
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => kick({ data: { userId } }),
    onSuccess: refresh,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => cancelInvite({ data: { id } }),
    onSuccess: refresh,
  });

  return (
    <Panel title={organization ? `${organization.name} — your team` : "Your team"}>
      <div className="space-y-4 text-sm">
        {(team.data?.members ?? []).map((member) => (
          <div key={member.userId} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">{member.fullName ?? member.email ?? "Team member"}</div>
              <div className="text-xs text-muted-foreground">{member.email}</div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin ? (
                <select
                  value={member.role}
                  onChange={(e) =>
                    roleMutation.mutate({ userId: member.userId, role: e.target.value as AppRole })
                  }
                  className="h-9 rounded-md border border-[var(--rule)] bg-background px-2 text-sm"
                >
                  {allRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <StatusPill tone="pending">{member.role}</StatusPill>
              )}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(member.userId)}
                  className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {(team.data?.members ?? []).length === 0 ? (
          <p className="text-muted-foreground">No team members yet.</p>
        ) : null}
      </div>

      {isAdmin ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) sendInvite.mutate();
          }}
          className="mt-5 flex flex-wrap gap-2 border-t border-[var(--rule)] pt-5"
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            type="email"
            className="h-10 flex-1 rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="h-10 rounded-md border border-[var(--rule)] bg-background px-2 text-sm"
          >
            {allRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={sendInvite.isPending}
            className="h-10 rounded-md bg-[var(--ink)] px-4 text-sm text-background transition-opacity hover:opacity-90"
          >
            Invite
          </button>
        </form>
      ) : null}

      {sendInvite.isError ? (
        <p className="mt-3 text-sm text-[var(--signal)]">
          {(sendInvite.error as Error).message}
        </p>
      ) : null}

      {inviteLink ? (
        <div className="mt-4 border border-[var(--signal)] bg-[var(--paper-deep)] p-3">
          <p className="text-xs uppercase tracking-widest text-[var(--signal)]">
            Send this link to your colleague
          </p>
          <code className="mt-2 block break-all font-mono text-xs">{inviteLink}</code>
        </div>
      ) : null}

      {(team.data?.invites ?? []).length ? (
        <div className="mt-5 space-y-2 border-t border-[var(--rule)] pt-4 text-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Pending invites</p>
          {(team.data?.invites ?? []).map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {row.email} · {row.role}
              </span>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate(row.id)}
                  className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-5 border-t border-[var(--rule)] pt-4 text-xs text-muted-foreground">
        Admin: full access including team, keys and webhooks. Analyst: works cases and adjudicates
        hits. Viewer: read-only. Invitations expire after 14 days.
      </p>
    </Panel>
  );
}

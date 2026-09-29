import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Panel } from "@/components/console/shell";
import { useOrganization } from "@/hooks/useSession";
import { NOTIFICATION_EVENT_LIST } from "@/lib/notification-events";
import { fetchNotificationPreferences } from "@/lib/platform";
import { setNotificationPreference } from "@/lib/platform.functions";

export function NotificationsPanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const orgId = organization?.orgId ?? "";
  const prefs = useQuery({
    queryKey: ["notification-prefs", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchNotificationPreferences(orgId),
  });
  const save = useServerFn(setNotificationPreference);

  const toggle = useMutation({
    mutationFn: async (input: { event: string; enabled: boolean }) => save({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notification-prefs", orgId] }),
  });

  function enabled(event: string) {
    const row = (prefs.data ?? []).find((p: any) => p.event === event);
    return row ? Boolean(row.enabled) : true;
  }

  return (
    <Panel title="Email notifications">
      <p className="mb-4 text-sm text-muted-foreground">
        Which emails your team receives. Everything is on unless you turn it off.
      </p>
      <div className="space-y-3 text-sm">
        {NOTIFICATION_EVENT_LIST.map((item) => (
          <label key={item.event} className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              disabled={!isAdmin || toggle.isPending}
              checked={enabled(item.event)}
              onChange={(e) => toggle.mutate({ event: item.event, enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
      {!isAdmin ? (
        <p className="mt-4 text-xs text-muted-foreground">Only administrators can change these.</p>
      ) : null}
    </Panel>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emptyOrg } from '@/lib/timeAttendance/engine';
import { timeRequest } from '@/lib/timeAttendance/persistence';
import type { Actor, OrgAttendance } from '@/lib/timeAttendance/types';

async function readOrg(organizationId: string): Promise<OrgAttendance> {
  const result = await timeRequest('GET', '/api/time/state', {}, { organizationId });
  if (result.status >= 400) return emptyOrg(organizationId);
  return (result.body.org as OrgAttendance) ?? emptyOrg(organizationId);
}

export function useTimeAttendance(organizationId?: string | null, actor?: Actor) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['time-attendance', organizationId],
    enabled: !!organizationId,
    queryFn: () => readOrg(organizationId!),
  });

  async function send(method: 'PUT' | 'POST', path: string, body: Record<string, unknown>) {
    const result = await timeRequest(method, path, { ...body, organizationId, actor: body.actor ?? actor });
    if (result.status >= 400 || result.body?.ok === false) {
      throw new Error(result.body?.error || 'Time attendance request failed');
    }
    await queryClient.invalidateQueries({ queryKey: ['time-attendance', organizationId] });
    return result.body;
  }

  return {
    org: query.data,
    isLoading: query.isLoading,
    send,
    actorFor(actor: Actor) {
      return actor;
    },
  };
}

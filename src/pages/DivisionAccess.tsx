import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useDepartments } from '@/hooks/useDimensions';
import { useDivisionAccess } from '@/hooks/useDivisionAccess';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, Trash2, UserPlus, Lock } from 'lucide-react';
import { PermissionGate } from '@/components/auth/PermissionGate';

interface MemberLite {
  user_id: string;
  display_name: string | null;
  role: string | null;
}

/**
 * Phase 5 — Division Security
 * Admin UI for granting/revoking per-user access to specific divisions.
 * RLS in the database (`user_can_access_division`) enforces these grants.
 */
export default function DivisionAccess() {
  const { organization } = useCurrentOrganization();
  const { data: divisions = [] } = useDepartments();
  const { data: access = [], grant, revoke } = useDivisionAccess();

  const membersQuery = useQuery({
    queryKey: ['org-members-lite', organization?.id],
    enabled: !!organization?.id,
    queryFn: async (): Promise<MemberLite[]> => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, display_name, role')
        .eq('organization_id', organization!.id);
      if (error) throw error;
      const rows = (data ?? []) as MemberLite[];
      const ids = rows.map((r) => r.user_id);
      if (ids.length === 0) return rows;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const map = new Map(
        (profiles ?? []).map((p: { user_id: string; full_name: string | null; email: string | null }) => [p.user_id, p]),
      );
      return rows.map((m) => {
        const p = map.get(m.user_id);
        return { ...m, display_name: m.display_name ?? p?.full_name ?? p?.email ?? null };
      });
    },
  });

  const members = membersQuery.data ?? [];
  const divisionName = (id: string) => divisions.find((d) => d.id === id)?.name ?? '—';
  const memberName = (id: string) => members.find((m) => m.user_id === id)?.display_name ?? id.slice(0, 8);

  const [userId, setUserId] = useState<string>('');
  const [deptId, setDeptId] = useState<string>('');

  const grouped = useMemo(() => {
    const m = new Map<string, typeof access>();
    for (const row of access) {
      const list = m.get(row.user_id) ?? [];
      list.push(row);
      m.set(row.user_id, list);
    }
    return Array.from(m.entries());
  }, [access]);

  return (
    <PermissionGate
      permission="USER_MANAGE"
      fallback={
        <div className="p-10 max-w-xl mx-auto text-center space-y-3">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Admin access required</h2>
          <p className="text-sm text-muted-foreground">
            You need the <strong>Manage Users</strong> permission to grant or revoke division access.
            Please contact an organization admin.
          </p>
        </div>
      }
    >
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5" /> Division Access
        </h1>
        <p className="text-sm text-muted-foreground">
          Grant users access to specific divisions. Users without any grants see consolidated data only.
        </p>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="w-4 h-4" /> Grant Access</CardTitle>
          <CardDescription>Pick a member and a division to grant.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[220px]">
              <Label>Member</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name ?? m.user_id.slice(0, 8)} {m.role ? `(${m.role})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px]">
              <Label>Division</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
                <SelectContent>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!userId || !deptId}
              onClick={async () => {
                await grant.mutateAsync({ user_id: userId, department_id: deptId });
                setDeptId('');
              }}
            >Grant</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Access</CardTitle>
          <CardDescription>{access.length} grants across {grouped.length} users</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Divisions</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map(([uid, rows]) => (
                <TableRow key={uid}>
                  <TableCell className="font-medium">{memberName(uid)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {rows.map((r) => (
                        <Badge key={r.id} variant="outline" className="gap-1">
                          {divisionName(r.department_id)}
                          <button
                            className="ml-1 opacity-60 hover:opacity-100"
                            onClick={() => revoke.mutate(r.id)}
                            aria-label="Revoke"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
              {grouped.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No grants yet — all users see consolidated data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </PermissionGate>
  );
}


import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Crown, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  useExecutiveSignerSettings,
  useSaveExecutiveSignerSettings,
} from '@/hooks/useExecutiveSignatures';

interface OrgMember {
  user_id: string;
  email: string | null;
  full_name: string | null;
}

function useOrgMembers() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['org-members-for-exec-signer', organization?.id],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!organization?.id) return [];
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id);
      if (error) throw error;
      const ids = (members || []).map((m) => m.user_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', ids as string[]);
      return (profiles || []).map((p) => ({
        user_id: p.id as string,
        email: (p as { email: string | null }).email,
        full_name: (p as { full_name: string | null }).full_name,
      }));
    },
    enabled: !!organization?.id,
  });
}

export function ExecutiveSignerSettingsCard() {
  const { data: settings } = useExecutiveSignerSettings();
  const { data: members = [] } = useOrgMembers();
  const save = useSaveExecutiveSignerSettings();

  // Primary signer (CEO/President/Chairman)
  const [userId, setUserId] = useState<string>('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('CEO/President');
  const [secondary, setSecondary] = useState('');

  // Secondary signer (CFO/Treasurer/Company Secretary)
  const [userId2, setUserId2] = useState<string>('');
  const [name2, setName2] = useState('');
  const [title2, setTitle2] = useState('CFO/Treasurer');
  const [secondary2, setSecondary2] = useState('');

  useEffect(() => {
    if (settings) {
      setUserId(settings.executive_signer_user_id || '');
      setName(settings.executive_signer_name || '');
      setTitle(settings.executive_signer_title || 'CEO/President');
      setSecondary(settings.executive_signer_secondary_title || '');
      setUserId2(settings.executive_signer2_user_id || '');
      setName2(settings.executive_signer2_name || '');
      setTitle2(settings.executive_signer2_title || 'CFO/Treasurer');
      setSecondary2(settings.executive_signer2_secondary_title || '');
    }
  }, [settings]);

  const handleSave = () => {
    save.mutate({
      executive_signer_user_id: userId || null,
      executive_signer_name: name || null,
      executive_signer_title: title || 'CEO/President',
      executive_signer_secondary_title: secondary || null,
      executive_signer2_user_id: userId2 || null,
      executive_signer2_name: name2 || null,
      executive_signer2_title: title2 || 'CFO/Treasurer',
      executive_signer2_secondary_title: secondary2 || null,
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold text-foreground">
          Executive Signers
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Designate up to two executives who can sign financial statements (Balance
        Sheet, Income Statement, Cash Flow, Statement of Changes in Net Assets,
        and the Accountant&apos;s Compilation Report). Both signatures will appear
        side-by-side on the printed reports. Optional — leave blank to hide the
        signature block from all statements.
      </p>

      {/* Primary signer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold">
            Primary signer (CEO / President / Board Chair)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Designated user</Label>
            <Select
              value={userId || 'none'}
              onValueChange={(v) => setUserId(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an organization member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (disable signing) —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exec-signer-name">Printed name</Label>
            <Input
              id="exec-signer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exec-signer-title">Title</Label>
            <Input
              id="exec-signer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="CEO/President"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="exec-signer-secondary">
              Secondary title (optional)
            </Label>
            <Input
              id="exec-signer-secondary"
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              placeholder="e.g. Executive Director"
            />
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Secondary signer */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-semibold">
            Second signer (CFO / Treasurer / Company Secretary)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Designated user</Label>
            <Select
              value={userId2 || 'none'}
              onValueChange={(v) => setUserId2(v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an organization member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None (disable signing) —</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.email || m.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exec-signer2-name">Printed name</Label>
            <Input
              id="exec-signer2-name"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder="John Smith"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exec-signer2-title">Title</Label>
            <Input
              id="exec-signer2-title"
              value={title2}
              onChange={(e) => setTitle2(e.target.value)}
              placeholder="CFO/Treasurer"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="exec-signer2-secondary">
              Secondary title (optional)
            </Label>
            <Input
              id="exec-signer2-secondary"
              value={secondary2}
              onChange={(e) => setSecondary2(e.target.value)}
              placeholder="e.g. Company Secretary"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  );
}

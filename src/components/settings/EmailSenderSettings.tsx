import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/;

export function EmailSenderSettings() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const org = organization as unknown as Record<string, unknown> | undefined;

  const [fromName, setFromName] = useState('');
  const [fromAddress, setFromAddress] = useState('');

  useEffect(() => {
    if (!org) return;
    setFromName(((org.email_from_name as string) ?? '') || '');
    setFromAddress(((org.email_from_address as string) ?? '') || '');
  }, [organization]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No organization');
      const address = fromAddress.trim();
      const name = fromName.trim();
      if (address && !EMAIL_RE.test(address)) {
        throw new Error('Enter a valid email address (e.g. info@yourdomain.com).');
      }
      const { error } = await supabase
        .from('organizations')
        .update({
          email_from_name: name || null,
          email_from_address: address || null,
        })
        .eq('id', organization.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email sender saved');
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview =
    fromName.trim() && fromAddress.trim()
      ? `${fromName.trim()} <${fromAddress.trim()}>`
      : fromAddress.trim() || '—';

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Email sender (Resend)</h3>
          <p className="text-sm text-muted-foreground">
            The "from" address used for payment-link emails and other app emails.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from-name">From name</Label>
          <Input
            id="from-name"
            placeholder="efinsuite"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="from-address">From email</Label>
          <Input
            id="from-address"
            type="email"
            placeholder="info@efinsuite.com"
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        The domain in this address must be verified at{' '}
        <a
          href="https://resend.com/domains"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          resend.com/domains
        </a>
        . Preview: <span className="font-mono">{preview}</span>
      </p>

      <div className="flex flex-wrap justify-end gap-2 mt-6">
        <Button
          variant="outline"
          onClick={async () => {
            const target = fromAddress.trim();
            if (!target || !EMAIL_RE.test(target)) {
              toast.error('Enter a valid From email above first, then click Send test.');
              return;
            }
            const t = toast.loading(`Sending test email to ${target}…`);
            try {
              const { data, error } = await supabase.functions.invoke('resend-integration', {
                body: {
                  action: 'send-test',
                  to: target,
                  branding: { email: target, displayName: fromName.trim() || undefined },
                },
              });
              if (error) throw error;
              if (data?.success) {
                toast.success(`Test email sent from ${data.from} to ${target}. Check the inbox (and spam).`, { id: t });
              } else {
                toast.error(data?.error || 'Test failed', { id: t });
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              toast.error(`Test failed: ${msg}`, { id: t });
            }
          }}
        >
          Send test email
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Email Sender'}
        </Button>
      </div>

    </Card>
  );
}

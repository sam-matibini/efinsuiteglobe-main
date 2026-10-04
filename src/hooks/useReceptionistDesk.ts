import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useContacts, Contact } from '@/hooks/useContacts';
import {
  ReceptionistActivity,
  ReceptionistActivityKind,
  contactIdentifier,
} from '@/lib/receptionist/sharedContacts';
import { toast } from 'sonner';
import { notifyContactsChanged } from '@/lib/receptionist/contactEvents';

const db = supabase as unknown as {
  from: (table: string) => any;
};

export function useReceptionistDesk() {
  const { currentOrganization } = useOrganizationContext();
  const organizationId = currentOrganization?.id;
  const contactsApi = useContacts();
  const [activities, setActivities] = useState<ReceptionistActivity[]>([]);
  const [answering, setAnswering] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [activityResult, settingsResult] = await Promise.all([
      db
        .from('receptionist_activity')
        .select('id, kind, body, contact_id, contact_name, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100),
      db
        .from('receptionist_settings')
        .select('answering')
        .eq('organization_id', organizationId)
        .maybeSingle(),
    ]);

    if (!activityResult.error && activityResult.data) {
      setActivities(
        (activityResult.data as unknown as Array<Record<string, string | null>>).map((row) => ({
          id: String(row.id),
          kind: (row.kind ?? 'message') as ReceptionistActivityKind,
          body: String(row.body ?? ''),
          contactId: row.contact_id,
          contactName: row.contact_name,
          createdAt: String(row.created_at),
        })),
      );
    }

    if (!settingsResult.error && settingsResult.data && 'answering' in (settingsResult.data as object)) {
      setAnswering(Boolean((settingsResult.data as { answering?: boolean }).answering));
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const setAnsweringEnabled = async (next: boolean) => {
    setAnswering(next);
    if (!organizationId) return;
    await db.from('receptionist_settings').upsert(
      { organization_id: organizationId, answering: next },
      { onConflict: 'organization_id' },
    );
  };

  const logCallerMessage = async (contact: Contact, body: string, kind: ReceptionistActivityKind = 'message') => {
    if (!organizationId) {
      toast.error('Choose an organization first.');
      return false;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error('Type a caller message first.');
      return false;
    }

    setIsSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error: activityError } = await db.from('receptionist_activity').insert({
        organization_id: organizationId,
        contact_id: contact.id,
        kind,
        body: trimmed,
        contact_name: contact.name,
        created_by: userData.user?.id ?? null,
      });
      if (activityError) throw activityError;

      const identifier = contactIdentifier(contact);
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('contact_identifier', identifier)
        .eq('channel', 'in_app')
        .maybeSingle();

      let conversationId = existing?.id;
      if (!conversationId) {
        const { data: created, error: conversationError } = await supabase
          .from('conversations')
          .insert({
            organization_id: organizationId,
            contact_identifier: identifier,
            contact_name: contact.name,
            channel: 'in_app',
            last_message_preview: trimmed.slice(0, 140),
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (conversationError) throw conversationError;
        conversationId = created.id;
      } else {
        await supabase
          .from('conversations')
          .update({
            contact_name: contact.name,
            last_message_preview: trimmed.slice(0, 140),
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId);
      }

      const { error: messageError } = await supabase.from('messages').insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        channel: 'in_app',
        direction: 'inbound',
        from_identifier: identifier,
        to_identifier: 'ai-receptionist',
        subject: 'AI Receptionist',
        body: trimmed,
        status: 'received',
        sent_by: userData.user?.id ?? null,
      });
      if (messageError) throw messageError;

      toast.success(`Saved for ${contact.name} in Communication`);
      notifyContactsChanged();
      await load();
      return true;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not share this caller with Communication.');
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return {
    ...contactsApi,
    activities,
    answering,
    isSending,
    setAnsweringEnabled,
    logCallerMessage,
    reload: load,
  };
}

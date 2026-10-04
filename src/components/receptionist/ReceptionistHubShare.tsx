import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  reminderMessage,
  upcomingFilingReminders,
  type CorporationKind,
  type FilingReminder,
  type GstFilingFrequency,
  type StoredComplianceDeadline,
  type StoredFilingPeriod,
} from '@/lib/receptionist/filingReminders';
import {
  channelDestination,
  conversationLabel,
  sharedChannelLabel,
  type SharedChannel,
  type SharedConversationSummary,
} from '@/lib/receptionist/sharedInbox';
import type { SharedContact } from '@/lib/receptionist/sharedContacts';
import { toast } from 'sonner';

type SendMessage = (
  channel: SharedChannel,
  to: string,
  body: string,
  options?: { subject?: string },
) => Promise<unknown>;

interface SharedMessage {
  id: string;
  body: string;
  direction: string;
  created_at: string;
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

export function SharedCommunicationPanel({
  contacts,
  conversations,
  messages,
  selectedConversationId,
  loadingMessages,
  onOpenConversation,
  onSend,
}: {
  contacts: SharedContact[];
  conversations: SharedConversationSummary[];
  messages: SharedMessage[];
  selectedConversationId: string | null;
  loadingMessages?: boolean;
  onOpenConversation: (id: string) => void;
  onSend: SendMessage;
}) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [channel, setChannel] = useState<SharedChannel>('email');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const contact = contacts.find((item) => item.id === contactId) ?? null;

  useEffect(() => {
    if (!contactId && contacts[0]) setContactId(contacts[0].id);
  }, [contactId, contacts]);

  const send = async () => {
    const text = body.trim();
    if (!contact || !text) return;
    const to = channelDestination(contact, channel);
    if (!to) {
      toast.error(channel === 'email' ? 'This contact has no email address.' : 'This contact has no phone number.');
      return;
    }
    setSending(true);
    try {
      await onSend(channel, to, text, channel === 'email' ? { subject: 'Message from AI Receptionist' } : undefined);
      setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="shared-communication">
      <Card className="p-4">
        <h2 className="font-medium">Contacts</h2>
        <p className="mt-1 text-sm text-muted-foreground">The same customers, vendors, and people saved in Communication.</p>
        <div className="mt-3 space-y-2">
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">No shared contacts yet.</p>}
          {contacts.map((item) => (
            <button
              key={item.id}
              type="button"
              className="block w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              aria-label={`Contact ${item.name}`}
              onClick={() => setContactId(item.id)}
            >
              <span className="font-medium">{item.name}</span>
              <span className="mt-0.5 block text-muted-foreground">{item.email || item.phone || item.cell_phone || 'No email or phone'}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-4" data-testid="shared-history">
        <h2 className="font-medium">Email, SMS, and WhatsApp</h2>
        <p className="mt-1 text-sm text-muted-foreground">History from Compose and Inbox. Sending here uses the same delivery path.</p>
        <div className="mt-3 space-y-2">
          {conversations.length === 0 && <p className="text-sm text-muted-foreground">No email, SMS, or WhatsApp conversations yet.</p>}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className="block w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              aria-label={`Open ${sharedChannelLabel(conversation.channel)} conversation with ${conversationLabel(conversation, contacts)}`}
              onClick={() => onOpenConversation(conversation.id)}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{conversationLabel(conversation, contacts)}</span>
                <Badge variant="outline">{sharedChannelLabel(conversation.channel)}</Badge>
                <span className="text-xs text-muted-foreground">{when(conversation.at)}</span>
              </span>
              <span className="mt-1 block text-muted-foreground">{conversation.preview || 'No preview'}</span>
            </button>
          ))}
        </div>
        {selectedConversationId && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {loadingMessages && <p className="text-sm text-muted-foreground">Loading messages…</p>}
            {messages.map((message) => (
              <p key={message.id} className="text-sm">
                <span className="font-medium">{message.direction === 'inbound' ? 'Contact' : 'Sent'}: </span>
                {message.body}
              </p>
            ))}
          </div>
        )}
        <div className="mt-4 space-y-2 border-t pt-3">
          <Label htmlFor="shared-contact">Send from the receptionist</Label>
          <select id="shared-contact" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={contactId} onChange={(event) => setContactId(event.target.value)}>
            {contacts.length === 0 && <option value="">No contacts</option>}
            {contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="Message channel" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as SharedChannel)}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <Input aria-label="Message to the contact" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write an email, SMS, or WhatsApp message" />
          <Button type="button" onClick={() => void send()} disabled={sending || !body.trim() || !contact}>Send</Button>
        </div>
      </Card>
    </div>
  );
}

export function FilingRemindersPanel({
  organizationName,
  fiscalYearEndMonth,
  deadlines,
  periods,
  contacts,
  onSend,
  today,
}: {
  organizationName: string;
  fiscalYearEndMonth: number | null;
  deadlines: StoredComplianceDeadline[];
  periods: StoredFilingPeriod[];
  contacts: SharedContact[];
  onSend: SendMessage;
  today?: string;
}) {
  const [frequency, setFrequency] = useState<GstFilingFrequency>('quarterly');
  const [corporationKind, setCorporationKind] = useState<CorporationKind>('ccpc');
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [channel, setChannel] = useState<SharedChannel>('email');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const asOf = today ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!contactId && contacts[0]) setContactId(contacts[0].id);
  }, [contactId, contacts]);

  const reminders = useMemo(() => upcomingFilingReminders({
    today: asOf,
    fiscalYearEndMonth,
    gstFrequency: frequency,
    corporationKind,
    deadlines,
    periods,
  }), [asOf, fiscalYearEndMonth, frequency, corporationKind, deadlines, periods]);

  const sendReminder = async (item: FilingReminder) => {
    const contact = contacts.find((row) => row.id === contactId);
    if (!contact) {
      toast.error('Choose a contact from Communication.');
      return;
    }
    const to = channelDestination(contact, channel);
    if (!to) {
      toast.error(channel === 'email' ? 'This contact has no email address.' : 'This contact has no phone number.');
      return;
    }
    const message = reminderMessage(organizationName, item);
    setSendingId(item.id);
    try {
      await onSend(channel, to, message.body, { subject: message.subject });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Card className="space-y-4 p-4" data-testid="filing-reminders">
      <div>
        <h2 className="font-medium">Tax filing reminders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          GST/HST, corporation tax, payroll remittances, and T4 dates. Saved compliance deadlines and tax filing periods replace the matching calendar date. Reminders go out by email, SMS, or WhatsApp.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="gst-frequency">GST/HST frequency</Label>
          <select id="gst-frequency" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={frequency} onChange={(event) => setFrequency(event.target.value as GstFilingFrequency)}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <Label htmlFor="corporation-kind">Corporation</Label>
          <select id="corporation-kind" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={corporationKind} onChange={(event) => setCorporationKind(event.target.value as CorporationKind)}>
            <option value="ccpc">CCPC small business</option>
            <option value="other">Other corporation</option>
          </select>
        </div>
        <div>
          <Label htmlFor="reminder-contact">Send to</Label>
          <select id="reminder-contact" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={contactId} onChange={(event) => setContactId(event.target.value)}>
            {contacts.length === 0 && <option value="">No contacts</option>}
            {contacts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="reminder-channel">Channel</Label>
          <select id="reminder-channel" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as SharedChannel)}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
      </div>
      <div className="space-y-3">
        {reminders.map((item) => (
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.title}</p>
                {item.overdue && <Badge variant="destructive">Overdue</Badge>}
                {item.source !== 'calendar' && <Badge variant="secondary">Saved date</Badge>}
              </div>
              <p className="text-sm">Due {item.dueDate}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={sendingId === item.id}
              aria-label={`Send ${item.title} reminder due ${item.dueDate}`}
              onClick={() => void sendReminder(item)}
            >
              Send reminder
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

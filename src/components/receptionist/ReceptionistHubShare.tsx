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
import { crmKindLabel, filterCrmContacts, type CrmContact } from '@/lib/receptionist/crmContacts';
import {
  channelDestination,
  conversationLabel,
  sharedChannelLabel,
  type SharedChannel,
  type SharedConversationSummary,
} from '@/lib/receptionist/sharedInbox';
import { toast } from 'sonner';

export interface NewReceptionistContact {
  name: string;
  email: string;
  phone: string;
  cell_phone: string;
}

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

function ContactLookup({
  id,
  label,
  contacts,
  query,
  onQuery,
  selectedId,
  onSelect,
}: {
  id: string;
  label: string;
  contacts: CrmContact[];
  query: string;
  onQuery: (value: string) => void;
  selectedId: string;
  onSelect: (contact: CrmContact) => void;
}) {
  const matches = filterCrmContacts(contacts, query);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Type a name, email, or phone"
        aria-label={label}
      />
      <div className="mt-2 max-h-64 overflow-y-auto rounded-md border" role="listbox" aria-label="Matching contacts">
        {matches.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">{contacts.length === 0 ? 'No CRM contacts yet.' : 'No matching contacts.'}</p>
        )}
        {matches.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={item.id === selectedId}
            className={`block w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted ${item.id === selectedId ? 'bg-primary/10' : ''}`}
            onClick={() => onSelect(item)}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.name}</span>
              <Badge variant="outline">{crmKindLabel(item.kind)}</Badge>
            </span>
            <span className="mt-0.5 block text-muted-foreground">{item.email || item.cell_phone || item.phone || 'No email or phone'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SharedCommunicationPanel({
  contacts,
  conversations,
  messages,
  selectedConversationId,
  loadingMessages,
  onOpenConversation,
  onSend,
  onCreateContact,
}: {
  contacts: CrmContact[];
  conversations: SharedConversationSummary[];
  messages: SharedMessage[];
  selectedConversationId: string | null;
  loadingMessages?: boolean;
  onOpenConversation: (id: string) => void;
  onSend: SendMessage;
  onCreateContact?: (input: NewReceptionistContact) => Promise<unknown>;
}) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [lookup, setLookup] = useState('');
  const [channel, setChannel] = useState<SharedChannel>('email');
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const contact = contacts.find((item) => item.id === contactId) ?? null;

  useEffect(() => {
    if (!contactId && contacts[0]) setContactId(contacts[0].id);
  }, [contactId, contacts]);

  const chooseContact = (next: CrmContact, nextChannel = channel) => {
    setContactId(next.id);
    const destination = channelDestination(next, nextChannel) || next.email || next.phone || next.cell_phone || '';
    setTo(destination);
  };

  const chooseChannel = (next: SharedChannel) => {
    setChannel(next);
    if (contact) {
      const destination = channelDestination(contact, next);
      if (destination) setTo(destination);
    }
  };

  const send = async () => {
    const text = body.trim();
    const destination = to.trim();
    if (!text || !destination) {
      toast.error('Choose a contact or type an email or phone number.');
      return;
    }
    setSending(true);
    try {
      await onSend(channel, destination, text, channel === 'email' ? { subject: 'Message from AI Receptionist' } : undefined);
      setBody('');
    } finally {
      setSending(false);
    }
  };

  const saveContact = async () => {
    const name = newName.trim();
    const phone = newPhone.trim();
    const email = newEmail.trim();
    if (!name) {
      toast.error('Enter the contact name.');
      return;
    }
    if (!phone && !email) {
      toast.error('Enter a cell number or an email address.');
      return;
    }
    setSavingContact(true);
    try {
      const created = await onCreateContact?.({ name, email, phone, cell_phone: phone });
      if (created) {
        setAdding(false);
        setNewName('');
        setNewPhone('');
        setNewEmail('');
      }
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="shared-communication">
      <Card className="p-4">
        <h2 className="font-medium">CRM contacts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Customers, vendors, and people saved in Communication. Type to look someone up.</p>
        <div className="mt-3">
          <ContactLookup
            id="crm-lookup"
            label="Look up a contact"
            contacts={contacts}
            query={lookup}
            onQuery={setLookup}
            selectedId={contactId}
            onSelect={(item) => chooseContact(item)}
          />
        </div>
        {onCreateContact && (
          <div className="mt-4 border-t pt-3">
            {!adding && <Button type="button" variant="outline" onClick={() => setAdding(true)}>Add contact</Button>}
            {adding && (
              <div className="space-y-2">
                <Label htmlFor="new-contact-name">Name</Label>
                <Input id="new-contact-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Name" />
                <Label htmlFor="new-contact-phone">Cell / phone</Label>
                <Input id="new-contact-phone" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="Cell or phone number" />
                <Label htmlFor="new-contact-email">Email</Label>
                <Input id="new-contact-email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Email address" />
                <div className="flex gap-2">
                  <Button type="button" onClick={() => void saveContact()} disabled={savingContact}>Save contact</Button>
                  <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
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
          <p className="text-sm font-medium">Send email, SMS, or WhatsApp</p>
          <p className="text-sm text-muted-foreground">Email uses the connected mail sender. SMS and WhatsApp use the connected Twilio number.</p>
          <div className="flex flex-wrap gap-2">
            {(['email', 'sms', 'whatsapp'] as const).map((item) => (
              <Button key={item} type="button" size="sm" variant={channel === item ? 'default' : 'outline'} aria-pressed={channel === item} onClick={() => chooseChannel(item)}>
                {sharedChannelLabel(item)}
              </Button>
            ))}
          </div>
          <Label htmlFor="message-to">To</Label>
          <Input id="message-to" aria-label="Message recipient" value={to} onChange={(event) => setTo(event.target.value)} placeholder="Type an email or phone number" />
          <Input aria-label="Message to the contact" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write an email, SMS, or WhatsApp message" />
          <Button type="button" onClick={() => void send()} disabled={sending || !body.trim() || !to.trim()}>Send {sharedChannelLabel(channel)}</Button>
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
  contacts: CrmContact[];
  onSend: SendMessage;
  today?: string;
}) {
  const [frequency, setFrequency] = useState<GstFilingFrequency>('quarterly');
  const [corporationKind, setCorporationKind] = useState<CorporationKind>('ccpc');
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [lookup, setLookup] = useState('');
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
        <div className="md:col-span-2">
          <ContactLookup
            id="reminder-lookup"
            label="Look up who receives the reminder"
            contacts={contacts}
            query={lookup}
            onQuery={setLookup}
            selectedId={contactId}
            onSelect={(item) => setContactId(item.id)}
          />
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

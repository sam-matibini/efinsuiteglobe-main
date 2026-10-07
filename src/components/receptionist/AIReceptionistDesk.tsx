import { useEffect, useMemo, useState } from 'react';
import { Headset, Phone, ArrowRightLeft, CalendarDays, MessageSquare, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Contact } from '@/hooks/useContacts';
import { AddApiKeyDialog } from '@/components/receptionist/AddApiKeyDialog';
import { ApiCredentialDraft, StoredApiCredential } from '@/lib/receptionist/apiCredentials';
import {
  ReceptionistActivity,
  ReceptionistActivityKind,
  activityCounts,
  matchSharedContact,
} from '@/lib/receptionist/sharedContacts';

interface AIReceptionistDeskProps {
  contacts: Contact[];
  activities: ReceptionistActivity[];
  answering: boolean;
  isSending?: boolean;
  credentials?: StoredApiCredential[];
  credentialError?: string | null;
  onAnsweringChange: (answering: boolean) => void;
  onSend: (contact: Contact, body: string, kind: ReceptionistActivityKind) => Promise<boolean>;
  onSaveCredential: (draft: ApiCredentialDraft) => Promise<void>;
  onTestCredential: (draft: ApiCredentialDraft) => Promise<void>;
}

export function AIReceptionistDesk({
  contacts,
  activities,
  answering,
  isSending = false,
  credentials = [],
  credentialError = null,
  onAnsweringChange,
  onSend,
  onSaveCredential,
  onTestCredential,
}: AIReceptionistDeskProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(contacts[0]?.id ?? null);
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<ReceptionistActivityKind>('message');
  const [apiOpen, setApiOpen] = useState(false);
  const counts = activityCounts(activities);
  const latest = activities[0] ?? null;

  const visibleContacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter((contact) =>
      [contact.name, contact.email, contact.phone, contact.company]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [contacts, query]);

  useEffect(() => {
    if (!selectedId && contacts[0]) setSelectedId(contacts[0].id);
  }, [contacts, selectedId]);

  const selected = contacts.find((contact) => contact.id === selectedId) ?? null;

  const handleSend = async () => {
    const matched = selected ?? matchSharedContact(contacts, { text: message });
    if (!matched) return;
    const saved = await onSend(matched as Contact, message, kind);
    if (saved) setMessage('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Headset className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">AI Receptionist</h2>
            <Badge variant="secondary">Test desk</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            ElevenLabs holds the conversation. eFinsuite keeps the customers, invoices, payroll, tax requests, and appointments.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Answering</span>
          <Switch checked={answering} onCheckedChange={onAnsweringChange} aria-label="Answering" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Calls" value={counts.calls} />
        <Stat label="Handoffs" value={counts.handoffs} />
        <Stat label="Bookings" value={counts.bookings} />
        <Stat label="Messages" value={counts.messages} />
      </div>

      <Tabs defaultValue="desk">
        <TabsList>
          <TabsTrigger value="desk">Desk</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="grid gap-4 lg:grid-cols-[240px_1fr_240px]">
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-medium">Shared contacts</p>
              <Input
                placeholder="Search contacts"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search shared contacts"
              />
              <div className="max-h-80 space-y-1 overflow-auto">
                {visibleContacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts yet. Add them in Communication.</p>
                ) : (
                  visibleContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className={`w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${
                        contact.id === selected?.id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedId(contact.id)}
                    >
                      <div className="font-medium">{contact.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {contact.email || contact.phone || contact.company || 'No details'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2">
                <KindButton current={kind} value="message" label="Message" icon={MessageSquare} onChange={setKind} />
                <KindButton current={kind} value="call" label="Call" icon={Phone} onChange={setKind} />
                <KindButton current={kind} value="handoff" label="Handoff" icon={ArrowRightLeft} onChange={setKind} />
                <KindButton current={kind} value="booking" label="Booking" icon={CalendarDays} onChange={setKind} />
              </div>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type a caller message"
                aria-label="Caller message"
                className="min-h-40"
              />
              {!selected && (
                <p className="text-sm text-muted-foreground">Select a shared contact before sending.</p>
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={handleSend} disabled={isSending || !selected || !message.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">Latest call</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {latest ? `${latest.contactName ?? 'Caller'}: ${latest.body}` : 'No calls yet.'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">Staff notifications</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Handoffs, messages, and bookings show here and in Communication.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calls">
          <ActivityList activities={activities.filter((item) => item.kind === 'call')} empty="No calls yet." />
        </TabsContent>
        <TabsContent value="schedule">
          <ActivityList activities={activities.filter((item) => item.kind === 'booking')} empty="No bookings yet." />
        </TabsContent>
        <TabsContent value="routing">
          <ActivityList activities={activities.filter((item) => item.kind === 'handoff')} empty="No handoffs yet." />
        </TabsContent>
        <TabsContent value="knowledge">
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              The receptionist uses the same customers, vendors, and manual contacts as Communication. A caller matched by phone, email, or name is filed on that contact.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Voice API</p>
              <p className="text-sm text-muted-foreground">Keys are stored for this organization, not as platform settings.</p>
            </div>
            <Button type="button" onClick={() => setApiOpen(true)}>Add API</Button>
          </div>
          {credentialError && <p className="text-sm text-destructive">{credentialError}</p>}
          {credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API key saved yet.</p>
          ) : (
            <ul className="space-y-2">
              {credentials.map((credential) => (
                <li key={credential.id} className="rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{credential.name}</span>
                  <span className="ml-2 text-muted-foreground">{credential.secretName}</span>
                  <span className="ml-2">{credential.keyHint}</span>
                </li>
              ))}
            </ul>
          )}
          <AddApiKeyDialog
            open={apiOpen}
            onOpenChange={setApiOpen}
            onSave={onSaveCredential}
            onTest={onTestCredential}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function KindButton({
  current,
  value,
  label,
  icon: Icon,
  onChange,
}: {
  current: ReceptionistActivityKind;
  value: ReceptionistActivityKind;
  label: string;
  icon: typeof Phone;
  onChange: (value: ReceptionistActivityKind) => void;
}) {
  return (
    <Button type="button" size="sm" variant={current === value ? 'default' : 'outline'} onClick={() => onChange(value)}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

function ActivityList({ activities, empty }: { activities: ReceptionistActivity[]; empty: string }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {activities.map((item) => (
        <li key={item.id} className="rounded-md border px-3 py-2 text-sm">
          <span className="font-medium">{item.contactName ?? 'Caller'}</span>
          <span className="ml-2 text-muted-foreground">{item.body}</span>
        </li>
      ))}
    </ul>
  );
}

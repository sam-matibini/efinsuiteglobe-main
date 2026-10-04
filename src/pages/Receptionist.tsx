import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MessageSquare, Plus, ShieldBan, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ReceptionCallBar } from '@/components/receptionist/ReceptionCallBar';
import { ReceptionCallsPanel } from '@/components/receptionist/ReceptionCallsPanel';
import { ReceptionSchedule } from '@/components/receptionist/ReceptionSchedule';
import { FilingRemindersPanel, SharedCommunicationPanel } from '@/components/receptionist/ReceptionistHubShare';
import { useContacts } from '@/hooks/useContacts';
import { useCustomers } from '@/hooks/useCustomers';
import { useFilingReminders } from '@/hooks/useFilingReminders';
import { useMessages } from '@/hooks/useMessages';
import { useReceptionist } from '@/hooks/useReceptionist';
import { useVendors } from '@/hooks/useVendors';
import { mergeCrmContacts } from '@/lib/receptionist/crmContacts';
import { RECEPTION_LANGUAGES, RECEPTION_VOICES } from '@/lib/receptionist/engine';
import { isSharedChannel } from '@/lib/receptionist/sharedInbox';
import type { ReceptionOrg, TranscriptTurn } from '@/lib/receptionist/types';
import { toast } from 'sonner';

export default function Receptionist() {
  const desk = useReceptionist();
  const { customers, createCustomer } = useCustomers();
  const { vendors } = useVendors();
  const { contacts, createContact } = useContacts();
  const hub = useMessages({ autoSubscribe: false });
  const filing = useFilingReminders();
  const [live, setLive] = useState<ReceptionOrg | null>(null);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [voiceStatus, setVoiceStatus] = useState('disconnected');
  const [session, setSession] = useState<{ endSession: () => Promise<void>; setMicMuted: (muted: boolean) => void; getId: () => string } | null>(null);
  const [voiceMode, setVoiceMode] = useState<'listening' | 'speaking'>('listening');
  const [muted, setMuted] = useState(false);
  const voiceTurns = useRef<TranscriptTurn[]>([]);
  const [blockedPhone, setBlockedPhone] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleBody, setArticleBody] = useState('');

  if (!desk.orgLoading && !desk.organization) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Building2 className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">No organization found</h1>
        <p className="text-muted-foreground">Create an organization before setting up the receptionist.</p>
      </div>
    );
  }

  if (desk.isLoading && !desk.org) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">AI Receptionist</h1>
        <p className="text-muted-foreground">Loading the receptionist desk…</p>
      </div>
    );
  }

  if (!desk.org) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-foreground">AI Receptionist</h1>
        <p className="text-muted-foreground">The receptionist desk could not be loaded. Refresh the page to try again.</p>
      </div>
    );
  }

  const sharedContacts = mergeCrmContacts({
    contacts: contacts
      .filter((contact) => contact.is_active)
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        cell_phone: contact.cell_phone,
        company: contact.company,
      })),
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      is_active: customer.is_active,
    })),
    vendors: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      is_active: vendor.is_active,
    })),
  });
  const sharedHistory = hub.conversations
    .filter((conversation) => isSharedChannel(conversation.channel))
    .map((conversation) => ({
      id: conversation.id,
      contactIdentifier: conversation.contact_identifier,
      contactName: conversation.contact_name,
      channel: conversation.channel,
      preview: conversation.last_message_preview,
      at: conversation.last_message_at,
    }));

  const org = live ?? desk.org;
  const analytics = desk.analytics ?? {
    calls: org.calls.length,
    resolved: 0,
    handedOff: org.calls.filter((call) => call.status === 'handed_off').length,
    blocked: 0,
    bookings: org.appointments.length,
    messages: org.messages.length,
    tickets: org.tickets.length,
    leads: org.leads.length,
    byDepartment: {},
    byChannel: {},
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setTurns((current) => [...current, { role: 'caller', text, at: new Date().toISOString() }]);
    const result = await desk.talk(text);
    if (result.org) setLive(result.org as ReceptionOrg);
    setTurns((current) => [...current, { role: 'receptionist', text: String(result.reply ?? ''), at: new Date().toISOString() }]);
  };

  const callsEnabled = org.channels.phone || org.channels.web;
  const callStatus = session
    ? muted ? 'Muted' : voiceMode === 'speaking' ? 'Speaking' : voiceStatus === 'connecting' ? 'Connecting' : 'Listening'
    : voiceStatus === 'connecting' ? 'Connecting' : callsEnabled ? 'Calls on' : 'Calls off';

  const setCallsEnabled = async (enabled: boolean) => {
    const channels = { ...org.channels, phone: enabled, web: enabled };
    const result = await desk.saveSettings({ channels });
    if (result.org) setLive(result.org as ReceptionOrg);
  };

  const toggleVoice = async () => {
    if (session) {
      await session.endSession();
      setSession(null);
      setMuted(false);
      setVoiceStatus('disconnected');
      return;
    }
    if (!callsEnabled) await setCallsEnabled(true);
    const result = await desk.startSession();
    if (!result.conversationToken && !result.signedUrl) {
      toast.message('Calls are on. Add the ElevenLabs API key in Platform Settings, then sync the agent, to answer by voice. You can still type the call here.');
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { startVoiceSession } = await import('@/lib/receptionist/voiceSession');
      voiceTurns.current = [];
      const started = await startVoiceSession({
        signedUrl: result.signedUrl ? String(result.signedUrl) : null,
        conversationToken: result.conversationToken ? String(result.conversationToken) : null,
        clientTools: Object.fromEntries(['identify_caller', 'verify_caller', 'search_knowledge', 'account_summary', 'book_appointment', 'reschedule_appointment', 'cancel_appointment', 'take_message', 'create_ticket', 'route_call', 'capture_lead'].map((name) => [name, async (parameters: Record<string, unknown>) => {
          const tool = await desk.runTool(name, parameters);
          if (tool.org) setLive(tool.org as ReceptionOrg);
          return String(tool.message ?? 'Done.');
        }])),
        onMessage: (message) => {
          const turn: TranscriptTurn = { role: message.source === 'user' ? 'caller' : 'receptionist', text: message.text, at: new Date().toISOString() };
          voiceTurns.current = [...voiceTurns.current, turn];
          setTurns((current) => [...current, turn]);
        },
        onStatus: setVoiceStatus,
        onMode: setVoiceMode,
        onError: (message) => toast.error(message),
        onDisconnect: () => {
          const transcript = voiceTurns.current;
          const conversationId = started.getId();
          voiceTurns.current = [];
          setSession(null);
          setMuted(false);
          setVoiceStatus('disconnected');
          if (transcript.length === 0) return;
          void desk.finishCall({
            transcript,
            conversationId,
            channel: 'web',
            summary: transcript.map((turn) => turn.text).join(' ').slice(0, 240),
          }).then((saved) => {
            if (saved.org) setLive(saved.org as ReceptionOrg);
          });
        },
      });
      setSession(started);
      setVoiceStatus('connecting');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The microphone or voice session could not start.');
    }
  };

  const toggleMute = () => {
    if (!session) return;
    const next = !muted;
    session.setMicMuted(next);
    setMuted(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">AI Receptionist</h1>
            <Badge variant="secondary">{desk.voiceReady ? 'Voice connected' : 'Text desk'}</Badge>
          </div>
          <p className="text-muted-foreground">ElevenLabs holds the conversation. Communication shares contacts, email, SMS, and WhatsApp history, and the receptionist can send GST/HST, corporation tax, payroll, and T4 due-date reminders.</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="receptionist-enabled">Answering</Label>
          <Switch
            id="receptionist-enabled"
            checked={org.enabled}
            onCheckedChange={async (enabled) => {
              const result = await desk.saveSettings({ enabled });
              if (result.org) setLive(result.org as ReceptionOrg);
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Calls', analytics.calls],
          ['Handoffs', analytics.handedOff],
          ['Bookings', analytics.bookings],
          ['Messages', analytics.messages],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="desk">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="desk">Desk</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="shared">Shared</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="routing">Routing</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <Card className="flex min-h-[420px] flex-col p-4">
            <div className="flex-1 space-y-3">
              {turns.length === 0 && <p className="text-sm text-muted-foreground">Try “I&apos;d like to speak with someone about my payroll.”</p>}
              {turns.map((turn, index) => (
                <div key={`${turn.at}-${index}`} className={turn.role === 'caller' ? 'ml-8 rounded-lg bg-muted px-3 py-2' : 'mr-8 rounded-lg bg-primary/10 px-3 py-2'}>
                  <p className="text-xs font-medium text-muted-foreground">{turn.role === 'caller' ? 'Caller' : 'Receptionist'}</p>
                  <p className="text-sm">{turn.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {turns.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {['I\'d like to speak with someone about my payroll.', 'Book an appointment tomorrow at 10.', 'Please take a message.'].map((prompt) => (
                    <Button key={prompt} type="button" size="sm" variant="outline" onClick={() => setDraft(prompt)}>{prompt}</Button>
                  ))}
                </div>
              )}
              <ReceptionCallBar
                live={Boolean(session)}
                connecting={voiceStatus === 'connecting'}
                muted={muted}
                statusLabel={callStatus}
                onToggleCall={() => void toggleVoice()}
                onToggleMute={toggleMute}
              />
              <div className="flex gap-2">
                <Input aria-label="Message the receptionist" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} placeholder="Type a caller message" />
                <Button onClick={() => void send()} disabled={desk.pending}>Send</Button>
              </div>
            </div>
          </Card>
          <div className="space-y-3">
            <Card className="p-4">
              <p className="text-sm font-medium">Latest call</p>
              <p className="mt-2 text-sm text-muted-foreground">{org.calls[0]?.summary || 'No calls yet.'}</p>
            </Card>
            <Card className="p-4" data-testid="shared-contact-summary">
              <p className="text-sm font-medium">Shared from Communication</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {sharedContacts.length} {sharedContacts.length === 1 ? 'contact' : 'contacts'} · {sharedHistory.length} email, SMS, and WhatsApp {sharedHistory.length === 1 ? 'conversation' : 'conversations'}
              </p>
              <div className="mt-2 space-y-1">
                {sharedContacts.slice(0, 4).map((contact) => (
                  <p key={contact.id} className="text-sm">{contact.name}</p>
                ))}
                {sharedContacts.length === 0 && <p className="text-sm text-muted-foreground">Customers, vendors, and Communication contacts show up here.</p>}
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium">Staff notifications</p>
              <div className="mt-2 space-y-2">
                {org.notifications.slice(0, 4).map((item) => <p key={item.id} className="text-sm">{item.title}</p>)}
                {org.notifications.length === 0 && <p className="text-sm text-muted-foreground">Handoffs, messages, and bookings show up here.</p>}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calls" className="mt-4">
          <ReceptionCallsPanel
            enabled={callsEnabled}
            live={Boolean(session)}
            connecting={voiceStatus === 'connecting'}
            muted={muted}
            statusLabel={callStatus}
            calls={org.calls}
            onEnabledChange={(enabled) => void setCallsEnabled(enabled)}
            onToggleCall={() => void toggleVoice()}
            onToggleMute={toggleMute}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 space-y-4">
          <ReceptionSchedule
            appointments={org.appointments}
            notepad={org.notepad ?? ''}
            onSaveNotepad={(notepad) => {
              void desk.saveSchedule({ notepad }).then((result) => result.org && setLive(result.org as ReceptionOrg));
            }}
            onAddAppointment={(appointment) => {
              void desk.saveSchedule({ appointment }).then((result) => result.org && setLive(result.org as ReceptionOrg));
            }}
          />
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" /><h2 className="font-medium">Messages and requests</h2></div>
            {org.messages.map((item) => <p key={item.id} className="text-sm">{item.priority === 'urgent' ? 'Urgent: ' : ''}{item.callerName} · {item.body}</p>)}
            {org.tickets.map((item) => <p key={item.id} className="text-sm">{item.department}: {item.subject} · {item.callerName}</p>)}
            {org.leads.map((item) => (
              <div key={item.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span>Lead: {item.name} {item.phone}</span>
                <Button size="sm" variant="outline" onClick={() => createCustomer.mutate({ name: item.name, phone: item.phone, email: item.email })}>Add customer</Button>
              </div>
            ))}
            {org.messages.length + org.tickets.length + org.leads.length === 0 && <p className="text-sm text-muted-foreground">Messages, tickets, and new leads will appear here.</p>}
          </Card>
        </TabsContent>

        <TabsContent value="shared" className="mt-4">
          <SharedCommunicationPanel
            contacts={sharedContacts}
            conversations={sharedHistory}
            messages={hub.selectedConversation ? hub.messages.map((message) => ({
              id: message.id,
              body: message.body,
              direction: message.direction,
              created_at: message.created_at,
            })) : []}
            selectedConversationId={hub.selectedConversation?.id ?? null}
            loadingMessages={hub.isLoadingMessages}
            onOpenConversation={(id) => {
              const conversation = hub.conversations.find((item) => item.id === id);
              if (conversation) void hub.selectConversation(conversation);
            }}
            onSend={hub.sendMessage}
            onCreateContact={async (input) => createContact({
              name: input.name,
              email: input.email,
              phone: input.phone,
              cell_phone: input.cell_phone,
            })}
          />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <FilingRemindersPanel
            organizationName={desk.organization?.name ?? 'Your organization'}
            fiscalYearEndMonth={filing.fiscalYearEndMonth}
            deadlines={filing.deadlines}
            periods={filing.periods}
            contacts={sharedContacts}
            onSend={hub.sendMessage}
          />
        </TabsContent>

        <TabsContent value="routing" className="mt-4 space-y-4">
          {org.routes.map((route) => (
            <Card key={route.id} className="grid gap-3 p-4 md:grid-cols-[160px_1fr_180px]">
              <p className="font-medium capitalize">{route.department}</p>
              <Input aria-label={`${route.department} destination`} defaultValue={route.destinationName} onBlur={(event) => {
                const routes = org.routes.map((item) => item.id === route.id ? { ...item, destinationName: event.target.value } : item);
                void desk.saveLists({ routes }).then((result) => result.org && setLive(result.org as ReceptionOrg));
              }} />
              <Input aria-label={`${route.department} phone`} placeholder="Transfer number" defaultValue={route.destinationPhone} onBlur={(event) => {
                const routes = org.routes.map((item) => item.id === route.id ? { ...item, destinationPhone: event.target.value } : item);
                void desk.saveLists({ routes }).then((result) => result.org && setLive(result.org as ReceptionOrg));
              }} />
            </Card>
          ))}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2"><ShieldBan className="h-4 w-4" /><h2 className="font-medium">Blocked numbers</h2></div>
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Blocked phone number" value={blockedPhone} onChange={(event) => setBlockedPhone(event.target.value)} placeholder="Phone number" className="max-w-xs" />
              <Input aria-label="Block reason" value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} placeholder="Reason" className="max-w-xs" />
              <Button variant="outline" onClick={() => {
                if (!blockedPhone.trim()) return;
                const blocked = [{ id: crypto.randomUUID(), phone: blockedPhone.trim(), reason: blockedReason.trim() || 'Blocked' }, ...org.blocked];
                setBlockedPhone('');
                setBlockedReason('');
                void desk.saveLists({ blocked }).then((result) => result.org && setLive(result.org as ReceptionOrg));
              }}><Plus className="mr-1 h-4 w-4" />Block</Button>
            </div>
            <div className="mt-3 space-y-1">
              {org.blocked.map((item) => <p key={item.id} className="text-sm">{item.phone} · {item.reason}</p>)}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4 space-y-3">
          <Card className="space-y-3 p-4">
            <Input aria-label="Article title" value={articleTitle} onChange={(event) => setArticleTitle(event.target.value)} placeholder="Article title" />
            <Textarea aria-label="Article body" value={articleBody} onChange={(event) => setArticleBody(event.target.value)} placeholder="What the receptionist should know" />
            <Button variant="outline" onClick={() => {
              if (!articleTitle.trim() || !articleBody.trim()) return;
              const knowledge = [{ id: crypto.randomUUID(), title: articleTitle.trim(), body: articleBody.trim(), department: 'all' as const }, ...org.knowledge];
              setArticleTitle('');
              setArticleBody('');
              void desk.saveLists({ knowledge }).then((result) => result.org && setLive(result.org as ReceptionOrg));
            }}>Add article</Button>
          </Card>
          {org.knowledge.map((article) => (
            <Card key={article.id} className="p-4">
              <p className="font-medium">{article.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{article.body}</p>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="grid gap-4 p-4 md:grid-cols-2">
            <div>
              <Label htmlFor="voice">Voice</Label>
              <select id="voice" className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={org.voiceId} onChange={(event) => {
                const voice = RECEPTION_VOICES.find((item) => item.id === event.target.value);
                void desk.saveSettings({ voiceId: event.target.value, voiceName: voice?.name ?? org.voiceName }).then((result) => result.org && setLive(result.org as ReceptionOrg));
              }}>
                {RECEPTION_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="forwarding">Existing number to forward</Label>
              <Input id="forwarding" className="mt-1" value={org.forwardingNumber} onChange={(event) => setLive({ ...org, forwardingNumber: event.target.value })} onBlur={() => void desk.saveSettings({ forwardingNumber: org.forwardingNumber })} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="personality">Personality</Label>
              <Textarea id="personality" className="mt-1" value={org.personality} onChange={(event) => setLive({ ...org, personality: event.target.value })} onBlur={() => void desk.saveSettings({ personality: org.personality })} />
            </div>
            <div>
              <Label htmlFor="notify">Staff notification email</Label>
              <Input id="notify" className="mt-1" value={org.notifyEmail} onChange={(event) => setLive({ ...org, notifyEmail: event.target.value })} onBlur={() => void desk.saveSettings({ notifyEmail: org.notifyEmail })} />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-6">
              {(['phone', 'web', 'sms', 'whatsapp'] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-sm capitalize">
                  <Switch checked={org.channels[channel]} onCheckedChange={(checked) => {
                    const channels = { ...org.channels, [channel]: checked };
                    setLive({ ...org, channels });
                    void desk.saveSettings({ channels });
                  }} />
                  {channel === 'whatsapp' ? 'WhatsApp' : channel}
                </label>
              ))}
            </div>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium">Languages</p>
              <div className="flex flex-wrap gap-2">
                {RECEPTION_LANGUAGES.map((language) => {
                  const selected = org.languages.includes(language.code);
                  return (
                    <Button key={language.code} type="button" size="sm" variant={selected ? 'default' : 'outline'} onClick={() => {
                      const languages = selected ? org.languages.filter((code) => code !== language.code) : [...org.languages, language.code];
                      const next = languages.length ? languages : ['en'];
                      setLive({ ...org, languages: next, language: next[0] });
                      void desk.saveSettings({ languages: next, language: next[0] });
                    }}>{language.label}</Button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">ElevenLabs can speak 70+ languages. The receptionist uses the languages selected here and can switch when the caller does.</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><h2 className="font-medium">ElevenLabs voice agent</h2></div>
                <p className="mt-1 text-sm text-muted-foreground">Add the ElevenLabs API key in Platform Settings. The key stays on the server, and Alice uses the same key for voice. Sync publishes this receptionist, its knowledge, and its eFinsuite tools.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild><Link to="/admin/settings">Add API key</Link></Button>
                <Button onClick={() => void desk.syncAgent().then((result) => result.org && setLive(result.org as ReceptionOrg))}>Sync agent</Button>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {org.receptionists.map((item) => (
                <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{item.name} · {item.department}</span>
                  <Switch checked={item.active} onCheckedChange={(active) => {
                    const receptionists = org.receptionists.map((profile) => profile.id === item.id ? { ...profile, active } : profile);
                    void desk.saveLists({ receptionists }).then((result) => result.org && setLive(result.org as ReceptionOrg));
                  }} />
                </label>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

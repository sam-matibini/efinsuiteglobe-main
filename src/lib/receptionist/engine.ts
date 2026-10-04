import type {
  Directory,
  DirectoryContact,
  ReceptionAnalytics,
  ReceptionAppointment,
  ReceptionCall,
  ReceptionChannel,
  ReceptionDepartment,
  ReceptionOrg,
  RoutingRule,
} from './types';

export const RECEPTION_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'sw', label: 'Swahili' },
];

export const RECEPTION_VOICES: { id: string; name: string }[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
];

const DEPARTMENTS: ReceptionDepartment[] = ['general', 'accounting', 'payroll', 'tax', 'billing'];

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `rx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function samePhone(left: string, right: string): boolean {
  const a = digits(left);
  const b = digits(right);
  if (!a || !b) return false;
  return a.endsWith(b) || b.endsWith(a);
}

function routeFor(org: ReceptionOrg, department: ReceptionDepartment): RoutingRule {
  return org.routes.find((route) => route.department === department)
    ?? org.routes.find((route) => route.department === 'general')
    ?? { id: 'general', department: 'general', destinationName: 'Front desk', destinationPhone: '', condition: 'General questions' };
}

export function emptyDirectory(): Directory {
  return { contacts: [], nextPayDate: null };
}

export function emptyReceptionOrg(organizationId: string): ReceptionOrg {
  const front = createId();
  return {
    organizationId,
    enabled: false,
    voiceId: RECEPTION_VOICES[0].id,
    voiceName: RECEPTION_VOICES[0].name,
    language: 'en',
    languages: ['en', 'fr'],
    personality: 'Warm, concise, and professional.',
    timezone: 'America/Toronto',
    forwardingNumber: '',
    channels: { phone: true, web: true, sms: false, whatsapp: false },
    notifyEmail: '',
    elevenAgentId: null,
    toolSecret: createId(),
    receptionists: [
      { id: front, name: 'Front desk', department: 'general', greeting: 'Thank you for calling. How can I help you today?', active: true, phoneNumber: '', elevenAgentId: null },
      { id: createId(), name: 'Accounting desk', department: 'accounting', greeting: 'You have reached the accounting desk. How can I help?', active: true, phoneNumber: '', elevenAgentId: null },
      { id: createId(), name: 'Payroll desk', department: 'payroll', greeting: 'You have reached payroll. How can I help?', active: true, phoneNumber: '', elevenAgentId: null },
      { id: createId(), name: 'Tax desk', department: 'tax', greeting: 'You have reached the tax desk. How can I help?', active: true, phoneNumber: '', elevenAgentId: null },
    ],
    knowledge: [
      { id: createId(), title: 'Office hours', department: 'all', body: 'The office is open weekdays from 9:00 to 17:00. The receptionist can take messages and book appointments outside those hours.' },
      { id: createId(), title: 'Invoices and payments', department: 'billing', body: 'Invoice balances are read from eFinsuite after the caller is verified with the last four digits of the phone number on the account. The receptionist does not take card numbers.' },
      { id: createId(), title: 'Payroll', department: 'payroll', body: 'Payroll questions are routed to the payroll team. Pay amounts, banking details, and tax slips are not read aloud. After verification, the receptionist may confirm the next pay date on file.' },
      { id: createId(), title: 'Tax and CRA', department: 'tax', body: 'Tax and CRA questions are triaged and sent to the tax team. The receptionist does not file a return or quote a balance owing during the call.' },
    ],
    routes: [
      { id: createId(), department: 'general', destinationName: 'Front desk', destinationPhone: '', condition: 'General questions and unknown requests' },
      { id: createId(), department: 'accounting', destinationName: 'Accounting team', destinationPhone: '', condition: 'Bookkeeping, statements, and journal questions' },
      { id: createId(), department: 'payroll', destinationName: 'Payroll team', destinationPhone: '', condition: 'Pay, pay stubs, and employee payroll questions' },
      { id: createId(), department: 'tax', destinationName: 'Tax team', destinationPhone: '', condition: 'Tax, CRA, GST/HST, and filing questions' },
      { id: createId(), department: 'billing', destinationName: 'Billing team', destinationPhone: '', condition: 'Invoices, payments, and balances' },
    ],
    blocked: [],
    calls: [],
    messages: [],
    appointments: [],
    tickets: [],
    leads: [],
    notifications: [],
    notepad: '',
    activeCallId: null,
  };
}

export function publicOrg(org: ReceptionOrg): Omit<ReceptionOrg, 'toolSecret'> {
  const view = clone(org) as Omit<ReceptionOrg, 'toolSecret'> & { toolSecret?: string };
  delete view.toolSecret;
  return view;
}

function notify(org: ReceptionOrg, title: string, body: string, at: string) {
  org.notifications.unshift({ id: createId(), title, body, createdAt: at, read: false });
  org.notifications = org.notifications.slice(0, 50);
}

function activeReceptionist(org: ReceptionOrg) {
  return org.receptionists.find((item) => item.active) ?? org.receptionists[0];
}

function startCall(org: ReceptionOrg, channel: ReceptionChannel, now: Date): ReceptionCall {
  const call: ReceptionCall = {
    id: createId(),
    receptionistId: activeReceptionist(org)?.id ?? '',
    channel,
    callerName: '',
    callerPhone: '',
    callerEmail: '',
    customerId: null,
    verified: false,
    intent: 'general',
    department: 'general',
    status: 'open',
    summary: '',
    transcript: [],
    elevenConversationId: null,
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  org.calls.unshift(call);
  org.calls = org.calls.slice(0, 100);
  org.activeCallId = call.id;
  return call;
}

function openCall(org: ReceptionOrg): ReceptionCall | null {
  if (!org.activeCallId) return null;
  const call = org.calls.find((item) => item.id === org.activeCallId) ?? null;
  if (!call || call.status !== 'open') return null;
  return call;
}

export function classifyIntent(text: string): ReceptionCall['intent'] {
  const value = text.toLowerCase();
  if (/take a message|\bmessage\b|call me back|callback/.test(value)) return 'message';
  if (/appointment|reschedule/.test(value)) return 'appointment';
  if (/payroll|pay stub|paycheque|paycheck|salary|wage/.test(value)) return 'payroll';
  if (/\btax\b|cra|gst|hst|\bt4\b|remittance/.test(value)) return 'tax';
  if (/invoice|payment|balance|bill|how much do i owe/.test(value)) return 'billing';
  if (/account|bookkeep|journal|ledger|statement/.test(value)) return 'accounting';
  if (/message|call me back|callback/.test(value)) return 'message';
  return 'general';
}

function departmentFrom(text: string, fallback: ReceptionDepartment): ReceptionDepartment {
  const intent = classifyIntent(text.replace(/appointment|reschedule|take a message|\bmessage\b|call me back|callback/gi, ''));
  if (intent === 'payroll' || intent === 'tax' || intent === 'billing' || intent === 'accounting') return intent;
  return fallback;
}

function wantsHuman(text: string): boolean {
  return /speak with|talk to|transfer|representative|someone|human|person/.test(text.toLowerCase());
}

function extractPhone(text: string): string {
  return text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? '';
}

function extractEmail(text: string): string {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? '';
}

function explicitLast4(text: string): string | null {
  const withoutPhones = text.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, ' ');
  return withoutPhones.match(/\b(\d{4})\b/)?.[1] ?? null;
}

function extractName(text: string): string {
  const match = text.match(/(?:i am|i'm|this is|my name is)\s+([A-Za-z][A-Za-z' -]{1,40})/i);
  return match?.[1]?.trim() ?? '';
}

function findContact(directory: Directory, call: ReceptionCall): DirectoryContact | null {
  if (call.customerId) return directory.contacts.find((contact) => contact.id === call.customerId) ?? null;
  if (call.callerPhone) {
    const byPhone = directory.contacts.find((contact) => contact.phone && samePhone(contact.phone, call.callerPhone));
    if (byPhone) return byPhone;
  }
  if (call.callerEmail) {
    const byEmail = directory.contacts.find((contact) => contact.email && contact.email.toLowerCase() === call.callerEmail);
    if (byEmail) return byEmail;
  }
  if (call.callerName) {
    const matches = directory.contacts.filter((contact) => contact.name.toLowerCase() === call.callerName.toLowerCase());
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function isBlocked(org: ReceptionOrg, phone: string): boolean {
  return !!phone && org.blocked.some((item) => samePhone(item.phone, phone));
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    weekday: get('weekday'),
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

function zonedIso(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): string {
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 4; i += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const delta = Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    if (delta === 0) break;
    utc += delta;
  }
  return new Date(utc).toISOString();
}

export function parseRequestedTime(text: string, now: Date, timeZone: string): string | null {
  const iso = text.match(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/);
  if (iso) {
    const value = iso[0].includes('T') || iso[0].includes(' ') ? new Date(iso[0]) : new Date(`${iso[0]}T10:00:00`);
    if (!Number.isNaN(value.getTime())) return value.toISOString();
  }
  const clock = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const relative = /tomorrow/i.test(text) ? 1 : /today/i.test(text) ? 0 : null;
  if (!clock || relative === null) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2] ?? 0);
  const mer = clock[3]?.toLowerCase();
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  if (!mer && hour < 8) hour += 12;
  const today = zonedParts(now, timeZone);
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + relative));
  return zonedIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute, timeZone);
}

export function nextOpenSlot(org: ReceptionOrg, now: Date): string {
  const cursor = new Date(now.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() < 30 ? 30 : 0);
  if (cursor.getMinutes() === 0) cursor.setHours(cursor.getHours() + 1);
  for (let step = 0; step < 24 * 21; step += 1) {
    const parts = zonedParts(cursor, org.timezone);
    const open = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(parts.weekday) && parts.hour >= 9 && parts.hour < 17;
    if (open && !appointmentConflict(org, cursor.toISOString())) return cursor.toISOString();
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return cursor.toISOString();
}

function appointmentConflict(org: ReceptionOrg, startsAt: string, ignoreId?: string): boolean {
  const start = new Date(startsAt).getTime();
  const end = start + 30 * 60 * 1000;
  return org.appointments.some((item) => {
    if (item.status !== 'booked' || item.id === ignoreId) return false;
    const otherStart = new Date(item.startsAt).getTime();
    const otherEnd = otherStart + item.durationMinutes * 60 * 1000;
    return start < otherEnd && end > otherStart;
  });
}

function rememberCaller(call: ReceptionCall, text: string) {
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const name = extractName(text);
  if (phone) call.callerPhone = digits(phone);
  if (email) call.callerEmail = email;
  if (name) call.callerName = name;
}

function identify(org: ReceptionOrg, directory: Directory, call: ReceptionCall): string {
  const contact = findContact(directory, call);
  if (!contact) {
    if (call.callerName || call.callerPhone || call.callerEmail) {
      return 'I could not find that caller in eFinsuite. I can take a message or save a new lead.';
    }
    return 'I can look up the account once I have a name and phone number.';
  }
  call.customerId = contact.id;
  call.callerName = call.callerName || contact.name;
  return `I found ${contact.name} in eFinsuite. Account details stay hidden until the last four digits of the phone number on the account are confirmed.`;
}

function verify(call: ReceptionCall, directory: Directory, text: string): string {
  const contact = findContact(directory, call);
  const last4 = text.match(/\b(\d{4})\b/)?.[1];
  if (!contact) return 'I need to find the account before I can verify it.';
  if (!last4) return 'Please say the last four digits of the phone number on the account.';
  if (digits(contact.phone ?? '').endsWith(last4)) {
    call.verified = true;
    call.customerId = contact.id;
    return `${contact.name} is verified. I can share the permitted account summary.`;
  }
  return 'Those digits do not match the phone number on the account.';
}

function accountSummary(directory: Directory, call: ReceptionCall, topic: string): string {
  const contact = findContact(directory, call);
  if (!contact) return 'There is no matching customer record yet.';
  if (!call.verified) return 'Verification is required before account details can be shared.';
  if (topic === 'payroll') {
    const when = directory.nextPayDate ? `The next pay date on file is ${directory.nextPayDate}.` : 'There is no upcoming pay date on file.';
    return `${when} Pay amounts stay in payroll and are not read on this call.`;
  }
  if (topic === 'tax') return 'Tax balances and CRA filings are handled by the tax team. I will not quote a balance on this call.';
  const amount = contact.openBalance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${contact.name} has ${contact.openInvoiceCount} open invoice${contact.openInvoiceCount === 1 ? '' : 's'} totaling ${amount} ${contact.currency}.`;
}

function book(org: ReceptionOrg, call: ReceptionCall, startsAt: string, department: ReceptionDepartment, now: Date): string {
  if (appointmentConflict(org, startsAt)) return 'That time is already booked. I can offer another weekday time.';
  const appointment: ReceptionAppointment = {
    id: createId(),
    customerId: call.customerId,
    customerName: call.callerName || 'Caller',
    department,
    startsAt,
    durationMinutes: 30,
    status: 'booked',
    notes: call.summary,
  };
  org.appointments.unshift(appointment);
  notify(org, 'Appointment booked', `${appointment.customerName} · ${department} · ${startsAt}`, now.toISOString());
  call.status = 'resolved';
  org.activeCallId = null;
  return `Booked a 30-minute ${department} appointment for ${appointment.customerName} at ${startsAt}.`;
}

function handoff(org: ReceptionOrg, call: ReceptionCall, department: ReceptionDepartment, now: Date, detail: string): string {
  const route = routeFor(org, department);
  call.department = department;
  call.intent = department === 'general' ? call.intent : department;
  call.status = 'handed_off';
  org.tickets.unshift({
    id: createId(),
    customerId: call.customerId,
    callerName: call.callerName || 'Caller',
    subject: `${department[0].toUpperCase()}${department.slice(1)} call`,
    department,
    body: detail,
    priority: /urgent|asap/i.test(detail) ? 'urgent' : 'normal',
    status: 'open',
    createdAt: now.toISOString(),
  });
  const destination = route.destinationPhone ? `${route.destinationName} at ${route.destinationPhone}` : route.destinationName;
  notify(org, `Handoff to ${route.destinationName}`, detail, now.toISOString());
  org.activeCallId = null;
  return `I have opened a ${department} request and the next step is ${destination}. The transcript stays on this call.`;
}

export function searchKnowledge(org: ReceptionOrg, query: string): string {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  const match = org.knowledge.find((article) => {
    const haystack = `${article.title} ${article.body}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
  return match ? `${match.title}: ${match.body}` : 'I do not have a knowledge article for that yet. I can take a message for the team.';
}

export function summarizeCall(call: ReceptionCall): string {
  const who = call.callerName || 'A caller';
  const where = call.department === 'general' ? 'the front desk' : `the ${call.department} team`;
  const verified = call.verified ? 'The caller was verified.' : 'The caller was not verified.';
  return `${who} called about ${call.intent}. Status: ${call.status}. Routed toward ${where}. ${verified}`;
}

export function receptionAnalytics(org: ReceptionOrg): ReceptionAnalytics {
  const byDepartment: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  for (const call of org.calls) {
    byDepartment[call.department] = (byDepartment[call.department] ?? 0) + 1;
    byChannel[call.channel] = (byChannel[call.channel] ?? 0) + 1;
  }
  return {
    calls: org.calls.length,
    resolved: org.calls.filter((call) => call.status === 'resolved').length,
    handedOff: org.calls.filter((call) => call.status === 'handed_off').length,
    blocked: org.calls.filter((call) => call.status === 'blocked').length,
    bookings: org.appointments.filter((item) => item.status === 'booked').length,
    messages: org.messages.length,
    tickets: org.tickets.length,
    leads: org.leads.length,
    byDepartment,
    byChannel,
  };
}

export function buildAgentPrompt(org: ReceptionOrg): string {
  const knowledge = org.knowledge.map((article) => `- ${article.title}: ${article.body}`).join('\n');
  const routes = org.routes.map((route) => `- ${route.department}: ${route.destinationName}${route.destinationPhone ? ` (${route.destinationPhone})` : ''}`).join('\n');
  const languages = org.languages.map((code) => RECEPTION_LANGUAGES.find((item) => item.code === code)?.label ?? code).join(', ');
  return [
    `You are the eFinsuite AI receptionist. Personality: ${org.personality}`,
    'eFinsuite is the system of record. Use the provided tools for customers, invoices, payroll, tax, appointments, messages, tickets, and transfers. Never invent balances, pay amounts, or CRA amounts.',
    'Verify the caller with the last four digits of the phone number on the account before sharing account details. Do not ask for a SIN, full bank account, or card number.',
    `Speak ${languages}. Switch to the caller\'s language when they use one of those languages. End the call when the caller is finished.`,
    'Knowledge:',
    knowledge,
    'Routing:',
    routes,
    org.forwardingNumber ? `The business forwards ${org.forwardingNumber} to this receptionist.` : '',
  ].filter(Boolean).join('\n');
}

export interface ToolResult {
  org: ReceptionOrg;
  ok: boolean;
  message: string;
}

export function runReceptionTool(org: ReceptionOrg, directory: Directory, name: string, parameters: Record<string, unknown>, now = new Date()): ToolResult {
  const next = clone(org);
  const call = openCall(next) ?? startCall(next, 'web', now);
  const text = String(parameters.text ?? parameters.query ?? parameters.note ?? '');
  rememberCaller(call, `${parameters.name ?? ''} ${parameters.phone ?? ''} ${parameters.email ?? ''} ${text}`);
  if (parameters.name) call.callerName = String(parameters.name);
  if (parameters.phone) call.callerPhone = digits(String(parameters.phone));
  if (parameters.email) call.callerEmail = String(parameters.email).toLowerCase();
  if (isBlocked(next, call.callerPhone)) {
    call.status = 'blocked';
    next.activeCallId = null;
    call.summary = summarizeCall(call);
    return { org: next, ok: false, message: 'This number is blocked. The call will not continue.' };
  }
  let message = 'I can help with accounting, payroll, tax, invoices, appointments, and messages.';
  if (name === 'identify_caller') message = identify(next, directory, call);
  if (name === 'verify_caller') message = verify(call, directory, String(parameters.last4 ?? text));
  if (name === 'search_knowledge') message = searchKnowledge(next, String(parameters.query ?? text));
  if (name === 'account_summary') message = accountSummary(directory, call, String(parameters.topic ?? 'billing'));
  if (name === 'capture_lead') {
    next.leads.unshift({
      id: createId(),
      name: call.callerName || String(parameters.name ?? 'Caller'),
      phone: call.callerPhone,
      email: call.callerEmail,
      note: String(parameters.note ?? text),
      createdAt: now.toISOString(),
    });
    message = 'Lead saved in eFinsuite. A staff member can turn it into a customer record.';
  }
  if (name === 'take_message') {
    next.messages.unshift({
      id: createId(),
      callId: call.id,
      callerName: call.callerName || 'Caller',
      phone: call.callerPhone,
      body: String(parameters.body ?? text),
      priority: /urgent|asap/i.test(String(parameters.priority ?? text)) ? 'urgent' : 'normal',
      department: (DEPARTMENTS.includes(parameters.department as ReceptionDepartment) ? parameters.department : call.department) as ReceptionDepartment,
      status: 'new',
      createdAt: now.toISOString(),
    });
    notify(next, 'New message', String(parameters.body ?? text), now.toISOString());
    call.status = 'resolved';
    next.activeCallId = null;
    message = 'Message saved for the team.';
  }
  if (name === 'create_ticket' || name === 'route_call') {
    const requested = String(parameters.department ?? '');
    const fromText = classifyIntent(text);
    const target: ReceptionDepartment = DEPARTMENTS.includes(requested as ReceptionDepartment)
      ? requested as ReceptionDepartment
      : fromText === 'payroll' || fromText === 'tax' || fromText === 'billing' || fromText === 'accounting'
        ? fromText
        : 'general';
    message = handoff(next, call, target, now, String(parameters.detail ?? text ?? call.summary));
  }
  if (name === 'book_appointment' || name === 'reschedule_appointment') {
    const startsAt = String(parameters.startsAt ?? '') || parseRequestedTime(text, now, next.timezone) || nextOpenSlot(next, now);
    if (name === 'reschedule_appointment') {
      const current = next.appointments.find((item) => item.customerId === call.customerId && item.status === 'booked');
      if (current) current.status = 'rescheduled';
    }
    const department = (DEPARTMENTS.includes(parameters.department as ReceptionDepartment) ? parameters.department : 'general') as ReceptionDepartment;
    message = book(next, call, startsAt, department, now);
  }
  if (name === 'cancel_appointment') {
    const current = next.appointments.find((item) => item.status === 'booked' && (item.customerId === call.customerId || item.customerName === call.callerName));
    if (!current) message = 'I do not see a booked appointment to cancel.';
    else {
      current.status = 'cancelled';
      call.status = 'resolved';
      next.activeCallId = null;
      message = `Cancelled the ${current.department} appointment at ${current.startsAt}.`;
    }
  }
  call.updatedAt = now.toISOString();
  call.summary = summarizeCall(call);
  return { org: next, ok: !message.startsWith('This number is blocked'), message };
}

export interface DeskResult {
  org: ReceptionOrg;
  reply: string;
  call: ReceptionCall | null;
}

export function deskReply(org: ReceptionOrg, directory: Directory, text: string, now = new Date()): DeskResult {
  if (!org.enabled) {
    return { org, reply: 'The AI receptionist is turned off. Turn it on before taking calls.', call: null };
  }
  const next = clone(org);
  const call = openCall(next) ?? startCall(next, 'web', now);
  call.transcript.push({ role: 'caller', text, at: now.toISOString() });
  rememberCaller(call, text);
  if (isBlocked(next, call.callerPhone)) {
    call.status = 'blocked';
    next.activeCallId = null;
    const reply = 'This number is blocked, so I cannot continue the call.';
    call.transcript.push({ role: 'receptionist', text: reply, at: now.toISOString() });
    call.summary = summarizeCall(call);
    return { org: next, reply, call };
  }
  const intent = classifyIntent(text);
  if (intent !== 'general') call.intent = intent;
  if (call.intent === 'payroll' || call.intent === 'tax' || call.intent === 'billing' || call.intent === 'accounting') {
    call.department = call.intent;
  }
  identify(next, directory, call);
  const last4 = explicitLast4(text);
  if (last4 && call.customerId) verify(call, directory, last4);

  let reply = 'I can help with accounting, payroll, tax, invoices, appointments, and messages.';
  let working = next;
  const adopt = (result: ToolResult) => {
    working = result.org;
    reply = result.message;
  };
  if (call.intent === 'appointment' && /cancel/i.test(text)) {
    adopt(runReceptionTool(next, directory, 'cancel_appointment', { text }, now));
  } else if (call.intent === 'appointment') {
    const startsAt = parseRequestedTime(text, now, next.timezone);
    const department = departmentFrom(text, 'general');
    adopt(runReceptionTool(next, directory, /reschedule/i.test(text) ? 'reschedule_appointment' : 'book_appointment', { startsAt: startsAt ?? '', department, text }, now));
  } else if (call.intent === 'message') {
    call.department = departmentFrom(text, call.department);
    adopt(runReceptionTool(next, directory, 'take_message', { body: text, department: call.department }, now));
  } else if (call.intent === 'billing' && call.verified) {
    reply = `${accountSummary(directory, call, 'billing')} ${handoff(next, call, 'billing', now, text)}`;
  } else if (call.intent === 'billing') {
    reply = call.customerId
      ? 'I found the account. Say the last four digits of the phone number on the account before I share the invoice balance.'
      : 'I can check an invoice once I have the name and phone number on the account.';
  } else if (call.intent === 'payroll' || call.intent === 'tax' || call.intent === 'accounting' || wantsHuman(text)) {
    if (!call.callerName && !call.callerPhone) {
      reply = `I can connect you with ${routeFor(next, call.department).destinationName}. Please tell me your name and phone number so the team has the context of this call.`;
    } else {
      const summary = call.verified ? accountSummary(directory, call, call.intent) : 'Account details stay hidden until the caller is verified.';
      reply = `${summary} ${handoff(next, call, call.department, now, text)}`;
    }
  } else if (/hour|when are you open|knowledge|faq/i.test(text)) {
    reply = searchKnowledge(next, text);
    call.status = 'resolved';
    next.activeCallId = null;
  } else if (!call.customerId && (call.callerName || call.callerPhone)) {
    adopt(runReceptionTool(next, directory, 'capture_lead', { note: text }, now));
  }

  const current = working.calls.find((item) => item.id === call.id) ?? working.calls[0] ?? null;
  if (current && !current.transcript.some((turn) => turn.role === 'receptionist' && turn.text === reply)) {
    current.transcript.push({ role: 'receptionist', text: reply, at: now.toISOString() });
  }
  if (current) {
    current.summary = summarizeCall(current);
    current.updatedAt = now.toISOString();
  }
  return { org: working, reply, call: current };
}

export function clientToolDefinitions() {
  const object = (properties: Record<string, { type: string; description: string }>, required: string[] = []) => ({
    type: 'object',
    properties,
    required,
  });
  const tools = [
    ['identify_caller', 'Find a customer in eFinsuite by name, phone, or email.', { name: { type: 'string', description: 'Caller name' }, phone: { type: 'string', description: 'Caller phone' }, email: { type: 'string', description: 'Caller email' } }],
    ['verify_caller', 'Verify the caller with the last four digits of the phone number on the account.', { last4: { type: 'string', description: 'Last four digits' } }],
    ['search_knowledge', 'Search the eFinsuite receptionist knowledge base.', { query: { type: 'string', description: 'Question' } }],
    ['account_summary', 'Read the permitted invoice, payroll, or tax summary after verification.', { topic: { type: 'string', description: 'billing, payroll, or tax' } }],
    ['book_appointment', 'Book an appointment in eFinsuite.', { startsAt: { type: 'string', description: 'ISO start time' }, department: { type: 'string', description: 'Department' } }],
    ['reschedule_appointment', 'Reschedule the caller appointment.', { startsAt: { type: 'string', description: 'New ISO start time' } }],
    ['cancel_appointment', 'Cancel the caller appointment.', {}],
    ['take_message', 'Save a callback message in eFinsuite.', { body: { type: 'string', description: 'Message' }, priority: { type: 'string', description: 'normal or urgent' } }],
    ['create_ticket', 'Create a support request in eFinsuite.', { department: { type: 'string', description: 'Department' }, detail: { type: 'string', description: 'Request' } }],
    ['route_call', 'Hand the call to an employee or department and keep the transcript.', { department: { type: 'string', description: 'Department' }, detail: { type: 'string', description: 'Context' } }],
    ['capture_lead', 'Save a new lead for staff to add as a customer.', { name: { type: 'string', description: 'Name' }, phone: { type: 'string', description: 'Phone' }, note: { type: 'string', description: 'Note' } }],
  ] as const;
  return tools.map(([name, description, properties]) => ({
    type: 'client' as const,
    name,
    description,
    parameters: object(properties as Record<string, { type: string; description: string }>),
  }));
}

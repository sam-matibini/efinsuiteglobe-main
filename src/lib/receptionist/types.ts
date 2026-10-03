export type ReceptionDepartment = 'general' | 'accounting' | 'payroll' | 'tax' | 'billing';
export type ReceptionChannel = 'phone' | 'web' | 'sms' | 'whatsapp';
export type CallStatus = 'open' | 'resolved' | 'handed_off' | 'blocked';
export type AppointmentStatus = 'booked' | 'cancelled' | 'rescheduled';

export interface ReceptionChannels {
  phone: boolean;
  web: boolean;
  sms: boolean;
  whatsapp: boolean;
}

export interface ReceptionistProfile {
  id: string;
  name: string;
  department: ReceptionDepartment;
  greeting: string;
  active: boolean;
  phoneNumber: string;
  elevenAgentId: string | null;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  body: string;
  department: ReceptionDepartment | 'all';
}

export interface RoutingRule {
  id: string;
  department: ReceptionDepartment;
  destinationName: string;
  destinationPhone: string;
  condition: string;
}

export interface BlockedNumber {
  id: string;
  phone: string;
  reason: string;
}

export interface TranscriptTurn {
  role: 'caller' | 'receptionist';
  text: string;
  at: string;
}

export interface ReceptionCall {
  id: string;
  receptionistId: string;
  channel: ReceptionChannel;
  callerName: string;
  callerPhone: string;
  callerEmail: string;
  customerId: string | null;
  verified: boolean;
  intent: ReceptionDepartment | 'message' | 'appointment' | 'general';
  department: ReceptionDepartment;
  status: CallStatus;
  summary: string;
  transcript: TranscriptTurn[];
  elevenConversationId: string | null;
  startedAt: string;
  updatedAt: string;
}

export interface ReceptionMessage {
  id: string;
  callId: string | null;
  callerName: string;
  phone: string;
  body: string;
  priority: 'normal' | 'urgent';
  department: ReceptionDepartment;
  status: 'new' | 'done';
  createdAt: string;
}

export interface ReceptionAppointment {
  id: string;
  customerId: string | null;
  customerName: string;
  department: ReceptionDepartment;
  startsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  notes: string;
}

export interface ReceptionTicket {
  id: string;
  customerId: string | null;
  callerName: string;
  subject: string;
  department: ReceptionDepartment;
  body: string;
  priority: 'normal' | 'urgent';
  status: 'open' | 'closed';
  createdAt: string;
}

export interface ReceptionLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  createdAt: string;
}

export interface ReceptionNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface ReceptionOrg {
  organizationId: string;
  enabled: boolean;
  voiceId: string;
  voiceName: string;
  language: string;
  languages: string[];
  personality: string;
  timezone: string;
  forwardingNumber: string;
  channels: ReceptionChannels;
  notifyEmail: string;
  elevenAgentId: string | null;
  toolSecret: string;
  receptionists: ReceptionistProfile[];
  knowledge: KnowledgeArticle[];
  routes: RoutingRule[];
  blocked: BlockedNumber[];
  calls: ReceptionCall[];
  messages: ReceptionMessage[];
  appointments: ReceptionAppointment[];
  tickets: ReceptionTicket[];
  leads: ReceptionLead[];
  notifications: ReceptionNotification[];
  activeCallId: string | null;
}

export interface DirectoryContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  openInvoiceCount: number;
  openBalance: number;
  currency: string;
}

export interface Directory {
  contacts: DirectoryContact[];
  nextPayDate: string | null;
}

export interface ReceptionAnalytics {
  calls: number;
  resolved: number;
  handedOff: number;
  blocked: number;
  bookings: number;
  messages: number;
  tickets: number;
  leads: number;
  byDepartment: Record<string, number>;
  byChannel: Record<string, number>;
}

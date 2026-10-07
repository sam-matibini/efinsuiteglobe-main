import { classifyIntent, deskReply, emptyDirectory, emptyReceptionOrg } from '@/lib/receptionist/engine';
import { formatFilingDate, upcomingFilingReminders, type FilingReminderKind } from '@/lib/receptionist/filingReminders';
import type { ReceptionOrg } from '@/lib/receptionist/types';

export const LANDING_DESK_EMAIL = 'info@efintax.biz';
export const LANDING_DESK_PHONE = '+17789020442';
export const LANDING_DESK_PHONE_LABEL = '+1 778 902 0442';

export type LandingChannel = 'email' | 'sms' | 'whatsapp';

export interface LandingVisitor {
  name: string;
  phone: string;
  email: string;
}

export function createLandingReceptionist(): ReceptionOrg {
  const org = emptyReceptionOrg('landing');
  org.enabled = true;
  org.channels = { phone: true, web: true, sms: true, whatsapp: true };
  org.notifyEmail = LANDING_DESK_EMAIL;
  org.forwardingNumber = LANDING_DESK_PHONE;
  return org;
}

/** Product questions stay with the marketing assistant. Reception requests use the desk. */
export function isLandingReceptionRequest(text: string): boolean {
  return /payroll|tax|gst|hst|\bcra\b|appointment|book a|leave a message|take a message|callback|call me|invoice|whatsapp|\bsms\b|remind|receptionist|t4|corporation|filing date|due date|office hours|when are you open/i.test(text);
}

const LANDING_FILING_KINDS: FilingReminderKind[] = [
  'payroll_remittance',
  'gst_hst',
  'corporate_balance',
  'corporate_return',
  't4_slip',
];

export function landingFilingSummary(today: Date): string {
  const reminders = upcomingFilingReminders({
    today: today.toISOString().slice(0, 10),
    fiscalYearEndMonth: 12,
    gstFrequency: 'quarterly',
    corporationKind: 'ccpc',
  });
  const picked = LANDING_FILING_KINDS.flatMap((kind) => {
    const item = reminders.find((entry) => entry.kind === kind);
    return item ? [item] : [];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return picked.map((item) => `${item.title}: ${formatFilingDate(item.dueDate)}`).join('\n');
}

export function replyToLandingVisitor(org: ReceptionOrg, text: string, today = new Date()): { org: ReceptionOrg; reply: string } {
  const result = deskReply(org, emptyDirectory(), text, today);
  let reply = result.reply;
  if (classifyIntent(text) === 'tax' || /gst|hst|filing date|due date|corporation tax|t4/i.test(text)) {
    reply = `${reply}\n\nUpcoming dates on the general CRA calendar for a December year-end, quarterly GST/HST, and a CCPC:\n${landingFilingSummary(today)}`;
  }
  return { org: result.org, reply };
}

export function landingVisitLines(org: ReceptionOrg): string[] {
  return [
    ...org.appointments.filter((item) => item.status === 'booked').slice(0, 2).map((item) => `Booked ${item.department} appointment`),
    ...org.messages.slice(0, 2).map((item) => `Message saved for ${item.callerName && item.callerName !== 'Caller' ? item.callerName : 'the desk'}`),
    ...org.leads.slice(0, 2).map((item) => `Contact saved: ${item.name}`),
  ];
}

export function visitorIntroduction(visitor: LandingVisitor): string {
  const parts = [`I am ${visitor.name.trim()}`];
  if (visitor.phone.trim()) parts.push(`My phone is ${visitor.phone.trim()}`);
  if (visitor.email.trim()) parts.push(`My email is ${visitor.email.trim()}`);
  return `${parts.join('. ')}.`;
}

export function followUpHref(channel: LandingChannel, note: string, visitor?: Partial<LandingVisitor>): string {
  const name = visitor?.name?.trim();
  const phone = visitor?.phone?.trim();
  const email = visitor?.email?.trim();
  const who = [name, phone, email].filter(Boolean).join(', ') || 'A website visitor';
  const body = `${who} asked the landing receptionist:\n${note.trim()}`;
  if (channel === 'email') {
    return `mailto:${LANDING_DESK_EMAIL}?subject=${encodeURIComponent('Reception request from the website')}&body=${encodeURIComponent(body)}`;
  }
  if (channel === 'sms') {
    return `sms:${LANDING_DESK_PHONE}?body=${encodeURIComponent(body)}`;
  }
  return `https://wa.me/${LANDING_DESK_PHONE.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`;
}

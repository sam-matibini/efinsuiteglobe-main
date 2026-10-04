import { matchSharedContact, type SharedContact } from './sharedContacts';

export type SharedChannel = 'email' | 'sms' | 'whatsapp';

export interface SharedConversationSummary {
  id: string;
  contactIdentifier: string;
  contactName: string | null;
  channel: string;
  preview: string | null;
  at: string;
}

export function isSharedChannel(channel: string): channel is SharedChannel {
  return channel === 'email' || channel === 'sms' || channel === 'whatsapp';
}

export function channelDestination(
  contact: Pick<SharedContact, 'email' | 'phone' | 'cell_phone'>,
  channel: SharedChannel,
): string {
  if (channel === 'email') return contact.email?.trim() ?? '';
  return contact.phone?.trim() || contact.cell_phone?.trim() || '';
}

export function sharedChannelLabel(channel: string): string {
  if (channel === 'sms') return 'SMS';
  if (channel === 'whatsapp') return 'WhatsApp';
  if (channel === 'email') return 'Email';
  return channel;
}

export function conversationLabel(conversation: SharedConversationSummary, contacts: SharedContact[]): string {
  const named = conversation.contactName?.trim();
  if (named) return named;
  const identifier = conversation.contactIdentifier.trim();
  const match = matchSharedContact(contacts, {
    email: identifier.includes('@') ? identifier : undefined,
    phone: identifier.includes('@') ? undefined : identifier,
  });
  return match?.name ?? identifier;
}

export function sharedConversations<T extends SharedConversationSummary>(conversations: T[]): T[] {
  return conversations.filter((conversation) => isSharedChannel(conversation.channel));
}

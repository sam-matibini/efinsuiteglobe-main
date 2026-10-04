import { describe, expect, it } from 'vitest';
import { channelDestination, conversationLabel, isSharedChannel, sharedConversations } from './sharedInbox';
import type { SharedContact } from './sharedContacts';

const contacts: SharedContact[] = [
  { id: 'c1', name: 'Bank of Canada', email: 'edalsan@gmail.com', phone: null, cell_phone: '613-555-0100', company: 'Bank of Canada' },
];

describe('shared communication inbox', () => {
  it('keeps email, SMS, and WhatsApp and drops other channels', () => {
    const visible = sharedConversations([
      { id: '1', contactIdentifier: 'edalsan@gmail.com', contactName: null, channel: 'email', preview: 'Invoice', at: '2026-10-01' },
      { id: '2', contactIdentifier: '+16135550100', contactName: 'Bank of Canada', channel: 'sms', preview: 'HST', at: '2026-10-02' },
      { id: '3', contactIdentifier: '+16135550100', contactName: 'Bank of Canada', channel: 'whatsapp', preview: 'Filing', at: '2026-10-03' },
      { id: '4', contactIdentifier: 'desk', contactName: 'Desk', channel: 'in_app', preview: 'Note', at: '2026-10-04' },
    ]);
    expect(visible.map((item) => item.channel)).toEqual(['email', 'sms', 'whatsapp']);
    expect(isSharedChannel('email')).toBe(true);
    expect(isSharedChannel('in_app')).toBe(false);
  });

  it('names a conversation from the shared contact and picks a destination for each channel', () => {
    expect(conversationLabel({
      id: '1',
      contactIdentifier: 'edalsan@gmail.com',
      contactName: null,
      channel: 'email',
      preview: null,
      at: '2026-10-01',
    }, contacts)).toBe('Bank of Canada');
    expect(channelDestination(contacts[0], 'email')).toBe('edalsan@gmail.com');
    expect(channelDestination(contacts[0], 'sms')).toBe('613-555-0100');
    expect(channelDestination(contacts[0], 'whatsapp')).toBe('613-555-0100');
  });
});

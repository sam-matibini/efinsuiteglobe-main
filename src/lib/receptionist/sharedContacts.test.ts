import { describe, expect, it } from 'vitest';
import { activityCounts, matchSharedContact, type SharedContact } from './sharedContacts';

const contacts: SharedContact[] = [
  {
    id: 'c1',
    name: '17259484 Canada Inc.',
    email: 'nnamdi@example.com',
    phone: '(437) 908-8602',
    company: '17259484 Canada Inc.',
  },
  {
    id: 'c2',
    name: 'Bank of Canada',
    email: 'edalsan@gmail.com',
    phone: null,
    cell_phone: '613-555-0100',
    company: 'Bank of Canada',
  },
];

describe('shared receptionist contacts', () => {
  it('matches a caller by phone even when the formatting differs', () => {
    const match = matchSharedContact(contacts, { text: "I'd like to speak with someone about my payroll. Call 4379088602." });
    expect(match?.id).toBe('c1');
  });

  it('matches a caller by email before a company name in the same message', () => {
    const match = matchSharedContact(contacts, {
      text: 'Email edalsan@gmail.com about the Bank of Canada filing',
    });
    expect(match?.id).toBe('c2');
  });

  it('counts receptionist activity for the desk', () => {
    expect(
      activityCounts([
        { id: '1', kind: 'call', body: 'a', contactId: 'c1', contactName: 'A', createdAt: '' },
        { id: '2', kind: 'message', body: 'b', contactId: 'c1', contactName: 'A', createdAt: '' },
        { id: '3', kind: 'message', body: 'c', contactId: 'c2', contactName: 'B', createdAt: '' },
      ]),
    ).toEqual({ calls: 1, handoffs: 0, bookings: 0, messages: 2 });
  });
});

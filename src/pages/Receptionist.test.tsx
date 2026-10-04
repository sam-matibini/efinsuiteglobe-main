import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { deskReply, emptyReceptionOrg } from '@/lib/receptionist/engine';
import type { Directory, ReceptionOrg } from '@/lib/receptionist/types';

const now = new Date('2026-10-05T15:00:00.000Z');
const directory: Directory = {
  contacts: [{ id: 'c1', name: 'Jane Doe', email: 'jane@example.com', phone: '4165550199', openInvoiceCount: 2, openBalance: 450, currency: 'CAD' }],
  nextPayDate: '2026-10-15',
};

const state = vi.hoisted(() => ({
  useReceptionist: vi.fn(),
  talk: async (_text: string): Promise<{ reply: string; org: ReceptionOrg }> => ({ reply: '', org: {} as ReceptionOrg }),
  contacts: [] as Array<{ id: string; name: string; email: string | null; phone: string | null; cell_phone: string | null; company: string | null; is_active: boolean }>,
  conversations: [] as Array<{ id: string; contact_identifier: string; contact_name: string | null; channel: 'email' | 'sms' | 'whatsapp'; last_message_preview: string | null; last_message_at: string; unread_count: number; is_archived: boolean; organization_id: string; created_at: string; updated_at: string }>,
  messages: [] as Array<{ id: string; body: string; direction: 'inbound' | 'outbound'; created_at: string }>,
  sendMessage: vi.fn(async () => ({ id: 'sent' })),
  selectConversation: vi.fn(async () => undefined),
}));

vi.mock('@/hooks/useReceptionist', () => ({
  useReceptionist: () => state.useReceptionist(),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: [], createCustomer: { mutate: vi.fn() } }),
}));

vi.mock('@/hooks/useContacts', () => ({
  useContacts: () => ({ contacts: state.contacts }),
}));

vi.mock('@/hooks/useMessages', () => ({
  useMessages: () => ({
    conversations: state.conversations,
    messages: state.messages,
    selectedConversation: null,
    isLoadingMessages: false,
    selectConversation: state.selectConversation,
    sendMessage: state.sendMessage,
  }),
}));

vi.mock('@/hooks/useFilingReminders', () => ({
  useFilingReminders: () => ({
    fiscalYearEndMonth: 12,
    deadlines: [],
    periods: [],
    isLoading: false,
  }),
}));

import Receptionist from './Receptionist';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe('AI Receptionist page', () => {
  beforeEach(() => {
    state.contacts = [];
    state.conversations = [];
    state.messages = [];
    state.sendMessage.mockClear();
    state.selectConversation.mockClear();
  });

  it('takes a payroll call and keeps the account details in eFinsuite', async () => {
    let org = emptyReceptionOrg('org-1');
    org.enabled = true;
    state.talk = async (text: string) => {
      const result = deskReply(org, directory, text, now);
      org = result.org;
      return { reply: result.reply, org: result.org };
    };
    state.useReceptionist.mockReturnValue({
      organization: { id: 'org-1', name: 'Acme' },
      orgLoading: false,
      isLoading: false,
      org,
      voiceReady: false,
      analytics: { calls: 0, resolved: 0, handedOff: 0, blocked: 0, bookings: 0, messages: 0, tickets: 0, leads: 0, byDepartment: {}, byChannel: {} },
      pending: false,
      talk: (text: string) => state.talk(text),
      saveSettings: vi.fn(async () => ({})),
      saveLists: vi.fn(async () => ({})),
      runTool: vi.fn(),
      syncAgent: vi.fn(),
      startSession: vi.fn(async () => ({})),
      refresh: vi.fn(),
      directory,
    } as never);

    render(<Receptionist />);
    expect(screen.getByRole('heading', { name: 'AI Receptionist' })).toBeInTheDocument();
    expect(screen.getByText('Text desk')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Message the receptionist' }), { target: { value: "I'd like to speak with someone about my payroll." } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/please tell me your name and phone number/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Message the receptionist' }), { target: { value: 'I am Jane Doe, 416-555-0199' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/Payroll team/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-15/)).not.toBeInTheDocument();
    expect(screen.getByText(/Jane Doe called about payroll/)).toBeInTheDocument();
  });

  it('shows the receptionist name while the organization is still loading', () => {
    state.useReceptionist.mockReturnValue({
      organization: null,
      orgLoading: true,
      isLoading: true,
      org: null,
      voiceReady: false,
      analytics: null,
      pending: false,
      talk: vi.fn(),
      saveSettings: vi.fn(),
      saveLists: vi.fn(),
      runTool: vi.fn(),
      syncAgent: vi.fn(),
      startSession: vi.fn(),
      refresh: vi.fn(),
      directory,
    } as never);

    render(<Receptionist />);
    expect(screen.getByRole('heading', { name: 'AI Receptionist' })).toBeInTheDocument();
    expect(screen.getByText('Loading the receptionist desk…')).toBeInTheDocument();
  });

  it('shows the desk when the organization has no stored receptionist', () => {
    state.useReceptionist.mockReturnValue({
      organization: { id: 'org-1', name: 'Acme' },
      orgLoading: false,
      isLoading: false,
      org: emptyReceptionOrg('org-1'),
      voiceReady: false,
      analytics: { calls: 0, resolved: 0, handedOff: 0, blocked: 0, bookings: 0, messages: 0, tickets: 0, leads: 0, byDepartment: {}, byChannel: {} },
      pending: false,
      talk: vi.fn(),
      saveSettings: vi.fn(),
      saveLists: vi.fn(),
      runTool: vi.fn(),
      syncAgent: vi.fn(),
      startSession: vi.fn(),
      refresh: vi.fn(),
      directory,
    } as never);

    render(<Receptionist />);
    expect(screen.getByRole('heading', { name: 'AI Receptionist' })).toBeInTheDocument();
    expect(screen.getByText('Text desk')).toBeInTheDocument();
    expect(screen.getByText('No calls yet.')).toBeInTheDocument();
    expect(screen.getByText('Contacts added in Communication show up here.')).toBeInTheDocument();
  });

  it('shares communication history and sends a GST/HST reminder on email', async () => {
    state.contacts = [{
      id: 'hub-1',
      name: 'Bank of Canada',
      email: 'edalsan@gmail.com',
      phone: null,
      cell_phone: '6135550100',
      company: 'Bank of Canada',
      is_active: true,
    }];
    state.conversations = [{
      id: 'conv-1',
      organization_id: 'org-1',
      contact_identifier: 'edalsan@gmail.com',
      contact_name: 'Bank of Canada',
      channel: 'email',
      last_message_preview: 'Please send the HST return',
      last_message_at: '2026-10-04T12:00:00.000Z',
      unread_count: 0,
      is_archived: false,
      created_at: '2026-10-04T12:00:00.000Z',
      updated_at: '2026-10-04T12:00:00.000Z',
    }];
    state.useReceptionist.mockReturnValue({
      organization: { id: 'org-1', name: 'Acme' },
      orgLoading: false,
      isLoading: false,
      org: emptyReceptionOrg('org-1'),
      voiceReady: false,
      analytics: { calls: 0, resolved: 0, handedOff: 0, blocked: 0, bookings: 0, messages: 0, tickets: 0, leads: 0, byDepartment: {}, byChannel: {} },
      pending: false,
      talk: vi.fn(),
      saveSettings: vi.fn(),
      saveLists: vi.fn(),
      runTool: vi.fn(),
      syncAgent: vi.fn(),
      startSession: vi.fn(),
      refresh: vi.fn(),
      directory,
    } as never);

    render(<Receptionist />);
    expect(screen.getByText('1 contact · 1 email, SMS, and WhatsApp conversation')).toBeInTheDocument();
    expect(screen.getByText('Bank of Canada')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Shared' }));
    expect(await screen.findByText('Please send the HST return')).toBeInTheDocument();
    expect(screen.getAllByText('Email').length).toBeGreaterThan(0);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Reminders' }));
    const gstReminder = (await screen.findAllByRole('button', { name: /Send GST\/HST return reminder due / }))[0];
    await act(async () => {
      fireEvent.click(gstReminder);
    });
    expect(state.sendMessage).toHaveBeenCalledWith(
      'email',
      'edalsan@gmail.com',
      expect.stringMatching(/^Acme: GST\/HST return is due /),
      expect.objectContaining({ subject: expect.stringMatching(/GST\/HST return due /) }),
    );
  });
});

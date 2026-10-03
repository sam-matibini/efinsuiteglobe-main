import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
}));

vi.mock('@/hooks/useReceptionist', () => ({
  useReceptionist: () => state.useReceptionist(),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: [], createCustomer: { mutate: vi.fn() } }),
}));

import Receptionist from './Receptionist';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe('AI Receptionist page', () => {
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
});

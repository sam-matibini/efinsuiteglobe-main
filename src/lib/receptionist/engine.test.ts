import { describe, expect, it, vi } from 'vitest';
import { handleReceptionApi } from './api';
import { agentRequestBody, syncElevenAgent, voiceCredentials } from './elevenlabs';
import {
  buildAgentPrompt,
  deskReply,
  emptyReceptionOrg,
  nextOpenSlot,
  receptionAnalytics,
  runReceptionTool,
} from './engine';
import type { Directory } from './types';

const now = new Date('2026-10-05T15:00:00.000Z');
const directory: Directory = {
  contacts: [{
    id: 'c1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '4165550199',
    openInvoiceCount: 2,
    openBalance: 450,
    currency: 'CAD',
  }],
  nextPayDate: '2026-10-15',
};

function enabled() {
  const org = emptyReceptionOrg('org-1');
  org.enabled = true;
  return org;
}

describe('AI receptionist', () => {
  it('routes a payroll call without reading pay details', () => {
    const first = deskReply(enabled(), directory, "I'd like to speak with someone about my payroll.", now);
    expect(first.reply.toLowerCase()).toContain('payroll');
    expect(first.reply.toLowerCase()).toContain('name');
    expect(first.org.tickets).toHaveLength(0);

    const second = deskReply(first.org, directory, 'I am Jane Doe, 416-555-0199', now);
    expect(second.reply).toContain('Account details stay hidden');
    expect(second.reply).toContain('Payroll team');
    expect(second.reply).not.toContain('2026-10-15');
    expect(second.org.tickets[0]?.department).toBe('payroll');
    expect(second.call?.status).toBe('handed_off');
    expect(second.org.notifications[0]?.title).toContain('Payroll');
  });

  it('hides invoice balances until the caller is verified', () => {
    const asked = deskReply(enabled(), directory, 'What is my invoice balance? I am Jane Doe, 416-555-0199', now);
    expect(asked.reply).not.toContain('450');
    expect(asked.reply.toLowerCase()).toContain('last four');

    const identified = runReceptionTool(enabled(), directory, 'identify_caller', { phone: '4165550199' }, now);
    const hidden = runReceptionTool(identified.org, directory, 'account_summary', { topic: 'billing' }, now);
    expect(hidden.message).not.toContain('450');
    const verified = runReceptionTool(hidden.org, directory, 'verify_caller', { last4: '0199' }, now);
    const summary = runReceptionTool(verified.org, directory, 'account_summary', { topic: 'billing' }, now);
    expect(summary.message).toContain('450.00');
    expect(summary.message).toContain('CAD');
    const payroll = runReceptionTool(verified.org, directory, 'account_summary', { topic: 'payroll' }, now);
    expect(payroll.message).toContain('2026-10-15');
    expect(payroll.message).not.toMatch(/\$|net pay|gross/i);
  });

  it('blocks a number, books an appointment, and answers from the knowledge base', () => {
    const org = enabled();
    org.blocked.push({ id: 'b1', phone: '4165550000', reason: 'Spam' });
    const blocked = deskReply(org, directory, 'My number is 416-555-0000', now);
    expect(blocked.call?.status).toBe('blocked');
    expect(blocked.org.tickets).toHaveLength(0);

    const booked = deskReply(enabled(), directory, 'Book an appointment tomorrow at 10 for accounting.', now);
    expect(booked.org.appointments[0]?.department).toBe('accounting');
    expect(booked.org.appointments[0]?.startsAt).toBe('2026-10-06T14:00:00.000Z');
    expect(booked.call?.status).toBe('resolved');

    const hours = deskReply(enabled(), directory, 'When are you open?', now);
    expect(hours.reply.toLowerCase()).toContain('weekdays');

    const analytics = receptionAnalytics(booked.org);
    expect(analytics.bookings).toBe(1);
    expect(analytics.calls).toBe(1);
  });

  it('keeps the ElevenLabs key on the server and records the call transcript', () => {
    const org = enabled();
    const prompt = buildAgentPrompt(org);
    expect(prompt).toContain('system of record');
    expect(prompt).toContain('Office hours');
    expect(prompt).not.toContain('xi-api-key');

    const body = JSON.stringify(agentRequestBody(org, 'https://example.com/api/receptionist'));
    expect(body).toContain(org.toolSecret);
    expect(body).not.toContain('super-secret-api-key');

    const calls: { url: string; headers: HeadersInit | undefined }[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: init?.headers });
      if (url.includes('/agents/create')) return new Response(JSON.stringify({ agent_id: 'agent_1' }), { status: 200 });
      if (url.includes('get-signed-url')) return new Response(JSON.stringify({ signed_url: 'wss://signed.example' }), { status: 200 });
      return new Response(JSON.stringify({ token: 'voice-token' }), { status: 200 });
    });
    return syncElevenAgent(org, { apiKey: 'super-secret-api-key', fetchImpl: fetchImpl as unknown as typeof fetch }).then(async (agentId) => {
      expect(agentId).toBe('agent_1');
      const header = JSON.stringify(calls[0]?.headers);
      expect(header).toContain('super-secret-api-key');
      expect(JSON.stringify(calls[0])).toContain('https://api.elevenlabs.io/v1/convai/agents/create');
      const credentials = await voiceCredentials(agentId, { apiKey: 'super-secret-api-key', fetchImpl: fetchImpl as unknown as typeof fetch });
      expect(credentials.signedUrl).toBe('wss://signed.example');
      expect(credentials.conversationToken).toBe('voice-token');
      expect(body).toContain('end_call');
      expect(body).toContain('language_detection');
      const transferable = enabled();
      transferable.forwardingNumber = '+14165550199';
      expect(JSON.stringify(agentRequestBody(transferable))).toContain('transfer_to_number');
    });
  });

  it('saves a schedule note and a calendar appointment', () => {
    const saved = handleReceptionApi({
      method: 'POST',
      action: 'schedule',
      body: {
        organizationId: 'org-1',
        notepad: 'Call Jane back about payroll.',
        appointment: { customerName: 'Jane Doe', department: 'payroll', startsAt: '2026-10-06T14:00:00.000Z', notes: 'Pay stub' },
      },
    }, { 'org-1': enabled() });
    expect(saved.org?.notepad).toBe('Call Jane back about payroll.');
    expect(saved.org?.appointments[0]?.customerName).toBe('Jane Doe');
    expect(saved.org?.appointments[0]?.department).toBe('payroll');
    const spoken = handleReceptionApi({
      method: 'POST',
      action: 'ingest',
      body: {
        organizationId: 'org-1',
        conversationId: 'conv-1',
        channel: 'web',
        transcript: [{ role: 'receptionist', text: 'How can I help?' }, { role: 'caller', text: 'Payroll, please.' }],
      },
    }, { 'org-1': saved.org! });
    expect(spoken.org?.calls[0]?.transcript.map((turn) => turn.role)).toEqual(['receptionist', 'caller']);
  });

  it('stores a text conversation through the API', () => {
    const first = handleReceptionApi({
      method: 'POST',
      action: 'save-settings',
      body: { organizationId: 'org-1', settings: { enabled: true, toolSecret: 'nope' } },
    }, {});
    expect(first.org?.enabled).toBe(true);
    expect(first.org?.toolSecret).not.toBe('nope');
    const talked = handleReceptionApi({
      method: 'POST',
      action: 'talk',
      body: { organizationId: 'org-1', text: 'Please take a message to call me back about payroll. I am Jane Doe, 416-555-0199', directory },
    }, { 'org-1': first.org! });
    expect(talked.org?.messages).toHaveLength(1);
    expect(talked.body.reply).toContain('Message saved');
    expect(nextOpenSlot(enabled(), now)).toContain('2026-10-05');
  });
});

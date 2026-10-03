import { syncElevenAgent, voiceCredentials } from './elevenlabs';
import {
  deskReply,
  emptyDirectory,
  emptyReceptionOrg,
  publicOrg,
  receptionAnalytics,
  runReceptionTool,
} from './engine';
import type { Directory, ReceptionOrg } from './types';

export interface ReceptionRequest {
  method: string;
  action: string;
  body: Record<string, unknown>;
}

export interface ReceptionContext {
  apiKey?: string;
  toolBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ReceptionResponse {
  status: number;
  body: Record<string, unknown>;
  org?: ReceptionOrg;
}

function orgFrom(store: Record<string, ReceptionOrg>, organizationId: string): ReceptionOrg {
  return store[organizationId] ?? emptyReceptionOrg(organizationId);
}

function directoryFrom(body: Record<string, unknown>): Directory {
  const directory = body.directory as Directory | undefined;
  if (!directory || !Array.isArray(directory.contacts)) return emptyDirectory();
  return {
    contacts: directory.contacts.map((contact) => ({
      id: String(contact.id ?? ''),
      name: String(contact.name ?? ''),
      email: contact.email ? String(contact.email) : null,
      phone: contact.phone ? String(contact.phone) : null,
      openInvoiceCount: Number(contact.openInvoiceCount ?? 0),
      openBalance: Number(contact.openBalance ?? 0),
      currency: String(contact.currency ?? 'CAD'),
    })),
    nextPayDate: directory.nextPayDate ? String(directory.nextPayDate) : null,
  };
}

export function handleReceptionApi(
  request: ReceptionRequest,
  store: Record<string, ReceptionOrg>,
  context: ReceptionContext = {},
): ReceptionResponse {
  const organizationId = String(request.body.organizationId ?? '');
  if (!organizationId) return { status: 400, body: { ok: false, error: 'organizationId is required.' } };
  const current = orgFrom(store, organizationId);
  const save = (org: ReceptionOrg, extra: Record<string, unknown> = {}): ReceptionResponse => ({
    status: 200,
    body: { ok: true, org: publicOrg(org), voiceReady: Boolean(context.apiKey && org.elevenAgentId), ...extra },
    org,
  });

  if (request.action === 'state') return save(current);
  if (request.action === 'analytics') return { status: 200, body: { ok: true, analytics: receptionAnalytics(current) } };

  if (request.action === 'save-settings') {
    const settings = (request.body.settings ?? {}) as Record<string, unknown>;
    const next = { ...current };
    for (const key of ['enabled', 'voiceId', 'voiceName', 'language', 'languages', 'personality', 'timezone', 'forwardingNumber', 'channels', 'notifyEmail'] as const) {
      if (key in settings) (next as unknown as Record<string, unknown>)[key] = settings[key];
    }
    return save(next);
  }

  if (request.action === 'replace-lists') {
    const next = { ...current };
    for (const key of ['receptionists', 'knowledge', 'routes', 'blocked'] as const) {
      if (Array.isArray(request.body[key])) next[key] = request.body[key] as never;
    }
    return save(next);
  }

  if (request.action === 'talk') {
    const result = deskReply(current, directoryFrom(request.body), String(request.body.text ?? ''), new Date());
    return save(result.org, { reply: result.reply, call: result.call });
  }

  if (request.action === 'tool') {
    const secret = String(request.body.secret ?? '');
    if (secret && secret !== current.toolSecret) return { status: 401, body: { ok: false, error: 'The receptionist tool secret does not match.' } };
    const result = runReceptionTool(current, directoryFrom(request.body), String(request.body.name ?? ''), (request.body.parameters as Record<string, unknown>) ?? {}, new Date());
    return save(result.org, { message: result.message });
  }

  if (request.action === 'ingest') {
    const transcript = Array.isArray(request.body.transcript) ? request.body.transcript : [];
    const next = { ...current, calls: [...current.calls] };
    next.calls.unshift({
      id: String(request.body.conversationId ?? crypto.randomUUID()),
      receptionistId: current.receptionists[0]?.id ?? '',
      channel: (request.body.channel as ReceptionOrg['calls'][number]['channel']) ?? 'phone',
      callerName: String(request.body.callerName ?? ''),
      callerPhone: String(request.body.callerPhone ?? ''),
      callerEmail: '',
      customerId: null,
      verified: false,
      intent: 'general',
      department: 'general',
      status: 'resolved',
      summary: String(request.body.summary ?? 'Call completed.'),
      transcript: transcript.map((turn) => ({
        role: (turn as { role?: string }).role === 'agent' ? 'receptionist' as const : 'caller' as const,
        text: String((turn as { message?: string; text?: string }).message ?? (turn as { text?: string }).text ?? ''),
        at: new Date().toISOString(),
      })),
      elevenConversationId: String(request.body.conversationId ?? ''),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    next.calls = next.calls.slice(0, 100);
    return save(next);
  }

  if (request.action === 'sync' || request.action === 'session') {
    if (!context.apiKey) {
      return { status: 200, body: { ok: true, org: publicOrg(current), voiceReady: false, error: 'Add ELEVENLABS_API_KEY on the server to connect the voice receptionist.' } };
    }
    return { status: 202, body: { ok: true, pending: request.action }, org: current };
  }

  return { status: 404, body: { ok: false, error: 'Unknown receptionist action.' } };
}

export async function handleReceptionVoice(
  action: 'sync' | 'session',
  org: ReceptionOrg,
  context: ReceptionContext,
): Promise<{ org: ReceptionOrg; body: Record<string, unknown> }> {
  if (!context.apiKey) {
    return { org, body: { ok: true, org: publicOrg(org), voiceReady: false, error: 'Add ELEVENLABS_API_KEY on the server to connect the voice receptionist.' } };
  }
  const client = { apiKey: context.apiKey, fetchImpl: context.fetchImpl };
  if (action === 'sync') {
    const agentId = await syncElevenAgent(org, client, context.toolBaseUrl);
    const next = { ...org, elevenAgentId: agentId };
    return { org: next, body: { ok: true, org: publicOrg(next), voiceReady: true, agentId } };
  }
  if (!org.elevenAgentId) {
    return { org, body: { ok: false, error: 'Sync the receptionist before starting a voice call.' } };
  }
  const credentials = await voiceCredentials(org.elevenAgentId, client);
  return { org, body: { ok: true, ...credentials, voiceReady: true } };
}

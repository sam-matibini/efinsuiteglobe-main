import { supabase } from '@/integrations/supabase/client';
import type { CraGatewayResult } from '../../../supabase/functions/_shared/cra-connection.ts';

export type { CraGatewayResult };

export interface CraConnectionInfo {
  representativeId: string | null;
  efileConfigured: boolean;
  efileNumberConfigured: boolean;
  cdeConfigured: boolean;
  nombaConfigured: boolean;
  loaded: boolean;
}

export const UNCONFIGURED_CONNECTION: CraConnectionInfo = {
  representativeId: null,
  efileConfigured: false,
  efileNumberConfigured: false,
  cdeConfigured: false,
  nombaConfigured: false,
  loaded: false,
};

export async function callCraGateway(body: Record<string, unknown>): Promise<CraGatewayResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, action: String(body.action ?? ''), error: 'Sign in before using the CRA gateway.' };
  try {
    const response = await fetch('/api/cra-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!result || typeof result !== 'object') {
      return { ok: false, action: String(body.action ?? ''), error: 'CRA gateway is unreachable.' };
    }
    return result as CraGatewayResult;
  } catch (error) {
    return {
      ok: false,
      action: String(body.action ?? ''),
      error: error instanceof Error ? error.message : 'CRA gateway is unreachable.',
    };
  }
}

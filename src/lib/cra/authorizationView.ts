import type { CraAuthorization } from './types';

export interface AuthorizationPresentation {
  label: string;
  badge: string;
  tone: 'authorized' | 'pending';
  representativeName: string;
}

/** How the connection card describes Represent a Client. A missing CRA balance is not the same as no representative. */
export function authorizationView(auth: CraAuthorization): AuthorizationPresentation {
  const representativeName = auth.representativeName?.trim() || '';
  if (auth.verifiedByCra && auth.status === 'connected') {
    return {
      label: 'Confirmed by CRA',
      badge: auth.level === 'level_2' ? 'Level 2' : 'Level 1',
      tone: 'authorized',
      representativeName,
    };
  }
  if (auth.status === 'connected' && representativeName) {
    return {
      label: 'Authorized representative',
      badge: 'Authorized',
      tone: 'authorized',
      representativeName,
    };
  }
  if (auth.status === 'pending_client_confirmation') {
    return {
      label: 'Pending client confirmation',
      badge: 'Pending',
      tone: 'pending',
      representativeName,
    };
  }
  if (auth.status === 'revoked') {
    return { label: 'Authorization revoked', badge: 'Revoked', tone: 'pending', representativeName };
  }
  if (auth.status === 'expired') {
    return { label: 'Authorization expired', badge: 'Expired', tone: 'pending', representativeName };
  }
  return { label: 'Not confirmed by CRA', badge: 'Not authorized', tone: 'pending', representativeName };
}

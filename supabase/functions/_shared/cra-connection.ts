/**
 * CRA gateway used by the Vite dev server and the cra-gateway edge function.
 * Firm software credentials come from the environment. Client CRA passwords are rejected.
 * A filing is accepted only when CRA returns HTTP 2xx and a confirmation.
 * A card payment is settled only when Nomba confirms a Visa or Mastercard charge.
 */
import { formatCraAmount, omitEmptyOptionalTags, schemaForTaxYear, t619Version, xmlEscape } from './cra-xml-utils.ts';

export type CraGatewayAction =
  | 'capabilities'
  | 'efile_submit'
  | 'efile_status'
  | 'cde_refresh'
  | 'payment_release'
  | 'payment_status';

export interface CraGatewayEnv {
  representativeId: string;
  efileNumber: string;
  efilePassword: string;
  efileTransmitUrl: string;
  efileStatusUrl: string;
  cdeUrl: string;
  nombaClientId: string;
  nombaClientSecret: string;
  nombaAccountId: string;
  nombaEnvironment: string;
  nombaCurrency: string;
  nombaCallbackUrl: string;
}

export interface CraBalancesPayload {
  gst_hst?: number;
  payroll?: number;
  corporate_tax?: number;
}

export interface CraGatewayResult {
  ok: boolean;
  action: string;
  error?: string;
  representativeId?: string | null;
  efileConfigured?: boolean;
  efileNumberConfigured?: boolean;
  cdeConfigured?: boolean;
  nombaConfigured?: boolean;
  checkoutUrl?: string | null;
  httpStatus?: number;
  body?: string;
  accepted?: boolean;
  confirmationNumber?: string | null;
  balances?: CraBalancesPayload | null;
  connected?: boolean;
  railStatus?: 'submitted' | 'processing' | 'accepted' | 'settled' | 'failed' | 'rejected' | null;
  railReference?: string | null;
  journalEntryId?: string | null;
  glError?: string | null;
  persisted?: boolean;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<FetchResponseLike>;

type QueryResult = { data: unknown; error: { message?: string } | null };

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns?: string): QueryBuilder;
  insert(values: unknown): QueryBuilder;
  upsert(values: unknown, options?: { onConflict?: string }): QueryBuilder;
  update(values: unknown): QueryBuilder;
  delete(): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  ilike(column: string, value: string): QueryBuilder;
  like(column: string, value: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
  single(): PromiseLike<QueryResult>;
}

export interface CraDb {
  from(table: string): QueryBuilder;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
}

const BLOCKED_KEYS = new Set([
  'password',
  'crapassword',
  'cra_password',
  'clientpassword',
  'client_password',
  'sin',
  'socialinsurance',
  'cardnumber',
  'pan',
  'cvv',
  'cvc',
  'cardcvv',
  'cardpin',
]);

/**
 * Internet File Transfer application published for the CRA IFT reference guide.
 * https://www.canada.ca/en/revenue-agency/services/e-services/filing-information-returns-electronically-t4-t5-other-types-returns-overview/ift-referenceguide.html
 * The previous upload address on /ebci/uisp/ returns 404. This NJFS disclaimer is the live entry point.
 */
export const CRA_INTERNET_FILE_TRANSFER_URL = 'https://apps.cra-arc.gc.ca/ebci/njfs/ext/disclaimer';

export function craEnvFrom(read: (key: string) => string | undefined): CraGatewayEnv {
  return {
    representativeId: (read('CRA_REPRESENTATIVE_ID') ?? '').trim(),
    efileNumber: (read('CRA_EFILE_NUMBER') ?? '').trim(),
    efilePassword: read('CRA_EFILE_PASSWORD') ?? '',
    efileTransmitUrl: (read('CRA_EFILE_TRANSMIT_URL') ?? '').trim(),
    efileStatusUrl: (read('CRA_EFILE_STATUS_URL') ?? '').trim(),
    cdeUrl: (read('CRA_CDE_URL') ?? '').trim() || CRA_INTERNET_FILE_TRANSFER_URL,
    nombaClientId: (read('NOMBA_CLIENT_ID') ?? '').trim(),
    nombaClientSecret: read('NOMBA_CLIENT_SECRET') ?? '',
    nombaAccountId: (read('NOMBA_ACCOUNT_ID') ?? '').trim(),
    nombaEnvironment: (read('NOMBA_ENVIRONMENT') ?? '').trim(),
    nombaCurrency: (read('NOMBA_CURRENCY') ?? '').trim(),
    nombaCallbackUrl: (read('NOMBA_CALLBACK_URL') ?? '').trim(),
  };
}

export interface CraFirmSettings {
  representativeId: string;
  efileNumber: string;
  efilePassword: string;
}

/** Admin-portal values replace server env when they are non-empty. */
export function applyCraFirmSettings(env: CraGatewayEnv, firm: CraFirmSettings | null | undefined): CraGatewayEnv {
  if (!firm) return env;
  return {
    ...env,
    representativeId: firm.representativeId.trim() || env.representativeId,
    efileNumber: firm.efileNumber.trim() || env.efileNumber,
    efilePassword: firm.efilePassword || env.efilePassword,
  };
}

export function parseCraFirmSettings(data: unknown): CraFirmSettings | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const representativeId = typeof record.representative_id === 'string' ? record.representative_id.trim() : '';
  const efileNumber = typeof record.efile_number === 'string' ? record.efile_number.trim() : '';
  const efilePassword = typeof record.efile_password === 'string' ? record.efile_password : '';
  if (!representativeId && !efileNumber && !efilePassword) return null;
  return { representativeId, efileNumber, efilePassword };
}

/** Firm software credentials saved by a platform admin. Empty when the caller cannot read them. */
export async function readCraFirmSettings(db: CraDb): Promise<CraFirmSettings | null> {
  try {
    const { data, error } = await db.rpc('gateway_cra_firm_settings', {});
    if (!error) return parseCraFirmSettings(data);
  } catch {
    // The settings function is not installed yet. Try the admin settings row.
  }
  try {
    const { data, error } = await db.from('platform_settings').select('setting_value').eq('setting_key', 'cra_firm_settings').limit(1);
    if (error || !data) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') return null;
    const value = (row as { setting_value?: unknown }).setting_value;
    return parseCraFirmSettings(value);
  } catch {
    return null;
  }
}

export function parseCraConfirmation(body: string): string | null {
  const text = body ?? '';
  if (!text.trim()) return null;
  const fromJson = confirmationFromJson(text);
  if (fromJson) return fromJson;
  const patterns = [
    /<(?:\w+:)?ConfirmationNumber[^>]*>([^<]+)<\/(?:\w+:)?ConfirmationNumber>/i,
    /<(?:\w+:)?confirmationNumber[^>]*>([^<]+)<\/(?:\w+:)?confirmationNumber>/i,
    /<(?:\w+:)?formBundleNumber[^>]*>([^<]+)<\/(?:\w+:)?formBundleNumber>/i,
    /Confirmation number[:\s#]+([A-Za-z0-9][A-Za-z0-9-]{5,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanConfirmation(match?.[1] ?? '');
    if (value) return value;
  }
  return null;
}

export function efileDecision(httpStatus: number, body: string): { accepted: boolean; confirmationNumber: string | null } {
  const confirmationNumber = parseCraConfirmation(body);
  const accepted = httpStatus >= 200 && httpStatus < 300 && Boolean(confirmationNumber);
  return { accepted, confirmationNumber: accepted ? confirmationNumber : confirmationNumber };
}

export async function handleCraGateway(
  action: string,
  payload: Record<string, unknown>,
  env: CraGatewayEnv,
  fetchImpl: FetchLike,
): Promise<CraGatewayResult> {
  if (containsBlockedSecret(payload)) {
    return { ok: false, action, error: 'Client CRA passwords and card numbers are not accepted. Visa and Mastercard are entered on Nomba Checkout.' };
  }
  if (action === 'capabilities') return capabilities(env);
  if (action === 'efile_submit') return transmitEfile(payload, env, fetchImpl);
  if (action === 'efile_status') return efileStatus(payload, env, fetchImpl);
  if (action === 'cde_refresh') return refreshCde(payload, env, fetchImpl);
  if (action === 'payment_release') return releaseNombaCard(payload, env, fetchImpl);
  if (action === 'payment_status') return nombaCardStatus(payload, env, fetchImpl);
  return { ok: false, action, error: 'Unknown CRA gateway action.' };
}

export async function callerMayUseGateway(
  db: CraDb,
  userId: string,
  action: string,
  organizationId: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (action === 'capabilities') return { ok: true };
  if (typeof organizationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return { ok: false, error: 'Choose an organization before using the CRA gateway.' };
  }
  try {
    const { data, error } = await db.rpc('is_org_member', { _user_id: userId, _org_id: organizationId });
    if (error || data !== true) return { ok: false, error: 'You are not a member of this organization.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Organization membership could not be verified.' };
  }
}

export async function finalizeCraGateway(
  db: CraDb,
  payload: Record<string, unknown>,
  result: CraGatewayResult,
  firm?: CraFirmSettings | null,
): Promise<CraGatewayResult> {
  const next: CraGatewayResult = { ...result, persisted: false, journalEntryId: result.journalEntryId ?? null, glError: result.glError ?? null };
  if (result.action === 'capabilities') return { ...next, persisted: false };
  const organizationId = typeof payload.organizationId === 'string' ? payload.organizationId : '';
  if (!organizationId) return next;
  try {
    if (result.action === 'efile_submit' || result.action === 'efile_status') {
      next.persisted = await persistSubmission(db, organizationId, payload, result);
    } else if (result.action === 'payment_release' || result.action === 'payment_status') {
      next.persisted = await persistPayment(db, organizationId, payload, result, firm);
      if (result.railStatus && result.ok) {
        const posted = await postPaymentJournals(db, organizationId, payload, result);
        next.journalEntryId = posted.journalEntryId;
        next.glError = posted.glError;
      }
    } else if (result.action === 'cde_refresh' && result.ok && result.connected) {
      next.persisted = await persistAuthorization(db, organizationId, result.representativeId || text(payload.representativeId));
    }
  } catch (error) {
    next.persisted = false;
    next.glError = next.glError ?? clip(error instanceof Error ? error.message : 'CRA records could not be saved.');
  }
  return next;
}

export function buildEfileXml(input: {
  submissionId: string;
  businessNumber: string;
  legalName: string;
  taxYear: string;
  returnType: string;
  account: string;
  representativeId: string;
  efileNumber: string;
  amounts: Record<string, number>;
}): string {
  const year = Number(input.taxYear) || new Date().getFullYear();
  const schemaYear = schemaForTaxYear(year);
  const net = money(input.amounts.net);
  const lines = returnLines(input.returnType, input.amounts, net);
  return omitEmptyOptionalTags(`<?xml version="1.0" encoding="UTF-8"?>
<Submission xmlns="http://www.cra-arc.gc.ca/efile" schemaVersion="${schemaYear}">
  <T619 version="${xmlEscape(t619Version(schemaYear))}">
    <sbmt_ref_id>${xmlEscape(input.submissionId)}</sbmt_ref_id>
    <rpt_tcd>O</rpt_tcd>
    <trnmtr_nbr>${xmlEscape(input.efileNumber)}</trnmtr_nbr>
    <trnmtr_tcd>3</trnmtr_tcd>
    <summ_cnt>1</summ_cnt>
    <lang_cd>E</lang_cd>
    <TransmitterName>${xmlEscape(input.legalName)}</TransmitterName>
    <TransmitterBN>${xmlEscape(input.businessNumber)}</TransmitterBN>
    <RepresentativeId>${xmlEscape(input.representativeId)}</RepresentativeId>
  </T619>
  <Return type="${xmlEscape(input.returnType)}">
    <BusinessNumber>${xmlEscape(input.businessNumber)}</BusinessNumber>
    <ProgramAccount>${xmlEscape(input.account)}</ProgramAccount>
    <TaxYear>${xmlEscape(input.taxYear)}</TaxYear>
    ${lines}
    <NetTax>${formatCraAmount(net)}</NetTax>
  </Return>
</Submission>`);
}

function capabilities(env: CraGatewayEnv): CraGatewayResult {
  const signedIn = Boolean(env.efileNumber && env.efilePassword);
  return {
    ok: true,
    action: 'capabilities',
    representativeId: env.representativeId || null,
    efileNumberConfigured: Boolean(env.efileNumber),
    efileConfigured: Boolean(signedIn && env.efileTransmitUrl),
    cdeConfigured: Boolean(signedIn && env.cdeUrl && env.representativeId),
    nombaConfigured: Boolean(env.nombaClientId && env.nombaClientSecret && env.nombaAccountId),
  };
}

async function transmitEfile(payload: Record<string, unknown>, env: CraGatewayEnv, fetchImpl: FetchLike): Promise<CraGatewayResult> {
  const action = 'efile_submit';
  const setupError = efileSetupError(env, ['number', 'password', 'transmit']);
  if (setupError) return { ok: false, action, accepted: false, httpStatus: 0, body: '', error: setupError };
  const urlError = assertCraServiceUrl(env.efileTransmitUrl);
  if (urlError) return { ok: false, action, accepted: false, httpStatus: 0, body: '', error: urlError };
  const businessNumber = text(payload.businessNumber);
  if (!/^\d{9}$/.test(businessNumber)) {
    return { ok: false, action, accepted: false, httpStatus: 0, body: '', error: 'A 9-digit business number is required before EFILE transmission.' };
  }
  const xml = buildEfileXml({
    submissionId: text(payload.submissionId) || 'unassigned',
    businessNumber,
    legalName: text(payload.legalName),
    taxYear: text(payload.taxYear),
    returnType: text(payload.returnType) || 'GST34',
    account: text(payload.account),
    representativeId: env.representativeId,
    efileNumber: env.efileNumber,
    amounts: numberMap(payload.amounts),
  });
  return postForConfirmation(action, env.efileTransmitUrl, xml, 'application/xml', env, fetchImpl);
}

async function efileStatus(payload: Record<string, unknown>, env: CraGatewayEnv, fetchImpl: FetchLike): Promise<CraGatewayResult> {
  const action = 'efile_status';
  const setupError = efileSetupError(env, ['number', 'password', 'status']);
  if (setupError) return { ok: false, action, accepted: false, httpStatus: 0, body: '', error: setupError };
  const urlError = assertCraServiceUrl(env.efileStatusUrl);
  if (urlError) return { ok: false, action, accepted: false, httpStatus: 0, body: '', error: urlError };
  const body = JSON.stringify({
    submissionId: text(payload.submissionId),
    businessNumber: text(payload.businessNumber),
    returnType: text(payload.returnType),
    representativeId: env.representativeId,
  });
  return postForConfirmation(action, env.efileStatusUrl, body, 'application/json', env, fetchImpl);
}

async function postForConfirmation(
  action: string,
  url: string,
  body: string,
  contentType: string,
  env: CraGatewayEnv,
  fetchImpl: FetchLike,
): Promise<CraGatewayResult> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(env.efileNumber, env.efilePassword),
        'Content-Type': contentType,
        Accept: 'application/xml, application/json, text/plain',
      },
      body,
    });
    const responseBody = await response.text();
    const decision = efileDecision(response.status, responseBody);
    if (!response.ok) {
      return {
        ok: false,
        action,
        httpStatus: response.status,
        body: clip(responseBody),
        accepted: false,
        confirmationNumber: null,
        error: `CRA returned HTTP ${response.status}. The return was not accepted.`,
      };
    }
    if (!decision.accepted) {
      return {
        ok: false,
        action,
        httpStatus: response.status,
        body: clip(responseBody),
        accepted: false,
        confirmationNumber: null,
        error: 'CRA did not return a confirmation number. The return was not accepted.',
      };
    }
    return {
      ok: true,
      action,
      httpStatus: response.status,
      body: clip(responseBody),
      accepted: true,
      confirmationNumber: decision.confirmationNumber,
    };
  } catch (error) {
    return {
      ok: false,
      action,
      accepted: false,
      httpStatus: 0,
      body: '',
      error: `CRA transmission failed. ${clip(error instanceof Error ? error.message : 'The endpoint did not respond.')}`,
    };
  }
}

async function refreshCde(payload: Record<string, unknown>, env: CraGatewayEnv, fetchImpl: FetchLike): Promise<CraGatewayResult> {
  const action = 'cde_refresh';
  const missing = [
    !env.representativeId ? 'CRA_REPRESENTATIVE_ID' : '',
    !env.efileNumber ? 'CRA_EFILE_NUMBER' : '',
    !env.efilePassword ? 'CRA_EFILE_PASSWORD' : '',
    !env.cdeUrl ? 'CRA_CDE_URL' : '',
  ].filter(Boolean);
  if (missing.length) {
    return {
      ok: false,
      action,
      connected: false,
      balances: null,
      error: `CRA Client Data Enquiry is not configured. Still missing ${missing.join(', ')}. The enquiry address comes from the CRA certification kit. Balances were not refreshed.`,
    };
  }
  const urlError = assertCraServiceUrl(env.cdeUrl);
  if (urlError) return { ok: false, action, connected: false, balances: null, error: urlError };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, application/xml, text/plain' };
  if (env.efileNumber && env.efilePassword) headers.Authorization = basicAuth(env.efileNumber, env.efilePassword);
  try {
    const response = await fetchImpl(env.cdeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        businessNumber: text(payload.businessNumber),
        programs: Array.isArray(payload.programs) ? payload.programs : [],
        representativeId: env.representativeId,
        legalName: text(payload.legalName),
      }),
    });
    const body = await response.text();
    if (!response.ok) {
      return { ok: false, action, httpStatus: response.status, body: clip(body), connected: false, balances: null, error: `CRA Client Data Enquiry returned HTTP ${response.status}. Balances were not changed.` };
    }
    const parsed = parseCdeBody(body);
    if (!parsed.balances && !parsed.connected) {
      const ift = env.cdeUrl.startsWith(CRA_INTERNET_FILE_TRANSFER_URL);
      return {
        ok: false,
        action,
        httpStatus: response.status,
        body: clip(body),
        connected: false,
        balances: null,
        error: ift
          ? 'CRA Internet File Transfer did not return account balances. The amounts on this page were not changed.'
          : 'CRA did not return account data.',
      };
    }
    return {
      ok: true,
      action,
      httpStatus: response.status,
      body: clip(body),
      balances: parsed.balances,
      connected: parsed.connected,
      representativeId: env.representativeId,
    };
  } catch (error) {
    return { ok: false, action, connected: false, balances: null, error: `CRA Client Data Enquiry failed. ${clip(error instanceof Error ? error.message : 'The endpoint did not respond.')}` };
  }
}

async function releaseNombaCard(payload: Record<string, unknown>, env: CraGatewayEnv, fetchImpl: FetchLike): Promise<CraGatewayResult> {
  const action = 'payment_release';
  if (!env.nombaClientId || !env.nombaClientSecret || !env.nombaAccountId) {
    return { ok: false, action, railStatus: null, error: 'Nomba card payments are not configured. Set NOMBA_CLIENT_ID, NOMBA_CLIENT_SECRET, and NOMBA_ACCOUNT_ID. The payment stays authorized.' };
  }
  const amount = typeof payload.amount === 'number' ? payload.amount : Number.NaN;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, action, railStatus: null, error: 'The payment amount is not valid. The payment stays authorized.' };
  }
  const email = text(payload.customerEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, action, railStatus: null, error: 'A customer email is required before Nomba can open card checkout. The payment stays authorized.' };
  }
  const callback = text(payload.callbackUrl) || env.nombaCallbackUrl;
  const callbackError = callback ? assertHttps(callback) : 'NOMBA_CALLBACK_URL is required so Nomba can return the payer to eFinsuite.';
  if (callbackError) return { ok: false, action, railStatus: null, error: `${callbackError} The payment stays authorized.` };
  const paymentId = text(payload.paymentId) || 'cra-payment';
  try {
    const token = await issueNombaToken(env, fetchImpl);
    if (!token.token) return { ok: false, action, railStatus: null, error: token.error || 'Nomba did not issue an access token. The payment stays authorized.' };
    const response = await fetchImpl(`${nombaBase(env)}/v1/checkout/order`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.token}`,
        accountId: env.nombaAccountId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        order: {
          orderReference: paymentId.slice(0, 64),
          callbackUrl: callback,
          customerEmail: email,
          amount: Math.round(amount * 100) / 100,
          currency: (env.nombaCurrency || 'CAD').toUpperCase(),
          allowedPaymentMethods: ['Card'],
        },
        tokenizeCard: false,
      }),
    });
    const body = await response.text();
    const parsed = parseNombaCheckout(body);
    if (!response.ok || parsed.code !== '00' || !parsed.checkoutUrl || !parsed.orderReference) {
      return { ok: false, action, httpStatus: response.status, body: clip(body), railStatus: null, error: 'Nomba did not open a Visa or Mastercard checkout. The payment stays authorized.' };
    }
    return {
      ok: true,
      action,
      httpStatus: response.status,
      body: clip(body),
      railStatus: 'submitted',
      railReference: parsed.orderReference,
      checkoutUrl: parsed.checkoutUrl,
    };
  } catch (error) {
    return { ok: false, action, railStatus: null, error: `Nomba did not respond. The payment stays authorized. ${clip(error instanceof Error ? error.message : '')}` };
  }
}

async function nombaCardStatus(payload: Record<string, unknown>, env: CraGatewayEnv, fetchImpl: FetchLike): Promise<CraGatewayResult> {
  const action = 'payment_status';
  const merchantReference = text(payload.paymentId);
  const railReference = text(payload.railReference);
  if (!merchantReference && !railReference) {
    return { ok: false, action, railStatus: null, error: 'This payment has no Nomba order. It has not been sent to card checkout.' };
  }
  if (!env.nombaClientId || !env.nombaClientSecret || !env.nombaAccountId) {
    return { ok: false, action, railStatus: null, error: 'Nomba card payments are not configured. The payment status was not changed.' };
  }
  try {
    const token = await issueNombaToken(env, fetchImpl);
    if (!token.token) return { ok: false, action, railStatus: null, error: token.error || 'Nomba did not issue an access token. The payment status was not changed.' };
    const query = merchantReference
      ? `orderReference=${encodeURIComponent(merchantReference.slice(0, 64))}`
      : `orderId=${encodeURIComponent(railReference)}`;
    const response = await fetchImpl(`${nombaBase(env)}/v1/transactions/accounts/single?${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.token}`,
        accountId: env.nombaAccountId,
        Accept: 'application/json',
      },
    });
    const body = await response.text();
    const parsed = parseNombaPayment(body);
    if (!response.ok || parsed.code !== '00') {
      return { ok: false, action, httpStatus: response.status, body: clip(body), railStatus: null, railReference, error: 'Nomba has not confirmed this card payment. It stays unpaid.' };
    }
    if (parsed.railStatus === 'settled' && !parsed.visaOrMastercard) {
      return { ok: false, action, httpStatus: response.status, body: clip(body), railStatus: null, railReference: parsed.railReference || railReference, error: 'Nomba did not confirm a Visa or Mastercard payment. The remittance was not marked settled.' };
    }
    if (!parsed.railStatus) {
      return { ok: false, action, httpStatus: response.status, body: clip(body), railStatus: null, railReference: parsed.railReference || railReference, error: 'Nomba did not return a card payment status. The payment was not changed.' };
    }
    return { ok: true, action, httpStatus: response.status, body: clip(body), railStatus: parsed.railStatus, railReference: parsed.railReference || railReference };
  } catch (error) {
    return { ok: false, action, railStatus: null, error: `Nomba status failed. ${clip(error instanceof Error ? error.message : 'The endpoint did not respond.')}` };
  }
}

async function issueNombaToken(env: CraGatewayEnv, fetchImpl: FetchLike): Promise<{ token: string | null; error?: string }> {
  const response = await fetchImpl(`${nombaBase(env)}/v1/auth/token/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accountId: env.nombaAccountId, Accept: 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: env.nombaClientId, client_secret: env.nombaClientSecret }),
  });
  const body = await response.text();
  if (!response.ok) return { token: null, error: `Nomba authentication failed (HTTP ${response.status}).` };
  try {
    const parsed = JSON.parse(body) as { code?: string; data?: { access_token?: string } };
    const token = parsed.data?.access_token ?? '';
    if (parsed.code !== '00' || !token) return { token: null, error: 'Nomba did not issue an access token.' };
    return { token };
  } catch {
    return { token: null, error: 'Nomba authentication did not return a token.' };
  }
}

function parseNombaCheckout(body: string): { code: string; checkoutUrl: string | null; orderReference: string | null } {
  try {
    const parsed = JSON.parse(body) as { code?: string; data?: { checkoutLink?: string; orderReference?: string } };
    const link = parsed.data?.checkoutLink ?? '';
    const reference = parsed.data?.orderReference ?? '';
    const checkoutUrl = link.startsWith('https://') ? link : null;
    return { code: parsed.code ?? '', checkoutUrl, orderReference: reference || null };
  } catch {
    return { code: '', checkoutUrl: null, orderReference: null };
  }
}

function parseNombaPayment(body: string): { code: string; railStatus: CraGatewayResult['railStatus']; railReference: string | null; visaOrMastercard: boolean } {
  try {
    const parsed = JSON.parse(body) as { code?: string; data?: Record<string, unknown> | null };
    const data = parsed.data ?? {};
    const status = typeof data.status === 'string' ? data.status.toUpperCase() : '';
    const id = typeof data.id === 'string' ? data.id : '';
    return {
      code: parsed.code ?? '',
      railStatus: mapNombaStatus(status),
      railReference: id || null,
      visaOrMastercard: isVisaOrMastercard(data),
    };
  } catch {
    return { code: '', railStatus: null, railReference: null, visaOrMastercard: false };
  }
}

function mapNombaStatus(status: string): CraGatewayResult['railStatus'] {
  if (status === 'SUCCESS') return 'settled';
  if (status === 'PENDING' || status === 'PROCESSING' || status === 'NEW') return 'processing';
  if (status === 'FAILED' || status === 'REVERSED') return 'failed';
  if (status === 'CANCELLED' || status === 'CANCELED' || status === 'EXPIRED') return 'rejected';
  return null;
}

function isVisaOrMastercard(data: Record<string, unknown>): boolean {
  const method = String(data.onlineCheckoutPaymentMethod ?? data.paymentMethod ?? '').toLowerCase();
  const cardType = String(data.cardType ?? cardTypeFrom(data) ?? '').toLowerCase();
  if (method.includes('transfer') || method.includes('ussd') || method.includes('momo') || method.includes('qr')) return false;
  if (cardType.includes('verve')) return false;
  if (cardType.includes('visa') || cardType.includes('mastercard') || cardType.includes('master card')) return true;
  return method.includes('card');
}

function cardTypeFrom(data: Record<string, unknown>): string {
  const details = data.cardDetails;
  if (!details || typeof details !== 'object') return '';
  const cardType = (details as { cardType?: unknown }).cardType;
  return typeof cardType === 'string' ? cardType : '';
}

export function parseCdeBody(body: string): { balances: CraBalancesPayload | null; connected: boolean } {
  let record: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === 'object') record = parsed as Record<string, unknown>;
  } catch {
    record = null;
  }
  if (!record) return { balances: null, connected: false };
  const source = record.balances && typeof record.balances === 'object' ? (record.balances as Record<string, unknown>) : record;
  const balances: CraBalancesPayload = {};
  const gst = firstNumber(source, ['gst_hst', 'gstHst', 'GST', 'RT']);
  const payroll = firstNumber(source, ['payroll', 'RP', 'sourceDeductions']);
  const corporate = firstNumber(source, ['corporate_tax', 'corporateTax', 'RC']);
  if (gst !== null) balances.gst_hst = gst;
  if (payroll !== null) balances.payroll = payroll;
  if (corporate !== null) balances.corporate_tax = corporate;
  const hasBalances = gst !== null || payroll !== null || corporate !== null;
  const status = typeof record.authorizationStatus === 'string' ? record.authorizationStatus.toLowerCase() : '';
  const connected = record.connected === true || record.representativeAuthorized === true || status === 'connected';
  return { balances: hasBalances ? balances : null, connected };
}

async function persistSubmission(db: CraDb, organizationId: string, payload: Record<string, unknown>, result: CraGatewayResult): Promise<boolean> {
  const id = text(payload.submissionId);
  if (!id) return false;
  const { error } = await db.from('cra_tax_efile_submissions').upsert({
    id,
    organization_id: organizationId,
    client_bn: text(payload.businessNumber),
    tax_year: text(payload.taxYear),
    return_type: text(payload.returnType) || 'GST34',
    submitted_at: new Date().toISOString(),
    cra_response: result.accepted ? 'Accepted' : result.error ?? 'Not accepted',
    confirmation_number: result.accepted ? result.confirmationNumber : null,
    errors: result.accepted ? [] : [result.error ?? 'Not accepted'],
    status: result.accepted ? 'accepted' : 'submitted',
    obligation_id: text(payload.obligationId) || null,
  }, { onConflict: 'id' });
  return !error;
}

async function persistPayment(
  db: CraDb,
  organizationId: string,
  payload: Record<string, unknown>,
  result: CraGatewayResult,
  firm?: CraFirmSettings | null,
): Promise<boolean> {
  const id = text(payload.paymentId);
  if (!id) return false;
  const row = {
    id,
    organization_id: organizationId,
    tax_type: text(payload.taxType) || 'gst_hst',
    cra_account: text(payload.account) || 'RT0001',
    amount: typeof payload.amount === 'number' ? payload.amount : 0,
    payment_date: text(payload.paymentDate) || new Date().toISOString().slice(0, 10),
    due_date: text(payload.dueDate) || new Date().toISOString().slice(0, 10),
    funding_account: text(payload.fundingAccount) || 'eFinsuite CAD Wallet',
    purpose: text(payload.purpose) || 'CRA remittance',
    status: result.railStatus || text(payload.paymentStatus) || 'authorized',
    prepared_by: text(payload.preparedBy) || 'unknown',
    approved_by: text(payload.approvedBy) || null,
    released_at: result.railStatus ? new Date().toISOString() : null,
    rail_reference: result.railReference ?? null,
    journal_entry_id: null,
    failure_reason: result.ok ? null : result.error ?? null,
  };
  const withFirm = {
    ...row,
    representative_id: firm?.representativeId || null,
    efile_number: firm?.efileNumber || null,
  };
  const { error } = await db.from('cra_tax_centre_payments').upsert(withFirm, { onConflict: 'id' });
  if (!error) return true;
  if (!/representative_id|efile_number/i.test(error.message ?? '')) return false;
  const again = await db.from('cra_tax_centre_payments').upsert(row, { onConflict: 'id' });
  return !again.error;
}

async function persistAuthorization(db: CraDb, organizationId: string, representativeId: string): Promise<boolean> {
  const { error } = await db.from('cra_tax_authorizations').upsert({
    organization_id: organizationId,
    status: 'connected',
    representative_id: representativeId || 'configured',
    authorization_level: 'level_2',
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'organization_id' });
  return !error;
}

async function postPaymentJournals(
  db: CraDb,
  organizationId: string,
  payload: Record<string, unknown>,
  result: CraGatewayResult,
): Promise<{ journalEntryId: string | null; glError: string | null }> {
  const amount = typeof payload.amount === 'number' ? payload.amount : 0;
  const taxType = text(payload.taxType) || 'gst_hst';
  const alreadyPosted = text(payload.journalEntryId);
  const currentStatus = text(payload.paymentStatus);
  try {
    const liability = await findLiability(db, organizationId, taxType);
    const clearing = await findNamed(db, organizationId, '%CRA Clearing%');
    const funding = await findNamed(db, organizationId, '%wallet%') ?? await findNamed(db, organizationId, '%bank%');
    if (!liability || !clearing) {
      return { journalEntryId: alreadyPosted || null, glError: 'The general ledger has no tax payable or CRA Clearing account for this organization.' };
    }
    let journalEntryId = alreadyPosted || null;
    if (!alreadyPosted) {
      const accrual = await insertJournal(db, organizationId, `CRA accrual ${text(payload.paymentId)}`, [
        { account_id: liability, debit: amount, credit: 0, description: 'Accrue CRA remittance' },
        { account_id: clearing, debit: 0, credit: amount, description: 'CRA clearing' },
      ]);
      if (accrual.error || !accrual.id) return { journalEntryId: null, glError: accrual.error ?? 'The accrual journal could not be posted.' };
      journalEntryId = accrual.id;
    }
    if (result.railStatus === 'settled' && currentStatus !== 'settled' && currentStatus !== 'confirmed') {
      if (!funding) return { journalEntryId, glError: 'The general ledger has no wallet or bank account to settle this CRA payment.' };
      const settlement = await insertJournal(db, organizationId, `CRA settlement ${text(payload.paymentId)}`, [
        { account_id: clearing, debit: amount, credit: 0, description: 'Clear CRA settlement' },
        { account_id: funding, debit: 0, credit: amount, description: 'Fund CRA payment' },
      ]);
      if (settlement.error || !settlement.id) return { journalEntryId, glError: settlement.error ?? 'The settlement journal could not be posted.' };
      journalEntryId = settlement.id;
    }
    return { journalEntryId, glError: null };
  } catch (error) {
    return { journalEntryId: alreadyPosted || null, glError: clip(error instanceof Error ? error.message : 'The general ledger post failed.') };
  }
}

async function findLiability(db: CraDb, organizationId: string, taxType: string): Promise<string | null> {
  const prefixes = taxType === 'payroll' ? ['2-2', '2-20'] : taxType === 'corporate_tax' ? ['2-4', '2-40'] : ['2-3', '2-30'];
  for (const prefix of prefixes) {
    const id = await firstId(db.from('accounts').select('id').eq('organization_id', organizationId).eq('account_type', 'liability').eq('is_active', true).ilike('code', `${prefix}%`).limit(1));
    if (id) return id;
  }
  const keyword = taxType === 'payroll' ? '%payroll%' : taxType === 'corporate_tax' ? '%corporate tax%' : '%gst%';
  return firstId(db.from('accounts').select('id').eq('organization_id', organizationId).eq('account_type', 'liability').eq('is_active', true).ilike('name', keyword).limit(1));
}

async function findNamed(db: CraDb, organizationId: string, pattern: string): Promise<string | null> {
  return firstId(db.from('accounts').select('id').eq('organization_id', organizationId).eq('is_active', true).ilike('name', pattern).limit(1));
}

async function firstId(query: QueryBuilder): Promise<string | null> {
  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { id?: unknown };
  return typeof row.id === 'string' ? row.id : null;
}

async function insertJournal(
  db: CraDb,
  organizationId: string,
  description: string,
  lines: Array<{ account_id: string; debit: number; credit: number; description: string }>,
): Promise<{ id: string | null; error: string | null }> {
  const reference = `JE-CRA-${Date.now().toString().slice(-8)}`;
  const created = await db.from('journal_entries').insert({
    organization_id: organizationId,
    entry_date: new Date().toISOString().slice(0, 10),
    reference,
    description,
    journal_type: 'manual',
    status: 'draft',
  }).select('id').single();
  const createdRow = created.data as { id?: unknown } | null;
  const id = createdRow && typeof createdRow.id === 'string' ? createdRow.id : null;
  if (created.error || !id) return { id: null, error: created.error?.message ?? 'Journal entry was not created.' };
  const lined = await db.from('journal_entry_lines').insert(lines.map((line, index) => ({
    journal_entry_id: id,
    account_id: line.account_id,
    debit: line.debit,
    credit: line.credit,
    description: line.description,
    line_order: index,
  })));
  if (lined.error) {
    await db.from('journal_entries').delete().eq('id', id);
    return { id: null, error: lined.error.message ?? 'Journal lines were not created.' };
  }
  const posted = await db.from('journal_entries').update({ status: 'posted' }).eq('id', id);
  if (posted.error) return { id, error: posted.error.message ?? 'Journal entry could not be posted.' };
  return { id, error: null };
}

function returnLines(returnType: string, amounts: Record<string, number>, net: number): string {
  if (returnType === 'GST34') {
    return `<Collected>${formatCraAmount(money(amounts.collected))}</Collected><InputTaxCredits>${formatCraAmount(money(amounts.itcs))}</InputTaxCredits>`;
  }
  if (returnType === 'PD7A') {
    return `<CPP>${formatCraAmount(money(amounts.cpp))}</CPP><EI>${formatCraAmount(money(amounts.ei))}</EI><IncomeTax>${formatCraAmount(money(amounts.incomeTax))}</IncomeTax>`;
  }
  if (returnType === 'T2') {
    return `<Balance>${formatCraAmount(money(amounts.balance))}</Balance><Installments>${formatCraAmount(money(amounts.installments))}</Installments>`;
  }
  return `<Amount>${formatCraAmount(net)}</Amount>`;
}

function confirmationFromJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return findConfirmation(parsed);
  } catch {
    return null;
  }
}

function findConfirmation(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['ConfirmationNumber', 'confirmationNumber', 'formBundleNumber', 'confirmation']) {
    if (typeof record[key] === 'string') {
      const cleaned = cleanConfirmation(record[key] as string);
      if (cleaned) return cleaned;
    }
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === 'object') {
      const found = findConfirmation(nested);
      if (found) return found;
    }
  }
  return null;
}

function cleanConfirmation(value: string): string | null {
  const cleaned = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{5,}$/.test(cleaned)) return null;
  return cleaned;
}

function containsBlockedSecret(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(key.toLowerCase().replace(/[^a-z_]/g, ''))) return true;
    if (nested && typeof nested === 'object' && containsBlockedSecret(nested)) return true;
  }
  return false;
}

function efileSetupError(env: CraGatewayEnv, need: Array<'number' | 'password' | 'transmit' | 'status'>): string | null {
  const missing = [
    need.includes('number') && !env.efileNumber ? 'CRA_EFILE_NUMBER' : '',
    need.includes('password') && !env.efilePassword ? 'CRA_EFILE_PASSWORD' : '',
    need.includes('transmit') && !env.efileTransmitUrl ? 'CRA_EFILE_TRANSMIT_URL' : '',
    need.includes('status') && !env.efileStatusUrl ? 'CRA_EFILE_STATUS_URL' : '',
  ].filter(Boolean);
  if (!missing.length) return null;
  return `CRA EFILE is not configured. Still missing ${missing.join(', ')}. The transmit and status addresses come from the CRA certification kit. The return was not accepted.`;
}

function assertCraServiceUrl(url: string): string | null {
  const httpsError = assertHttps(url);
  if (httpsError) return httpsError;
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'The CRA endpoint URL is invalid.';
  }
  const government = host === 'gc.ca' || host.endsWith('.gc.ca') || host === 'canada.ca' || host.endsWith('.canada.ca');
  if (!government) return 'CRA filing and Client Data Enquiry only call an https address on gc.ca. The request was not sent.';
  return null;
}

function assertHttps(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return null;
    if (parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) return null;
    return 'CRA and Nomba endpoints must use HTTPS.';
  } catch {
    return 'The CRA endpoint URL is invalid.';
  }
}

function nombaBase(env: CraGatewayEnv): string {
  return env.nombaEnvironment === 'live' ? 'https://api.nomba.com' : 'https://sandbox.nomba.com';
}

function basicAuth(user: string, password: string): string {
  return `Basic ${encodeBase64(`${user}:${password}`)}`;
}

function encodeBase64(value: string): string {
  const scope = globalThis as {
    Buffer?: { from(input: string, encoding: string): { toString(encoding: string): string } };
    btoa?: (input: string) => string;
  };
  if (scope.Buffer) return scope.Buffer.from(value, 'utf8').toString('base64');
  if (scope.btoa) return scope.btoa(value);
  throw new Error('Base64 encoding is not available in this runtime.');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function money(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'number' && Number.isFinite(item)) result[key] = item;
  }
  return result;
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function clip(value: string, max = 500): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max);
}

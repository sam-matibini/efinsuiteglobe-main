import { describe, expect, it, vi } from 'vitest';
import {
  buildEfileXml,
  finalizeCraGateway,
  handleCraGateway,
  parseCdeBody,
  parseCraConfirmation,
  type CraDb,
  type CraGatewayEnv,
  type FetchLike,
} from '../../../supabase/functions/_shared/cra-connection.ts';

const env: CraGatewayEnv = {
  representativeId: 'R9999999',
  efileNumber: 'AB1234',
  efilePassword: 'secret-efile',
  efileTransmitUrl: 'https://efile.example.test/transmit',
  efileStatusUrl: 'https://efile.example.test/status',
  cdeUrl: 'https://cde.example.test/enquiry',
  paysafeApiKey: 'user:pass',
  paysafeAccountIdEft: 'acct-1',
  paysafeEnvironment: 'test',
};

const blankEnv: CraGatewayEnv = {
  representativeId: '',
  efileNumber: '',
  efilePassword: '',
  efileTransmitUrl: '',
  efileStatusUrl: '',
  cdeUrl: '',
  paysafeApiKey: '',
  paysafeAccountIdEft: '',
  paysafeEnvironment: '',
};

function respond(status: number, body: string, ok = status >= 200 && status < 300): FetchLike {
  return vi.fn(async () => ({ ok, status, text: async () => body }));
}

describe('CRA gateway', () => {
  it('reads confirmation numbers from JSON, XML, and text', () => {
    expect(parseCraConfirmation('{"ConfirmationNumber":"CRA-123456"}')).toBe('CRA-123456');
    expect(parseCraConfirmation('{"nested":{"confirmationNumber":"ABC123456"}}')).toBe('ABC123456');
    expect(parseCraConfirmation('<formBundleNumber>987654321</formBundleNumber>')).toBe('987654321');
    expect(parseCraConfirmation('Confirmation number: CRA-ABC123')).toBe('CRA-ABC123');
    expect(parseCraConfirmation('')).toBeNull();
    expect(parseCraConfirmation('{"ConfirmationNumber":"no"}')).toBeNull();
  });

  it('does not accept an empty HTTP 200 or a confirmation on HTTP 500', async () => {
    const empty = await handleCraGateway('efile_submit', payload(), env, respond(200, ''));
    expect(empty.ok).toBe(false);
    expect(empty.accepted).toBe(false);
    const failed = await handleCraGateway(
      'efile_submit',
      payload(),
      env,
      respond(500, '<ConfirmationNumber>CRA-999999</ConfirmationNumber>', false),
    );
    expect(failed.accepted).toBe(false);
    expect(failed.confirmationNumber).toBeNull();
  });

  it('posts return XML and accepts only a real confirmation', async () => {
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', payload(), env, fetchImpl);
    expect(result.ok).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.confirmationNumber).toBe('CRA-123456');
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://efile.example.test/transmit');
    expect(String(init.body)).toContain('<Return type="GST34">');
    expect(String(init.body)).not.toContain('secret-efile');
    expect(String(init.headers.Authorization)).toMatch(/^Basic /);
  });

  it('leaves the return unaccepted when the transmit URL is missing', async () => {
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', payload(), blankEnv, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.accepted).toBe(false);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects a client CRA password and does not call the network', async () => {
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', { ...payload(), password: 'client-secret' }, env, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/password/i);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('does not pretend a missing Client Data Enquiry endpoint refreshed CRA', async () => {
    const fetchImpl = respond(200, '{"connected":true,"balances":{"gst_hst":1}}');
    const result = await handleCraGateway('cde_refresh', { businessNumber: '123456789', programs: ['RT'] }, blankEnv, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.balances).toBeNull();
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('applies balances only when CRA returns them', () => {
    expect(parseCdeBody('{}')).toEqual({ balances: null, connected: false });
    expect(parseCdeBody('{"balances":{"gst_hst":12.5,"RP":"3"},"authorizationStatus":"connected"}')).toEqual({
      balances: { gst_hst: 12.5, payroll: 3 },
      connected: true,
    });
  });

  it('keeps a payment authorized when Paysafe is missing or rejects it', async () => {
    const missing = await handleCraGateway('payment_release', { paymentId: 'EFS-CRA-1', amount: 10 }, blankEnv, respond(200, '{}'));
    expect(missing.railStatus).toBeNull();
    expect(missing.error).toMatch(/stays authorized/);
    const rejected = await handleCraGateway(
      'payment_release',
      { paymentId: 'EFS-CRA-1', amount: 10 },
      env,
      respond(402, '{"error":"no"}', false),
    );
    expect(rejected.ok).toBe(false);
    expect(rejected.railStatus).toBeNull();
  });

  it('records a Paysafe id only when the rail returns a status', async () => {
    const fetchImpl = respond(200, '{"id":"ps-99","status":"COMPLETED"}');
    const result = await handleCraGateway('payment_release', { paymentId: 'EFS-CRA-1', amount: 75 }, env, fetchImpl);
    expect(result.ok).toBe(true);
    expect(result.railStatus).toBe('settled');
    expect(result.railReference).toBe('ps-99');
    const [url] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.test.paysafe.com/paymenthub/v1/payments');
  });

  it('builds a T619 packet without embedding the EFILE password', () => {
    const xml = buildEfileXml({
      submissionId: 'EF-1',
      businessNumber: '123456789',
      legalName: 'A & B <Ltd>',
      taxYear: '2026',
      returnType: 'PD7A',
      account: 'RP0001',
      representativeId: 'R9999999',
      efileNumber: 'AB1234',
      amounts: { cpp: 10, ei: 2, incomeTax: 8, net: 20 },
    });
    expect(xml).toContain('T619');
    expect(xml).toContain('A &amp; B &lt;Ltd&gt;');
    expect(xml).not.toContain('secret');
  });

  it('reports persistence and ledger failures without hiding a rail result', async () => {
    const db = failingDb();
    const finalized = await finalizeCraGateway(db as CraDb, { organizationId: '11111111-1111-1111-1111-111111111111', paymentId: 'EFS-CRA-1', amount: 10, taxType: 'gst_hst' }, {
      ok: true,
      action: 'payment_release',
      railStatus: 'submitted',
      railReference: 'ps-1',
    });
    expect(finalized.ok).toBe(true);
    expect(finalized.railStatus).toBe('submitted');
    expect(finalized.persisted).toBe(false);
    expect(finalized.glError).toBeTruthy();
  });
});

function payload() {
  return {
    businessNumber: '123456789',
    submissionId: 'EF-1',
    returnType: 'GST34',
    taxYear: '2026',
    account: 'RT0001',
    legalName: 'ABC Manufacturing Ltd.',
    amounts: { collected: 25000, itcs: 17500, net: 7500 },
  };
}

function failingDb() {
  const result = { data: null, error: { message: 'relation does not exist' } };
  const builder = {
    select: () => builder,
    insert: () => builder,
    upsert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    ilike: () => builder,
    like: () => builder,
    order: () => builder,
    limit: () => builder,
    single: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return {
    from: () => builder,
    rpc: () => Promise.resolve({ data: true, error: null }),
  };
}

import { describe, expect, it, vi } from 'vitest';
import {
  CRA_INTERNET_FILE_TRANSFER_URL,
  applyCraFirmSettings,
  isInternetFileTransferUrl,
  buildEfileXml,
  craEnvFrom,
  finalizeCraGateway,
  handleCraGateway,
  parseCdeBody,
  parseCraConfirmation,
  parseCraFirmSettings,
  readCraFirmSettings,
  type CraDb,
  type CraGatewayEnv,
  type FetchLike,
} from '../../../supabase/functions/_shared/cra-connection.ts';

const env: CraGatewayEnv = {
  representativeName: 'eFinTax Advisors Ltd.',
  representativeId: 'R9999999',
  efileName: 'eFinTax EFILE',
  efileNumber: 'AB1234',
  efilePassword: 'secret-efile',
  efileTransmitUrl: 'https://apps.cra-arc.gc.ca/efile-test/transmit',
  efileStatusUrl: 'https://apps.cra-arc.gc.ca/efile-test/status',
  cdeUrl: 'https://apps.cra-arc.gc.ca/efile-test/enquiry',
  nombaClientId: 'nomba-client',
  nombaClientSecret: 'nomba-secret',
  nombaAccountId: 'nomba-account',
  nombaEnvironment: 'sandbox',
  nombaCurrency: 'CAD',
  nombaCallbackUrl: 'https://app.example.test/tax-cra/remittances',
};

const blankEnv: CraGatewayEnv = {
  representativeName: '',
  representativeId: '',
  efileName: '',
  efileNumber: '',
  efilePassword: '',
  efileTransmitUrl: '',
  efileStatusUrl: '',
  cdeUrl: '',
  nombaClientId: '',
  nombaClientSecret: '',
  nombaAccountId: '',
  nombaEnvironment: '',
  nombaCurrency: '',
  nombaCallbackUrl: '',
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
    expect(url).toBe('https://apps.cra-arc.gc.ca/efile-test/transmit');
    expect(String(init.body)).toContain('<Return type="GST34">');
    expect(String(init.body)).toContain('<trnmtr_nm>eFinTax EFILE</trnmtr_nm>');
    expect(String(init.body)).toContain('<RepresentativeName>eFinTax Advisors Ltd.</RepresentativeName>');
    expect(String(init.body)).not.toContain('secret-efile');
    expect(String(init.headers.Authorization)).toMatch(/^Basic /);
  });

  it('leaves the return unaccepted when the transmit URL is missing', async () => {
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', payload(), blankEnv, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/CRA_EFILE_NUMBER/);
    expect(result.error).toMatch(/CRA_EFILE_TRANSMIT_URL/);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('does not post a return to a host outside gc.ca', async () => {
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', payload(), { ...env, efileTransmitUrl: 'https://efile.example.test/transmit' }, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.error).toMatch(/gc\.ca/);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rejects a client CRA password and does not call the network', async () => {
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', { ...payload(), password: 'client-secret' }, env, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/password/i);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('uses the CRA Internet File Transfer address when CRA_CDE_URL is empty', () => {
    expect(craEnvFrom(() => undefined).cdeUrl).toBe(CRA_INTERNET_FILE_TRANSFER_URL);
    expect(craEnvFrom((key) => (key === 'CRA_CDE_URL' ? 'https://apps.cra-arc.gc.ca/efile-test/enquiry' : undefined)).cdeUrl).toBe(
      'https://apps.cra-arc.gc.ca/efile-test/enquiry',
    );
  });

  it('does not pretend a missing Client Data Enquiry endpoint refreshed CRA', async () => {
    const fetchImpl = respond(200, '{"connected":true,"balances":{"gst_hst":1}}');
    const result = await handleCraGateway('cde_refresh', { businessNumber: '123456789', programs: ['RT'] }, blankEnv, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.balances).toBeNull();
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('does not send Basic auth to the CRA Internet File Transfer application', async () => {
    expect(isInternetFileTransferUrl(`${CRA_INTERNET_FILE_TRANSFER_URL}?request_locale=en`)).toBe(true);
    expect(isInternetFileTransferUrl('https://apps.cra-arc.gc.ca/efile-test/enquiry')).toBe(false);
    const html = '<html><title>Internet file transfer</title></html>';
    const fetchImpl = respond(200, html);
    const result = await handleCraGateway(
      'cde_refresh',
      { businessNumber: '711450965', programs: ['RC'], legalName: '10255666 MANITOBA LTD.' },
      { ...env, cdeUrl: `${CRA_INTERNET_FILE_TRANSFER_URL}?request_locale=en` },
      fetchImpl,
    );
    expect(result.ok).toBe(true);
    expect(result.connected).toBe(false);
    expect(result.balances).toBeNull();
    expect(result.notice).toMatch(/Account balances were not included/);
    expect(result.error).toBeUndefined();
    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(String(init.body)).not.toContain(env.efilePassword);
  });

  it('sends Basic auth to a certification-kit enquiry and keeps HTTP 401 as an error', async () => {
    const okFetch = respond(200, '{"balances":{"gst_hst":12},"connected":true}');
    const refreshed = await handleCraGateway('cde_refresh', { businessNumber: '711450965', programs: ['RT'] }, env, okFetch);
    expect(refreshed.ok).toBe(true);
    expect(refreshed.connected).toBe(true);
    expect(refreshed.balances).toEqual({ gst_hst: 12 });
    const okInit = (okFetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(String(okInit.headers.Authorization)).toMatch(/^Basic /);
    expect(String(okInit.body)).toContain('"representativeName":"eFinTax Advisors Ltd."');
    expect(String(okInit.body)).toContain('"efileName":"eFinTax EFILE"');

    const denied = respond(401, 'Unauthorized', false);
    const result = await handleCraGateway('cde_refresh', { businessNumber: '711450965', programs: ['RT'] }, env, denied);
    expect(result.ok).toBe(false);
    expect(result.connected).toBe(false);
    expect(result.balances).toBeNull();
    expect(result.error).toMatch(/HTTP 401/);
    expect(result.notice).toBeUndefined();
  });

  it('applies balances only when CRA returns them', () => {
    expect(parseCdeBody('{}')).toEqual({ balances: null, connected: false, enquiry: null });
    expect(parseCdeBody('{"balances":{"gst_hst":12.5,"RP":"3"},"authorizationStatus":"connected","unfiledReturns":2,"directDepositAvailable":true}')).toEqual({
      balances: { gst_hst: 12.5, payroll: 3 },
      connected: true,
      enquiry: {
        outstandingReturns: null,
        unfiledReturns: 2,
        reviewStatus: null,
        efileRestricted: null,
        directDepositAvailable: true,
      },
    });
  });

  it('keeps a payment authorized when Nomba is missing or rejects checkout', async () => {
    const missing = await handleCraGateway('payment_release', cardPayload(), blankEnv, respond(200, '{}'));
    expect(missing.railStatus).toBeNull();
    expect(missing.error).toMatch(/stays authorized/);
    const rejected = await handleCraGateway('payment_release', cardPayload(), env, respond(401, '{"code":"401"}', false));
    expect(rejected.ok).toBe(false);
    expect(rejected.railStatus).toBeNull();
    expect(String((rejected as { error?: string }).error)).not.toMatch(/nomba-secret/);
  });

  it('opens Nomba card checkout and settles only a confirmed Visa or Mastercard payment', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: { body?: string }) => {
      if (String(url).includes('/auth/token/issue')) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ code: '00', data: { access_token: 'tok' } }) };
      }
      if (String(url).includes('/checkout/order')) {
        expect(String(init?.body)).toContain('"allowedPaymentMethods":["Card"]');
        expect(String(init?.body)).not.toMatch(/cardNumber|cardPin|"cvv"/);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            code: '00',
            data: { checkoutLink: 'https://checkout.nomba.com/pay/abc', orderReference: 'nomba-order-1' },
          }),
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    });
    const opened = await handleCraGateway('payment_release', cardPayload(), env, fetchImpl);
    expect(opened.ok).toBe(true);
    expect(opened.railStatus).toBe('submitted');
    expect(opened.railReference).toBe('nomba-order-1');
    expect(opened.checkoutUrl).toBe('https://checkout.nomba.com/pay/abc');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://sandbox.nomba.com/v1/checkout/order');

    const transfer = await handleCraGateway('payment_status', cardPayload(), env, vi.fn(async (url: string) => {
      if (String(url).includes('/auth/token')) return { ok: true, status: 200, text: async () => JSON.stringify({ code: '00', data: { access_token: 'tok' } }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ code: '00', data: { status: 'SUCCESS', onlineCheckoutPaymentMethod: 'bank_transfer', id: 'tx-1' } }) };
    }));
    expect(transfer.railStatus).toBeNull();

    const visa = await handleCraGateway('payment_status', cardPayload(), env, vi.fn(async (url: string) => {
      if (String(url).includes('/auth/token')) return { ok: true, status: 200, text: async () => JSON.stringify({ code: '00', data: { access_token: 'tok' } }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ code: '00', data: { status: 'SUCCESS', onlineCheckoutPaymentMethod: 'card_payment', cardType: 'Visa', id: 'tx-visa' } }) };
    }));
    expect(visa.ok).toBe(true);
    expect(visa.railStatus).toBe('settled');
    expect(visa.railReference).toBe('tx-visa');
  });

  it('refuses a card number in the CRA gateway payload', async () => {
    const fetchImpl = respond(200, '{}');
    const result = await handleCraGateway('payment_release', { ...cardPayload(), cardNumber: '4242424242424242' }, env, fetchImpl);
    expect(result.ok).toBe(false);
    expect((fetchImpl as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('builds a T619 packet without embedding the EFILE password', () => {
    const xml = buildEfileXml({
      submissionId: 'EF-1',
      businessNumber: '123456789',
      legalName: 'A & B <Ltd>',
      taxYear: '2026',
      returnType: 'PD7A',
      account: 'RP0001',
      representativeName: 'eFinTax Advisors Ltd.',
      representativeId: 'R9999999',
      efileName: 'eFinTax EFILE',
      efileNumber: 'AB1234',
      amounts: { cpp: 10, ei: 2, incomeTax: 8, net: 20 },
    });
    expect(xml).toContain('T619');
    expect(xml).toContain('<trnmtr_nm>eFinTax EFILE</trnmtr_nm>');
    expect(xml).toContain('<RepresentativeName>eFinTax Advisors Ltd.</RepresentativeName>');
    expect(xml).toContain('A &amp; B &lt;Ltd&gt;');
    expect(xml).not.toContain('secret');
  });

  it('uses firm settings from the admin portal for filing and keeps a blank field on the server', async () => {
    const merged = applyCraFirmSettings(
      { ...blankEnv, efileTransmitUrl: env.efileTransmitUrl },
      { representativeName: 'Saved Rep', representativeId: 'REP1234', efileName: 'Saved EFILE', efileNumber: 'EF12345', efilePassword: 'portal-secret' },
    );
    const fetchImpl = respond(200, '{"ConfirmationNumber":"CRA-123456"}');
    const result = await handleCraGateway('efile_submit', payload(), merged, fetchImpl);
    expect(result.accepted).toBe(true);
    const init = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(String(init.body)).toContain('Saved Rep');
    expect(String(init.body)).toContain('REP1234');
    expect(String(init.body)).toContain('Saved EFILE');
    expect(String(init.body)).toContain('EF12345');
    expect(String(init.body)).not.toContain('portal-secret');
    expect(Buffer.from(String(init.headers.Authorization).replace('Basic ', ''), 'base64').toString()).toBe('EF12345:portal-secret');
    const kept = applyCraFirmSettings(env, { representativeName: '', representativeId: '', efileName: '', efileNumber: '', efilePassword: '' });
    expect(kept.representativeName).toBe(env.representativeName);
    expect(kept.representativeId).toBe(env.representativeId);
    expect(kept.efileName).toBe(env.efileName);
    expect(kept.efilePassword).toBe(env.efilePassword);
    expect(parseCraFirmSettings([{ representative_name: 'Saved Rep', representative_id: 'REP1234', efile_name: 'Saved EFILE', efile_number: '', efile_password: '' }])).toMatchObject({
      representativeName: 'Saved Rep',
      representativeId: 'REP1234',
      efileName: 'Saved EFILE',
    });
  });

  it('reads admin portal credentials and does not replace them from platform settings when the gateway function is installed', async () => {
    const fromGateway = await readCraFirmSettings(settingsDb(
      { data: [{ representative_id: 'REP1234', efile_number: 'EF12345', efile_password: 'from-db' }], error: null },
      { representative_id: 'OTHER1', efile_number: 'OTHER2', efile_password: 'from-platform' },
    ));
    expect(fromGateway).toEqual({
      representativeName: '',
      representativeId: 'REP1234',
      efileName: '',
      efileNumber: 'EF12345',
      efilePassword: 'from-db',
    });
    const fromPlatform = await readCraFirmSettings(settingsDb(
      { data: null, error: { message: 'function gateway_cra_firm_settings does not exist' } },
      { representative_id: 'REP9999', efile_number: 'EF99999', efile_password: 'from-platform' },
    ));
    expect(fromPlatform?.efileNumber).toBe('EF99999');
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

function cardPayload() {
  return {
    paymentId: 'EFS-CRA-1',
    amount: 75,
    customerEmail: 'cfo@company.com',
    callbackUrl: 'https://app.example.test/tax-cra/remittances',
  };
}

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

function settingsDb(
  rpcResult: { data: unknown; error: { message?: string } | null },
  platformValue: Record<string, string> | null,
) {
  const result = { data: platformValue ? [{ setting_value: platformValue }] : [], error: null };
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
    rpc: () => Promise.resolve(rpcResult),
  } as CraDb;
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

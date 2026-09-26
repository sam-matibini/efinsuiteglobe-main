import {
  accrualEntry,
  approveBlockReason,
  canException,
  complianceFailures,
  effectiveCapabilities,
  nextRailStatus,
  OPEN_CEILING,
  roundMoney,
  settlementEntry,
  validateBn,
  validatePaymentInput,
  type PaymentInput,
} from './engine';
import { FUNDING_ACCOUNT, PROGRAM_LABEL } from './representative';
import type {
  AccessCeiling,
  ActionResult,
  AuditEvent,
  CraActor,
  CraLedger,
  CraPayment,
  CraProfile,
  CraProgramCode,
  EfileReturnType,
  EfileSubmission,
  PaymentStatus,
  ProgramAccount,
} from './types';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memory = new Map<string, string>();
const memoryStorage: KeyValueStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

let storage: KeyValueStorage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : memoryStorage;

const snapshots = new Map<string, CraLedger>();
const listeners = new Map<string, Set<() => void>>();

function storageKey(orgId: string) {
  return `efinsuite.cra-tax-centre.v1:${orgId}`;
}

export function useMemoryCraStorage() {
  storage = memoryStorage;
}

export function resetCraStoreForTests() {
  snapshots.clear();
  listeners.clear();
  memory.clear();
  storage = memoryStorage;
}

export function subscribe(orgId: string, listener: () => void) {
  let set = listeners.get(orgId);
  if (!set) {
    set = new Set();
    listeners.set(orgId, set);
  }
  set.add(listener);
  return () => set!.delete(listener);
}

function emit(orgId: string) {
  listeners.get(orgId)?.forEach((listener) => listener());
}

const SAMPLE_PAYMENT_IDS = new Set(['EFS-CRA-00001245', 'EFS-CRA-00001246']);
const SAMPLE_NOTICE_IDS = new Set(['notice-gst-reassess', 'notice-payroll-mail', 'notice-noa']);
const SAMPLE_CONFIRMATION = 'CRA-123456789';
const SAMPLE_AUTH_REFERENCE = 'RAC-20260901-0042';
const SAMPLE_SYNCED_AT = '2026-09-25T14:42:00.000Z';
const SAMPLE_BN = '123456789';
/**
 * Businesses that already authorized Samson Matibini in Represent a Client.
 * Recording that fact does not invent CRA balances or a confirmation number.
 */
const AUTHORIZED_CLIENTS: { bn: string; representativeName: string }[] = [
  { bn: '711450965', representativeName: 'Samson Matibini' },
  { bn: '725966758', representativeName: 'Samson Matibini' },
];

export function knownAuthorizedRepresentative(businessNumber: string): string | null {
  const bn = businessNumber.replace(/\D/g, '');
  return AUTHORIZED_CLIENTS.find((row) => row.bn === bn)?.representativeName ?? null;
}

function seed(orgName?: string): CraLedger {
  const legalName = orgName?.trim() || '';
  return {
    version: 1,
    syncedAt: '',
    walletBalance: 0,
    profile: {
      legalName,
      businessNumber: '',
      corporationNumber: '',
      businessType: 'Corporation',
      province: '',
      address: '',
      fiscalYearEnd: '',
      contactName: '',
      contactEmail: '',
      programs: [],
      otherProgramNote: '',
    },
    accounts: [],
    authorization: {
      status: 'not_started',
      level: 'level_1',
    },
    accessCeiling: { ...OPEN_CEILING },
    balances: { gst_hst: null, payroll: null, corporate_tax: null },
    balancesFromCra: false,
    enquiry: null,
    accountReviewStatus: '',
    directDepositAvailable: false,
    gst: {
      id: 'gst-current',
      periodStart: '',
      periodEnd: '',
      collected: 0,
      itcs: 0,
      dueDate: '',
      filingStatus: 'calculated',
    },
    payroll: {
      id: 'payroll-current',
      account: 'RP0001',
      periodStart: '',
      periodEnd: '',
      cpp: 0,
      ei: 0,
      incomeTax: 0,
      dueDate: '',
      filingStatus: 'calculated',
      sourcePayRunLabel: '',
    },
    corporate: {
      id: 't2-current',
      form: 'T2',
      fiscalStart: '',
      fiscalEnd: '',
      filingStatus: 'not_filed',
      balance: 0,
      installmentsPaid: 0,
      nextInstallmentAmount: 0,
      nextInstallmentDate: '',
    },
    submissions: [],
    payments: [],
    notices: [],
    audit: [],
    seq: { payment: 1246, efile: 122, confirmation: 0, audit: 1 },
  };
}

/** Drop sample CRA dollars, payments, notices, and the sample authorization. Keep a profile the user edited. */
export function stripSampleCraLedger(ledger: CraLedger): boolean {
  let changed = false;
  const mark = () => {
    changed = true;
  };
  const payments = ledger.payments.filter((payment) => !SAMPLE_PAYMENT_IDS.has(payment.id) && payment.craConfirmation !== SAMPLE_CONFIRMATION);
  if (payments.length !== ledger.payments.length) {
    ledger.payments = payments;
    mark();
  }
  const notices = ledger.notices.filter((notice) => !SAMPLE_NOTICE_IDS.has(notice.id));
  if (notices.length !== ledger.notices.length) {
    ledger.notices = notices;
    mark();
  }
  const audit = ledger.audit.filter((event) => event.id !== 'audit-1' && event.action !== 'CRA information synchronized');
  if (audit.length !== ledger.audit.length) {
    ledger.audit = audit;
    mark();
  }
  const sampleAuthorization = ledger.authorization.reference === SAMPLE_AUTH_REFERENCE || ledger.authorization.confirmedAt === '2026-09-03T18:12:00.000Z';
  if (!ledger.authorization.verifiedByCra && sampleAuthorization) {
    ledger.authorization = { status: 'not_started', level: 'level_1' };
    mark();
  }
  if (ledger.balancesFromCra !== true) {
    if (ledger.balances.gst_hst !== null || ledger.balances.payroll !== null || ledger.balances.corporate_tax !== null || ledger.balancesFromCra !== false) {
      ledger.balances = { gst_hst: null, payroll: null, corporate_tax: null };
      ledger.balancesFromCra = false;
      mark();
    }
    if (ledger.accountReviewStatus === 'None') {
      ledger.accountReviewStatus = '';
      mark();
    }
    if (ledger.directDepositAvailable) {
      ledger.directDepositAvailable = false;
      mark();
    }
    if (ledger.enquiry) {
      ledger.enquiry = null;
      mark();
    }
  }
  if (!ledger.enquiry) ledger.enquiry = null;
  if (ledger.gst.collected === 25000 && ledger.gst.itcs === 17500) {
    ledger.gst = { ...ledger.gst, collected: 0, itcs: 0, periodStart: '', periodEnd: '', dueDate: '' };
    mark();
  }
  if (ledger.payroll.cpp === 4250 && ledger.payroll.ei === 1250 && ledger.payroll.incomeTax === 8500) {
    ledger.payroll = { ...ledger.payroll, cpp: 0, ei: 0, incomeTax: 0, periodStart: '', periodEnd: '', dueDate: '', sourcePayRunLabel: '' };
    mark();
  }
  if (ledger.corporate.balance === 25000 && ledger.corporate.installmentsPaid === 10000 && ledger.corporate.nextInstallmentAmount === 10000) {
    ledger.corporate = { ...ledger.corporate, balance: 0, installmentsPaid: 0, nextInstallmentAmount: 0, nextInstallmentDate: '', fiscalStart: '', fiscalEnd: '' };
    mark();
  }
  if (ledger.walletBalance === 45000) {
    ledger.walletBalance = 0;
    mark();
  }
  if (ledger.profile.businessNumber === SAMPLE_BN) {
    ledger.profile = {
      ...ledger.profile,
      businessNumber: '',
      corporationNumber: '',
      address: '',
      contactName: '',
      contactEmail: '',
      fiscalYearEnd: '',
      province: '',
      programs: [],
    };
    ledger.accounts = [];
    mark();
  }
  if (ledger.syncedAt === SAMPLE_SYNCED_AT && !ledger.balancesFromCra && !ledger.authorization.verifiedByCra) {
    ledger.syncedAt = '';
    mark();
  }
  if (ledger.seq.confirmation === 123456789) {
    ledger.seq.confirmation = 0;
    mark();
  }
  if (recordKnownRepresentative(ledger)) mark();
  return changed;
}

function isInventedAuthorizationReference(reference?: string): boolean {
  return reference === SAMPLE_AUTH_REFERENCE || (!!reference && /^RAC-\d{8}-\d+$/.test(reference));
}

function writeKnownRepresentative(ledger: CraLedger, representativeName: string) {
  ledger.authorization = {
    ...ledger.authorization,
    status: 'connected',
    representativeName,
    verifiedByCra: undefined,
    reference: isInventedAuthorizationReference(ledger.authorization.reference) ? undefined : ledger.authorization.reference,
    confirmedAt: ledger.authorization.confirmedAt === '2026-09-03T18:12:00.000Z' ? undefined : ledger.authorization.confirmedAt,
  };
}

/** Record a representative the business has already authorized. Does not mark CRA as having returned balances. */
export function recordKnownRepresentative(ledger: CraLedger): boolean {
  const representativeName = knownAuthorizedRepresentative(ledger.profile.businessNumber);
  if (!representativeName) return false;
  if (ledger.authorization.status === 'revoked' || ledger.authorization.status === 'expired') return false;
  if (ledger.authorization.verifiedByCra) return false;
  const currentName = ledger.authorization.representativeName?.trim();
  if (ledger.authorization.status === 'connected' && currentName && currentName !== representativeName) return false;
  if (ledger.authorization.status === 'connected' && currentName === representativeName && !isInventedAuthorizationReference(ledger.authorization.reference)) {
    return false;
  }
  writeKnownRepresentative(ledger, representativeName);
  return true;
}

function persist(orgId: string, ledger: CraLedger) {
  snapshots.set(orgId, ledger);
  storage.setItem(storageKey(orgId), JSON.stringify(ledger));
  emit(orgId);
}

function ledgerFromStorage(raw: string, orgName?: string): CraLedger {
  try {
    const parsed = JSON.parse(raw) as CraLedger;
    if (parsed?.version === 1 && parsed.profile) {
      const ledger: CraLedger = {
        ...seed(orgName),
        ...parsed,
        profile: { ...seed(orgName).profile, ...parsed.profile },
        authorization: { ...seed(orgName).authorization, ...parsed.authorization },
        balances: {
          gst_hst: typeof parsed.balances?.gst_hst === 'number' ? parsed.balances.gst_hst : null,
          payroll: typeof parsed.balances?.payroll === 'number' ? parsed.balances.payroll : null,
          corporate_tax: typeof parsed.balances?.corporate_tax === 'number' ? parsed.balances.corporate_tax : null,
        },
        balancesFromCra: parsed.balancesFromCra === true,
        enquiry: parsed.enquiry ?? null,
        gst: { ...seed(orgName).gst, ...parsed.gst },
        payroll: { ...seed(orgName).payroll, ...parsed.payroll },
        corporate: { ...seed(orgName).corporate, ...parsed.corporate },
        accessCeiling: { ...OPEN_CEILING, ...parsed.accessCeiling },
        accounts: parsed.accounts ?? [],
        payments: parsed.payments ?? [],
        notices: parsed.notices ?? [],
        submissions: parsed.submissions ?? [],
        audit: parsed.audit ?? [],
        seq: { ...seed(orgName).seq, ...parsed.seq },
      };
      stripSampleCraLedger(ledger);
      return ledger;
    }
  } catch {
    // Fall through to an empty ledger.
  }
  return seed(orgName);
}

export function getLedger(orgId: string, orgName?: string): CraLedger {
  const cached = snapshots.get(orgId);
  if (cached) return cached;
  const raw = storage.getItem(storageKey(orgId));
  const ledger = raw ? ledgerFromStorage(raw, orgName) : seed(orgName);
  storage.setItem(storageKey(orgId), JSON.stringify(ledger));
  snapshots.set(orgId, ledger);
  return ledger;
}

function update(orgId: string, orgName: string | undefined, mutate: (draft: CraLedger) => void): CraLedger {
  const draft = structuredClone(getLedger(orgId, orgName));
  mutate(draft);
  persist(orgId, draft);
  return draft;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function authLabel(ledger: CraLedger): string {
  if (ledger.authorization.status !== 'connected') return ledger.authorization.status.replaceAll('_', ' ');
  return ledger.authorization.level === 'level_2' ? 'Level 2' : 'Level 1';
}

function audit(
  ledger: CraLedger,
  actor: CraActor,
  action: string,
  extra?: Partial<Pick<AuditEvent, 'craAccount' | 'efileSubmission' | 'craResponse' | 'confirmation'>>,
) {
  ledger.seq.audit += 1;
  ledger.audit.unshift({
    id: `audit-${ledger.seq.audit}`,
    at: new Date().toISOString(),
    userEmail: actor.email,
    client: ledger.profile.legalName || 'Organization',
    action,
    authorization: authLabel(ledger),
    ipDevice: 'Recorded',
    ...extra,
  });
}

function fail(orgId: string, orgName: string | undefined, actor: CraActor, action: string, error: string): ActionResult {
  update(orgId, orgName, (draft) => audit(draft, actor, `Denied: ${action}`, { craResponse: error }));
  return { ok: false, error };
}

function accountsFromPrograms(programs: CraProgramCode[], previous: ProgramAccount[]): ProgramAccount[] {
  return programs
    .filter((program) => program !== 'OTHER')
    .map((program) => {
      const existing = previous.find((account) => account.program === program);
      return {
        program,
        reference: existing?.reference ?? '0001',
        label: PROGRAM_LABEL[program] ?? program,
      };
    });
}

export function saveProfile(orgId: string, orgName: string | undefined, actor: CraActor, profile: CraProfile): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const caps = effectiveCapabilities(actor.role, ledger.accessCeiling);
  if (!caps.includes('manage_authorization') && !caps.includes('prepare_gst') && !caps.includes('prepare_corporate')) {
    return fail(orgId, orgName, actor, 'Save CRA business profile', 'Your role cannot change the CRA business profile.');
  }
  const bnError = validateBn(profile.businessNumber);
  if (bnError) return { ok: false, error: bnError };
  if (!profile.legalName.trim()) return { ok: false, error: 'Legal business name is required.' };
  if (!profile.province) return { ok: false, error: 'Province is required.' };
  if (!/^\d{2}-\d{2}$/.test(profile.fiscalYearEnd)) return { ok: false, error: 'Fiscal year end must be MM-DD.' };
  update(orgId, orgName, (draft) => {
    draft.profile = {
      ...profile,
      legalName: profile.legalName.trim(),
      programs: [...new Set(profile.programs)],
    };
    draft.accounts = accountsFromPrograms(draft.profile.programs, draft.accounts);
    audit(draft, actor, 'CRA business profile saved', { craAccount: draft.accounts.map((a) => `${a.program}${a.reference}`).join(', ') });
  });
  return { ok: true, message: 'CRA business profile saved for this organization.' };
}

export function saveAccessCeiling(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  ceiling: AccessCeiling,
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!effectiveCapabilities(actor.role, ledger.accessCeiling).includes('manage_authorization')) {
    return fail(orgId, orgName, actor, 'Change CRA access ceiling', 'Your role cannot manage CRA authorization.');
  }
  update(orgId, orgName, (draft) => {
    draft.accessCeiling = { ...ceiling };
    audit(draft, actor, 'CRA access ceiling saved');
  });
  return { ok: true, message: 'CRA access levels saved. Employee roles still cannot exceed their eFinsuite role.' };
}

export function requestAuthorization(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!effectiveCapabilities(actor.role, ledger.accessCeiling).includes('manage_authorization')) {
    return fail(orgId, orgName, actor, 'Request CRA authorization', 'Your role cannot manage CRA authorization.');
  }
  const alreadyAuthorized = knownAuthorizedRepresentative(ledger.profile.businessNumber);
  if (alreadyAuthorized) {
    if (ledger.authorization.status !== 'connected' || ledger.authorization.representativeName !== alreadyAuthorized) {
      update(orgId, orgName, (draft) => {
        writeKnownRepresentative(draft, alreadyAuthorized);
        audit(draft, actor, `Authorization check found ${alreadyAuthorized} already authorized. No form was sent.`);
      });
    }
    return {
      ok: true,
      message: `${alreadyAuthorized} is already authorized to access this business. No authorization form was sent.`,
    };
  }
  if (ledger.authorization.status === 'connected') {
    return { ok: false, error: 'This organization is already connected. Revoke the authorization before requesting a new one.' };
  }
  if (ledger.authorization.status === 'pending_client_confirmation') {
    return { ok: false, error: 'A request is already waiting for the business owner to confirm it in My Business Account.' };
  }
  const bnError = validateBn(ledger.profile.businessNumber);
  if (bnError) return { ok: false, error: bnError };
  update(orgId, orgName, (draft) => {
    draft.authorization = {
      ...draft.authorization,
      status: 'pending_client_confirmation',
      requestedAt: new Date().toISOString(),
      reference: undefined,
      confirmedAt: undefined,
      verifiedByCra: undefined,
    };
    audit(draft, actor, 'CRA representative authorization requested');
  });
  return { ok: true, message: 'Authorization requested. The director must confirm the CRA representative in My Business Account. This request is not a CRA confirmation number.' };
}

export function recordRepresentativeAuthorization(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  input: { representativeName: string; representativeId?: string },
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!effectiveCapabilities(actor.role, ledger.accessCeiling).includes('manage_authorization')) {
    return fail(orgId, orgName, actor, 'Record CRA representative', 'Your role cannot manage CRA authorization.');
  }
  const bnError = validateBn(ledger.profile.businessNumber);
  if (bnError) return { ok: false, error: bnError };
  const representativeName = input.representativeName.trim().replace(/\s+/g, ' ');
  if (representativeName.length < 2) {
    return { ok: false, error: 'Enter the CRA representative name before recording the authorization.' };
  }
  const representativeId = input.representativeId?.trim() || ledger.authorization.representativeId;
  update(orgId, orgName, (draft) => {
    draft.authorization = {
      ...draft.authorization,
      status: 'connected',
      representativeName,
      representativeId,
      confirmedAt: new Date().toISOString(),
      verifiedByCra: undefined,
      reference: isInventedAuthorizationReference(draft.authorization.reference) ? undefined : draft.authorization.reference,
    };
    audit(draft, actor, `CRA representative authorization recorded for ${representativeName}`);
  });
  return {
    ok: true,
    message: `${representativeName} is recorded as the authorized CRA representative for this business. Account balances stay blank until CRA returns them.`,
  };
}

export function sendInstructions(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const alreadyAuthorized = knownAuthorizedRepresentative(ledger.profile.businessNumber);
  if (alreadyAuthorized) {
    if (ledger.authorization.status !== 'connected' || ledger.authorization.representativeName !== alreadyAuthorized) {
      update(orgId, orgName, (draft) => {
        writeKnownRepresentative(draft, alreadyAuthorized);
        audit(draft, actor, `Authorization check found ${alreadyAuthorized} already authorized. No form was sent.`);
      });
    }
    return {
      ok: true,
      message: `${alreadyAuthorized} is already authorized to access this business. No authorization form was sent.`,
    };
  }
  if (ledger.authorization.status === 'not_started') {
    return { ok: false, error: 'Request CRA authorization before sending confirmation instructions.' };
  }
  update(orgId, orgName, (draft) => {
    draft.authorization.instructionsSentAt = new Date().toISOString();
    audit(draft, actor, `Confirmation instructions prepared for ${draft.profile.contactEmail || 'the primary contact'}`);
  });
  return { ok: true, message: `Instructions are ready for ${ledger.profile.contactName || 'the primary contact'}.` };
}

export function recordClientConfirmation(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  update(orgId, orgName, (draft) => {
    audit(draft, actor, 'Client confirmation in eFinsuite was not sent to CRA', {
      craResponse: 'Not a CRA response',
    });
  });
  return {
    ok: false,
    error: 'A confirmation in eFinsuite does not connect CRA. Check status through Client Data Enquiry. Do not enter a CRA password.',
  };
}

export function noteStillPending(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (ledger.authorization.status !== 'pending_client_confirmation') {
    return { ok: false, error: 'Authorization is not pending client confirmation.' };
  }
  update(orgId, orgName, (draft) => {
    draft.syncedAt = new Date().toISOString();
    audit(draft, actor, 'Checked CRA authorization status', { craResponse: 'Pending client confirmation' });
  });
  return { ok: true, message: 'CRA still shows this request as pending client confirmation.' };
}

export function revokeAuthorization(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!effectiveCapabilities(actor.role, ledger.accessCeiling).includes('manage_authorization')) {
    return fail(orgId, orgName, actor, 'Revoke CRA authorization', 'Your role cannot manage CRA authorization.');
  }
  if (ledger.authorization.status === 'not_started') {
    return { ok: false, error: 'There is no authorization to revoke.' };
  }
  update(orgId, orgName, (draft) => {
    draft.authorization.status = 'revoked';
    draft.authorization.verifiedByCra = undefined;
    audit(draft, actor, 'CRA representative authorization revoked');
  });
  return { ok: true, message: 'Authorization revoked for this organization. CRA filings and payments are blocked until it is connected again.' };
}

export function refreshCra(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!effectiveCapabilities(actor.role, ledger.accessCeiling).includes('view')) {
    return fail(orgId, orgName, actor, 'Refresh CRA information', 'Your role cannot view CRA information.');
  }
  update(orgId, orgName, (draft) => {
    draft.syncedAt = new Date().toISOString();
    audit(draft, actor, 'CRA information refreshed');
  });
  return { ok: true, message: 'CRA connection refreshed. Balances shown are limited to enrolled program accounts.' };
}

function capsOf(ledger: CraLedger, actor: CraActor) {
  return effectiveCapabilities(actor.role, ledger.accessCeiling);
}

export function reviewGst(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!capsOf(ledger, actor).includes('prepare_gst')) {
    return fail(orgId, orgName, actor, 'Review GST/HST return', 'Your role cannot prepare GST/HST.');
  }
  update(orgId, orgName, (draft) => {
    if (draft.gst.filingStatus === 'calculated') draft.gst.filingStatus = 'reviewed';
    audit(draft, actor, 'GST/HST return reviewed', { craAccount: 'RT0001' });
  });
  return { ok: true, message: 'GST/HST return marked reviewed. Filing and payment stay separate.' };
}

export function reviewPayroll(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!capsOf(ledger, actor).includes('prepare_payroll')) {
    return fail(orgId, orgName, actor, 'Review payroll remittance', 'Your role cannot prepare payroll remittances.');
  }
  update(orgId, orgName, (draft) => {
    if (draft.payroll.filingStatus === 'calculated') draft.payroll.filingStatus = 'reviewed';
    audit(draft, actor, 'Payroll remittance reviewed', { craAccount: draft.payroll.account });
  });
  return { ok: true, message: 'Payroll remittance reviewed. Submit the PD7A and pay CRA as separate steps.' };
}

export function prepareT2(orgId: string, orgName: string | undefined, actor: CraActor): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!capsOf(ledger, actor).includes('prepare_corporate')) {
    return fail(orgId, orgName, actor, 'Prepare T2', 'Your role cannot prepare the T2.');
  }
  update(orgId, orgName, (draft) => {
    if (draft.corporate.filingStatus === 'not_filed') draft.corporate.filingStatus = 'prepared';
    audit(draft, actor, 'T2 prepared', { craAccount: 'RC0001' });
  });
  return { ok: true, message: 'T2 marked prepared. File it through the EFILE gateway when it is ready.' };
}

export function submitEfile(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  input: { returnType: EfileReturnType; obligationId: string; taxYear: string; account: string },
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!capsOf(ledger, actor).includes('file_return')) {
    return fail(orgId, orgName, actor, `Submit ${input.returnType}`, 'Your role cannot submit tax returns.');
  }
  if (ledger.authorization.status !== 'connected') {
    return fail(orgId, orgName, actor, `Submit ${input.returnType}`, 'EFILE is available only after the client confirms the representative authorization.');
  }
  const bnError = validateBn(ledger.profile.businessNumber);
  if (bnError) return fail(orgId, orgName, actor, `Submit ${input.returnType}`, bnError);
  if (input.returnType === 'GST34' && ledger.gst.filingStatus === 'calculated') {
    return fail(orgId, orgName, actor, 'File GST/HST', 'Review the GST/HST return before filing it.');
  }
  if (input.returnType === 'PD7A' && ledger.payroll.filingStatus === 'calculated') {
    return fail(orgId, orgName, actor, 'Submit payroll remittance', 'Review the payroll remittance before submitting it.');
  }
  if (input.returnType === 'T2' && ledger.corporate.filingStatus === 'not_filed') {
    return fail(orgId, orgName, actor, 'File T2', 'Prepare the T2 before filing it.');
  }
  const open = ledger.submissions.find(
    (submission) => submission.obligationId === input.obligationId && submission.status === 'submitted',
  );
  if (open) return { ok: true, message: 'This return is already with the EFILE gateway.', id: open.id };

  let id = '';
  update(orgId, orgName, (draft) => {
    draft.seq.efile += 1;
    const stamp = new Date();
    const ymd = stamp.toISOString().slice(0, 10).replaceAll('-', '');
    id = `EF-${ymd}-${String(draft.seq.efile).padStart(6, '0')}`;
    const submission: EfileSubmission = {
      id,
      clientName: draft.profile.legalName,
      clientBn: draft.profile.businessNumber,
      taxYear: input.taxYear,
      returnType: input.returnType,
      submittedAt: stamp.toISOString(),
      errors: [],
      status: 'submitted',
      obligationId: input.obligationId,
    };
    draft.submissions.unshift(submission);
    audit(draft, actor, `${input.returnType} submitted to the EFILE gateway`, {
      craAccount: input.account,
      efileSubmission: id,
      craResponse: 'Submitted',
    });
  });
  return { ok: true, message: `${input.returnType} submitted to the EFILE gateway. Retrieve the CRA acknowledgement before treating it as accepted.`, id };
}

export interface EfileApplyInput {
  httpStatus: number;
  body?: string;
  confirmationNumber?: string | null;
  error?: string;
}

/** Apply a real CRA HTTP result. A confirmation is stored only when CRA returned one on HTTP 2xx. */
export function applyEfileResult(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  submissionId: string,
  result: EfileApplyInput,
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const submission = ledger.submissions.find((item) => item.id === submissionId);
  if (!submission) return { ok: false, error: 'EFILE submission was not found.', id: submissionId };
  if (submission.status === 'accepted') return { ok: true, message: 'CRA has already accepted this submission.', id: submissionId };
  if (submission.status !== 'submitted' && submission.status !== 'error') {
    return { ok: false, error: 'Only a submitted return can receive an acknowledgement.', id: submissionId };
  }
  const confirmation = (result.confirmationNumber ?? '').trim();
  const accepted = result.httpStatus >= 200 && result.httpStatus < 300 && /^[A-Za-z0-9][A-Za-z0-9-]{5,}$/.test(confirmation);
  if (!accepted) {
    const message = result.error || (result.httpStatus >= 200 && result.httpStatus < 300
      ? 'CRA did not return a confirmation number. The return was not accepted.'
      : result.httpStatus
        ? `CRA returned HTTP ${result.httpStatus}. The return was not accepted.`
        : 'CRA did not accept this return.');
    update(orgId, orgName, (draft) => {
      const row = draft.submissions.find((item) => item.id === submissionId);
      if (!row) return;
      row.confirmationNumber = undefined;
      row.errors = [message];
      row.craResponse = message;
      if (result.httpStatus >= 400) row.status = 'error';
      audit(draft, actor, `${row.returnType} was not accepted by CRA`, {
        efileSubmission: submissionId,
        craResponse: message,
      });
    });
    return { ok: false, error: message, id: submissionId };
  }
  update(orgId, orgName, (draft) => {
    const row = draft.submissions.find((item) => item.id === submissionId);
    if (!row) return;
    row.status = 'accepted';
    row.confirmationNumber = confirmation;
    row.craResponse = 'Accepted';
    row.errors = [];
    if (row.obligationId === draft.gst.id && draft.gst.filingStatus !== 'filed') {
      draft.gst.filingStatus = 'filed';
      draft.gst.efileSubmissionId = row.id;
    }
    if (row.obligationId === draft.payroll.id) {
      draft.payroll.filingStatus = 'submitted';
      draft.payroll.efileSubmissionId = row.id;
    }
    if (row.obligationId === draft.corporate.id && draft.corporate.filingStatus !== 'filed') {
      draft.corporate.filingStatus = 'filed';
      draft.corporate.efileSubmissionId = row.id;
    }
    audit(draft, actor, `${row.returnType} acknowledgement accepted`, {
      efileSubmission: row.id,
      craResponse: 'Accepted',
      confirmation,
    });
  });
  return { ok: true, message: `CRA accepted the return. Confirmation ${confirmation}.`, id: submissionId };
}

export interface CdeApplyInput {
  ok: boolean;
  error?: string;
  notice?: string;
  connected?: boolean;
  balances?: { gst_hst?: number; payroll?: number; corporate_tax?: number } | null;
  enquiry?: {
    outstandingReturns?: number | null;
    unfiledReturns?: number | null;
    reviewStatus?: string | null;
    efileRestricted?: boolean | null;
    directDepositAvailable?: boolean | null;
  } | null;
}

/** Update balances or connection only from a Client Data Enquiry payload. */
export function applyCdeResult(orgId: string, orgName: string | undefined, actor: CraActor, result: CdeApplyInput): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!capsOf(ledger, actor).includes('view')) {
    return fail(orgId, orgName, actor, 'Refresh CRA information', 'Your role cannot view CRA information.');
  }
  const balances = result.balances;
  const hasBalances = Boolean(
    balances && [balances.gst_hst, balances.payroll, balances.corporate_tax].some((value) => typeof value === 'number' && Number.isFinite(value)),
  );
  if (result.ok && result.notice && !hasBalances && result.connected !== true) {
    const alreadyAuthorized = knownAuthorizedRepresentative(ledger.profile.businessNumber);
    const message = alreadyAuthorized
      ? `${alreadyAuthorized} is already authorized to access this business. CRA Internet File Transfer did not include account balances, so the amounts were not changed.`
      : result.notice;
    update(orgId, orgName, (draft) => {
      if (alreadyAuthorized) recordKnownRepresentative(draft);
      audit(draft, actor, 'CRA Internet File Transfer did not include account balances', { craResponse: message });
    });
    return { ok: true, message };
  }
  if (!result.ok || (!hasBalances && result.connected !== true)) {
    const message = result.error || 'CRA did not return account data.';
    update(orgId, orgName, (draft) => {
      audit(draft, actor, 'CRA Client Data Enquiry did not update this organization', { craResponse: message });
    });
    return { ok: false, error: message };
  }
  update(orgId, orgName, (draft) => {
    if (balances) {
      if (typeof balances.gst_hst === 'number' && Number.isFinite(balances.gst_hst)) draft.balances.gst_hst = roundMoney(balances.gst_hst);
      if (typeof balances.payroll === 'number' && Number.isFinite(balances.payroll)) draft.balances.payroll = roundMoney(balances.payroll);
      if (typeof balances.corporate_tax === 'number' && Number.isFinite(balances.corporate_tax)) {
        draft.balances.corporate_tax = roundMoney(balances.corporate_tax);
      }
      draft.balancesFromCra = true;
    }
    if (result.enquiry) {
      draft.enquiry = {
        outstandingReturns: finiteOrNull(result.enquiry.outstandingReturns),
        unfiledReturns: finiteOrNull(result.enquiry.unfiledReturns),
        reviewStatus: result.enquiry.reviewStatus ?? null,
        efileRestricted: typeof result.enquiry.efileRestricted === 'boolean' ? result.enquiry.efileRestricted : null,
        directDepositAvailable: typeof result.enquiry.directDepositAvailable === 'boolean' ? result.enquiry.directDepositAvailable : null,
      };
      if (draft.enquiry.reviewStatus) draft.accountReviewStatus = draft.enquiry.reviewStatus;
      if (draft.enquiry.directDepositAvailable !== null) draft.directDepositAvailable = draft.enquiry.directDepositAvailable;
    }
    if (result.connected === true) {
      draft.authorization.status = 'connected';
      draft.authorization.level = 'level_2';
      draft.authorization.confirmedAt = new Date().toISOString();
      draft.authorization.verifiedByCra = true;
    }
    draft.syncedAt = new Date().toISOString();
    audit(draft, actor, result.connected ? 'CRA confirmed the representative authorization' : 'CRA balances refreshed', {
      craResponse: result.connected ? 'Connected' : 'Balances updated',
    });
  });
  return {
    ok: true,
    message: result.connected
      ? 'CRA confirmed the representative authorization and returned account data.'
      : 'CRA returned account balances. The representative authorization was not confirmed.',
  };
}

export function createPayment(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  input: PaymentInput & { purpose: string; obligationId?: string },
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const caps = capsOf(ledger, actor);
  const error = validatePaymentInput(ledger, input, caps);
  if (error) return fail(orgId, orgName, actor, 'Prepare CRA payment', error);
  if (input.obligationId) {
    const existing = ledger.payments.find(
      (payment) =>
        payment.obligationId === input.obligationId &&
        ['draft', 'authorized', 'submitted', 'processing', 'accepted', 'settled'].includes(payment.status),
    );
    if (existing) {
      return { ok: true, message: `Payment ${existing.id} is already ${existing.status} for this obligation.`, id: existing.id };
    }
  }
  let id = '';
  update(orgId, orgName, (draft) => {
    draft.seq.payment += 1;
    id = `EFS-CRA-${String(draft.seq.payment).padStart(8, '0')}`;
    const payment: CraPayment = {
      id,
      taxType: input.taxType,
      account: input.account,
      amount: roundMoney(input.amount),
      paymentDate: input.paymentDate,
      dueDate: input.dueDate,
      fundingAccount: input.fundingAccount || FUNDING_ACCOUNT,
      purpose: input.purpose,
      obligationId: input.obligationId,
      status: 'draft',
      preparedBy: actor.email,
      preparedByName: actor.displayName,
      fee: 0,
      glAccrual: [],
      glSettlement: [],
      createdAt: new Date().toISOString(),
    };
    draft.payments.unshift(payment);
    audit(draft, actor, 'CRA payment prepared', { craAccount: payment.account, confirmation: id });
  });
  return {
    ok: true,
    message: `Payment ${id} is draft. A different approver must authorize it before it can be released.`,
    id,
  };
}

export function approvePayment(orgId: string, orgName: string | undefined, actor: CraActor, paymentId: string): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const payment = ledger.payments.find((item) => item.id === paymentId);
  if (!payment) return { ok: false, error: 'Payment was not found.' };
  const reason = approveBlockReason(payment, actor.email, capsOf(ledger, actor));
  if (reason) return fail(orgId, orgName, actor, 'Approve CRA payment', reason);
  update(orgId, orgName, (draft) => {
    const row = draft.payments.find((item) => item.id === paymentId)!;
    row.status = 'authorized';
    row.approvedBy = actor.email;
    audit(draft, actor, 'CRA payment authorized', { craAccount: row.account, confirmation: row.id });
  });
  return { ok: true, message: `Payment ${paymentId} is authorized. Release it through the CRA payment engine.` };
}

export function paymentReleaseBlock(orgId: string, orgName: string | undefined, actor: CraActor, paymentId: string): string | null {
  const ledger = getLedger(orgId, orgName);
  const payment = ledger.payments.find((item) => item.id === paymentId);
  if (!payment) return 'Payment was not found.';
  if (!capsOf(ledger, actor).includes('approve_payment')) return 'Your role cannot release CRA payments.';
  if (payment.preparedBy.toLowerCase() === actor.email.toLowerCase()) {
    return 'Four-eyes control: the preparer cannot release the same CRA payment.';
  }
  if (payment.status !== 'authorized') return 'Release is available after a different approver has authorized the payment.';
  const failures = complianceFailures(ledger, payment);
  return failures.length ? failures.join(' ') : null;
}

export function releasePayment(orgId: string, orgName: string | undefined, actor: CraActor, paymentId: string): ActionResult {
  const reason = paymentReleaseBlock(orgId, orgName, actor, paymentId);
  if (reason) {
    if (reason === 'Payment was not found.' || reason.startsWith('Release is available')) return { ok: false, error: reason };
    return fail(orgId, orgName, actor, 'Release CRA payment', reason);
  }
  update(orgId, orgName, (draft) => {
    const row = draft.payments.find((item) => item.id === paymentId)!;
    row.status = 'submitted';
    row.releasedAt = new Date().toISOString();
    row.glAccrual = accrualEntry(row);
    audit(draft, actor, 'CRA payment released to the payment engine', {
      craAccount: row.account,
      confirmation: row.id,
      craResponse: 'Submitted',
    });
  });
  return { ok: true, message: `Payment ${paymentId} is submitted. It is not marked paid until CRA confirms settlement.` };
}

export function pollPayment(orgId: string, orgName: string | undefined, actor: CraActor, paymentId: string): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const payment = ledger.payments.find((item) => item.id === paymentId);
  if (!payment) return { ok: false, error: 'Payment was not found.' };
  if (!capsOf(ledger, actor).includes('view')) {
    return fail(orgId, orgName, actor, 'Poll CRA payment', 'Your role cannot view CRA payments.');
  }
  const next = nextRailStatus(payment.status);
  if (!next) return { ok: false, error: 'This payment is not waiting on the bank or CRA rail.' };
  if (next === 'settled' && ledger.walletBalance < payment.amount + payment.fee) {
    update(orgId, orgName, (draft) => {
      const row = draft.payments.find((item) => item.id === paymentId)!;
      row.status = 'failed';
      row.failureReason = 'Funding account could not cover settlement.';
      audit(draft, actor, 'CRA payment failed at settlement', {
        craAccount: row.account,
        confirmation: row.id,
        craResponse: row.failureReason,
      });
    });
    return { ok: false, error: 'Funding account could not cover settlement. The payment is failed, not paid.' };
  }
  update(orgId, orgName, (draft) => {
    const row = draft.payments.find((item) => item.id === paymentId)!;
    row.status = next;
    if (next === 'settled') {
      row.walletDeduction = row.amount;
      row.bankSettlement = row.amount;
      row.glSettlement = settlementEntry(row);
      draft.walletBalance = roundMoney(draft.walletBalance - row.amount - row.fee);
    }
    audit(draft, actor, `CRA payment status ${next}`, {
      craAccount: row.account,
      confirmation: row.id,
      craResponse: next,
    });
  });
  return { ok: true, message: `Payment ${paymentId} is ${next}. A CRA confirmation is still required before it is reconciled.` };
}

const RAIL_RANK: Partial<Record<PaymentStatus, number>> = {
  authorized: 0,
  submitted: 1,
  processing: 2,
  accepted: 3,
  settled: 4,
  confirmed: 5,
};

export interface RailApplyInput {
  ok: boolean;
  error?: string;
  railStatus?: PaymentStatus | null;
  railReference?: string | null;
  checkoutUrl?: string | null;
  journalEntryId?: string | null;
  glError?: string | null;
}

/** Apply a Nomba card status. Missing or unknown statuses leave the payment where it is. */
export function applyRailResult(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  paymentId: string,
  result: RailApplyInput,
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const payment = ledger.payments.find((item) => item.id === paymentId);
  if (!payment) return { ok: false, error: 'Payment was not found.' };
  if (!result.ok || !result.railStatus) {
    const message = result.error || 'The payment rail did not return a status.';
    update(orgId, orgName, (draft) => {
      audit(draft, actor, 'CRA payment rail did not change status', {
        craAccount: payment.account,
        confirmation: payment.id,
        craResponse: message,
      });
    });
    return { ok: false, error: message };
  }
  const railStatus = result.railStatus;
  if (payment.status === 'confirmed') return { ok: true, message: `Payment ${paymentId} is already confirmed.`, id: paymentId };
  if (payment.status === railStatus) {
    if (result.checkoutUrl) {
      update(orgId, orgName, (draft) => {
        const row = draft.payments.find((item) => item.id === paymentId);
        if (row) row.checkoutUrl = result.checkoutUrl ?? undefined;
      });
    }
    return { ok: true, message: `Payment ${paymentId} is still ${railStatus}.`, id: paymentId };
  }
  const currentRank = RAIL_RANK[payment.status];
  const nextRank = RAIL_RANK[railStatus];
  if (currentRank !== undefined && nextRank !== undefined && nextRank < currentRank) {
    return { ok: true, message: `Payment ${paymentId} stays ${payment.status}.`, id: paymentId };
  }
  if (!['authorized', 'submitted', 'processing', 'accepted', 'settled'].includes(payment.status)) {
    return { ok: false, error: 'This payment is not waiting on the payment rail.' };
  }
  if (railStatus === 'failed' || railStatus === 'rejected') {
    update(orgId, orgName, (draft) => {
      const row = draft.payments.find((item) => item.id === paymentId)!;
      row.status = railStatus;
      row.failureReason = result.error || railStatus;
      if (result.railReference) row.railReference = result.railReference;
      audit(draft, actor, `CRA payment ${railStatus} by the payment rail`, {
        craAccount: row.account,
        confirmation: row.id,
        craResponse: row.failureReason,
      });
    });
    return { ok: false, error: result.error || `Payment ${paymentId} is ${railStatus}.`, id: paymentId };
  }
  if (!['submitted', 'processing', 'accepted', 'settled'].includes(railStatus)) {
    return { ok: false, error: 'The payment rail returned a status this ledger does not apply.' };
  }
  update(orgId, orgName, (draft) => {
    const row = draft.payments.find((item) => item.id === paymentId)!;
    row.status = railStatus;
    if (!row.releasedAt) row.releasedAt = new Date().toISOString();
    if (!row.glAccrual.length) row.glAccrual = accrualEntry(row);
    if (result.railReference) row.railReference = result.railReference;
    if (result.checkoutUrl) row.checkoutUrl = result.checkoutUrl;
    if (result.journalEntryId) row.journalEntryId = result.journalEntryId;
    if (result.glError) row.glError = result.glError;
    if (railStatus === 'settled' && row.walletDeduction === undefined) {
      row.glSettlement = settlementEntry(row);
      if (draft.walletBalance >= row.amount + row.fee) {
        row.walletDeduction = row.amount;
        row.bankSettlement = row.amount;
        draft.walletBalance = roundMoney(draft.walletBalance - row.amount - row.fee);
      } else {
        row.glError = 'The CAD wallet ledger does not cover this settled payment.';
      }
    }
    audit(draft, actor, `CRA payment rail status ${railStatus}`, {
      craAccount: row.account,
      confirmation: row.railReference || row.id,
      craResponse: railStatus,
    });
  });
  const glNote = result.glError ? ` General ledger: ${result.glError}` : '';
  return { ok: true, message: `Payment ${paymentId} is ${railStatus}.${glNote}`, id: paymentId };
}

export function recordConfirmation(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  paymentId: string,
  confirmation: string,
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const payment = ledger.payments.find((item) => item.id === paymentId);
  if (!payment) return { ok: false, error: 'Payment was not found.' };
  if (!capsOf(ledger, actor).includes('approve_payment') && !capsOf(ledger, actor).includes('prepare_payment')) {
    return fail(orgId, orgName, actor, 'Record CRA confirmation', 'Your role cannot record a CRA confirmation.');
  }
  if (payment.status !== 'settled') {
    return { ok: false, error: 'Record the CRA confirmation only after the payment has settled. It is not paid yet.' };
  }
  const cleaned = confirmation.trim().toUpperCase();
  if (!/^CRA-[A-Z0-9]{6,}$/.test(cleaned)) {
    return { ok: false, error: 'Enter the CRA confirmation number, for example CRA-AB123456.' };
  }
  update(orgId, orgName, (draft) => {
    const row = draft.payments.find((item) => item.id === paymentId)!;
    row.status = 'confirmed';
    row.craConfirmation = cleaned;
    if (row.purpose.toLowerCase().includes('balance')) {
      if (row.taxType === 'gst_hst' && typeof draft.balances.gst_hst === 'number') {
        draft.balances.gst_hst = roundMoney(Math.max(0, draft.balances.gst_hst - row.amount));
      }
      if (row.taxType === 'payroll' && typeof draft.balances.payroll === 'number') {
        draft.balances.payroll = roundMoney(Math.max(0, draft.balances.payroll - row.amount));
      }
      if (row.taxType === 'corporate_tax' && typeof draft.balances.corporate_tax === 'number') {
        draft.balances.corporate_tax = roundMoney(Math.max(0, draft.balances.corporate_tax - row.amount));
      }
    }
    audit(draft, actor, 'CRA payment confirmed and reconciled', {
      craAccount: row.account,
      confirmation: cleaned,
      craResponse: 'Confirmed',
    });
  });
  return { ok: true, message: `Payment ${paymentId} is confirmed and reconciled to ${cleaned}.` };
}

export function recordException(
  orgId: string,
  orgName: string | undefined,
  actor: CraActor,
  paymentId: string,
  status: PaymentStatus,
  reason: string,
): ActionResult {
  const ledger = getLedger(orgId, orgName);
  const payment = ledger.payments.find((item) => item.id === paymentId);
  if (!payment) return { ok: false, error: 'Payment was not found.' };
  if (!capsOf(ledger, actor).includes('approve_payment')) {
    return fail(orgId, orgName, actor, 'Record CRA payment exception', 'Your role cannot change CRA payment status.');
  }
  if (!canException(payment.status, status)) {
    return { ok: false, error: `${payment.status} cannot move to ${status}.` };
  }
  update(orgId, orgName, (draft) => {
    const row = draft.payments.find((item) => item.id === paymentId)!;
    if (status === 'refunded' && row.walletDeduction) {
      draft.walletBalance = roundMoney(draft.walletBalance + row.walletDeduction);
    }
    row.status = status;
    row.failureReason = reason.trim() || status;
    audit(draft, actor, `CRA payment ${status}`, {
      craAccount: row.account,
      confirmation: row.id,
      craResponse: row.failureReason,
    });
  });
  return { ok: true, message: `Payment ${paymentId} is ${status}.` };
}

export function markNoticeRead(orgId: string, orgName: string | undefined, actor: CraActor, noticeId: string): ActionResult {
  const ledger = getLedger(orgId, orgName);
  if (!capsOf(ledger, actor).includes('view')) {
    return fail(orgId, orgName, actor, 'View CRA notice', 'Your role cannot view CRA notices.');
  }
  const notice = ledger.notices.find((item) => item.id === noticeId);
  if (!notice) return { ok: false, error: 'Notice was not found.' };
  update(orgId, orgName, (draft) => {
    const row = draft.notices.find((item) => item.id === noticeId)!;
    row.read = true;
    audit(draft, actor, `CRA notice viewed: ${row.title}`, { craAccount: row.program });
  });
  return { ok: true, message: 'Notice opened. The view is on the audit log.' };
}

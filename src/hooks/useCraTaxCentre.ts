import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { effectiveCapabilities } from '@/lib/cra/engine';
import { callCraGateway, UNCONFIGURED_CONNECTION, type CraConnectionInfo } from '@/lib/cra/gatewayClient';
import {
  applyCdeResult,
  applyEfileResult,
  applyRailResult,
  approvePayment,
  createPayment,
  getLedger,
  markNoticeRead,
  noteStillPending,
  paymentReleaseBlock,
  prepareT2,
  recordClientConfirmation,
  recordConfirmation,
  recordException,
  requestAuthorization,
  reviewGst,
  reviewPayroll,
  revokeAuthorization,
  saveAccessCeiling,
  saveProfile,
  sendInstructions,
  submitEfile,
  subscribe,
} from '@/lib/cra/store';
import type { AccessCeiling, ActionResult, CraActor, CraLedger, CraProfile, EfileReturnType, PaymentStatus, TaxType } from '@/lib/cra/types';
import { useAuth } from '@/hooks/useAuth';
import { useCountryScope, normalizeCountryCode } from '@/hooks/useCountryFilter';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

function efileAmounts(ledger: CraLedger, returnType: EfileReturnType) {
  if (returnType === 'GST34') {
    return { collected: ledger.gst.collected, itcs: ledger.gst.itcs, net: ledger.gst.collected - ledger.gst.itcs };
  }
  if (returnType === 'PD7A') {
    const net = ledger.payroll.cpp + ledger.payroll.ei + ledger.payroll.incomeTax;
    return { cpp: ledger.payroll.cpp, ei: ledger.payroll.ei, incomeTax: ledger.payroll.incomeTax, net };
  }
  if (returnType === 'T2') {
    return { balance: ledger.corporate.balance, installments: ledger.corporate.installmentsPaid, net: ledger.corporate.balance - ledger.corporate.installmentsPaid };
  }
  return {};
}

export function useCraTaxCentre() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const { userRole, isLoading, isReadOnly } = useEnabledModules();
  const { country: scopedCountry } = useCountryScope();
  const orgId = currentOrganization?.id ?? 'unscoped';
  const orgName = currentOrganization?.name;
  const [connection, setConnection] = useState<CraConnectionInfo>(UNCONFIGURED_CONNECTION);

  const ledger = useSyncExternalStore(
    (listener) => subscribe(orgId, listener),
    () => getLedger(orgId, orgName),
    () => getLedger(orgId, orgName),
  );

  const actor: CraActor = useMemo(
    () => ({
      email: user?.email ?? 'user@efinsuite.local',
      role: isLoading ? 'owner' : userRole,
      displayName: user?.email?.split('@')[0] || 'User',
    }),
    [user?.email, userRole, isLoading],
  );

  const capabilities = useMemo(
    () => (isReadOnly ? effectiveCapabilities('auditor', ledger.accessCeiling) : effectiveCapabilities(actor.role, ledger.accessCeiling)),
    [actor.role, isReadOnly, ledger.accessCeiling],
  );

  const can = useCallback((cap: (typeof capabilities)[number]) => capabilities.includes(cap), [capabilities]);

  const run = useCallback((result: ActionResult) => {
    if (result.ok === false) toast.error(result.error);
    else toast.success(result.message);
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setConnection({ ...UNCONFIGURED_CONNECTION, loaded: true });
      return;
    }
    callCraGateway({ action: 'capabilities', organizationId: orgId }).then((result) => {
      if (cancelled) return;
      setConnection({
        representativeId: result.representativeId ?? null,
        efileConfigured: result.efileConfigured === true,
        cdeConfigured: result.cdeConfigured === true,
        nombaConfigured: result.nombaConfigured === true,
        loaded: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, user]);

  const country = scopedCountry ?? normalizeCountryCode(currentOrganization?.country ?? null) ?? 'CA';

  const bind = useCallback(
    <Args extends unknown[]>(fn: (orgId: string, orgName: string | undefined, actor: CraActor, ...args: Args) => ActionResult) =>
      (...args: Args) => run(fn(orgId, orgName, actor, ...args)),
    [actor, orgId, orgName, run],
  );

  const refresh = useCallback(async () => {
    const current = getLedger(orgId, orgName);
    const gateway = await callCraGateway({
      action: 'cde_refresh',
      organizationId: orgId,
      businessNumber: current.profile.businessNumber,
      legalName: current.profile.legalName,
      programs: current.profile.programs,
    });
    return run(applyCdeResult(orgId, orgName, actor, {
      ok: gateway.ok,
      error: gateway.error,
      connected: gateway.connected,
      balances: gateway.balances,
    }));
  }, [actor, orgId, orgName, run]);

  const submitToEfile = useCallback(async (input: { returnType: EfileReturnType; obligationId: string; taxYear: string; account: string }) => {
    const queued = submitEfile(orgId, orgName, actor, input);
    if (!queued.ok || !queued.id) return run(queued);
    const current = getLedger(orgId, orgName);
    const submission = current.submissions.find((item) => item.id === queued.id);
    if (submission?.status === 'accepted') return run(queued);
    const gateway = await callCraGateway({
      action: 'efile_submit',
      organizationId: orgId,
      submissionId: queued.id,
      businessNumber: current.profile.businessNumber,
      legalName: current.profile.legalName,
      taxYear: input.taxYear,
      returnType: input.returnType,
      account: input.account,
      obligationId: input.obligationId,
      amounts: efileAmounts(current, input.returnType),
    });
    return run(applyEfileResult(orgId, orgName, actor, queued.id, {
      httpStatus: gateway.httpStatus ?? 0,
      body: gateway.body,
      confirmationNumber: gateway.confirmationNumber,
      error: gateway.error,
    }));
  }, [actor, orgId, orgName, run]);

  const acknowledgeEfile = useCallback(async (submissionId: string) => {
    const current = getLedger(orgId, orgName);
    const submission = current.submissions.find((item) => item.id === submissionId);
    if (!submission) return run({ ok: false, error: 'EFILE submission was not found.' });
    const gateway = await callCraGateway({
      action: 'efile_status',
      organizationId: orgId,
      submissionId,
      businessNumber: submission.clientBn,
      legalName: submission.clientName,
      taxYear: submission.taxYear,
      returnType: submission.returnType,
      obligationId: submission.obligationId,
    });
    return run(applyEfileResult(orgId, orgName, actor, submissionId, {
      httpStatus: gateway.httpStatus ?? 0,
      body: gateway.body,
      confirmationNumber: gateway.confirmationNumber,
      error: gateway.error,
    }));
  }, [actor, orgId, orgName, run]);

  const releasePayment = useCallback(async (paymentId: string) => {
    const reason = paymentReleaseBlock(orgId, orgName, actor, paymentId);
    if (reason) return run({ ok: false, error: reason });
    const payment = getLedger(orgId, orgName).payments.find((item) => item.id === paymentId);
    if (!payment) return run({ ok: false, error: 'Payment was not found.' });
    const gateway = await callCraGateway({
      action: 'payment_release',
      organizationId: orgId,
      paymentId,
      amount: payment.amount,
      taxType: payment.taxType,
      account: payment.account,
      paymentDate: payment.paymentDate,
      dueDate: payment.dueDate,
      fundingAccount: payment.fundingAccount,
      purpose: payment.purpose,
      preparedBy: payment.preparedBy,
      approvedBy: payment.approvedBy ?? null,
      paymentStatus: payment.status,
      journalEntryId: payment.journalEntryId ?? null,
      customerEmail: actor.email,
      callbackUrl: typeof window !== 'undefined' ? `${window.location.origin}/tax-cra/remittances` : '',
    });
    return run(applyRailResult(orgId, orgName, actor, paymentId, {
      ok: gateway.ok,
      error: gateway.error,
      railStatus: (gateway.railStatus ?? null) as PaymentStatus | null,
      railReference: gateway.railReference,
      checkoutUrl: gateway.checkoutUrl,
      journalEntryId: gateway.journalEntryId,
      glError: gateway.glError,
    }));
  }, [actor, orgId, orgName, run]);

  const pollPayment = useCallback(async (paymentId: string) => {
    const payment = getLedger(orgId, orgName).payments.find((item) => item.id === paymentId);
    if (!payment) return run({ ok: false, error: 'Payment was not found.' });
    const gateway = await callCraGateway({
      action: 'payment_status',
      organizationId: orgId,
      paymentId,
      railReference: payment.railReference ?? '',
      amount: payment.amount,
      taxType: payment.taxType,
      account: payment.account,
      paymentDate: payment.paymentDate,
      dueDate: payment.dueDate,
      fundingAccount: payment.fundingAccount,
      purpose: payment.purpose,
      preparedBy: payment.preparedBy,
      approvedBy: payment.approvedBy ?? null,
      paymentStatus: payment.status,
      journalEntryId: payment.journalEntryId ?? null,
    });
    return run(applyRailResult(orgId, orgName, actor, paymentId, {
      ok: gateway.ok,
      error: gateway.error,
      railStatus: (gateway.railStatus ?? null) as PaymentStatus | null,
      railReference: gateway.railReference,
      checkoutUrl: gateway.checkoutUrl,
      journalEntryId: gateway.journalEntryId,
      glError: gateway.glError,
    }));
  }, [actor, orgId, orgName, run]);

  return {
    ledger,
    actor,
    orgId,
    orgName,
    country,
    isLoading,
    capabilities,
    can,
    connection,
    refresh,
    saveProfile: bind((id, name, who, profile: CraProfile) => saveProfile(id, name, who, profile)),
    saveAccessCeiling: bind((id, name, who, ceiling: AccessCeiling) => saveAccessCeiling(id, name, who, ceiling)),
    requestAuthorization: bind(requestAuthorization),
    sendInstructions: bind(sendInstructions),
    recordClientConfirmation: bind(recordClientConfirmation),
    noteStillPending: bind(noteStillPending),
    revokeAuthorization: bind(revokeAuthorization),
    reviewGst: bind(reviewGst),
    reviewPayroll: bind(reviewPayroll),
    prepareT2: bind(prepareT2),
    submitEfile: submitToEfile,
    acknowledgeEfile,
    createPayment: bind(
      (
        id,
        name,
        who,
        input: {
          taxType: TaxType;
          account: string;
          amount: number;
          paymentDate: string;
          dueDate: string;
          fundingAccount: string;
          purpose: string;
          obligationId?: string;
        },
      ) => createPayment(id, name, who, input),
    ),
    approvePayment: bind((id, name, who, paymentId: string) => approvePayment(id, name, who, paymentId)),
    releasePayment,
    pollPayment,
    recordConfirmation: bind(
      (id, name, who, paymentId: string, confirmation: string) => recordConfirmation(id, name, who, paymentId, confirmation),
    ),
    recordException: bind(
      (id, name, who, paymentId: string, status: PaymentStatus, reason: string) =>
        recordException(id, name, who, paymentId, status, reason),
    ),
    markNoticeRead: bind((id, name, who, noticeId: string) => markNoticeRead(id, name, who, noticeId)),
  };
}

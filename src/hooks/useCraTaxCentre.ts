import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { effectiveCapabilities } from '@/lib/cra/engine';
import {
  acknowledgeEfile,
  approvePayment,
  createPayment,
  getLedger,
  markNoticeRead,
  noteStillPending,
  pollPayment,
  prepareT2,
  recordClientConfirmation,
  recordConfirmation,
  recordException,
  refreshCra,
  releasePayment,
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
import type { AccessCeiling, ActionResult, CraActor, CraProfile, EfileReturnType, PaymentStatus, TaxType } from '@/lib/cra/types';
import { useAuth } from '@/hooks/useAuth';
import { useCountryScope, normalizeCountryCode } from '@/hooks/useCountryFilter';
import { useEnabledModules } from '@/hooks/useEnabledModules';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

export function useCraTaxCentre() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const { userRole, isLoading, isReadOnly } = useEnabledModules();
  const { country: scopedCountry } = useCountryScope();
  const orgId = currentOrganization?.id ?? 'unscoped';
  const orgName = currentOrganization?.name;

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
    if (result.ok) toast.success(result.message);
    else toast.error(result.error);
    return result;
  }, []);

  const country = scopedCountry ?? normalizeCountryCode(currentOrganization?.country ?? null) ?? 'CA';

  const bind = useCallback(
    <Args extends unknown[]>(fn: (orgId: string, orgName: string | undefined, actor: CraActor, ...args: Args) => ActionResult) =>
      (...args: Args) => run(fn(orgId, orgName, actor, ...args)),
    [actor, orgId, orgName, run],
  );

  return {
    ledger,
    actor,
    orgId,
    orgName,
    country,
    isLoading,
    capabilities,
    can,
    refresh: bind(refreshCra),
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
    submitEfile: bind(
      (
        id,
        name,
        who,
        input: { returnType: EfileReturnType; obligationId: string; taxYear: string; account: string },
      ) => submitEfile(id, name, who, input),
    ),
    acknowledgeEfile: bind((id, name, who, submissionId: string) => acknowledgeEfile(id, name, who, submissionId)),
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
    releasePayment: bind((id, name, who, paymentId: string) => releasePayment(id, name, who, paymentId)),
    pollPayment: bind((id, name, who, paymentId: string) => pollPayment(id, name, who, paymentId)),
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

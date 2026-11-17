/**
 * Links final tax reports (PD7A remittances, GST/HST returns) to CRA Payments.
 * Starting a payment creates a CRA My Payment draft; approval, the hand-off to CRA and the
 * confirmation all happen in CRA Payments. The database marks the report paid afterwards.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { craDraftForReport, linkedPaymentsByReport, type LinkedPayment, type ReportForPayment } from '@/lib/cra/reportPayments';

// tax_payments.tax_return_id and the CRA workflow columns are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function friendly(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? 'Something went wrong.';
  if (/tax_return_id|workflow_status|next_cra_my_payment_reference/i.test(message) && /column|function|schema cache|does not exist/i.test(message)) {
    return 'The database update for linking tax reports to CRA Payments has not been applied yet.';
  }
  return message;
}

export function useTaxReportPayments() {
  const { organization } = useCurrentOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = organization?.id;

  const linked = useQuery({
    queryKey: ['tax-report-payments', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await db
        .from('tax_payments')
        .select('id, reference, workflow_status, remittance_id, tax_return_id, confirmation_number, created_at')
        .eq('organization_id', orgId)
        .not('workflow_status', 'is', null)
        .or('remittance_id.not.is.null,tax_return_id.not.is.null')
        .order('created_at', { ascending: false });
      if (error) throw new Error(friendly(error));
      return linkedPaymentsByReport((data ?? []) as LinkedPayment[]);
    },
  });

  const startPayment = useMutation({
    mutationFn: async (report: ReportForPayment) => {
      if (!orgId || !user?.id) throw new Error('Sign in and choose an organization first.');
      const { data: accounts } = await db
        .from('cra_program_accounts')
        .select('full_account_number, program_code, status, is_default')
        .eq('organization_id', orgId);
      const draft = craDraftForReport(report, organization ?? {}, accounts ?? []);
      const { data: reference, error: refError } = await db.rpc('next_cra_my_payment_reference', { p_org: orgId });
      if (refError) throw new Error(friendly(refError));
      const { data, error } = await db
        .from('tax_payments')
        .insert({ ...draft, organization_id: orgId, reference, prepared_by: user.id, initiated_by: user.id, created_by: user.id })
        .select('id, reference')
        .single();
      if (error) throw new Error(friendly(error));
      return data as { id: string; reference: string };
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['tax-report-payments', orgId] });
      qc.invalidateQueries({ queryKey: ['cra-my-payments', orgId] });
      toast.success(`Draft ${row.reference} created in CRA Payments. Review it and submit it for approval there.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    linkedByReport: linked.data ?? new Map<string, LinkedPayment>(),
    isLoading: linked.isLoading,
    startPayment,
  };
}

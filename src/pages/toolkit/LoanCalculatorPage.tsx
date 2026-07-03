import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AIFinancialToolkit } from '@/components/dashboard/AIFinancialToolkit';

/**
 * Standalone full-page mount of the Loan Calculator.
 * - Reads URL params and seeds the calculator (?amount=&rate=&term=&frequency=&extra=&grace=&start=).
 * - Provides a Back arrow that returns to the previous page (fallback /dashboard).
 * - Closing the modal navigates back rather than leaving an empty page.
 */
export default function LoanCalculatorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(true);

  // Build initial loan seed from URL params (consumed by AIFinancialToolkit).
  const seed = {
    principal: numParam(searchParams, 'amount'),
    rate: numParam(searchParams, 'rate'),
    termYears: numParam(searchParams, 'term'),
    frequency: (searchParams.get('frequency') as 'monthly' | 'biweekly' | 'weekly' | null) ?? undefined,
    extraPayment: numParam(searchParams, 'extra'),
    gracePeriodMonths: numParam(searchParams, 'grace'),
    startDate: searchParams.get('start') ?? undefined,
  };
  const hasSeed = Object.values(seed).some(v => v !== undefined && v !== null);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  useEffect(() => {
    if (!open) handleBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AIFinancialToolkit
      isOpen={open}
      onOpenChange={setOpen}
      initialTab="loan"
      onBack={handleBack}
      loanSeed={hasSeed ? seed : undefined}
    />
  );
}

function numParam(p: URLSearchParams, key: string): number | undefined {
  const v = p.get(key);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

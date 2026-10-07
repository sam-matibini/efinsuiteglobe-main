/**
 * E2E-only page proving the bank register loads past 1,000 rows.
 * Registered at /__e2e__/banking-volume when served with VITE_E2E=1.
 */
import { useEffect, useState } from 'react';
import { bankingActivity } from '@/lib/bankingActivity';
import { fetchAllPages } from '@/lib/fetchAllPages';

const rows = Array.from({ length: 2500 }, (_, index) => ({
  id: `tx-${index + 1}`,
  amount: index < 900 ? 10 : 2.5,
  transaction_type: index < 900 ? 'deposit' : 'withdrawal',
}));

export default function E2EBankingVolumeHarness() {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    fetchAllPages<{ id: string; amount: number; transaction_type: string }>(async (from, to) => ({
      data: rows.slice(from, to + 1),
      error: null,
    })).then((loaded) => {
      const activity = bankingActivity(loaded, 'bank');
      setSummary(
        `Total Transactions ${activity.total} · ${activity.volume.toFixed(2)} volume · ${activity.inflowCount} deposits · ${activity.outflowCount} withdrawals`,
      );
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">Bank Transactions</h1>
      <p data-testid="banking-volume" className="mt-3 text-base font-medium">{summary}</p>
    </div>
  );
}

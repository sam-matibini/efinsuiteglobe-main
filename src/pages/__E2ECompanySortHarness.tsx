/**
 * E2E-only page for the company favorites and statement sort.
 * Registered at /__e2e__/company-sort when served with VITE_E2E=1.
 */
import { useState } from 'react';
import { SearchableOrgSwitcher } from '@/components/layout/SearchableOrgSwitcher';
import { StatementSortControls } from '@/components/reports/StatementSortControls';
import { useStatementSort } from '@/hooks/useStatementSort';
import { sortIncomeStatementSections } from '@/lib/reports/statementSort';
import type { Organization } from '@/hooks/useOrganization';

const COMPANY_NAMES = [
  '10255666 MANITOBA LTD.',
  '13097781 Canada Inc.',
  '1410443 B.C. Ltd',
  '17259484 CANADA INC.',
  '7995083 Canada Incorporated',
  '85911 INC.',
  'Afropegga Inc.',
  'Black Manitoba Network',
];

const organizations = COMPANY_NAMES.map((name, index) => ({
  id: `org-${index + 1}`,
  name,
  legal_name: name,
  business_number: null,
  country: 'CA',
})) as Organization[];

const statement = {
  income: [
    { code: '4200', name: 'Service revenue', calculated_balance: 26791.61 },
    { code: '4000', name: 'Sales', calculated_balance: 200000 },
  ],
  cogs: [
    { code: '5100', name: 'Platforms and Partners Fees', calculated_balance: 73615 },
    { code: '5200', name: 'Subcontractor Expenses', calculated_balance: 75386.49 },
  ],
  expenses: [
    { code: '6100', name: 'Rent Expense', calculated_balance: 6213.61 },
    { code: '6110', name: 'Utilities', calculated_balance: 46.09 },
    { code: '6200', name: 'Motor Vehicle Expenses', calculated_balance: 22220.11 },
    { code: '6300', name: 'Fuel', calculated_balance: 8968.48 },
  ],
  otherIncome: [],
  otherExpenses: [],
};

function HarnessBody() {
  const [current, setCurrent] = useState(organizations[0]);
  const lineSort = useStatementSort('e2e-org');
  const ordered = sortIncomeStatementSections(statement, lineSort.criteria);

  return (
    <div className="grid gap-6 p-6 md:grid-cols-[280px_1fr]">
      <div className="w-64 bg-sidebar text-sidebar-foreground">
        <SearchableOrgSwitcher
          currentOrg={current}
          organizations={organizations}
          isLoading={false}
          onSwitch={setCurrent}
          onCreateNew={() => undefined}
          filterCountry="CA"
          userId="e2e-user"
        />
      </div>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Company list and statement sort</h1>
        <StatementSortControls organizationId="e2e-org" model={lineSort} />
        <section>
          <h2 className="mb-2 text-sm font-medium">Operating expenses</h2>
          <ol aria-label="Operating expenses" className="space-y-1 text-sm">
            {ordered.expenses.map((account) => (
              <li key={account.name} className="flex justify-between gap-4">
                <span>{account.name}</span>
                <span>{account.calculated_balance.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-medium">Accountant dashboard export order</h2>
          <ol aria-label="Accountant dashboard export order" className="list-decimal pl-5 text-sm">
            {ordered.expenses.map((account) => (
              <li key={account.name}>{account.name}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

export default function E2ECompanySortHarness() {
  return <HarnessBody />;
}

import { useLocation, useNavigate } from 'react-router-dom';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';

const colorClasses: Record<string, { active: string; indicator: string }> = {
  'balance-sheet': {
    active: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm',
    indicator: 'border-blue-500',
  },
  'income-statement': {
    active: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shadow-sm',
    indicator: 'border-emerald-500',
  },
  'cash-flow': {
    active: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 shadow-sm',
    indicator: 'border-teal-500',
  },
  'changes-equity': {
    active: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 shadow-sm',
    indicator: 'border-violet-500',
  },
};

export function ReportsTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { npoTerms, isNpo } = useNpoTerminology();

  const statementTabs = [
    { id: 'balance-sheet', label: isNpo ? (npoTerms?.balanceSheet || 'Statement of Financial Position') : 'Balance Sheet', path: '/reports/balance-sheet' },
    { id: 'income-statement', label: isNpo ? (npoTerms?.incomeStatement || 'Statement of Operations') : 'Income Statement', path: '/reports/income-statement' },
    { id: 'cash-flow', label: isNpo ? (npoTerms?.cashFlow || 'Statement of Cash Flows') : 'Cash Flow', path: '/reports/cash-flow' },
    { id: 'changes-equity', label: isNpo ? 'Changes in Net Assets' : 'Changes in Equity', path: '/reports/changes-in-equity' },
  ];

  const currentStatement = statementTabs.find(tab => tab.path === location.pathname)?.id || 'balance-sheet';

  return (
    <div className="flex bg-muted/50 rounded-lg p-1 border border-border">
      {statementTabs.map((tab) => {
        const isActive = currentStatement === tab.id;
        const colors = colorClasses[tab.id];
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all border-b-2 ${
              isActive
                ? `${colors.active} ${colors.indicator}`
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

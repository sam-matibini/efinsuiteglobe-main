import { useLocation, useNavigate } from 'react-router-dom';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';

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
      {statementTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => navigate(tab.path)}
          className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            currentStatement === tab.id
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

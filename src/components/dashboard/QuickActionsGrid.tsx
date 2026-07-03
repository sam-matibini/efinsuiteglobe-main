import { FileText, DollarSign, CreditCard, Users, Calculator, BarChart3, Receipt, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEnabledModules, ModuleCode } from '@/hooks/useEnabledModules';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  description?: string;
  requiredModules?: ModuleCode[];
  /** If true, this action is hidden for read-only (auditor) users */
  isAction?: boolean;
}

const quickActions: QuickAction[] = [
  { 
    label: 'Create Invoice', 
    icon: FileText, 
    color: 'bg-accent/10 text-accent hover:bg-accent/20',
    path: '/sales/invoices',
    description: 'Bill a customer',
    requiredModules: ['accounts_receivable'],
    isAction: true,
  },
  { 
    label: 'Record Payment', 
    icon: DollarSign, 
    color: 'bg-success/10 text-success hover:bg-success/20',
    path: '/sales/payments',
    description: 'Receive funds',
    requiredModules: ['accounts_receivable'],
    isAction: true,
  },
  { 
    label: 'Enter Bill', 
    icon: Receipt, 
    color: 'bg-warning/10 text-warning hover:bg-warning/20',
    path: '/purchases/bills',
    description: 'Record expense',
    requiredModules: ['accounts_payable'],
    isAction: true,
  },
  { 
    label: 'Run Payroll', 
    icon: Users, 
    color: 'bg-primary/10 text-primary hover:bg-primary/20',
    path: '/payroll/runs',
    description: 'Process pay run',
    requiredModules: ['payroll'],
    isAction: true,
  },
  { 
    label: 'Record Donation', 
    icon: Heart, 
    color: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
    path: '/donations',
    description: 'CRA compliant',
    requiredModules: ['donations'],
    isAction: true,
  },
  { 
    label: 'Journal Entry', 
    icon: Calculator, 
    color: 'bg-chart-5/10 text-chart-5 hover:bg-chart-5/20',
    path: '/journal-entries',
    description: 'Manual entry',
    requiredModules: ['general_ledger'],
    isAction: true,
  },
  { 
    label: 'Reconcile', 
    icon: CreditCard, 
    color: 'bg-chart-2/10 text-chart-2 hover:bg-chart-2/20',
    path: '/banking/reconciliation',
    description: 'Bank reconciliation',
    requiredModules: ['banking'],
    isAction: true,
  },
  { 
    label: 'Reports', 
    icon: BarChart3, 
    color: 'bg-chart-3/10 text-chart-3 hover:bg-chart-3/20',
    path: '/reports',
    description: 'Financial reports',
    requiredModules: ['reporting'],
  },
];

export function QuickActionsGrid() {
  const navigate = useNavigate();
  const { isModuleEnabled, isLoading } = useEnabledModules();
  const isReadOnly = useIsReadOnly();

  // Filter actions based on enabled modules and read-only status
  const filteredActions = quickActions.filter(action => {
    if (isLoading) return true;
    if (isReadOnly && action.isAction) return false; // Hide action buttons for auditors
    if (!action.requiredModules || action.requiredModules.length === 0) return true;
    return action.requiredModules.some(code => isModuleEnabled(code));
  });

  if (filteredActions.length === 0) {
    return null;
  }

  return (
    <div className="stat-card animate-slide-in">
      <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filteredActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200 group",
              action.color
            )}
          >
            <action.icon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="font-medium text-sm">{action.label}</span>
            {action.description && (
              <span className="text-xs opacity-70">{action.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

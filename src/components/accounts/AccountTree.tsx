import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, File, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Account, AccountType } from '@/types/accounting';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AccountTreeItemProps {
  account: Account;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const accountTypeColors: Record<AccountType, string> = {
  asset: 'bg-blue-500/10 text-blue-600',
  liability: 'bg-orange-500/10 text-orange-600',
  equity: 'bg-purple-500/10 text-purple-600',
  income: 'bg-green-500/10 text-green-600',
  cogs: 'bg-amber-500/10 text-amber-600',
  expense: 'bg-red-500/10 text-red-600',
  other_income: 'bg-teal-500/10 text-teal-600',
  other_expense: 'bg-pink-500/10 text-pink-600',
};

const accountTypeLabels: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  cogs: 'COGS',
  expense: 'Expense',
  other_income: 'Other Income',
  other_expense: 'Other Expense',
};

function AccountTreeItem({ account, level, expandedIds, onToggle, selectedId, onSelect }: AccountTreeItemProps) {
  const hasChildren = account.children && account.children.length > 0;
  const isExpanded = expandedIds.has(account.id);
  const isSelected = selectedId === account.id;

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(Math.abs(balance));
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group",
          isSelected ? "bg-accent/10 border border-accent/30" : "hover:bg-muted/50",
          level > 0 && "ml-6"
        )}
        onClick={() => onSelect(account.id)}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(account.id);
          }}
          className="w-5 h-5 flex items-center justify-center"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4" />
          )}
        </button>

        {/* Icon */}
        {hasChildren ? (
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
        ) : (
          <File className="w-4 h-4 text-muted-foreground" />
        )}

        {/* Account Code */}
        <span className="font-mono text-sm text-muted-foreground w-16">{account.code}</span>

        {/* Account Name */}
        <span className={cn(
          "flex-1 text-sm font-medium",
          isSelected ? "text-foreground" : "text-foreground/80"
        )}>
          {account.name}
        </span>

        {/* Account Type Badge */}
        <span className={cn(
          "px-2 py-0.5 rounded text-xs font-medium",
          accountTypeColors[account.type]
        )}>
          {accountTypeLabels[account.type]}
        </span>

        {/* Balance */}
        <span className={cn(
          "font-mono text-sm w-28 text-right",
          account.balance >= 0 ? "text-foreground" : "text-destructive"
        )}>
          {formatBalance(account.balance)}
        </span>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit Account</DropdownMenuItem>
            <DropdownMenuItem>View Transactions</DropdownMenuItem>
            <DropdownMenuItem>Add Sub-Account</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l border-border/50 ml-5">
          {account.children!.map((child) => (
            <AccountTreeItem
              key={child.id}
              account={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AccountTreeProps {
  accounts: Account[];
}

export function AccountTree({ accounts }: AccountTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(['acc-1000', 'acc-1100', 'acc-2000', 'acc-3000', 'acc-4000', 'acc-5000'])
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const getAllIds = (accts: Account[]): string[] => {
      return accts.flatMap((a) => [a.id, ...(a.children ? getAllIds(a.children) : [])]);
    };
    setExpandedIds(new Set(getAllIds(accounts)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={expandAll}>
          Expand All
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>

      {/* Tree Header */}
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
        <div className="w-5" />
        <div className="w-4" />
        <span className="w-16">Code</span>
        <span className="flex-1">Account Name</span>
        <span className="w-20 text-center">Type</span>
        <span className="w-28 text-right">Balance</span>
        <div className="w-8" />
      </div>

      {/* Tree Content */}
      <div className="space-y-1">
        {accounts.map((account) => (
          <AccountTreeItem
            key={account.id}
            account={account}
            level={0}
            expandedIds={expandedIds}
            onToggle={toggleExpand}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>
    </div>
  );
}

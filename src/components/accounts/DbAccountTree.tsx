import { useState } from 'react';
import { ChevronRight, ChevronDown, FolderOpen, File, MoreHorizontal, Trash2, Edit, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DbAccount, useDeleteAccount, useUpdateAccount, useAccounts } from '@/hooks/useAccounts';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { getT3010CategoryLabel, getT3010CategoriesForAccountType } from '@/data/t3010Categories';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditAccountDialog } from './EditAccountDialog';
import { AddAccountDialog } from './AddAccountDialog';

type AccountWithChildren = DbAccount & { children?: AccountWithChildren[] };

const accountTypeColors: Record<string, string> = {
  asset: 'bg-blue-500/10 text-blue-600',
  liability: 'bg-orange-500/10 text-orange-600',
  equity: 'bg-purple-500/10 text-purple-600',
  income: 'bg-green-500/10 text-green-600',
  expense: 'bg-red-500/10 text-red-600',
};

const accountTypeLabels: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
};

interface AccountTreeItemProps {
  account: AccountWithChildren;
  level: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  organizationId: string;
  allAccounts: DbAccount[];
  isNpo: boolean;
}

function AccountTreeItem({
  account,
  level,
  expandedIds,
  onToggle,
  selectedId,
  onSelect,
  organizationId,
  allAccounts,
  isNpo,
}: AccountTreeItemProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addSubAccountOpen, setAddSubAccountOpen] = useState(false);
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  
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

  const handleDelete = async () => {
    await deleteAccount.mutateAsync({ id: account.id, organizationId });
    setDeleteDialogOpen(false);
  };

  const canDelete = !hasChildren && account.current_balance === 0;

  return (
    <>
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
          {account.is_header ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          ) : (
            <File className="w-4 h-4 text-muted-foreground" />
          )}

          {/* Account Code */}
          <span className="font-mono text-sm text-muted-foreground w-16">{account.code}</span>

          {/* Account Name */}
          <span className={cn(
            "flex-1 text-sm font-medium",
            isSelected ? "text-foreground" : "text-foreground/80",
            !account.is_active && "line-through opacity-50"
          )}>
            {account.name}
          </span>

          {/* Account Type Badge */}
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            accountTypeColors[account.account_type] || 'bg-muted text-muted-foreground'
          )}>
            {accountTypeLabels[account.account_type] || account.account_type}
          </span>

          {/* T3010 Inline Selector (NPO only) */}
          {isNpo && (account.account_type === 'expense' || account.account_type === 'income') ? (
            <div className="w-40" onClick={(e) => e.stopPropagation()}>
              <Select
                value={(account as any).t3010_category || '__none__'}
                onValueChange={(val) => {
                  updateAccount.mutate({
                    id: account.id,
                    organizationId,
                    updates: { t3010_category: val === '__none__' ? null : val } as any,
                  });
                }}
              >
                <SelectTrigger className="h-7 text-xs border-dashed">
                  <SelectValue placeholder="No mapping" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No mapping</SelectItem>
                  {getT3010CategoriesForAccountType(account.account_type).map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.line} - {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : isNpo ? (
            <div className="w-40" />
          ) : null}

          {/* Balance */}
          <span className={cn(
            "font-mono text-sm w-28 text-right",
            account.current_balance >= 0 ? "text-foreground" : "text-destructive"
          )}>
            {formatBalance(account.current_balance)}
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
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setEditDialogOpen(true);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Account
              </DropdownMenuItem>
              <DropdownMenuItem>View Transactions</DropdownMenuItem>
              {account.is_header && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddSubAccountOpen(true);
                  }}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Sub-Account
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                disabled={!canDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canDelete) {
                    setDeleteDialogOpen(true);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {!canDelete ? (hasChildren ? 'Has sub-accounts' : 'Has balance') : 'Delete Account'}
              </DropdownMenuItem>
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
                organizationId={organizationId}
                allAccounts={allAccounts}
                isNpo={isNpo}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditAccountDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        organizationId={organizationId}
        account={account}
        existingAccounts={allAccounts}
      />

      {/* Add Sub-Account Dialog */}
      <AddAccountDialog
        open={addSubAccountOpen}
        onOpenChange={setAddSubAccountOpen}
        organizationId={organizationId}
        existingAccounts={allAccounts}
        defaultParentId={account.id}
        defaultAccountType={account.account_type}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{account.code} - {account.name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface DbAccountTreeProps {
  accounts: AccountWithChildren[];
  organizationId: string;
}

export function DbAccountTree({ accounts, organizationId }: DbAccountTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: allAccounts = [] } = useAccounts(organizationId);
  const { isNpo } = useNpoTerminology();

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

  const getAllIds = (accts: AccountWithChildren[]): string[] => {
    return accts.flatMap((a) => [a.id, ...(a.children ? getAllIds(a.children) : [])]);
  };

  const expandAll = () => {
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
        {isNpo && <span className="w-40 text-center">T3010</span>}
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
            organizationId={organizationId}
            allAccounts={allAccounts}
            isNpo={isNpo}
          />
        ))}
      </div>
    </div>
  );
}

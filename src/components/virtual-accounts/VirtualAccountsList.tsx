import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, Plus, Wallet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useVirtualAccounts } from '@/hooks/useVirtualAccounts';
import { CreateVirtualAccountDialog } from './CreateVirtualAccountDialog';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  pending: 'secondary',
  failed: 'destructive',
};

export function VirtualAccountsList() {
  const { accounts, isLoading } = useVirtualAccounts();
  const [open, setOpen] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Virtual Accounts
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Fund virtual accounts to enable money-out operations. Create one per currency.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Virtual Account
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No virtual accounts yet. Create one to start receiving funds.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Currency</TableHead>
                <TableHead>Account number</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Account name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.currency}</TableCell>
                  <TableCell>
                    {a.account_number ? (
                      <button
                        type="button"
                        onClick={() => copy(a.account_number!)}
                        className="inline-flex items-center gap-2 hover:text-primary"
                      >
                        <span className="font-mono">{a.account_number}</span>
                        <Copy className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{a.bank_name ?? '—'}</TableCell>
                  <TableCell>{a.account_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[a.status] ?? 'outline'}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CreateVirtualAccountDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

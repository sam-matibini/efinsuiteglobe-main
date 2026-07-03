import { useState } from 'react';
import { Plus, Search, Clock, MoreHorizontal, Timer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { usePMTimeEntries } from '@/hooks/usePracticeManagement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';

interface PMTimeTrackingTabProps {
  onAddTimeEntry: () => void;
}

export function PMTimeTrackingTab({ onAddTimeEntry }: PMTimeTrackingTabProps) {
  const { user } = useAuth();
  const { data: timeEntries, isLoading } = usePMTimeEntries(undefined, user?.id);
  const { formatWithSymbol } = useCurrencyFormatter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billableFilter, setBillableFilter] = useState<string>('all');

  const filteredEntries = timeEntries?.filter(entry => {
    const matchesSearch = entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.engagement?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.engagement?.client?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    const matchesBillable = billableFilter === 'all' || 
      (billableFilter === 'billable' ? entry.is_billable : !entry.is_billable);
    return matchesSearch && matchesStatus && matchesBillable;
  });

  const totalHours = filteredEntries?.reduce((sum, e) => sum + e.hours, 0) || 0;
  const billableHours = filteredEntries?.filter(e => e.is_billable).reduce((sum, e) => sum + e.hours, 0) || 0;
  const totalValue = filteredEntries?.filter(e => e.is_billable)
    .reduce((sum, e) => sum + (e.hours * (e.billing_rate || 0)), 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500 text-white';
      case 'submitted': return 'bg-blue-500 text-white';
      case 'billed': return 'bg-purple-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Tracking
            </CardTitle>
            <CardDescription>Track billable and non-billable hours</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Timer className="mr-2 h-4 w-4" />
              Start Timer
            </Button>
            <Button onClick={onAddTimeEntry}>
              <Plus className="mr-2 h-4 w-4" />
              Log Time
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Hours</div>
              <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Billable Hours</div>
              <div className="text-2xl font-bold">{billableHours.toFixed(1)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Billable Value</div>
              <div className="text-2xl font-bold">{formatWithSymbol(totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search time entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="billed">Billed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={billableFilter} onValueChange={setBillableFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Billable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="billable">Billable</SelectItem>
              <SelectItem value="non-billable">Non-Billable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No time entries found. Click "Log Time" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(parseISO(entry.entry_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{entry.engagement?.name || '-'}</p>
                        <p className="text-xs text-muted-foreground">{entry.engagement?.client?.legal_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="line-clamp-2">{entry.description || '-'}</p>
                    </TableCell>
                    <TableCell className="font-medium">{entry.hours}</TableCell>
                    <TableCell>
                      {entry.is_billable ? (
                        formatWithSymbol(entry.billing_rate || 0)
                      ) : (
                        <Badge variant="secondary">Non-billable</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {entry.is_billable ? formatWithSymbol(entry.hours * (entry.billing_rate || 0)) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(entry.status)}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>Submit for Approval</DropdownMenuItem>
                          <DropdownMenuItem>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

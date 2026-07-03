import { useState } from 'react';
import { Search, Calendar, AlertTriangle, CheckCircle2, Clock, MoreHorizontal } from 'lucide-react';
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
import { usePMComplianceDeadlines } from '@/hooks/usePracticeManagement';
import { SUPPORTED_COUNTRIES } from '@/types/global';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';

export function PMComplianceTab() {
  const { data: deadlines, isLoading } = usePMComplianceDeadlines();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  const filteredDeadlines = deadlines?.filter(deadline => {
    const matchesSearch = deadline.filing_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deadline.client?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || deadline.status === statusFilter;
    const matchesCountry = countryFilter === 'all' || deadline.country === countryFilter;
    return matchesSearch && matchesStatus && matchesCountry;
  });

  const getDeadlineStatus = (deadline: typeof deadlines[number]) => {
    const dueDate = parseISO(deadline.due_date);
    const daysUntilDue = differenceInDays(dueDate, new Date());
    
    if (deadline.status === 'filed') {
      return { label: 'Filed', variant: 'bg-green-500 text-white', icon: CheckCircle2 };
    }
    if (isPast(dueDate)) {
      return { label: 'Overdue', variant: 'bg-destructive text-destructive-foreground', icon: AlertTriangle };
    }
    if (daysUntilDue <= 7) {
      return { label: 'Due Soon', variant: 'bg-orange-500 text-white', icon: Clock };
    }
    if (daysUntilDue <= 30) {
      return { label: 'Upcoming', variant: 'bg-yellow-500 text-white', icon: Calendar };
    }
    return { label: 'Pending', variant: 'bg-muted text-muted-foreground', icon: Calendar };
  };

  const overdueCount = deadlines?.filter(d => d.status !== 'filed' && isPast(parseISO(d.due_date))).length || 0;
  const dueSoonCount = deadlines?.filter(d => {
    if (d.status === 'filed') return false;
    const daysUntilDue = differenceInDays(parseISO(d.due_date), new Date());
    return daysUntilDue > 0 && daysUntilDue <= 7;
  }).length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Compliance Calendar
            </CardTitle>
            <CardDescription>Track filing deadlines and compliance requirements</CardDescription>
          </div>
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} Overdue
              </Badge>
            )}
            {dueSoonCount > 0 && (
              <Badge className="bg-orange-500 text-white flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {dueSoonCount} Due Soon
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deadlines..."
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="filed">Filed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {Object.entries(SUPPORTED_COUNTRIES).map(([code, info]) => (
                <SelectItem key={code} value={code}>
                  {info.flag} {code}
                </SelectItem>
              ))}
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
                <TableHead>Client</TableHead>
                <TableHead>Filing Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Fiscal Year</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeadlines?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No compliance deadlines found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeadlines?.map((deadline) => {
                  const status = getDeadlineStatus(deadline);
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={deadline.id} className={deadline.status !== 'filed' && isPast(parseISO(deadline.due_date)) ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        <p className="font-medium">{deadline.client?.legal_name || '-'}</p>
                      </TableCell>
                      <TableCell>{deadline.filing_type}</TableCell>
                      <TableCell>
                        {SUPPORTED_COUNTRIES[deadline.country as keyof typeof SUPPORTED_COUNTRIES]?.flag || ''}{' '}
                        {deadline.country}
                        {deadline.jurisdiction && (
                          <span className="text-xs text-muted-foreground block">{deadline.jurisdiction}</span>
                        )}
                      </TableCell>
                      <TableCell>{deadline.fiscal_year || '-'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{format(parseISO(deadline.due_date), 'MMM d, yyyy')}</p>
                          {deadline.extended_due_date && (
                            <p className="text-xs text-muted-foreground">
                              Extended: {format(parseISO(deadline.extended_due_date), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
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
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Mark as Filed</DropdownMenuItem>
                            <DropdownMenuItem>Request Extension</DropdownMenuItem>
                            <DropdownMenuItem>Create Task</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

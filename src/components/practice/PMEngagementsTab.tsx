import { useState } from 'react';
import { Plus, Search, Briefcase, MoreHorizontal } from 'lucide-react';
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
import { usePMEngagements } from '@/hooks/usePracticeManagement';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format, parseISO } from 'date-fns';

interface PMEngagementsTabProps {
  onAddEngagement: () => void;
}

export function PMEngagementsTab({ onAddEngagement }: PMEngagementsTabProps) {
  const { data: engagements, isLoading } = usePMEngagements();
  const { formatWithSymbol } = useCurrencyFormatter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredEngagements = engagements?.filter(eng => {
    const matchesSearch = eng.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eng.client?.legal_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eng.engagement_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || eng.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on_hold': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getBillingDisplay = (eng: typeof engagements[number]) => {
    if (eng.billing_type === 'fixed' && eng.fixed_fee) {
      return formatWithSymbol(eng.fixed_fee);
    } else if (eng.billing_type === 'hourly' && eng.hourly_rate) {
      return `${formatWithSymbol(eng.hourly_rate)}/hr`;
    } else if (eng.billing_type === 'retainer' && eng.retainer_amount) {
      return `${formatWithSymbol(eng.retainer_amount)}/mo`;
    }
    return eng.billing_type;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Engagements
            </CardTitle>
            <CardDescription>Track client engagements and services</CardDescription>
          </div>
          <Button onClick={onAddEngagement}>
            <Plus className="mr-2 h-4 w-4" />
            New Engagement
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search engagements..."
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
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
                <TableHead>Engagement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEngagements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No engagements found. Click "New Engagement" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEngagements?.map((eng) => (
                  <TableRow key={eng.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{eng.name}</p>
                        <p className="text-xs text-muted-foreground">{eng.engagement_number}</p>
                      </div>
                    </TableCell>
                    <TableCell>{eng.client?.legal_name || '-'}</TableCell>
                    <TableCell className="capitalize">{eng.service_type.replace('_', ' ')}</TableCell>
                    <TableCell>{getBillingDisplay(eng)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(parseISO(eng.start_date), 'MMM d, yyyy')}</p>
                        {eng.end_date && (
                          <p className="text-xs text-muted-foreground">
                            to {format(parseISO(eng.end_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(eng.status)}>
                        {eng.status.replace('_', ' ')}
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
                          <DropdownMenuItem>Edit</DropdownMenuItem>
                          <DropdownMenuItem>View Tasks</DropdownMenuItem>
                          <DropdownMenuItem>Time Entries</DropdownMenuItem>
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

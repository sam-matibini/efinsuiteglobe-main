import { useState, useEffect } from 'react';
import { Sparkles, Clock, Mail, MessageSquare, Phone, ArrowRight, CheckCircle, X, Loader2, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { format, differenceInDays, addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface FollowUpSuggestion {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  reason: string;
  suggestedChannel: 'email' | 'sms' | 'call';
  priority: 'high' | 'medium' | 'low';
  suggestedMessage: string;
  dueDate: Date;
  context: string;
  type: 'overdue_invoice' | 'no_recent_contact' | 'pending_reply' | 'scheduled';
}

interface AIFollowupsPanelProps {
  onComposeMessage?: (channel: 'email' | 'sms', to: string, message: string) => void;
}

export function AIFollowupsPanel({ onComposeMessage }: AIFollowupsPanelProps) {
  const { currentOrganization } = useOrganizationContext();
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentOrganization?.id) {
      generateFollowUpSuggestions();
    }
  }, [currentOrganization?.id]);

  const generateFollowUpSuggestions = async () => {
    if (!currentOrganization?.id) return;
    setIsLoading(true);

    try {
      const suggestions: FollowUpSuggestion[] = [];

      // Get overdue invoices
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          due_date,
          total,
          balance_due,
          customer:customers(id, name, email)
        `)
        .eq('organization_id', currentOrganization.id)
        .eq('status', 'overdue')
        .limit(10);

      if (overdueInvoices) {
        overdueInvoices.forEach((inv: any) => {
          if (!inv.customer) return;
          const daysOverdue = differenceInDays(new Date(), parseLocalDate(inv.due_date));
          
          suggestions.push({
            id: `inv-${inv.id}`,
            contactId: inv.customer.id,
            contactName: inv.customer.name,
            contactEmail: inv.customer.email,
            reason: `Invoice ${inv.invoice_number} is ${daysOverdue} days overdue`,
            suggestedChannel: daysOverdue > 14 ? 'call' : 'email',
            priority: daysOverdue > 30 ? 'high' : daysOverdue > 14 ? 'medium' : 'low',
            suggestedMessage: `Hi ${inv.customer.name.split(' ')[0]},\n\nI wanted to follow up regarding Invoice ${inv.invoice_number} for $${inv.balance_due.toFixed(2)}, which was due on ${format(parseLocalDate(inv.due_date), 'MMMM d, yyyy')}.\n\nPlease let me know if you have any questions or if there's anything I can help with.\n\nBest regards`,
            dueDate: new Date(),
            context: `Outstanding balance: $${inv.balance_due.toFixed(2)}`,
            type: 'overdue_invoice',
          });
        });
      }

      // Get customers with no recent communication
      const thirtyDaysAgo = addDays(new Date(), -30).toISOString();
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .limit(20);

      if (customers) {
        // Check each customer's last communication
        for (const customer of customers) {
          const { data: lastConvo } = await supabase
            .from('conversations')
            .select('last_message_at')
            .eq('organization_id', currentOrganization.id)
            .eq('contact_identifier', customer.email || customer.phone || '')
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!lastConvo || new Date(lastConvo.last_message_at) < new Date(thirtyDaysAgo)) {
            suggestions.push({
              id: `nc-${customer.id}`,
              contactId: customer.id,
              contactName: customer.name,
              contactEmail: customer.email || undefined,
              contactPhone: customer.phone || undefined,
              reason: 'No communication in the last 30 days',
              suggestedChannel: 'email',
              priority: 'low',
              suggestedMessage: `Hi ${customer.name.split(' ')[0]},\n\nI hope this message finds you well! I wanted to check in and see how everything is going.\n\nPlease don't hesitate to reach out if there's anything we can help with.\n\nBest regards`,
              dueDate: addDays(new Date(), 3),
              context: lastConvo ? `Last contact: ${format(new Date(lastConvo.last_message_at), 'MMM d, yyyy')}` : 'No previous contact on record',
              type: 'no_recent_contact',
            });
          }
        }
      }

      // Sort by priority
      suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      setSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating follow-up suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleComplete = (id: string) => {
    setCompletedIds(prev => new Set([...prev, id]));
  };

  const handleAction = (suggestion: FollowUpSuggestion) => {
    if (suggestion.suggestedChannel === 'email' && suggestion.contactEmail) {
      onComposeMessage?.('email', suggestion.contactEmail, suggestion.suggestedMessage);
    } else if (suggestion.suggestedChannel === 'sms' && suggestion.contactPhone) {
      onComposeMessage?.('sms', suggestion.contactPhone, suggestion.suggestedMessage);
    }
    handleComplete(suggestion.id);
  };

  const getChannelIcon = (channel: 'email' | 'sms' | 'call') => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'call':
        return <Phone className="w-4 h-4 text-amber-500" />;
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
      case 'low':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
    }
  };

  const visibleSuggestions = suggestions.filter(
    s => !dismissedIds.has(s.id) && !completedIds.has(s.id)
  );

  const highPriority = visibleSuggestions.filter(s => s.priority === 'high');
  const mediumPriority = visibleSuggestions.filter(s => s.priority === 'medium');
  const lowPriority = visibleSuggestions.filter(s => s.priority === 'low');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Analyzing your communications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent</p>
                <p className="text-2xl font-bold">{highPriority.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <Clock className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{mediumPriority.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suggested</p>
                <p className="text-2xl font-bold">{lowPriority.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Sparkles className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Follow-up List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            AI Follow-up Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All ({visibleSuggestions.length})
              </TabsTrigger>
              <TabsTrigger value="urgent">
                Urgent ({highPriority.length})
              </TabsTrigger>
              <TabsTrigger value="invoices">
                Invoices
              </TabsTrigger>
              <TabsTrigger value="engagement">
                Re-engage
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <FollowUpList 
                suggestions={visibleSuggestions}
                onAction={handleAction}
                onDismiss={handleDismiss}
                getChannelIcon={getChannelIcon}
                getPriorityColor={getPriorityColor}
              />
            </TabsContent>

            <TabsContent value="urgent">
              <FollowUpList 
                suggestions={highPriority}
                onAction={handleAction}
                onDismiss={handleDismiss}
                getChannelIcon={getChannelIcon}
                getPriorityColor={getPriorityColor}
              />
            </TabsContent>

            <TabsContent value="invoices">
              <FollowUpList 
                suggestions={visibleSuggestions.filter(s => s.type === 'overdue_invoice')}
                onAction={handleAction}
                onDismiss={handleDismiss}
                getChannelIcon={getChannelIcon}
                getPriorityColor={getPriorityColor}
              />
            </TabsContent>

            <TabsContent value="engagement">
              <FollowUpList 
                suggestions={visibleSuggestions.filter(s => s.type === 'no_recent_contact')}
                onAction={handleAction}
                onDismiss={handleDismiss}
                getChannelIcon={getChannelIcon}
                getPriorityColor={getPriorityColor}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface FollowUpListProps {
  suggestions: FollowUpSuggestion[];
  onAction: (suggestion: FollowUpSuggestion) => void;
  onDismiss: (id: string) => void;
  getChannelIcon: (channel: 'email' | 'sms' | 'call') => React.ReactNode;
  getPriorityColor: (priority: 'high' | 'medium' | 'low') => string;
}

function FollowUpList({ suggestions, onAction, onDismiss, getChannelIcon, getPriorityColor }: FollowUpListProps) {
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">All caught up!</p>
        <p className="text-sm">No follow-ups needed in this category</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {suggestions.map((suggestion) => (
          <Card key={suggestion.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{suggestion.contactName}</span>
                    <Badge className={getPriorityColor(suggestion.priority)}>
                      {suggestion.priority}
                    </Badge>
                    {getChannelIcon(suggestion.suggestedChannel)}
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">{suggestion.context}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDismiss(suggestion.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onAction(suggestion)}
                    className="gap-1"
                  >
                    Follow Up
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { 
  History, Mail, MessageSquare, MessageCircle, Search, Calendar, 
  ArrowUpRight, ArrowDownLeft, Trash2, Sparkles, CheckSquare, Square,
  Loader2, AlertTriangle, CalendarIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { format, subDays, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface CommunicationRecord {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'in_app';
  direction: 'inbound' | 'outbound';
  contactName: string;
  contactIdentifier: string;
  subject?: string;
  preview: string;
  status: string;
  timestamp: Date;
}

interface AICleanupSuggestion {
  category: string;
  description: string;
  messageIds: string[];
  estimatedCount: number;
  reason: string;
}

interface CommunicationHistoryPanelProps {
  onViewConversation?: (contactIdentifier: string, channel: string) => void;
}

export function CommunicationHistoryPanel({ onViewConversation }: CommunicationHistoryPanelProps) {
  const { currentOrganization } = useOrganizationContext();
  const [records, setRecords] = useState<CommunicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  // Deletion state
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // AI cleanup state
  const [showAICleanup, setShowAICleanup] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AICleanupSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (currentOrganization?.id) {
      // Don't fetch if custom is selected but no dates are set
      if (dateFilter === 'custom' && (!customDateRange.from || !customDateRange.to)) {
        return;
      }
      fetchHistory();
    }
  }, [currentOrganization?.id, dateFilter, customDateRange.from, customDateRange.to]);

  const fetchHistory = async () => {
    if (!currentOrganization?.id) return;
    setIsLoading(true);

    try {
      let startDate: Date;
      let endDate: Date | undefined;
      
      switch (dateFilter) {
        case '24hours':
          startDate = subDays(new Date(), 1);
          break;
        case '7days':
          startDate = subDays(new Date(), 7);
          break;
        case '30days':
          startDate = subDays(new Date(), 30);
          break;
        case '90days':
          startDate = subDays(new Date(), 90);
          break;
        case 'custom':
          if (!customDateRange.from || !customDateRange.to) {
            setIsLoading(false);
            return;
          }
          startDate = customDateRange.from;
          // Set end date to end of day
          endDate = new Date(customDateRange.to);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = subDays(new Date(), 7);
      }

      let query = supabase
        .from('messages')
        .select(`
          id,
          channel,
          direction,
          from_identifier,
          to_identifier,
          subject,
          body,
          status,
          created_at,
          conversation:conversations(contact_name, contact_identifier)
        `)
        .eq('organization_id', currentOrganization.id)
        .gte('created_at', startDate.toISOString());
      
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }
      
      const { data: messages, error } = await query
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const historyRecords: CommunicationRecord[] = (messages || []).map((msg: any) => ({
        id: msg.id,
        channel: msg.channel as CommunicationRecord['channel'],
        direction: msg.direction as CommunicationRecord['direction'],
        contactName: msg.conversation?.contact_name || (msg.direction === 'inbound' ? msg.from_identifier : msg.to_identifier),
        contactIdentifier: msg.direction === 'inbound' ? msg.from_identifier : msg.to_identifier,
        subject: msg.subject,
        preview: msg.body?.substring(0, 100) + (msg.body?.length > 100 ? '...' : ''),
        status: msg.status,
        timestamp: new Date(msg.created_at),
      }));

      setRecords(historyRecords);
    } catch (error) {
      console.error('Error fetching communication history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // AI-powered analysis for cleanup suggestions
  const analyzeForCleanup = () => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const suggestions: AICleanupSuggestion[] = [];
      
      // 1. Old failed messages (> 30 days)
      const failedMessages = records.filter(r => 
        r.status === 'failed' && differenceInDays(new Date(), r.timestamp) > 30
      );
      if (failedMessages.length > 0) {
        suggestions.push({
          category: 'Failed Messages',
          description: 'Messages that failed to deliver over 30 days ago',
          messageIds: failedMessages.map(m => m.id),
          estimatedCount: failedMessages.length,
          reason: 'These messages failed to deliver and are unlikely to be needed for reference.',
        });
      }

      // 2. Duplicate-looking messages
      const duplicateCandidates = records.filter((r, index) => {
        const similarMessages = records.filter((other, otherIndex) => 
          otherIndex !== index &&
          other.contactIdentifier === r.contactIdentifier &&
          format(other.timestamp, 'yyyy-MM-dd') === format(r.timestamp, 'yyyy-MM-dd') &&
          other.channel === r.channel &&
          other.direction === r.direction
        );
        return similarMessages.length > 0;
      });
      if (duplicateCandidates.length > 2) {
        suggestions.push({
          category: 'Potential Duplicates',
          description: 'Messages to the same contact on the same day',
          messageIds: duplicateCandidates.slice(0, Math.ceil(duplicateCandidates.length / 2)).map(m => m.id),
          estimatedCount: Math.ceil(duplicateCandidates.length / 2),
          reason: 'These appear to be duplicate or redundant messages that can be safely removed.',
        });
      }

      // 3. Old system/automated messages
      const oldAutoMessages = records.filter(r => 
        r.direction === 'outbound' &&
        differenceInDays(new Date(), r.timestamp) > 60 &&
        (r.preview.toLowerCase().includes('reminder') || 
         r.preview.toLowerCase().includes('notification') ||
         r.preview.toLowerCase().includes('automated'))
      );
      if (oldAutoMessages.length > 0) {
        suggestions.push({
          category: 'Old Automated Messages',
          description: 'System-generated messages older than 60 days',
          messageIds: oldAutoMessages.map(m => m.id),
          estimatedCount: oldAutoMessages.length,
          reason: 'Automated notifications and reminders are typically not needed after resolution.',
        });
      }

      // 4. Very old messages (> 90 days)
      const veryOldMessages = records.filter(r => 
        differenceInDays(new Date(), r.timestamp) > 90
      );
      if (veryOldMessages.length > 0) {
        suggestions.push({
          category: 'Archived Messages',
          description: 'Messages older than 90 days',
          messageIds: veryOldMessages.map(m => m.id),
          estimatedCount: veryOldMessages.length,
          reason: 'Consider archiving or deleting old messages to free up storage space.',
        });
      }

      setAiSuggestions(suggestions);
      setIsAnalyzing(false);
    }, 1500);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const allIds = new Set(filteredRecords.map(r => r.id));
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const deleteSelectedMessages = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`Deleted ${selectedIds.size} message(s)`);
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirm(false);
      fetchHistory();
    } catch (error) {
      console.error('Error deleting messages:', error);
      toast.error('Failed to delete messages');
    } finally {
      setIsDeleting(false);
    }
  };

  const applySuggestion = (suggestionIndex: number) => {
    const suggestion = aiSuggestions[suggestionIndex];
    const newSelected = new Set(selectedIds);
    
    const newSelectedSuggestions = new Set(selectedSuggestions);
    if (newSelectedSuggestions.has(suggestionIndex)) {
      newSelectedSuggestions.delete(suggestionIndex);
      suggestion.messageIds.forEach(id => newSelected.delete(id));
    } else {
      newSelectedSuggestions.add(suggestionIndex);
      suggestion.messageIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedIds(newSelected);
    setSelectedSuggestions(newSelectedSuggestions);
    setIsSelectionMode(true);
  };

  const applyAllSuggestions = () => {
    const allIds = new Set<string>();
    aiSuggestions.forEach(s => s.messageIds.forEach(id => allIds.add(id)));
    setSelectedIds(allIds);
    setSelectedSuggestions(new Set(aiSuggestions.map((_, i) => i)));
    setIsSelectionMode(true);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4 text-green-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">Delivered</Badge>;
      case 'failed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">Pending</Badge>;
      case 'received':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400">Received</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!record.contactName.toLowerCase().includes(query) &&
            !record.contactIdentifier.toLowerCase().includes(query) &&
            !record.preview.toLowerCase().includes(query) &&
            !(record.subject?.toLowerCase().includes(query))) {
          return false;
        }
      }

      if (channelFilter !== 'all' && record.channel !== channelFilter) {
        return false;
      }

      if (directionFilter !== 'all' && record.direction !== directionFilter) {
        return false;
      }

      return true;
    });
  }, [records, searchQuery, channelFilter, directionFilter]);

  const groupedRecords = useMemo(() => {
    return filteredRecords.reduce((groups, record) => {
      const dateKey = format(record.timestamp, 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(record);
      return groups;
    }, {} as Record<string, CommunicationRecord[]>);
  }, [filteredRecords]);

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const totalEmails = records.filter(r => r.channel === 'email').length;
  const totalSMS = records.filter(r => r.channel === 'sms').length;
  const totalWhatsApp = records.filter(r => r.channel === 'whatsapp').length;
  const inboundCount = records.filter(r => r.direction === 'inbound').length;

  const allSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(r.id));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalEmails}</p>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSMS}</p>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <MessageCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalWhatsApp}</p>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950">
                <ArrowDownLeft className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inboundCount}</p>
                <p className="text-xs text-muted-foreground">Inbound</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5" />
              Communication History
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {isSelectionMode && selectedIds.size > 0 && (
                <Badge variant="secondary" className="gap-1">
                  {selectedIds.size} selected
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAICleanup(true);
                  analyzeForCleanup();
                }}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                AI Cleanup
              </Button>
              {isSelectionMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={selectedIds.size === 0}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedIds.size})
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectionMode(true)}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            {isSelectionMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={allSelected ? clearSelection : selectAll}
                className="gap-2"
              >
                {allSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            )}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={dateFilter} 
              onValueChange={(value) => {
                setDateFilter(value);
                if (value === 'custom') {
                  setShowDatePicker(true);
                }
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="24hours">Last 24 Hours</SelectItem>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            
            {dateFilter === 'custom' && (
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "gap-2 min-w-[200px] justify-start text-left font-normal",
                      !customDateRange.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {customDateRange.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "MMM d, yyyy")} - {format(customDateRange.to, "MMM d, yyyy")}
                        </>
                      ) : (
                        format(customDateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      <span>Pick date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: customDateRange.from, to: customDateRange.to }}
                    onSelect={(range) => {
                      setCustomDateRange({ from: range?.from, to: range?.to });
                      if (range?.from && range?.to) {
                        setShowDatePicker(false);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-start gap-3 p-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                <History className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium">No communication history found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDates.map(dateKey => (
                  <div key={dateKey}>
                    <div className="sticky top-0 bg-background py-2 z-10">
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {groupedRecords[dateKey].map(record => (
                        <div
                          key={record.id}
                          className={`group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${
                            selectedIds.has(record.id) ? 'bg-primary/5 border border-primary/20' : ''
                          }`}
                          onClick={() => {
                            if (isSelectionMode) {
                              toggleSelection(record.id);
                            } else {
                              onViewConversation?.(record.contactIdentifier, record.channel);
                            }
                          }}
                        >
                          {isSelectionMode && (
                            <Checkbox
                              checked={selectedIds.has(record.id)}
                              onCheckedChange={() => toggleSelection(record.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                          )}
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                            {getChannelIcon(record.channel)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{record.contactName}</span>
                              {record.direction === 'inbound' ? (
                                <ArrowDownLeft className="w-3 h-3 text-blue-500" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                              )}
                              {getStatusBadge(record.status)}
                            </div>
                            {record.subject && (
                              <p className="text-sm font-medium text-foreground">{record.subject}</p>
                            )}
                            <p className="text-sm text-muted-foreground truncate">{record.preview}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(record.timestamp, 'h:mm a')}
                            </p>
                          </div>
                          {!isSelectionMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedIds(new Set([record.id]));
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Messages
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} message(s)? 
              This action cannot be undone and will permanently remove the messages from your communication history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelectedMessages}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Cleanup Dialog */}
      <Dialog open={showAICleanup} onOpenChange={setShowAICleanup}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI-Powered Cleanup Suggestions
            </DialogTitle>
            <DialogDescription>
              Our AI has analyzed your communication history and identified messages that can be safely deleted to free up storage.
            </DialogDescription>
          </DialogHeader>

          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Analyzing your messages...</p>
            </div>
          ) : aiSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckSquare className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-medium">Your inbox is clean!</p>
              <p className="text-sm">No cleanup suggestions at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {aiSuggestions.reduce((sum, s) => sum + s.estimatedCount, 0)} messages can be cleaned up
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={applyAllSuggestions}
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select All Suggestions
                </Button>
              </div>

              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {aiSuggestions.map((suggestion, index) => (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all ${
                        selectedSuggestions.has(index) 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-muted-foreground/50'
                      }`}
                      onClick={() => applySuggestion(index)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedSuggestions.has(index)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium">{suggestion.category}</h4>
                              <Badge variant="secondary">{suggestion.estimatedCount} messages</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {suggestion.description}
                            </p>
                            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                              💡 {suggestion.reason}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="ghost" onClick={() => setShowAICleanup(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowAICleanup(false);
                    if (selectedIds.size > 0) {
                      setShowDeleteConfirm(true);
                    }
                  }}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedIds.size})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
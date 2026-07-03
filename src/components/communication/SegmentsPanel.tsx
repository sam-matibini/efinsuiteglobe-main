import { useState, useEffect } from 'react';
import { UsersRound, Plus, Mail, MessageSquare, Search, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useContacts, Contact } from '@/hooks/useContacts';
import { toast } from 'sonner';

interface Segment {
  id: string;
  name: string;
  description: string;
  criteria: SegmentCriteria;
  contactCount: number;
  color: string;
  createdAt: Date;
}

interface SegmentCriteria {
  source?: 'customer' | 'vendor' | 'all';
  isActive?: boolean;
  hasEmail?: boolean;
  hasPhone?: boolean;
  city?: string;
  tags?: string[];
}

interface SegmentsPanelProps {
  onSendToSegment?: (contactIds: string[], channel: 'email' | 'sms') => void;
}

// Predefined segments
const DEFAULT_SEGMENTS: Segment[] = [
  {
    id: 'active-customers',
    name: 'Active Customers',
    description: 'All active customers with valid contact information',
    criteria: { source: 'customer', isActive: true },
    contactCount: 0,
    color: 'emerald',
    createdAt: new Date(),
  },
  {
    id: 'email-subscribers',
    name: 'Email Subscribers',
    description: 'Contacts with email addresses',
    criteria: { hasEmail: true },
    contactCount: 0,
    color: 'blue',
    createdAt: new Date(),
  },
  {
    id: 'sms-enabled',
    name: 'SMS Enabled',
    description: 'Contacts with phone numbers for SMS',
    criteria: { hasPhone: true },
    contactCount: 0,
    color: 'purple',
    createdAt: new Date(),
  },
  {
    id: 'vendors',
    name: 'All Vendors',
    description: 'Vendor contacts for business communications',
    criteria: { source: 'vendor' },
    contactCount: 0,
    color: 'amber',
    createdAt: new Date(),
  },
];

export function SegmentsPanel({ onSendToSegment }: SegmentsPanelProps) {
  const { filteredContacts, isLoading: isLoadingContacts } = useContacts();
  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [segmentContacts, setSegmentContacts] = useState<Contact[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDescription, setNewSegmentDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate contact counts for each segment
  useEffect(() => {
    if (!filteredContacts.length) return;

    const updatedSegments = segments.map(segment => ({
      ...segment,
      contactCount: getContactsForSegment(segment.criteria).length,
    }));

    setSegments(updatedSegments);
  }, [filteredContacts]);

  const getContactsForSegment = (criteria: SegmentCriteria): Contact[] => {
    return filteredContacts.filter(contact => {
      if (criteria.source && criteria.source !== 'all') {
        if (contact.source !== criteria.source) return false;
      }
      if (criteria.isActive !== undefined) {
        if (contact.is_active !== criteria.isActive) return false;
      }
      if (criteria.hasEmail) {
        if (!contact.email) return false;
      }
      if (criteria.hasPhone) {
        if (!contact.cell_phone && !contact.phone) return false;
      }
      if (criteria.city) {
        if (contact.city?.toLowerCase() !== criteria.city.toLowerCase()) return false;
      }
      return true;
    });
  };

  const handleSelectSegment = (segment: Segment) => {
    setSelectedSegment(segment);
    const contacts = getContactsForSegment(segment.criteria);
    setSegmentContacts(contacts);
  };

  const handleCreateSegment = () => {
    if (!newSegmentName.trim()) {
      toast.error('Please enter a segment name');
      return;
    }

    const newSegment: Segment = {
      id: `custom-${Date.now()}`,
      name: newSegmentName,
      description: newSegmentDescription,
      criteria: { source: 'all' },
      contactCount: filteredContacts.length,
      color: 'slate',
      createdAt: new Date(),
    };

    setSegments([...segments, newSegment]);
    setNewSegmentName('');
    setNewSegmentDescription('');
    setShowCreateDialog(false);
    toast.success('Segment created successfully');
  };

  const handleSendEmail = () => {
    if (!selectedSegment || segmentContacts.length === 0) return;
    const contactIds = segmentContacts.filter(c => c.email).map(c => c.id);
    onSendToSegment?.(contactIds, 'email');
    toast.success(`Preparing email for ${contactIds.length} contacts`);
  };

  const handleSendSMS = () => {
    if (!selectedSegment || segmentContacts.length === 0) return;
    const contactIds = segmentContacts.filter(c => c.cell_phone || c.phone).map(c => c.id);
    onSendToSegment?.(contactIds, 'sms');
    toast.success(`Preparing SMS for ${contactIds.length} contacts`);
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
      blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900',
      purple: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-900',
      amber: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
      slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-900',
    };
    return colors[color] || colors.slate;
  };

  const filteredSegmentContacts = segmentContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UsersRound className="w-5 h-5" />
            Customer Segments
          </h2>
          <p className="text-sm text-muted-foreground">
            Group contacts for targeted messaging campaigns
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Segment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Segments List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Segments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {segments.map(segment => (
                    <div
                      key={segment.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedSegment?.id === segment.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleSelectSegment(segment)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{segment.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {segment.description}
                          </p>
                        </div>
                        <Badge className={getColorClasses(segment.color)}>
                          {segment.contactCount}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Segment Details */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            {selectedSegment ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedSegment.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedSegment.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendEmail}
                        disabled={segmentContacts.filter(c => c.email).length === 0}
                        className="gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Send Email
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendSMS}
                        disabled={segmentContacts.filter(c => c.cell_phone || c.phone).length === 0}
                        className="gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Send SMS
                      </Button>
                    </div>
                  </div>
                  <div className="relative mt-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts in segment..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {isLoadingContacts ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredSegmentContacts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Users className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-medium">No contacts in this segment</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredSegmentContacts.map(contact => (
                          <div
                            key={contact.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
                              <Users className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{contact.name}</div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-sky-500" />
                                    {contact.email}
                                  </span>
                                )}
                                {(contact.cell_phone || contact.phone) && (
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3 text-amber-500" />
                                    {contact.cell_phone || contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {contact.source}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <UsersRound className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a segment</p>
                <p className="text-sm mt-1">Choose a segment to view its contacts</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Segment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Segment</DialogTitle>
            <DialogDescription>
              Create a custom segment to group contacts for targeted messaging.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="segment-name">Segment Name</Label>
              <Input
                id="segment-name"
                placeholder="e.g., VIP Customers"
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment-description">Description</Label>
              <Textarea
                id="segment-description"
                placeholder="Describe this segment..."
                value={newSegmentDescription}
                onChange={(e) => setNewSegmentDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSegment}>
              Create Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

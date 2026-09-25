import { useState, useMemo } from 'react';
import { Search, Plus, User, Building, Briefcase, X, Users, GripVertical, Mail, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCustomers } from '@/hooks/useCustomers';
import { useVendors } from '@/hooks/useVendors';
import { useEmployees } from '@/hooks/useEmployees';

export interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'vendor' | 'employee' | 'manual';
  role?: string;
  signingOrder?: number;
}

interface RecipientPickerProps {
  recipients: Recipient[];
  onAddRecipient: (recipient: Recipient) => void;
  onRemoveRecipient: (recipientId: string) => void;
  onUpdateRecipientOrder?: (recipientId: string, order: number) => void;
  onReorderRecipients?: (recipients: Recipient[]) => void;
  allowMultiple?: boolean;
  showSigningOrder?: boolean;
}

export function RecipientPicker({
  recipients,
  onAddRecipient,
  onRemoveRecipient,
  onReorderRecipients,
  allowMultiple = true,
  showSigningOrder = false,
}: RecipientPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'customers' | 'vendors' | 'employees' | 'manual'>('all');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualRole, setManualRole] = useState('Signer');
  
  // Quick add state
  const [quickEmails, setQuickEmails] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  
  // Drag state for reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { customers, isLoading: customersLoading } = useCustomers();
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { employees, isLoading: employeesLoading } = useEmployees();

  const isLoading = customersLoading || vendorsLoading || employeesLoading;

  // Combine all contacts for "All" tab
  const allContacts = useMemo(() => {
    const contacts: { id: string; name: string; email: string; type: 'customer' | 'vendor' | 'employee' }[] = [];
    
    customers.forEach(c => {
      if (c.email) {
        contacts.push({
          id: `customer-${c.id}`,
          name: c.name,
          email: c.email,
          type: 'customer',
        });
      }
    });

    vendors.forEach(v => {
      if (v.email) {
        contacts.push({
          id: `vendor-${v.id}`,
          name: v.name,
          email: v.email,
          type: 'vendor',
        });
      }
    });

    employees.forEach(e => {
      if (e.email) {
        contacts.push({
          id: `employee-${e.id}`,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
          email: e.email,
          type: 'employee',
        });
      }
    });

    return contacts;
  }, [customers, vendors, employees]);

  // Filter contacts based on search and tab
  const filteredContacts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let contacts = allContacts;

    if (selectedTab !== 'all' && selectedTab !== 'manual') {
      contacts = allContacts.filter(c => c.type === selectedTab.slice(0, -1) as 'customer' | 'vendor' | 'employee');
    }

    if (query) {
      contacts = contacts.filter(
        c => c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)
      );
    }

    // Exclude already added recipients
    const addedEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    return contacts.filter(c => !addedEmails.has(c.email.toLowerCase()));
  }, [allContacts, searchQuery, selectedTab, recipients]);

  const handleSelectContact = (contact: { id: string; name: string; email: string; type: 'customer' | 'vendor' | 'employee' }) => {
    const newRecipient: Recipient = {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      type: contact.type,
      role: 'Signer',
      signingOrder: recipients.length + 1,
    };
    onAddRecipient(newRecipient);
    
    if (!allowMultiple) {
      setDialogOpen(false);
    }
    setSearchQuery('');
  };

  const handleAddManualRecipient = () => {
    if (!manualEmail || !manualName) return;
    
    const newRecipient: Recipient = {
      id: `manual-${Date.now()}`,
      name: manualName,
      email: manualEmail,
      type: 'manual',
      role: manualRole || 'Signer',
      signingOrder: recipients.length + 1,
    };
    onAddRecipient(newRecipient);
    setManualName('');
    setManualEmail('');
    setManualRole('Signer');
    
    if (!allowMultiple) {
      setDialogOpen(false);
    }
  };

  // Quick add multiple recipients from comma/newline separated emails
  const handleQuickAdd = () => {
    if (!quickEmails.trim()) return;
    
    // Parse emails (comma, semicolon, or newline separated)
    const emailsArray = quickEmails
      .split(/[,;\n]+/)
      .map(e => e.trim())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    
    const addedEmails = new Set(recipients.map(r => r.email.toLowerCase()));
    let orderOffset = recipients.length;
    
    emailsArray.forEach((email, index) => {
      if (!addedEmails.has(email.toLowerCase())) {
        addedEmails.add(email.toLowerCase());
        const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const newRecipient: Recipient = {
          id: `quick-${Date.now()}-${index}`,
          name: name,
          email: email,
          type: 'manual',
          role: 'Signer',
          signingOrder: orderOffset + index + 1,
        };
        onAddRecipient(newRecipient);
      }
    });
    
    setQuickEmails('');
    setShowQuickAdd(false);
  };

  // Reorder handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && onReorderRecipients) {
      const newRecipients = [...recipients];
      const [removed] = newRecipients.splice(draggedIndex, 1);
      newRecipients.splice(dragOverIndex, 0, removed);
      // Update signing orders
      const reordered = newRecipients.map((r, idx) => ({ ...r, signingOrder: idx + 1 }));
      onReorderRecipients(reordered);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveRecipient = (index: number, direction: 'up' | 'down') => {
    if (!onReorderRecipients) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= recipients.length) return;
    
    const newRecipients = [...recipients];
    [newRecipients[index], newRecipients[newIndex]] = [newRecipients[newIndex], newRecipients[index]];
    const reordered = newRecipients.map((r, idx) => ({ ...r, signingOrder: idx + 1 }));
    onReorderRecipients(reordered);
  };

  const getTypeIcon = (type: Recipient['type']) => {
    switch (type) {
      case 'customer': return <Building className="w-3.5 h-3.5" />;
      case 'vendor': return <Briefcase className="w-3.5 h-3.5" />;
      case 'employee': return <User className="w-3.5 h-3.5" />;
      default: return <User className="w-3.5 h-3.5" />;
    }
  };

  const getTypeBadgeColor = (type: Recipient['type']) => {
    switch (type) {
      case 'customer': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'vendor': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'employee': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Add Section */}
      <div className="space-y-2">
        {!showQuickAdd ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setShowQuickAdd(true)}
            >
              <Mail className="w-4 h-4 mr-2" />
              Quick Add by Email
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="flex-1">
                  <Users className="w-4 h-4 mr-2" />
                  Browse Contacts
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-accent" />
                    Add Recipients
                  </DialogTitle>
                  <DialogDescription>
                    Search for existing contacts or add a new recipient manually.
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)} className="mt-4">
                  <TabsList className="w-full grid grid-cols-5">
                    <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                    <TabsTrigger value="customers" className="text-xs">Customers</TabsTrigger>
                    <TabsTrigger value="vendors" className="text-xs">Vendors</TabsTrigger>
                    <TabsTrigger value="employees" className="text-xs">Employees</TabsTrigger>
                    <TabsTrigger value="manual" className="text-xs">Manual</TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input
                        placeholder="Enter recipient's name"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        placeholder="recipient@example.com"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role (optional)</Label>
                      <Input
                        placeholder="e.g., Signer, Witness, Approver"
                        value={manualRole}
                        onChange={(e) => setManualRole(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleAddManualRecipient}
                      disabled={!manualName || !manualEmail}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Recipient
                    </Button>
                  </TabsContent>

                  {(['all', 'customers', 'vendors', 'employees'] as const).map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-4">
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>

                        <ScrollArea className="h-[250px]">
                          {isLoading ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              Loading contacts...
                            </div>
                          ) : filteredContacts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                              <Users className="w-8 h-8 mb-2 opacity-50" />
                              <p className="text-sm">No contacts found</p>
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => setSelectedTab('manual')}
                              >
                                Add manually instead
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {filteredContacts.map((contact) => (
                                <button
                                  key={contact.id}
                                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
                                  onClick={() => handleSelectContact(contact)}
                                >
                                  <div className={cn(
                                    'w-9 h-9 rounded-full flex items-center justify-center',
                                    contact.type === 'customer' && 'bg-blue-100 text-blue-700',
                                    contact.type === 'vendor' && 'bg-purple-100 text-purple-700',
                                    contact.type === 'employee' && 'bg-green-100 text-green-700',
                                  )}>
                                    {getTypeIcon(contact.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {contact.type}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>

                {recipients.length > 0 && (
                  <>
                    <div className="border-t pt-4 mt-2">
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Added Recipients ({recipients.length})
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {recipients.map((r) => (
                          <Badge
                            key={r.id}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {r.name}
                            <button
                              className="ml-1 rounded-full hover:bg-background/50 p-0.5"
                              onClick={() => onRemoveRecipient(r.id)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Quick Add Recipients</Label>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowQuickAdd(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter email addresses separated by commas, semicolons, or new lines
            </p>
            <textarea
              className="w-full min-h-[80px] p-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="john@example.com, jane@example.com&#10;bob@example.com"
              value={quickEmails}
              onChange={(e) => setQuickEmails(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleQuickAdd}
                disabled={!quickEmails.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Recipients
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuickEmails('');
                  setShowQuickAdd(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Current Recipients with Signing Order */}
      {recipients.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Recipients ({recipients.length})
              {showSigningOrder && <span className="text-muted-foreground font-normal ml-1">- Signing Order</span>}
            </Label>
          </div>
          
          {showSigningOrder && (
            <p className="text-xs text-muted-foreground">
              Drag to reorder or use arrows to change signing sequence
            </p>
          )}
          
          <ScrollArea className={cn(recipients.length > 4 && 'h-[200px]')}>
            <div className="space-y-2">
              {recipients.map((recipient, index) => (
                <div
                  key={recipient.id}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border bg-background transition-all',
                    showSigningOrder && 'cursor-grab active:cursor-grabbing',
                    draggedIndex === index && 'opacity-50',
                    dragOverIndex === index && 'border-accent border-2'
                  )}
                  draggable={showSigningOrder}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  {showSigningOrder && (
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{recipient.name}</span>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 gap-1', getTypeBadgeColor(recipient.type))}>
                        {getTypeIcon(recipient.type)}
                        <span className="capitalize">{recipient.type}</span>
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                    {recipient.role && recipient.role !== 'Signer' && (
                      <Badge variant="secondary" className="text-[10px] mt-1">{recipient.role}</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {showSigningOrder && onReorderRecipients && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveRecipient(index, 'up')}
                          disabled={index === 0}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => moveRecipient(index, 'down')}
                          disabled={index === recipients.length - 1}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveRecipient(recipient.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty State */}
      {recipients.length === 0 && !showQuickAdd && (
        <div className="text-center py-6 border rounded-lg border-dashed bg-muted/20">
          <Mail className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            No recipients added yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use Quick Add for emails or Browse Contacts to select from your database
          </p>
        </div>
      )}
    </div>
  );
}

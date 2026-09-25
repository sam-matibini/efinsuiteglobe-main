import { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Star, 
  Phone, 
  Mail, 
  Building2, 
  MoreVertical,
  MessageSquare,
  UserCircle,
  Filter,
  MapPin,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useContacts, Contact, ContactSource, type CreateContactInput } from '@/hooks/useContacts';
import { ContactFormDialog } from './ContactFormDialog';
import { cn } from '@/lib/utils';

interface ContactsPanelProps {
  onSelectContact?: (contact: Contact, channel: 'sms' | 'email' | 'whatsapp') => void;
  defaultExpanded?: boolean;
}

export function ContactsPanel({ onSelectContact, defaultExpanded = true }: ContactsPanelProps) {
  const {
    filteredContacts,
    isLoading,
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    createContact,
    updateContact,
    toggleFavorite,
    deleteContact,
  } = useContacts();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showStats, setShowStats] = useState(false);

  const getSourceBadge = (source: ContactSource) => {
    switch (source) {
      case 'customer':
        return <Badge variant="secondary" className="text-xs">Customer</Badge>;
      case 'vendor':
        return <Badge variant="outline" className="text-xs">Vendor</Badge>;
      case 'employee':
        return <Badge className="text-xs bg-hub-voice/20 text-hub-voice border-0">Employee</Badge>;
      case 'other':
        return <Badge variant="outline" className="text-xs">Other</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleOpenCreate = () => {
    setEditingContact(null);
    setCreateDialogOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setCreateDialogOpen(true);
  };

  const handleFormSubmit = async (data: CreateContactInput, isEdit: boolean) => {
    if (isEdit && editingContact) {
      await updateContact(editingContact.id, data);
    } else {
      await createContact(data);
    }
    setEditingContact(null);
  };

  const handleDelete = async (contact: Contact) => {
    if (window.confirm(`Are you sure you want to delete "${contact.name}"?`)) {
      await deleteContact(contact.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Collapsible Stats Section */}
      <Collapsible open={showStats} onOpenChange={setShowStats}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Contact Statistics
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total</p>
                    <p className="text-xl font-bold">{filteredContacts.length}</p>
                  </div>
                  <Users className="w-6 h-6 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Customers</p>
                    <p className="text-xl font-bold">
                      {filteredContacts.filter(c => c.source === 'customer').length}
                    </p>
                  </div>
                  <Building2 className="w-6 h-6 text-hub-contacts/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Vendors</p>
                    <p className="text-xl font-bold">
                      {filteredContacts.filter(c => c.source === 'vendor').length}
                    </p>
                  </div>
                  <Briefcase className="w-6 h-6 text-hub-messages/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Employees</p>
                    <p className="text-xl font-bold">
                      {filteredContacts.filter(c => c.source === 'employee').length}
                    </p>
                  </div>
                  <UserCircle className="w-6 h-6 text-hub-voice/50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Favorites</p>
                    <p className="text-xl font-bold">
                      {filteredContacts.filter(c => c.is_favorite).length}
                    </p>
                  </div>
                  <Star className="w-6 h-6 text-accent/50" />
                </div>
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Contacts List - Collapsible */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="gap-2 p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Contacts
                    <Badge variant="secondary" className="ml-1">{filteredContacts.length}</Badge>
                  </CardTitle>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <Button onClick={handleOpenCreate} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Contact
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardHeader className="pt-0 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as ContactSource | 'all')}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="customer">
                      <span className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-hub-contacts" />
                        Customers
                      </span>
                    </SelectItem>
                    <SelectItem value="vendor">
                      <span className="flex items-center gap-2">
                        <Briefcase className="w-3 h-3 text-hub-messages" />
                        Vendors
                      </span>
                    </SelectItem>
                    <SelectItem value="employee">
                      <span className="flex items-center gap-2">
                        <UserCircle className="w-3 h-3 text-hub-voice" />
                        Employees
                      </span>
                    </SelectItem>
                    <SelectItem value="other">
                      <span className="flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        Others
                      </span>
                    </SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={showFavoritesOnly ? "default" : "outline"}
                  size="icon"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className="shrink-0"
                >
                  <Star className={cn("w-4 h-4", showFavoritesOnly && "fill-current")} />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                        <Skeleton className="w-12 h-12 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Users className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No contacts found</p>
                    <p className="text-sm mt-1">
                      {searchQuery ? 'Try adjusting your search' : 'Add a contact to get started'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{contact.name}</span>
                            {contact.is_favorite && (
                              <Star className="w-4 h-4 text-accent fill-accent shrink-0" />
                            )}
                            {getSourceBadge(contact.source)}
                          </div>
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                            {(contact.cell_phone || contact.phone) && (
                              <span className="flex items-center gap-1 truncate">
                                <Smartphone className="w-3 h-3" />
                                {contact.cell_phone || contact.phone}
                              </span>
                            )}
                            {contact.landline && (
                              <span className="flex items-center gap-1 truncate">
                                <Phone className="w-3 h-3" />
                                {contact.landline}
                              </span>
                            )}
                            {contact.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                            {contact.company && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {contact.company}
                              </span>
                            )}
                            {(contact.city || contact.province) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {[contact.city, contact.province].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Quick action toggle buttons */}
                          {(contact.cell_phone || contact.phone) && onSelectContact && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-hub-voice/20 hover:bg-hub-voice/30 text-hub-voice rounded-md transition-colors"
                              onClick={() => onSelectContact(contact, 'sms')}
                              title="Call"
                            >
                              <Phone className="w-4 h-4" />
                            </Button>
                          )}
                          {(contact.cell_phone || contact.phone) && onSelectContact && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-hub-messages/20 hover:bg-hub-messages/30 text-hub-messages rounded-md transition-colors"
                              onClick={() => onSelectContact(contact, 'whatsapp')}
                              title="Send WhatsApp"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          )}
                          {contact.email && onSelectContact && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-hub-contacts/20 hover:bg-hub-contacts/30 text-hub-contacts rounded-md transition-colors"
                              onClick={() => onSelectContact(contact, 'email')}
                              title="Send Email"
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toggleFavorite(contact.id, contact.is_favorite)}>
                                <Star className={cn("w-4 h-4 mr-2", contact.is_favorite && "fill-current text-accent")} />
                                {contact.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                              </DropdownMenuItem>
                              {contact.source === 'manual' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleOpenEdit(contact)}>
                                    Edit Contact
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDelete(contact)}
                                  >
                                    Delete Contact
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Create/Edit Dialog */}
      <ContactFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        editingContact={editingContact}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}

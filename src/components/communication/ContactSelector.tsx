import { useState, useMemo } from 'react';
import { Check, ChevronDown, User, Building2, Users, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContacts, Contact, ContactSource } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

export type ContactChannel = 'email' | 'phone' | 'sms' | 'whatsapp' | 'voice';

interface ContactSelectorProps {
  channel: ContactChannel;
  value?: string;
  contactName?: string;
  onSelect: (contact: Contact, value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ContactSelector({
  channel,
  value,
  contactName,
  onSelect,
  placeholder = 'Select contact...',
  disabled = false,
  className,
}: ContactSelectorProps) {
  const { contacts } = useContacts();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Filter contacts based on channel and search
  const filteredContacts = useMemo(() => {
    const query = search.toLowerCase();
    return contacts.filter(c => {
      // Check if contact has valid field for channel
      let hasValidField = false;
      if (channel === 'email') {
        hasValidField = !!c.email;
      } else {
        // phone, sms, whatsapp, voice all need phone numbers
        hasValidField = !!(c.phone || c.cell_phone || c.landline);
      }
      
      if (!hasValidField) return false;

      // Search match
      const matchesSearch = !query || 
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query) ||
        c.cell_phone?.includes(query) ||
        c.landline?.includes(query) ||
        c.company?.toLowerCase().includes(query);
      
      return matchesSearch;
    });
  }, [contacts, channel, search]);

  // Group contacts by source
  const groupedContacts = useMemo(() => {
    const groups: Record<string, Contact[]> = {
      customer: [],
      vendor: [],
      employee: [],
      manual: [],
      other: [],
    };

    filteredContacts.forEach(c => {
      const source = c.source || 'manual';
      if (groups[source]) {
        groups[source].push(c);
      } else {
        groups.other.push(c);
      }
    });

    return groups;
  }, [filteredContacts]);

  // Get contact value based on channel
  const getContactValue = (contact: Contact): string => {
    if (channel === 'email') {
      return contact.email || '';
    }
    return contact.cell_phone || contact.phone || contact.landline || '';
  };

  // Get source icon
  const getSourceIcon = (source: ContactSource) => {
    switch (source) {
      case 'customer':
        return <Building2 className="w-3 h-3 text-hub-contacts" />;
      case 'vendor':
        return <Briefcase className="w-3 h-3 text-hub-messages" />;
      case 'employee':
        return <Users className="w-3 h-3 text-hub-voice" />;
      default:
        return <User className="w-3 h-3 text-muted-foreground" />;
    }
  };

  // Get source label
  const getSourceLabel = (source: string): string => {
    switch (source) {
      case 'customer': return 'Customers';
      case 'vendor': return 'Vendors';
      case 'employee': return 'Employees';
      case 'manual': return 'Manual Contacts';
      case 'other': return 'Others';
      default: return source;
    }
  };

  const handleSelect = (contact: Contact) => {
    const contactValue = getContactValue(contact);
    onSelect(contact, contactValue);
    setOpen(false);
    setSearch('');
  };

  const displayValue = contactName || value || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !displayValue && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate flex items-center gap-2">
            <User className="w-4 h-4 shrink-0" />
            {displayValue || placeholder}
          </span>
          <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search contacts..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <ScrollArea className="h-[300px]">
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No contacts found
              </CommandEmpty>
              
              {Object.entries(groupedContacts).map(([source, sourceContacts]) => {
                if (sourceContacts.length === 0) return null;
                
                return (
                  <CommandGroup 
                    key={source} 
                    heading={
                      <span className="flex items-center gap-1.5">
                        {getSourceIcon(source as ContactSource)}
                        {getSourceLabel(source)}
                        <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                          {sourceContacts.length}
                        </Badge>
                      </span>
                    }
                  >
                    {sourceContacts.map((contact) => {
                      const contactValue = getContactValue(contact);
                      const isSelected = value === contactValue;
                      
                      return (
                        <CommandItem
                          key={contact.id}
                          value={contact.id}
                          onSelect={() => handleSelect(contact)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "w-4 h-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{contact.name}</span>
                              {contact.is_favorite && (
                                <span className="text-yellow-500">★</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {contactValue}
                              {contact.company && ` • ${contact.company}`}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

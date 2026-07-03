import { useState } from 'react';
import { ChevronDown, User, Briefcase, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useCommunicationSenders, CommunicationSender } from '@/hooks/useCommunicationSenders';
import { cn } from '@/lib/utils';

interface SenderSelectorProps {
  selectedSenderId?: string | null;
  onSelect: (sender: CommunicationSender | null) => void;
  compact?: boolean;
  className?: string;
}

export function SenderSelector({ selectedSenderId, onSelect, compact = false, className }: SenderSelectorProps) {
  const { senders, defaultSender, isLoading } = useCommunicationSenders();
  const [open, setOpen] = useState(false);

  const selectedSender = selectedSenderId 
    ? senders.find(s => s.id === selectedSenderId) 
    : defaultSender;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (senders.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between",
            compact ? "h-9 px-3" : "h-11",
            className
          )}
        >
          {selectedSender ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className={cn(compact ? "h-5 w-5" : "h-6 w-6")}>
                <AvatarImage src={selectedSender.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-accent/10 text-accent">
                  {getInitials(selectedSender.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0">
                <span className={cn("truncate", compact && "text-sm")}>
                  {selectedSender.name}
                </span>
                {!compact && selectedSender.title && (
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedSender.title}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Select sender...
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search senders..." />
          <CommandList>
            <CommandEmpty>No senders found.</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="max-h-[200px]">
                {senders.map((sender) => (
                  <CommandItem
                    key={sender.id}
                    value={sender.name}
                    onSelect={() => {
                      onSelect(sender);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 py-3"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={sender.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-accent/10 text-accent">
                        {getInitials(sender.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{sender.name}</span>
                        {sender.is_default && (
                          <span className="text-[10px] text-accent">(Default)</span>
                        )}
                      </div>
                      {sender.title && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {sender.title}
                        </p>
                      )}
                    </div>
                    {selectedSender?.id === sender.id && (
                      <Check className="h-4 w-4 text-accent" />
                    )}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

import { useState } from 'react';
import { FileText, ChevronDown, Plus, Search, Star, Mail, MessageSquare, MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCommunicationTemplates, TemplateChannel, CommunicationTemplate } from '@/hooks/useCommunicationTemplates';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  channel: TemplateChannel;
  onSelectTemplate: (template: CommunicationTemplate) => void;
  onCreateNew?: () => void;
}

const channelIcons: Record<TemplateChannel, React.ReactNode> = {
  email: <Mail className="h-3 w-3" />,
  sms: <MessageSquare className="h-3 w-3" />,
  whatsapp: <MessagesSquare className="h-3 w-3" />,
  all: <FileText className="h-3 w-3" />,
};

const channelColors: Record<TemplateChannel, string> = {
  email: 'text-hub-contacts bg-hub-contacts/10',
  sms: 'text-hub-voice bg-hub-voice/10',
  whatsapp: 'text-hub-messages bg-hub-messages/10',
  all: 'text-muted-foreground bg-muted',
};

export function TemplateSelector({ channel, onSelectTemplate, onCreateNew }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { templates, isLoading, incrementUseCount } = useCommunicationTemplates(channel);

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.body.toLowerCase().includes(search.toLowerCase()) ||
    t.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (template: CommunicationTemplate) => {
    onSelectTemplate(template);
    incrementUseCount.mutate(template.id);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileText className="h-4 w-4" />
          Templates
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0"
            />
          </div>
        </div>
        
        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-4 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? 'No templates found' : 'No templates yet'}
              </p>
              {onCreateNew && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    onCreateNew();
                  }}
                  className="mt-1"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create first template
                </Button>
              )}
            </div>
          ) : (
            <div className="p-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-md hover:bg-muted/50 transition-colors",
                    "flex flex-col gap-1"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate flex-1">
                      {template.name}
                    </span>
                    {template.is_default && (
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    )}
                    <Badge 
                      variant="secondary" 
                      className={cn("text-[10px] px-1.5 py-0", channelColors[template.channel])}
                    >
                      {channelIcons[template.channel]}
                    </Badge>
                  </div>
                  {template.subject && (
                    <p className="text-xs text-muted-foreground truncate">
                      Subject: {template.subject}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.body}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {template.category && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {template.category}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      Used {template.use_count}x
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {onCreateNew && filteredTemplates.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
              className="w-full justify-start"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new template
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

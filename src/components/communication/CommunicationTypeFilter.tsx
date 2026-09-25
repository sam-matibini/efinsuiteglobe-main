import { Mail, MessageSquare, MessageCircle, Phone, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export type CommunicationType = 'email' | 'sms' | 'whatsapp' | 'call';

interface CommunicationTypeFilterProps {
  selectedTypes: CommunicationType[];
  onTypesChange: (types: CommunicationType[]) => void;
  showCounts?: boolean;
  counts?: Record<CommunicationType, number>;
}

export function CommunicationTypeFilter({
  selectedTypes,
  onTypesChange,
  showCounts = false,
  counts = { email: 0, sms: 0, whatsapp: 0, call: 0 },
}: CommunicationTypeFilterProps) {
  const allTypes: CommunicationType[] = ['email', 'sms', 'whatsapp', 'call'];

  const handleToggle = (type: CommunicationType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    onTypesChange(allTypes);
  };

  const handleClearAll = () => {
    onTypesChange([]);
  };

  const getTypeIcon = (type: CommunicationType) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'call':
        return <Phone className="w-4 h-4 text-amber-500" />;
    }
  };

  const getTypeLabel = (type: CommunicationType) => {
    switch (type) {
      case 'email':
        return 'Email';
      case 'sms':
        return 'SMS';
      case 'whatsapp':
        return 'WhatsApp';
      case 'call':
        return 'Voice Call';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Communication Type
            {selectedTypes.length > 0 && selectedTypes.length < allTypes.length && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {selectedTypes.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 bg-popover">
          <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {allTypes.map(type => (
            <DropdownMenuCheckboxItem
              key={type}
              checked={selectedTypes.includes(type)}
              onCheckedChange={() => handleToggle(type)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1">
                {getTypeIcon(type)}
                <span>{getTypeLabel(type)}</span>
              </div>
              {showCounts && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {counts[type]}
                </Badge>
              )}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <div className="flex items-center justify-between px-2 py-1.5">
            <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 text-xs">
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="h-7 text-xs">
              Clear
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Quick filter badges */}
      <div className="flex items-center gap-1.5">
        {allTypes.map(type => (
          <Badge
            key={type}
            variant={selectedTypes.includes(type) ? 'default' : 'outline'}
            className={`cursor-pointer transition-colors ${
              selectedTypes.includes(type) 
                ? type === 'email' ? 'bg-blue-500 hover:bg-blue-600'
                  : type === 'sms' ? 'bg-purple-500 hover:bg-purple-600'
                  : type === 'whatsapp' ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-amber-500 hover:bg-amber-600'
                : 'hover:bg-muted'
            }`}
            onClick={() => handleToggle(type)}
          >
            {getTypeIcon(type)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

import { 
  PenTool, 
  User, 
  Type, 
  Calendar, 
  CheckSquare, 
  Stamp, 
  Hash,
  MousePointer,
  ZoomIn,
  ZoomOut,
  UserCheck,
  FileSignature,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export const FIELD_TOOLS = [
  { id: 'signature', label: 'Signature', icon: PenTool, color: 'bg-blue-500', category: 'sign' },
  { id: 'initial', label: 'Initials', icon: User, color: 'bg-purple-500', category: 'sign' },
  { id: 'full_name', label: 'Full Name', icon: Type, color: 'bg-green-500', category: 'sign' },
  { id: 'date', label: 'Date', icon: Calendar, color: 'bg-orange-500', category: 'data' },
  { id: 'checkbox', label: 'Checkbox', icon: CheckSquare, color: 'bg-pink-500', category: 'data' },
  { id: 'text', label: 'Text', icon: Hash, color: 'bg-cyan-500', category: 'data' },
  { id: 'stamp', label: 'Stamp/Seal', icon: Stamp, color: 'bg-amber-500', category: 'sign' },
] as const;

export type FieldToolType = typeof FIELD_TOOLS[number]['id'];

interface Signer {
  id: string;
  email: string;
  name: string;
  isSender?: boolean;
}

interface FieldToolsSidebarProps {
  selectedTool: string | null;
  onSelectTool: (toolId: string | null) => void;
  assignToSigner: string;
  onAssignToSigner: (signerId: string) => void;
  allSigners: Signer[];
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const SENDER_SIGNER_ID = 'sender';

export function FieldToolsSidebar({
  selectedTool,
  onSelectTool,
  assignToSigner,
  onAssignToSigner,
  allSigners,
  zoom,
  onZoomChange,
}: FieldToolsSidebarProps) {
  const getSignerBgColor = (signerId: string, index: number) => {
    if (signerId === SENDER_SIGNER_ID) return 'bg-emerald-500';
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    return colors[index % colors.length];
  };

  const signTools = FIELD_TOOLS.filter(t => t.category === 'sign');
  const dataTools = FIELD_TOOLS.filter(t => t.category === 'data');

  return (
    <div className="w-60 border-r bg-card flex flex-col shadow-sm">
      {/* Header with E-Sign branding */}
      <div className="p-4 border-b bg-gradient-to-r from-accent/10 to-transparent">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-sm">E-Sign</h3>
        </div>
      </div>

      {/* Fill and Sign Yourself Section */}
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Fill and Sign Yourself
        </p>
        <Tabs defaultValue="sign" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="sign" className="text-xs gap-1.5">
              <PenTool className="w-3.5 h-3.5" />
              Sign
            </TabsTrigger>
            <TabsTrigger value="signer" className="text-xs gap-1.5">
              <User className="w-3.5 h-3.5" />
              Signer
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sign" className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">Quick actions for self-signing</p>
          </TabsContent>
          <TabsContent value="signer" className="mt-2">
            <p className="text-xs text-muted-foreground mb-2">Assign to specific signers</p>
          </TabsContent>
        </Tabs>
      </div>

      <Separator />

      {/* Field Tools Section */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Field Tools Header */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Field Tools
            </p>
            
            {/* Select Tool */}
            <Button
              variant={selectedTool === null || selectedTool === 'select' ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start mb-1 h-9"
              onClick={() => onSelectTool(null)}
            >
              <MousePointer className="w-4 h-4 mr-3" />
              <span className="font-medium">Select</span>
            </Button>
          </div>

          {/* Signature Fields */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Signature Fields
            </p>
            <div className="space-y-0.5">
              {signTools.map((tool) => (
                <Button
                  key={tool.id}
                  variant={selectedTool === tool.id ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start h-9',
                    selectedTool === tool.id && `${tool.color} hover:${tool.color}/90 text-white`
                  )}
                  onClick={() => onSelectTool(tool.id)}
                >
                  <tool.icon className="w-4 h-4 mr-3" />
                  <span className="font-medium">{tool.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Data Fields */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Data Fields
            </p>
            <div className="space-y-0.5">
              {dataTools.map((tool) => (
                <Button
                  key={tool.id}
                  variant={selectedTool === tool.id ? 'default' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start h-9',
                    selectedTool === tool.id && `${tool.color} hover:${tool.color}/90 text-white`
                  )}
                  onClick={() => onSelectTool(tool.id)}
                >
                  <tool.icon className="w-4 h-4 mr-3" />
                  <span className="font-medium">{tool.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Assign To Section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Assign Fields To
            </p>
            <div className="space-y-1">
              {allSigners.map((signer, index) => {
                const isSender = signer.isSender;
                return (
                  <button
                    key={signer.id}
                    className={cn(
                      'w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left text-xs transition-all',
                      assignToSigner === signer.id 
                        ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-accent/50' 
                        : 'hover:bg-muted/80'
                    )}
                    onClick={() => onAssignToSigner(signer.id)}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm',
                      getSignerBgColor(signer.id, index)
                    )}>
                      {isSender ? <UserCheck className="w-3.5 h-3.5" /> : index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block truncate">
                        {isSender ? 'Me (Sender)' : (signer.name || 'Recipient')}
                      </span>
                      {!isSender && signer.email && (
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {signer.email}
                        </span>
                      )}
                    </div>
                    {assignToSigner === signer.id && (
                      <div className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
      
      {/* Zoom Controls Footer */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => onZoomChange(Math.max(50, zoom - 25))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center">
            <span className="text-sm font-medium">{zoom}%</span>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => onZoomChange(Math.min(200, zoom + 25))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Type, 
  ArrowDownUp, 
  AlignLeft, 
  Smile, 
  Briefcase, 
  Check, 
  X,
  Loader2,
  ChevronRight,
  FileText,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AIAction = 'compose' | 'rewrite' | 'grammar' | 'shorten' | 'expand' | 'professional' | 'friendly';

interface AIDraft {
  draft: string;
  style: string;
}

interface AIComposeAssistantProps {
  channel: 'email' | 'sms' | 'whatsapp';
  currentMessage: string;
  onApplyDraft: (text: string) => void;
  className?: string;
}

const AI_ACTIONS = [
  { action: 'rewrite' as AIAction, label: 'Rewrite', icon: Wand2, description: 'Improve clarity and flow' },
  { action: 'grammar' as AIAction, label: 'Fix Grammar', icon: Type, description: 'Fix spelling & grammar' },
  { action: 'shorten' as AIAction, label: 'Shorten', icon: ArrowDownUp, description: 'Make it concise' },
  { action: 'expand' as AIAction, label: 'Expand', icon: AlignLeft, description: 'Add more detail' },
  { action: 'professional' as AIAction, label: 'Professional', icon: Briefcase, description: 'Formal business tone' },
  { action: 'friendly' as AIAction, label: 'Friendly', icon: Smile, description: 'Warm, approachable tone' },
];

export function AIComposeAssistant({ 
  channel, 
  currentMessage, 
  onApplyDraft,
  className 
}: AIComposeAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [composePrompt, setComposePrompt] = useState('');
  const [drafts, setDrafts] = useState<AIDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);

  const handleAIAction = async (action: AIAction) => {
    const content = action === 'compose' ? composePrompt : currentMessage;
    
    if (!content.trim()) {
      toast.error(action === 'compose' ? 'Enter a prompt first' : 'Enter message content first');
      return;
    }

    setIsProcessing(true);
    setActiveAction(action);
    setDrafts([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('compose-ai-assistant', {
        body: { action, content, channel, numDrafts: 3 },
      });

      if (error) throw error;

      if (data?.drafts && data.drafts.length > 0) {
        setDrafts(data.drafts);
        setShowDrafts(true);
        toast.success(`${data.drafts.length} drafts generated!`);
      } else if (data?.result) {
        onApplyDraft(data.result);
        setIsOpen(false);
        toast.success(action === 'compose' ? 'Message composed!' : 'Message updated!');
      }
    } catch (err: any) {
      console.error('AI error:', err);
      if (err.message?.includes('429')) {
        toast.error('Rate limit exceeded. Please wait a moment.');
      } else if (err.message?.includes('402')) {
        toast.error('AI credits exhausted. Please add funds.');
      } else {
        toast.error(err.message || 'AI assistant failed');
      }
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };

  const selectDraft = (draft: AIDraft) => {
    onApplyDraft(draft.draft);
    setDrafts([]);
    setShowDrafts(false);
    setComposePrompt('');
    setIsOpen(false);
    toast.success(`"${draft.style}" applied`);
  };

  const resetView = () => {
    setShowDrafts(false);
    setDrafts([]);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-200 dark:border-violet-800 hover:from-violet-500/20 hover:to-purple-500/20 text-violet-700 dark:text-violet-300",
            className
          )}
        >
          <Sparkles className="w-4 h-4" />
          AI Assistant
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[420px] p-0 bg-popover" 
        align="start"
        side="top"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">AI Communication Assistant</h4>
              <p className="text-xs text-muted-foreground">Word Co-pilot style drafts</p>
            </div>
          </div>
          {showDrafts && (
            <Button variant="ghost" size="sm" onClick={resetView}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[450px]">
          {!showDrafts ? (
            <div className="p-4 space-y-4">
              {/* Compose from prompt */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Compose from Prompt
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., 'Thank you for your payment'"
                    value={composePrompt}
                    onChange={(e) => setComposePrompt(e.target.value)}
                    className="flex-1 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAIAction('compose');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleAIAction('compose')}
                    disabled={isProcessing || !composePrompt.trim()}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {isProcessing && activeAction === 'compose' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Quick Actions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wand2 className="w-4 h-4 text-blue-500" />
                  Improve Current Message
                </div>
                <p className="text-xs text-muted-foreground">
                  Select an action to transform your message into 3 style options
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {AI_ACTIONS.map(({ action, label, icon: Icon, description }) => (
                    <Button
                      key={action}
                      variant="outline"
                      size="sm"
                      className="justify-start h-auto py-2 px-3"
                      onClick={() => handleAIAction(action)}
                      disabled={isProcessing || !currentMessage.trim()}
                    >
                      <div className="flex items-start gap-2 w-full">
                        {isProcessing && activeAction === action ? (
                          <Loader2 className="w-4 h-4 mt-0.5 animate-spin shrink-0" />
                        ) : (
                          <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="text-left min-w-0">
                          <div className="font-medium text-xs">{label}</div>
                          <div className="text-xs text-muted-foreground truncate">{description}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {!currentMessage.trim() && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
                  💡 Type a message first to use the improvement actions, or use "Compose from Prompt" above.
                </p>
              )}
            </div>
          ) : (
            /* Draft Selection View */
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-emerald-500" />
                Choose a Draft
              </div>
              <p className="text-xs text-muted-foreground">
                Click on a draft to apply it to your message
              </p>

              <div className="space-y-3">
                {drafts.map((draft, index) => (
                  <Card 
                    key={index}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                    onClick={() => selectDraft(draft)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {draft.style}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Use
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                        {draft.draft}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

import { useState, useEffect } from 'react';
import { Save, X, FileText, Mail, MessageSquare, MessagesSquare, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCommunicationTemplates, TemplateChannel, CommunicationTemplate, CreateTemplateInput } from '@/hooks/useCommunicationTemplates';

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTemplate?: CommunicationTemplate | null;
  defaultChannel?: TemplateChannel;
}

const CATEGORIES = [
  'follow-up',
  'reminder',
  'greeting',
  'invoice',
  'thank-you',
  'appointment',
  'promotion',
  'notification',
  'other',
];

const COMMON_VARIABLES = [
  '{{name}}',
  '{{first_name}}',
  '{{company}}',
  '{{date}}',
  '{{time}}',
  '{{amount}}',
  '{{link}}',
];

export function TemplateFormDialog({ 
  open, 
  onOpenChange, 
  editTemplate,
  defaultChannel = 'all' 
}: TemplateFormDialogProps) {
  const { createTemplate, updateTemplate } = useCommunicationTemplates();
  
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<TemplateChannel>(defaultChannel);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (editTemplate) {
      setName(editTemplate.name);
      setChannel(editTemplate.channel);
      setSubject(editTemplate.subject || '');
      setBody(editTemplate.body);
      setCategory(editTemplate.category || '');
      setIsDefault(editTemplate.is_default);
    } else {
      setName('');
      setChannel(defaultChannel);
      setSubject('');
      setBody('');
      setCategory('');
      setIsDefault(false);
    }
  }, [editTemplate, defaultChannel, open]);

  const extractVariables = (text: string): string[] => {
    const regex = /\{\{[^}]+\}\}/g;
    const matches = text.match(regex) || [];
    return [...new Set(matches)];
  };

  const handleInsertVariable = (variable: string) => {
    setBody(prev => prev + variable);
  };

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;

    const variables = extractVariables(body + (subject || ''));

    const input: CreateTemplateInput = {
      name: name.trim(),
      channel,
      subject: channel === 'email' ? subject.trim() : undefined,
      body: body.trim(),
      category: category || undefined,
      variables,
      is_default: isDefault,
    };

    try {
      if (editTemplate) {
        await updateTemplate.mutateAsync({ id: editTemplate.id, ...input });
      } else {
        await createTemplate.mutateAsync(input);
      }
      onOpenChange(false);
    } catch {
      // Error handled in hook
    }
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {editTemplate ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Template Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Follow-up Email"
            />
          </div>

          {/* Channel & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Channel *</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-hub-contacts" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-hub-voice" />
                      SMS/MMS
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <MessagesSquare className="h-4 w-4 text-hub-messages" />
                      WhatsApp
                    </div>
                  </SelectItem>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      All Channels
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject (Email only) */}
          {channel === 'email' && (
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>
          )}

          {/* Body */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message Body *</Label>
              <div className="flex items-center gap-1">
                <Wand2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Insert variable:</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {COMMON_VARIABLES.map(variable => (
                <Badge
                  key={variable}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 text-xs"
                  onClick={() => handleInsertVariable(variable)}
                >
                  {variable}
                </Badge>
              ))}
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message template..."
              className="min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{variable}}'} syntax for dynamic content. Variables will be replaced when sending.
            </p>
          </div>

          {/* Default Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Set as Default</Label>
              <p className="text-xs text-muted-foreground">
                Default template appears first in selection
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!name.trim() || !body.trim() || isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

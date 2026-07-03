import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Mail, Phone, MessageCircle, Loader2, Paperclip, X, FileText, User, Building2, Sparkles, Check, ChevronDown, Wand2, Type, ArrowDownUp, AlignLeft, Smile, Briefcase, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCommunicationIdentity } from '@/hooks/useCommunicationIdentity';
import { useCommunicationSenders } from '@/hooks/useCommunicationSenders';
import { useContacts, Contact } from '@/hooks/useContacts';
import { buildShortSignature, buildEmailSignature, ResolvedIdentity } from '@/utils/communicationIdentity';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TemplateSelector } from './TemplateSelector';
import { TemplateFormDialog } from './TemplateFormDialog';
import { SignaturePreview } from './branding/SignaturePreview';
import { SenderSelector } from './SenderSelector';
import { CommunicationTemplate } from '@/hooks/useCommunicationTemplates';

interface ComposeMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (
    channel: 'email' | 'sms' | 'whatsapp',
    to: string,
    body: string,
    options?: { 
      subject?: string; 
      mediaUrls?: string[];
      attachments?: Array<{ url: string; filename?: string; mimeType?: string }>;
      branding?: {
        logoUrl?: string;
        displayName?: string;
        signatureHtml?: string;
        phone?: string;
        email?: string;
        website?: string;
        address?: string;
      };
    }
  ) => Promise<boolean>;
  initialChannel?: 'email' | 'sms' | 'whatsapp';
  initialTo?: string;
  contactName?: string;
}

type AIAction = 'compose' | 'rewrite' | 'grammar' | 'shorten' | 'expand' | 'professional' | 'friendly';

interface AIDraft {
  draft: string;
  style: string;
}

export function ComposeMessageDialog({
  open,
  onOpenChange,
  onSend,
  initialChannel = 'sms',
  initialTo = '',
  contactName = '',
}: ComposeMessageDialogProps) {
  const { identity, getChannelEnabled } = useCommunicationIdentity();
  const { senders, defaultSender } = useCommunicationSenders();
  const { contacts } = useContacts();
  
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>(initialChannel);
  const [to, setTo] = useState(initialTo);
  const [selectedContactName, setSelectedContactName] = useState(contactName);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAICompose, setShowAICompose] = useState(false);
  const [aiDrafts, setAiDrafts] = useState<AIDraft[]>([]);
  const [showDraftSelection, setShowDraftSelection] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get active sender
  const activeSender = selectedSenderId 
    ? senders.find(s => s.id === selectedSenderId) 
    : defaultSender;

  // Reset form when dialog opens with new values
  useEffect(() => {
    if (open) {
      setChannel(initialChannel);
      setTo(initialTo);
      setSelectedContactName(contactName);
      setSubject('');
      setBody('');
      setAttachedFiles([]);
      setUploadedMediaUrls([]);
      setAiPrompt('');
      setShowAICompose(false);
      setAiDrafts([]);
      setShowDraftSelection(false);
    }
  }, [open, initialChannel, initialTo, contactName]);

  // Filter contacts based on search and channel
  const filteredContacts = useMemo(() => {
    const query = contactSearch.toLowerCase();
    return contacts.filter(c => {
      const hasValidField = channel === 'email' 
        ? !!c.email 
        : !!(c.phone || c.cell_phone || c.landline);
      
      const matchesSearch = 
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query) ||
        c.cell_phone?.includes(query) ||
        c.company?.toLowerCase().includes(query);
      
      return hasValidField && matchesSearch;
    });
  }, [contacts, contactSearch, channel]);

  // Handle contact selection
  const handleContactSelect = (contact: Contact) => {
    const value = channel === 'email' 
      ? contact.email || ''
      : contact.cell_phone || contact.phone || contact.landline || '';
    setTo(value);
    setSelectedContactName(contact.name);
    setContactPopoverOpen(false);
    setContactSearch('');
  };

  // Get contact display value
  const getContactDisplayValue = (contact: Contact) => {
    if (channel === 'email') {
      return contact.email || '';
    }
    return contact.cell_phone || contact.phone || contact.landline || '';
  };

  // AI Assistant function - now generates multiple drafts
  const handleAIAction = async (action: AIAction) => {
    const content = action === 'compose' ? aiPrompt : body;
    
    if (!content.trim()) {
      toast.error(action === 'compose' ? 'Enter a prompt first' : 'Enter message content first');
      return;
    }

    setIsAIProcessing(true);
    setAiDrafts([]);
    setShowDraftSelection(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('compose-ai-assistant', {
        body: { action, content, channel, numDrafts: 3 },
      });

      if (error) throw error;

      if (data?.drafts && data.drafts.length > 0) {
        setAiDrafts(data.drafts);
        setShowDraftSelection(true);
        setShowAICompose(false);
        toast.success(`${data.drafts.length} drafts generated! Select one below.`);
      } else if (data?.result) {
        // Fallback for single result
        setBody(data.result);
        setShowAICompose(false);
        setAiPrompt('');
        toast.success(action === 'compose' ? 'Message composed!' : 'Message updated!');
      }
    } catch (err: any) {
      console.error('AI error:', err);
      toast.error(err.message || 'AI assistant failed');
    } finally {
      setIsAIProcessing(false);
    }
  };

  // Select a draft from the generated options
  const selectDraft = (draft: AIDraft) => {
    setBody(draft.draft);
    setAiDrafts([]);
    setShowDraftSelection(false);
    setAiPrompt('');
    toast.success(`"${draft.style}" draft selected`);
  };

  // Handle template selection
  const handleSelectTemplate = (template: CommunicationTemplate) => {
    // Replace variables with placeholders or keep as-is
    let templateBody = template.body;
    
    // If we have a selected contact name, replace {{name}} variable
    if (selectedContactName) {
      templateBody = templateBody.replace(/\{\{name\}\}/gi, selectedContactName);
      templateBody = templateBody.replace(/\{\{first_name\}\}/gi, selectedContactName.split(' ')[0] || selectedContactName);
    }
    
    // Replace company variable if available from selected contact
    const selectedContact = contacts.find(c => 
      (channel === 'email' && c.email === to) ||
      (channel !== 'email' && (c.cell_phone === to || c.phone === to))
    );
    if (selectedContact?.company) {
      templateBody = templateBody.replace(/\{\{company\}\}/gi, selectedContact.company);
    }
    
    // Replace date and time
    templateBody = templateBody.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString());
    templateBody = templateBody.replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    setBody(templateBody);
    
    // Set subject for email templates
    if (template.subject && channel === 'email') {
      let templateSubject = template.subject;
      if (selectedContactName) {
        templateSubject = templateSubject.replace(/\{\{name\}\}/gi, selectedContactName);
      }
      setSubject(templateSubject);
    }
    
    toast.success(`Template "${template.name}" applied`);
  };

  // Save current message as template
  const handleSaveAsTemplate = () => {
    if (!body.trim()) {
      toast.error('Write a message first before saving as template');
      return;
    }
    setShowTemplateForm(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxSize = channel === 'email' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    const maxSizeLabel = channel === 'email' ? '20MB' : '5MB';
    
    const filesToAdd = Array.from(files).filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds ${maxSizeLabel} limit`);
        return false;
      }
      return true;
    });

    if (attachedFiles.length + filesToAdd.length > 10) {
      toast.error('Maximum 10 attachments allowed');
      return;
    }

    setAttachedFiles(prev => [...prev, ...filesToAdd]);

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      const maxSize = channel === 'email' ? 20 * 1024 * 1024 : 5 * 1024 * 1024; // 20MB for email, 5MB for others
      
      for (const file of filesToAdd) {
        if (file.size > maxSize) {
          toast.error(`${file.name} exceeds ${channel === 'email' ? '20MB' : '5MB'} limit`);
          continue;
        }
        
        const fileName = `${channel === 'email' ? 'email-attachments' : 'mms-attachments'}/${Date.now()}-${file.name}`;
        const { error } = await supabase
          .storage
          .from('documents')
          .upload(fileName, file, { upsert: true });

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase
          .storage
          .from('documents')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl);
        }
      }
      setUploadedMediaUrls(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      console.error('Upload exception:', err);
      toast.error('Failed to upload attachments');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadedMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearForm = () => {
    setTo('');
    setSelectedContactName('');
    setSubject('');
    setBody('');
    setAttachedFiles([]);
    setUploadedMediaUrls([]);
    setAiPrompt('');
    setShowAICompose(false);
    setAiDrafts([]);
    setShowDraftSelection(false);
  };

  // Build resolved identity object from hook data
  const resolvedIdentity: ResolvedIdentity | null = identity ? {
    displayName: identity.display_name,
    legalName: identity.legal_name,
    logoUrl: identity.logo_url,
    logoPosition: identity.logo_position || 'left',
    signatureHtml: identity.signature_html,
    signaturePlainText: identity.signature_plain_text,
    signatureImageUrl: identity.signature_image_url,
    phone: identity.phone,
    email: identity.email,
    website: identity.website,
    address: [
      identity.address_line1,
      identity.address_line2,
      identity.city,
      identity.province,
      identity.postal_code,
      identity.country,
    ].filter(Boolean).join(', ') || null,
  } : null;

  // Get signature based on channel - includes sender details
  const getSignaturePreview = () => {
    if (!resolvedIdentity) return null;
    
    const channelKey = channel as 'email' | 'sms' | 'whatsapp';
    const isEnabled = getChannelEnabled(channelKey);
    
    if (!isEnabled) return null;

    // Build identity with sender-specific overrides
    const senderEnhancedIdentity: ResolvedIdentity = {
      ...resolvedIdentity,
      // Override with sender's contact info if available
      phone: activeSender?.phone || resolvedIdentity.phone,
      email: activeSender?.email || resolvedIdentity.email,
    };

    if (channel === 'email') {
      return buildEmailSignature(senderEnhancedIdentity, activeSender?.name, activeSender?.title);
    } else {
      // Use enhanced signature with contact details for SMS/WhatsApp
      // For WhatsApp: preventLinkPreview breaks URL to avoid dark banner
      return buildShortSignature(senderEnhancedIdentity, activeSender?.name, activeSender?.title, {
        phone: activeSender?.phone || senderEnhancedIdentity.phone || '+1 778 902 0442',
        email: activeSender?.email || senderEnhancedIdentity.email || 'info@efinsuite.com',
        website: senderEnhancedIdentity.website || 'https://globe.efinsuite.com/',
        channel: channel as 'sms' | 'whatsapp',
        preventLinkPreview: channel === 'whatsapp', // Break URL to prevent dark banner
      });
    }
  };

  const signaturePreview = getSignaturePreview();

  const handleSubmit = async () => {
    if (!to || !body) return;

    setIsSending(true);
    try {
      // Build branding data from identity
      const brandingData = resolvedIdentity && getChannelEnabled(channel) ? {
        logoUrl: resolvedIdentity.logoUrl || undefined,
        displayName: resolvedIdentity.displayName || resolvedIdentity.legalName || undefined,
        signatureHtml: channel === 'email' ? resolvedIdentity.signatureHtml || undefined : undefined,
        phone: resolvedIdentity.phone || undefined,
        email: resolvedIdentity.email || undefined,
        website: resolvedIdentity.website || undefined,
        address: resolvedIdentity.address || undefined,
      } : undefined;

      // Append signature to body for SMS/WhatsApp
      let finalBody = body;
      if (signaturePreview && channel !== 'email') {
        finalBody = body + signaturePreview;
      }

      // Build email attachments array
      const emailAttachments = channel === 'email' && uploadedMediaUrls.length > 0
        ? uploadedMediaUrls.map((url, i) => ({
            url,
            filename: attachedFiles[i]?.name,
            mimeType: attachedFiles[i]?.type,
          }))
        : undefined;

      const result = await onSend(
        channel,
        to,
        finalBody,
        {
          subject: channel === 'email' ? subject || 'Message from eFinsuite' : undefined,
          mediaUrls: (channel === 'sms' || channel === 'whatsapp') && uploadedMediaUrls.length > 0 ? uploadedMediaUrls : undefined,
          attachments: emailAttachments,
          branding: brandingData,
        }
      );

      if (result) {
        onOpenChange(false);
        clearForm();
      }
    } finally {
      setIsSending(false);
    }
  };

  const getChannelLabel = () => {
    switch (channel) {
      case 'email': return 'Email';
      case 'sms': return attachedFiles.length > 0 ? 'MMS' : 'SMS';
      case 'whatsapp': return 'WhatsApp';
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[900px] h-[85vh] max-h-[800px] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5 text-accent" />
            {selectedContactName ? `Message to ${selectedContactName}` : 'Compose Message'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Main compose area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-5">
                {/* Sender Selection */}
                {senders.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Sending as</Label>
                    <SenderSelector
                      selectedSenderId={selectedSenderId}
                      onSelect={(sender) => setSelectedSenderId(sender?.id || null)}
                      className="w-full"
                    />
                    {activeSender?.title && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {activeSender.title}
                      </p>
                    )}
                  </div>
                )}

                {/* Channel Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Channel</Label>
                  <Select value={channel} onValueChange={(v) => {
                    setChannel(v as 'email' | 'sms' | 'whatsapp');
                    setTo('');
                    setSelectedContactName('');
                  }}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-primary" />
                          SMS / MMS
                        </div>
                      </SelectItem>
                      <SelectItem value="whatsapp">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-accent" />
                          WhatsApp
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-secondary-foreground" />
                          Email
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Recipient with searchable dropdown */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {channel === 'email' ? 'Email Address' : 'Phone Number (E.164)'}
                  </Label>
                  <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={contactPopoverOpen}
                        className="w-full h-11 justify-between font-normal"
                      >
                        <span className={cn("truncate", !to && "text-muted-foreground")}>
                          {to ? (
                            selectedContactName ? `${selectedContactName} (${to})` : to
                          ) : (
                            `Select or enter ${channel === 'email' ? 'email' : 'phone'}...`
                          )}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder={`Search contacts or enter ${channel === 'email' ? 'email' : 'phone'}...`}
                          value={contactSearch}
                          onValueChange={setContactSearch}
                        />
                        <CommandList className="max-h-[300px]">
                          <CommandEmpty>
                            <div className="p-4 text-center">
                              <p className="text-sm text-muted-foreground mb-3">No contacts found</p>
                              {contactSearch && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTo(contactSearch);
                                    setSelectedContactName('');
                                    setContactPopoverOpen(false);
                                    setContactSearch('');
                                  }}
                                >
                                  Use "{contactSearch}"
                                </Button>
                              )}
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Contacts">
                            {filteredContacts.map((contact) => (
                              <CommandItem
                                key={contact.id}
                                value={`${contact.name} ${getContactDisplayValue(contact)}`}
                                onSelect={() => handleContactSelect(contact)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {getContactDisplayValue(contact)}
                                      {contact.company && ` • ${contact.company}`}
                                    </p>
                                  </div>
                                  {to === getContactDisplayValue(contact) && (
                                    <Check className="w-4 h-4 text-accent shrink-0" />
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {/* Manual input fallback */}
                  <Input
                    placeholder={channel === 'email' ? 'Or type email directly...' : 'Or type phone directly...'}
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setSelectedContactName('');
                    }}
                    className="h-10"
                  />
                </div>

                {/* Subject - Email only */}
                {channel === 'email' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Subject</Label>
                    <Input
                      placeholder="Message subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="h-11"
                    />
                  </div>
                )}

                {/* AI Compose Section */}
                {showAICompose && (
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-lg border border-violet-200 dark:border-violet-800 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                      <Sparkles className="w-4 h-4" />
                      AI Compose Assistant
                    </div>
                    <Textarea
                      placeholder="Describe the message you want to write... e.g., 'A follow-up email about the pending invoice'"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="min-h-[80px] bg-background"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAIAction('compose')}
                        disabled={isAIProcessing || !aiPrompt.trim()}
                        className="bg-violet-600 hover:bg-violet-700"
                      >
                        {isAIProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-1" />
                            Generate
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAICompose(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Message Body with AI Tools */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Message</Label>
                    <div className="flex items-center gap-1">
                      {/* Template Selector */}
                      <TemplateSelector
                        channel={channel}
                        onSelectTemplate={handleSelectTemplate}
                        onCreateNew={() => setShowTemplateForm(true)}
                      />
                      
                      {/* Save as Template */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={handleSaveAsTemplate}
                        disabled={!body.trim()}
                        title="Save as template"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      
                      <Separator orientation="vertical" className="h-4 mx-1" />
                      
                      {!showAICompose && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                          onClick={() => setShowAICompose(true)}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Compose
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            disabled={!body.trim() || isAIProcessing}
                          >
                            {isAIProcessing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Wand2 className="w-3 h-3 mr-1" />
                                AI Tools
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleAIAction('grammar')}>
                            <Type className="w-4 h-4 mr-2" />
                            Fix Grammar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAIAction('rewrite')}>
                            <Wand2 className="w-4 h-4 mr-2" />
                            Rewrite & Improve
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAIAction('shorten')}>
                            <ArrowDownUp className="w-4 h-4 mr-2" />
                            Make Shorter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAIAction('expand')}>
                            <AlignLeft className="w-4 h-4 mr-2" />
                            Expand & Elaborate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAIAction('professional')}>
                            <Briefcase className="w-4 h-4 mr-2" />
                            Make Professional
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAIAction('friendly')}>
                            <Smile className="w-4 h-4 mr-2" />
                            Make Friendly
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Type your message..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="min-h-[180px] resize-none"
                  />
                </div>

                {/* AI Draft Selection - Word Co-pilot Style */}
                {aiDrafts.length > 0 && (
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-lg border border-violet-200 dark:border-violet-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                        <Sparkles className="w-4 h-4" />
                        Select a Draft
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setAiDrafts([]);
                          setShowDraftSelection(false);
                        }}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                    <div className="grid gap-3">
                      {aiDrafts.map((draft, index) => (
                        <div
                          key={index}
                          className="bg-background rounded-lg border p-3 cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/50 transition-colors group"
                          onClick={() => selectDraft(draft)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                              {draft.style}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Use This
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                            {draft.draft}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments - All channels */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Paperclip className="w-4 h-4" />
                    {channel === 'email' 
                      ? 'Attachments' 
                      : channel === 'whatsapp' 
                        ? 'Media Attachment' 
                        : 'Attachments (MMS)'}
                  </Label>
                  
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md text-sm"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(0)}KB)
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={channel !== 'whatsapp'}
                    accept={channel === 'email' 
                      ? '*/*' 
                      : 'image/jpeg,image/png,image/gif,application/pdf,video/mp4,audio/mpeg,audio/ogg'}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || (channel === 'whatsapp' ? attachedFiles.length >= 1 : attachedFiles.length >= 10)}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Paperclip className="w-4 h-4 mr-2" />
                        {channel === 'email' 
                          ? 'Add Attachment' 
                          : channel === 'whatsapp' 
                            ? 'Add Image/File' 
                            : 'Add Attachment'}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {channel === 'email'
                      ? 'Attach any file type. Max 10 files, 20MB each.'
                      : channel === 'whatsapp' 
                        ? 'Supported: JPG, PNG, GIF, PDF, MP4, MP3. 1 file per message, max 5MB.'
                        : 'Supported: JPG, PNG, GIF, PDF. Max 10 files, 5MB each.'}
                  </p>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Signature Preview Sidebar */}
          <div className="w-80 border-l bg-muted/30 flex flex-col shrink-0">
            <div className="p-4 border-b">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <User className="w-4 h-4" />
                Signature Preview
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {identity ? (
                  <>
                    {/* Full Signature Preview - Uses sender details, not recipient */}
                    <SignaturePreview
                      identity={identity}
                      senderName={activeSender?.name || 'Your Name'}
                      senderTitle={activeSender?.title || 'Team Member'}
                      variant="full"
                    />

                    {/* Channel-Specific Signature */}
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {channel === 'email' ? 'Email Signature Block' : 'SMS/WhatsApp Signature'}
                      </Label>
                      
                      {signaturePreview ? (
                        <div className="bg-background rounded-md p-3 border text-sm">
                          {channel === 'email' ? (
                            <div 
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: signaturePreview }}
                            />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground">
                              {signaturePreview}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No signature configured for this channel.
                        </p>
                      )}
                    </div>

                    {/* Channel Status */}
                    <div className="pt-2">
                      <Badge 
                        variant={getChannelEnabled(channel) ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {getChannelEnabled(channel) ? 'Branding Enabled' : 'Branding Disabled'}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No branding configured.</p>
                    <p className="text-xs mt-1">
                      Set up your identity in the Branding tab.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex justify-between items-center shrink-0">
          <div className="text-sm text-muted-foreground">
            {attachedFiles.length > 0 && (
              <span>{attachedFiles.length} attachment{attachedFiles.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => { onOpenChange(false); clearForm(); }} 
              disabled={isSending || isUploading}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90 min-w-[120px]"
              disabled={isSending || isUploading || !to || !body}
              onClick={handleSubmit}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send {getChannelLabel()}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Template Form Dialog for saving new templates */}
    <TemplateFormDialog
      open={showTemplateForm}
      onOpenChange={setShowTemplateForm}
      defaultChannel={channel}
    />
    </>
  );
}

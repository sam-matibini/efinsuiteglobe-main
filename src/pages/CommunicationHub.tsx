import { useState, useRef } from 'react';
import { 
  MessageSquare, 
  Users, 
  Search, 
  Mail, 
  Phone, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Send, 
  MessageCircle, 
  Loader2, 
  Inbox, 
  ArrowLeft, 
  RefreshCw, 
  Settings2, 
  Paperclip, 
  X,
  History,
  Sparkles,
  UsersRound,
  Plus,
  FileText,
  ImageIcon,
  Mic,
  User,
  Globe,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMessages, MessageChannel } from '@/hooks/useMessages';
import { useContacts, Contact } from '@/hooks/useContacts';
import { VoiceCallPanel } from '@/components/communication/VoiceCallPanel';
import { HybridClickToCall } from '@/components/communication/voice/HybridClickToCall';
import { CallHistoryPanel } from '@/components/communication/voice/CallHistoryPanel';
import { VoiceRatesPanel } from '@/components/communication/voice/VoiceRatesPanel';
import { VoiceSettingsPanel } from '@/components/communication/VoiceSettingsPanel';
import { ContactsPanel } from '@/components/communication/ContactsPanel';
import { BrandingSettingsPanel } from '@/components/communication/branding/BrandingSettingsPanel';
import { ComposeMessageDialog } from '@/components/communication/ComposeMessageDialog';
import { AIDocumentFinder } from '@/components/communication/AIDocumentFinder';
import { buildAndUploadDocumentPdf } from '@/lib/communicationAttachments';
import { AIFollowupsPanel } from '@/components/communication/AIFollowupsPanel';
import { CommunicationHistoryPanel } from '@/components/communication/CommunicationHistoryPanel';
import { SegmentsPanel } from '@/components/communication/SegmentsPanel';
import { CommunicationTypeFilter, CommunicationType } from '@/components/communication/CommunicationTypeFilter';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCommunicationSenders } from '@/hooks/useCommunicationSenders';
import { useCommunicationIdentity } from '@/hooks/useCommunicationIdentity';
import { resolveIdentity, buildShortSignature, buildEmailSignature } from '@/utils/communicationIdentity';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { CommunicationTemplate } from '@/hooks/useCommunicationTemplates';
import { TemplateSelector } from '@/components/communication/TemplateSelector';
import { TemplateFormDialog } from '@/components/communication/TemplateFormDialog';
import { AIComposeAssistant } from '@/components/communication/AIComposeAssistant';
import efinsuiteGlobeLogo from '@/assets/efinsuite-globe-logo.png';

// Default contact details for signature
const DEFAULT_CONTACT = {
  phone: '+1 778 902 0442',
  email: 'info@efinsuite.com',
  website: 'https://globe.efinsuite.com/',
};

export default function CommunicationHub() {
  const { currentOrganization } = useOrganizationContext();
  const {
    conversations,
    messages,
    selectedConversation,
    isLoadingConversations,
    isLoadingMessages,
    totalUnreadCount,
    fetchConversations,
    selectConversation,
    sendMessage,
    setSelectedConversation,
  } = useMessages();

  const { filteredContacts, isLoading: isLoadingContacts, searchQuery: contactSearch, setSearchQuery: setContactSearch } = useContacts();
  const { defaultSender } = useCommunicationSenders();
  const { identity } = useCommunicationIdentity();

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeChannel, setComposeChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [composeContactName, setComposeContactName] = useState('');
  
  // Inline compose form state
  const [activeComposeTab, setActiveComposeTab] = useState<'email' | 'sms' | 'whatsapp' | 'history' | 'segments' | 'ai-followups'>('email');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [toField, setToField] = useState('');
  const [subjectField, setSubjectField] = useState('');
  const [messageField, setMessageField] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [communicationTypeFilter, setCommunicationTypeFilter] = useState<CommunicationType[]>(['email', 'sms', 'whatsapp', 'call']);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle template selection
  const handleSelectTemplate = (template: CommunicationTemplate) => {
    let templateBody = template.body;
    
    // If we have a selected contact name, replace {{name}} variable
    if (selectedContact?.name) {
      templateBody = templateBody.replace(/\{\{name\}\}/gi, selectedContact.name);
      templateBody = templateBody.replace(/\{\{first_name\}\}/gi, selectedContact.name.split(' ')[0] || selectedContact.name);
    }
    
    // Replace company variable if available
    if (selectedContact?.company) {
      templateBody = templateBody.replace(/\{\{company\}\}/gi, selectedContact.company);
    }
    
    // Replace date/time variables
    templateBody = templateBody.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString());
    templateBody = templateBody.replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    setMessageField(templateBody);
    
    // Set subject if template has one and we're in email mode
    if (template.subject && activeComposeTab === 'email') {
      let templateSubject = template.subject;
      if (selectedContact?.name) {
        templateSubject = templateSubject.replace(/\{\{name\}\}/gi, selectedContact.name);
      }
      setSubjectField(templateSubject);
    }
  };

  // Handle AI assistant applying a draft
  const handleApplyAIDraft = (text: string) => {
    setMessageField(text);
  };

  // Handle contact selection from sidebar
  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    if (activeComposeTab === 'email') {
      setToField(contact.email || '');
    } else {
      setToField(contact.cell_phone || contact.phone || '');
    }
  };

  // Handle quick compose from contacts panel
  const handleQuickCompose = (contact: Contact, channel: 'sms' | 'email' | 'whatsapp') => {
    setComposeChannel(channel);
    setComposeTo(channel === 'email' ? (contact.email || '') : (contact.cell_phone || contact.phone || ''));
    setComposeContactName(contact.name);
    setComposeOpen(true);
  };

  const clearComposeForm = () => {
    setComposeTo('');
    setComposeContactName('');
  };

  // Handle file upload for attachments
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxSize = activeComposeTab === 'email' ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    const maxSizeLabel = activeComposeTab === 'email' ? '20MB' : '5MB';

    setIsUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > maxSize) {
          toast.error(`${file.name} exceeds ${maxSizeLabel} limit`);
          continue;
        }

        const folder = activeComposeTab === 'email' ? 'email-attachments' : 'mms-attachments';
        const fileName = `${folder}/${Date.now()}-${file.name}`;
        
        const { error } = await supabase.storage
          .from('documents')
          .upload(fileName, file, { upsert: true });

        if (error) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          setAttachments(prev => [...prev, urlData.publicUrl]);
        }
      }
      toast.success('Files attached');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload files');
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Get signature for messages
  const getSignature = async (channel: 'email' | 'sms' | 'whatsapp'): Promise<string> => {
    if (!currentOrganization?.id) return '';

    try {
      const resolved = await resolveIdentity(currentOrganization.id);
      if (!resolved) return '';

      if (channel === 'email') {
        return buildEmailSignature(resolved, defaultSender?.name, defaultSender?.title, {
          phone: defaultSender?.phone || DEFAULT_CONTACT.phone,
          email: defaultSender?.email || DEFAULT_CONTACT.email,
          website: DEFAULT_CONTACT.website,
        });
      } else {
        // For WhatsApp: preventLinkPreview breaks URL to avoid dark banner
        return buildShortSignature(resolved, defaultSender?.name, defaultSender?.title, {
          phone: defaultSender?.phone || DEFAULT_CONTACT.phone,
          email: defaultSender?.email || DEFAULT_CONTACT.email,
          website: DEFAULT_CONTACT.website,
          channel: channel,
          preventLinkPreview: channel === 'whatsapp', // Break URL to prevent dark banner
        });
      }
    } catch (err) {
      console.error('Error getting signature:', err);
      return '';
    }
  };

  // Get filename from URL
  const getFileName = (url: string): string => {
    try {
      const pathname = new URL(url).pathname;
      const segments = pathname.split('/');
      const fileName = segments[segments.length - 1];
      const match = fileName.match(/^\d+-(.+)$/);
      return match ? match[1] : fileName;
    } catch {
      return 'Attachment';
    }
  };

  // Check if URL is an image
  const isImageUrl = (url: string): boolean => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  };

  // Handle inline send
  const handleInlineSend = async () => {
    if (!toField.trim() || !messageField.trim()) {
      toast.error('Please enter recipient and message');
      return;
    }

    setIsSending(true);
    try {
      const channel = activeComposeTab as MessageChannel;
      const signature = await getSignature(activeComposeTab as 'email' | 'sms' | 'whatsapp');
      const finalBody = messageField.trim() + signature;

      await sendMessage(
        channel,
        toField.trim(),
        finalBody,
        {
          subject: activeComposeTab === 'email' ? subjectField : undefined,
          mediaUrls: attachments.length > 0 ? attachments : undefined,
        }
      );

      // Clear form
      setToField('');
      setSubjectField('');
      setMessageField('');
      setAttachments([]);
      setSelectedContact(null);
      toast.success(`${activeComposeTab === 'email' ? 'Email' : 'Message'} sent successfully!`);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // Stats calculations
  const totalCustomers = filteredContacts.filter(c => c.source === 'customer').length;
  const emailsSent = conversations.filter(c => c.channel === 'email').length;
  const smsSent = conversations.filter(c => c.channel === 'sms').length;
  const activeCustomers = filteredContacts.filter(c => c.is_active).length;

  // Get company display name
  const companyName = identity?.display_name || identity?.legal_name || currentOrganization?.name || 'Your Company';
  const companyEmail = defaultSender?.email || DEFAULT_CONTACT.email;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img 
                src={efinsuiteGlobeLogo} 
                alt="efinsuite Globe" 
                className="w-14 h-14 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  efinsuite Globe
                </h1>
                <p className="text-sm text-muted-foreground">
                  Global AI-Powered Accounting, Payroll & Financial Management
                </p>
                <p className="text-xs text-primary font-medium">
                  globe.efinsuite.com
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchConversations()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <UsersRound className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10">
                <Mail className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Emails Sent</p>
                <p className="text-2xl font-bold">{emailsSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <MessageSquare className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">SMS Sent</p>
                <p className="text-2xl font-bold">{smsSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Phone className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Customers</p>
                <p className="text-2xl font-bold">{activeCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList className="inline-flex h-auto gap-2 bg-transparent p-1">
          <TabsTrigger value="compose" className="hub-tab hub-tab-messages">
            <MessageSquare className="w-4 h-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="inbox" className="hub-tab hub-tab-messages">
            <Inbox className="w-4 h-4" />
            Inbox
            {totalUnreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                {totalUnreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="hub-tab hub-tab-contacts">
            <Users className="w-4 h-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="voice" className="hub-tab hub-tab-voice">
            <Phone className="w-4 h-4" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="branding" className="hub-tab hub-tab-branding">
            <Settings2 className="w-4 h-4" />
            Branding
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab - New Layout */}
        <TabsContent value="compose" className="space-y-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Customer Sidebar */}
            <div className="lg:col-span-1">
              <Card className="h-[700px] flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Customers</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full">
                    {isLoadingContacts ? (
                      <div className="space-y-2 p-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex items-center gap-3 p-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredContacts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                        <Users className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-center">No customers found</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedContact?.id === contact.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                            }`}
                            onClick={() => handleContactSelect(contact)}
                          >
                            <div className="font-medium text-sm">{contact.name}</div>
                            {contact.email && (
                              <div className="text-xs text-sky-600 truncate">{contact.email}</div>
                            )}
                            {(contact.cell_phone || contact.phone) && (
                              <div className="text-xs text-amber-600">{contact.cell_phone || contact.phone}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Main Compose Area */}
            <div className="lg:col-span-3">
              <Card className="h-[700px] flex flex-col">
                {/* Channel Tabs */}
                <div className="border-b px-6 pt-4">
                  <Tabs value={activeComposeTab} onValueChange={(v) => setActiveComposeTab(v as any)}>
                    <TabsList className="bg-transparent gap-2 h-auto p-0">
                      <TabsTrigger 
                        value="email" 
                        className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-full px-6"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Email
                      </TabsTrigger>
                      <TabsTrigger 
                        value="sms" 
                        className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-full px-6"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        SMS
                      </TabsTrigger>
                      <TabsTrigger 
                        value="whatsapp" 
                        className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-full px-6"
                      >
                        <MessageCircle className="w-4 h-4 mr-2 text-green-500" />
                        WhatsApp
                      </TabsTrigger>
                      <TabsTrigger 
                        value="history" 
                        className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-full px-6"
                      >
                        <History className="w-4 h-4 mr-2" />
                        History
                      </TabsTrigger>
                      <TabsTrigger 
                        value="segments" 
                        className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-full px-6"
                      >
                        <UsersRound className="w-4 h-4 mr-2" />
                        Segments
                      </TabsTrigger>
                      <TabsTrigger 
                        value="ai-followups" 
                        className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border rounded-full px-6"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Follow-ups
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Compose Form Content */}
                <div className="flex-1 overflow-auto p-6">
                  {(activeComposeTab === 'email' || activeComposeTab === 'sms' || activeComposeTab === 'whatsapp') && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">
                        Compose {activeComposeTab === 'email' ? 'Email' : activeComposeTab === 'sms' ? 'SMS' : 'WhatsApp Message'}
                      </h3>

                      {/* From Field */}
                      <div className={`rounded-lg p-4 border ${
                        activeComposeTab === 'whatsapp' 
                          ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
                          : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                      }`}>
                        <span className={activeComposeTab === 'whatsapp' ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>From: </span>
                        <span className="text-foreground">
                          {companyName} {activeComposeTab === 'email' ? `<${companyEmail}>` : `(${defaultSender?.phone || DEFAULT_CONTACT.phone})`}
                        </span>
                      </div>

                      {/* To Field */}
                      <div className="space-y-2">
                        <Label htmlFor="to-field">To</Label>
                        <Input
                          id="to-field"
                          placeholder={activeComposeTab === 'email' ? 'customer@example.com' : '+1 234 567 8900'}
                          value={toField}
                          onChange={(e) => setToField(e.target.value)}
                        />
                      </div>

                      {/* Template & AI Section */}
                      <div className="space-y-2">
                        <Label>Templates & AI</Label>
                        <div className="flex flex-wrap gap-2">
                          <TemplateSelector
                            channel={activeComposeTab as 'email' | 'sms' | 'whatsapp'}
                            onSelectTemplate={handleSelectTemplate}
                            onCreateNew={() => setShowTemplateDialog(true)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowTemplateDialog(true)}
                            className="gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Template
                          </Button>
                          <AIComposeAssistant
                            channel={activeComposeTab as 'email' | 'sms' | 'whatsapp'}
                            currentMessage={messageField}
                            onApplyDraft={handleApplyAIDraft}
                          />
                        </div>
                      </div>

                      {/* AI Document Finder */}
                      <AIDocumentFinder
                        isAttaching={isUploadingAttachment}
                        onAttachDocument={async (doc) => {
                          if (activeComposeTab === 'whatsapp' && attachments.length >= 1) {
                            toast.error('WhatsApp supports only one attachment');
                            return;
                          }
                          setIsUploadingAttachment(true);
                          try {
                            const channel = activeComposeTab as 'email' | 'sms' | 'whatsapp';
                            const built = await buildAndUploadDocumentPdf(
                              { id: doc.id, type: doc.type, employeeId: doc.employeeId },
                              channel,
                              currentOrganization,
                            );
                            setAttachments((prev) => [...prev, built.url]);
                            // Prefill email subject if blank
                            if (channel === 'email' && !subjectField.trim()) {
                              setSubjectField(`${doc.title}${currentOrganization?.name ? ` from ${currentOrganization.name}` : ''}`);
                            }
                            toast.success(`Attached ${built.filename}`);
                          } catch (err: any) {
                            console.error('Attach document error:', err);
                            toast.error(err?.message || 'Failed to attach document');
                          } finally {
                            setIsUploadingAttachment(false);
                          }
                        }}
                      />


                      {/* Attachment Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <Paperclip className="w-4 h-4" />
                          {activeComposeTab === 'whatsapp' ? 'Attach Media' : activeComposeTab === 'sms' ? 'MMS Attachment' : 'Attachments'}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          multiple={activeComposeTab === 'email'}
                          accept={activeComposeTab === 'email' ? '*/*' : 'image/*,video/*,audio/*,.gif'}
                          onChange={handleFileUpload}
                        />
                        
                        {activeComposeTab === 'whatsapp' || activeComposeTab === 'sms' ? (
                          /* WhatsApp & SMS/MMS style attachment dropdown */
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="gap-2"
                                disabled={isUploadingAttachment || (activeComposeTab === 'whatsapp' && attachments.length >= 1)}
                              >
                                {isUploadingAttachment ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Plus className="w-4 h-4" />
                                )}
                                {activeComposeTab === 'whatsapp' && attachments.length >= 1 
                                  ? 'Media attached (1 max)' 
                                  : attachments.length > 0 
                                    ? `${attachments.length} file(s) attached`
                                    : 'Add Media'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 bg-popover">
                              <DropdownMenuItem onClick={() => {
                                if (fileInputRef.current) {
                                  fileInputRef.current.accept = 'image/*,.gif';
                                  fileInputRef.current.click();
                                }
                              }}>
                                <ImageIcon className="w-4 h-4 mr-2 text-blue-500" />
                                Photo / GIF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                if (fileInputRef.current) {
                                  fileInputRef.current.accept = 'video/*';
                                  fileInputRef.current.click();
                                }
                              }}>
                                <FileText className="w-4 h-4 mr-2 text-emerald-500" />
                                Video
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                if (fileInputRef.current) {
                                  fileInputRef.current.accept = 'audio/*';
                                  fileInputRef.current.click();
                                }
                              }}>
                                <Mic className="w-4 h-4 mr-2 text-orange-500" />
                                Audio
                              </DropdownMenuItem>
                              {activeComposeTab === 'whatsapp' && (
                                <>
                                  <DropdownMenuItem onClick={() => {
                                    if (fileInputRef.current) {
                                      fileInputRef.current.accept = '*/*';
                                      fileInputRef.current.click();
                                    }
                                  }}>
                                    <FileText className="w-4 h-4 mr-2 text-violet-500" />
                                    Document
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    if (fileInputRef.current) {
                                      fileInputRef.current.accept = '.vcf,.vcard';
                                      fileInputRef.current.click();
                                    }
                                  }}>
                                    <User className="w-4 h-4 mr-2 text-sky-500" />
                                    Contact
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAttachment}
                            className="gap-2"
                          >
                            {isUploadingAttachment ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Paperclip className="w-4 h-4" />
                            )}
                            Upload File
                          </Button>
                        )}

                        {/* MMS note for SMS */}
                        {activeComposeTab === 'sms' && (
                          <p className="text-xs text-muted-foreground">
                            📱 Adding media will send as MMS. Supports images, GIFs, video & audio.
                          </p>
                        )}

                        {/* Attachment previews */}
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {attachments.map((url, idx) => (
                              <div
                                key={idx}
                                className="relative group bg-muted rounded-lg p-2 flex items-center gap-2"
                              >
                                {isImageUrl(url) ? (
                                  <img
                                    src={url}
                                    alt={`Attachment ${idx + 1}`}
                                    className="w-12 h-12 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-12 flex items-center justify-center bg-background rounded">
                                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="text-xs truncate max-w-24">{getFileName(url)}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-5 h-5 absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeAttachment(idx)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {activeComposeTab === 'whatsapp' && (
                          <p className="text-xs text-muted-foreground">WhatsApp allows one media attachment per message</p>
                        )}
                      </div>

                      {/* Subject (Email only) */}
                      {activeComposeTab === 'email' && (
                        <div className="space-y-2">
                          <Label htmlFor="subject-field">Subject</Label>
                          <Input
                            id="subject-field"
                            placeholder="Email subject"
                            value={subjectField}
                            onChange={(e) => setSubjectField(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Message */}
                      <div className="space-y-2">
                        <Label htmlFor="message-field">Message</Label>
                        <Textarea
                          id="message-field"
                          placeholder={activeComposeTab === 'email' ? 'Email body' : 'Type your message...'}
                          value={messageField}
                          onChange={(e) => setMessageField(e.target.value)}
                          className="min-h-[200px] resize-none"
                        />
                      </div>

                      {/* Sender Signature Preview */}
                      <div className="text-xs pt-4 border-t border-border/50 space-y-1">
                        {defaultSender && (
                          <p className="text-muted-foreground">
                            Sending as: <span className="font-semibold text-foreground">{defaultSender.name}</span>
                            {defaultSender.title && <span className="text-muted-foreground">, {defaultSender.title}</span>}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-amber-500" />
                            <span>{defaultSender?.phone || DEFAULT_CONTACT.phone}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-sky-500" />
                            <span>{defaultSender?.email || DEFAULT_CONTACT.email}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <img src={efinsuiteGlobeLogo} alt="" className="w-3 h-3 object-contain" />
                            <span>{DEFAULT_CONTACT.website}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeComposeTab === 'history' && (
                    <CommunicationHistoryPanel
                      onViewConversation={(contactIdentifier, channel) => {
                        const conv = conversations.find(
                          c => c.contact_identifier === contactIdentifier && c.channel === channel
                        );
                        if (conv) {
                          selectConversation(conv);
                        }
                      }}
                    />
                  )}

                  {activeComposeTab === 'segments' && (
                    <SegmentsPanel
                      onSendToSegment={(contactIds, channel) => {
                        toast.info(`Preparing ${channel} campaign for ${contactIds.length} contacts`);
                      }}
                    />
                  )}

                  {activeComposeTab === 'ai-followups' && (
                    <AIFollowupsPanel
                      onComposeMessage={(channel, to, message) => {
                        setComposeChannel(channel);
                        setComposeTo(to);
                        setMessageField(message);
                        if (channel === 'email') {
                          setActiveComposeTab('email');
                        } else {
                          setActiveComposeTab('sms');
                        }
                        setToField(to);
                      }}
                    />
                  )}
                </div>

                {/* Send Button (Email/SMS/WhatsApp) */}
                {(activeComposeTab === 'email' || activeComposeTab === 'sms' || activeComposeTab === 'whatsapp') && (
                  <div className="p-4 border-t">
                    <Button 
                      className={`w-full py-6 text-base font-medium text-white ${
                        activeComposeTab === 'whatsapp' 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      onClick={handleInlineSend}
                      disabled={isSending || !toField.trim() || !messageField.trim()}
                    >
                      {isSending ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : activeComposeTab === 'whatsapp' ? (
                        <MessageCircle className="w-5 h-5 mr-2" />
                      ) : (
                        <Send className="w-5 h-5 mr-2" />
                      )}
                      Send {activeComposeTab === 'email' ? 'Email' : activeComposeTab === 'sms' ? 'SMS' : 'WhatsApp'}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Inbox Tab - Original Messages Layout */}
        <TabsContent value="inbox" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversations List */}
            <div className="lg:col-span-1">
              <Card className="h-[600px] flex flex-col">
                <CardHeader className="pb-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Conversations</CardTitle>
                    </div>
                    <CommunicationTypeFilter
                      selectedTypes={communicationTypeFilter}
                      onTypesChange={setCommunicationTypeFilter}
                    />
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full">
                    {isLoadingConversations ? (
                      <div className="space-y-2 p-4">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex items-center gap-3 p-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                        <Inbox className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-center">No conversations yet</p>
                        <p className="text-sm text-center mt-1">Send a message to start a conversation</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {conversations
                          .filter(conv => communicationTypeFilter.includes(conv.channel as CommunicationType))
                          .map((conv) => (
                          <div
                            key={conv.id}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedConversation?.id === conv.id ? 'bg-muted' : ''
                            } ${conv.unread_count > 0 ? 'bg-accent/5' : ''}`}
                            onClick={() => selectConversation(conv)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative">
                                <Avatar className="w-10 h-10">
                                  <AvatarFallback className={
                                    conv.channel === 'email' ? 'bg-blue-500' :
                                    conv.channel === 'sms' ? 'bg-purple-500' :
                                    conv.channel === 'whatsapp' ? 'bg-green-500' : 'bg-gray-500'
                                  }>
                                    {conv.channel === 'email' ? <Mail className="w-4 h-4" /> :
                                     conv.channel === 'sms' ? <Phone className="w-4 h-4" /> :
                                     conv.channel === 'whatsapp' ? <MessageCircle className="w-4 h-4 text-white" /> :
                                     <MessageSquare className="w-4 h-4" />}
                                  </AvatarFallback>
                                </Avatar>
                                {conv.unread_count > 0 && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-medium">
                                    {conv.unread_count}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium truncate">
                                    {conv.contact_name || conv.contact_identifier}
                                  </span>
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    {format(new Date(conv.last_message_at), 'h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {conv.last_message_preview || 'No messages'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Message Thread */}
            <div className="lg:col-span-2">
              <Card className="h-[600px] flex flex-col">
                {selectedConversation ? (
                  <>
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="lg:hidden"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className={
                            selectedConversation.channel === 'email' ? 'bg-blue-500' :
                            selectedConversation.channel === 'sms' ? 'bg-purple-500' :
                            selectedConversation.channel === 'whatsapp' ? 'bg-green-500' : 'bg-gray-500'
                          }>
                            {selectedConversation.channel === 'email' ? <Mail className="w-4 h-4" /> :
                             selectedConversation.channel === 'sms' ? <Phone className="w-4 h-4" /> :
                             selectedConversation.channel === 'whatsapp' ? <MessageCircle className="w-4 h-4" /> :
                             <MessageSquare className="w-4 h-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {selectedConversation.contact_name || selectedConversation.contact_identifier}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {selectedConversation.channel.toUpperCase()}
                            </Badge>
                            {selectedConversation.contact_identifier}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                      <ScrollArea className="h-full p-4">
                        {isLoadingMessages ? (
                          <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                                <Skeleton className="h-16 w-2/3 rounded-lg" />
                              </div>
                            ))}
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                            <p>No messages in this conversation</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-lg p-3 ${
                                    msg.direction === 'outbound'
                                      ? 'bg-accent text-accent-foreground'
                                      : 'bg-muted'
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap break-words">
                                    {msg.body
                                      ?.replace(/<br\s*\/?>/gi, '\n')
                                      .replace(/<[^>]*>/g, '')
                                      .replace(/&nbsp;/g, ' ')
                                      .replace(/&amp;/g, '&')
                                      .replace(/&lt;/g, '<')
                                      .replace(/&gt;/g, '>')
                                      .replace(/&quot;/g, '"')
                                    }
                                  </p>
                                  <div className={`flex items-center gap-2 mt-1 text-xs ${
                                    msg.direction === 'outbound' ? 'text-accent-foreground/70' : 'text-muted-foreground'
                                  }`}>
                                    <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                                    {msg.direction === 'outbound' && (
                                      <span className="flex items-center gap-1">
                                        {msg.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                                        {msg.status === 'delivered' && <CheckCircle className="w-3 h-3" />}
                                        {msg.status === 'failed' && <AlertCircle className="w-3 h-3 text-destructive" />}
                                        {msg.status === 'pending' && <Clock className="w-3 h-3" />}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                    <div className="p-4 border-t">
                      <Button 
                        onClick={() => {
                          setComposeChannel(selectedConversation.channel as any);
                          setComposeTo(selectedConversation.contact_identifier);
                          setComposeContactName(selectedConversation.contact_name || '');
                          setComposeOpen(true);
                        }}
                        className="w-full"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Reply
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Select a conversation</p>
                    <p className="text-sm mt-1">Choose from the list to view messages</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <ContactsPanel onSelectContact={handleQuickCompose} />
        </TabsContent>

        <TabsContent value="voice" className="space-y-6">
          <Tabs defaultValue="hybrid" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl">
              <TabsTrigger value="hybrid" className="gap-2">
                <Globe className="h-4 w-4 text-blue-500" />
                <span className="text-blue-600">Int'l Call</span>
              </TabsTrigger>
              <TabsTrigger value="webrtc" className="gap-2">
                <Phone className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Local Call</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4 text-purple-500" />
                <span className="text-purple-600">History</span>
              </TabsTrigger>
              <TabsTrigger value="rates" className="gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600">Rates</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4 text-slate-500" />
                <span className="text-slate-600">Settings</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="hybrid">
              <HybridClickToCall />
            </TabsContent>
            
            <TabsContent value="webrtc">
              <VoiceCallPanel />
            </TabsContent>
            
            <TabsContent value="history">
              <CallHistoryPanel />
            </TabsContent>
            
            <TabsContent value="rates">
              <VoiceRatesPanel />
            </TabsContent>
            
            <TabsContent value="settings">
              <VoiceSettingsPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
          <BrandingSettingsPanel />
        </TabsContent>
      </Tabs>

      {/* Compose Message Dialog */}
      <ComposeMessageDialog
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) {
            clearComposeForm();
          }
        }}
        onSend={async (channel, to, body, options) => {
          const result = await sendMessage(
            channel as MessageChannel,
            to,
            body,
            options
          );
          return !!result;
        }}
        initialChannel={composeChannel}
        initialTo={composeTo}
        contactName={composeContactName}
      />

      {/* Template Form Dialog */}
      <TemplateFormDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        defaultChannel={activeComposeTab === 'history' || activeComposeTab === 'segments' || activeComposeTab === 'ai-followups' ? 'all' : activeComposeTab}
      />
    </div>
  );
}

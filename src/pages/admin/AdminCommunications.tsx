import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceSettingsPanel } from "@/components/communication/VoiceSettingsPanel";
import { useTwilioVoice } from "@/hooks/useTwilioVoice";
import { useMessaging } from "@/hooks/useMessaging";
import { supabase } from "@/integrations/supabase/client";
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  Send, 
  RefreshCw, 
  CheckCircle2,
  Clock,
  AlertCircle,
  PhoneCall,
  Voicemail,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminCommunications() {
  const { initiateCall, calling } = useTwilioVoice();
  const { sendSMS, sendEmail, sendWhatsApp, checkConfiguration } = useMessaging();
  
  // Quick send states
  const [channel, setChannel] = useState<"sms" | "email" | "whatsapp">("sms");
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  // MMS attachments
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Configuration status
  const [configStatus, setConfigStatus] = useState<{ twilio: boolean; sendgrid: boolean } | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(false);

  // Handle file upload for MMS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // MMS supports up to 10 attachments
    if (attachments.length + files.length > 10) {
      toast.error("Maximum 10 attachments allowed for MMS");
      return;
    }

    setUploading(true);
    const newAttachments: { name: string; url: string; type: string }[] = [];

    for (const file of Array.from(files)) {
      // Validate file size (max 5MB per file for MMS)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        continue;
      }

      // Validate file type (common MMS supported types)
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain',
        'audio/mpeg', 'audio/wav',
        'video/mp4', 'video/3gpp'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }

      try {
        // Upload to Supabase storage
        const fileName = `mms/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        const { data, error } = await supabase.storage
          .from('documents')
          .upload(fileName, file, { 
            cacheControl: '3600',
            upsert: false 
          });

        if (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type
        });
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setUploading(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (newAttachments.length > 0) {
      toast.success(`${newAttachments.length} file(s) attached`);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const handleCheckConfig = async () => {
    setCheckingConfig(true);
    try {
      const status = await checkConfiguration();
      setConfigStatus(status);
      toast.success("Configuration checked");
    } catch {
      toast.error("Failed to check configuration");
    } finally {
      setCheckingConfig(false);
    }
  };

  const handleQuickSend = async () => {
    if (!recipient || !message) {
      toast.error("Please fill in recipient and message");
      return;
    }

    setSending(true);
    try {
      let result;
      
      if (channel === "sms") {
        // Include media URLs for MMS if attachments exist
        const mediaUrls = attachments.length > 0 ? attachments.map(a => a.url) : undefined;
        result = await sendSMS(recipient, message, mediaUrls);
      } else if (channel === "email") {
        if (!subject) {
          toast.error("Please enter a subject for email");
          setSending(false);
          return;
        }
        result = await sendEmail(recipient, subject, message);
      } else if (channel === "whatsapp") {
        result = await sendWhatsApp(recipient, message);
      }

      if (result?.success) {
        const msgType = channel === "sms" && attachments.length > 0 ? "MMS" : channel.toUpperCase();
        toast.success(`${msgType} sent successfully`);
        setMessage("");
        setSubject("");
        setAttachments([]); // Clear attachments after successful send
      } else {
        toast.error(result?.error || "Failed to send message");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleQuickCall = async () => {
    if (!recipient) {
      toast.error("Please enter a phone number");
      return;
    }
    
    let formattedNumber = recipient.trim();
    if (!formattedNumber.startsWith("+")) {
      formattedNumber = "+1" + formattedNumber.replace(/\D/g, "");
    }
    
    await initiateCall(formattedNumber);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Communications Center</h1>
          <p className="text-muted-foreground">
            Manage calls, SMS, WhatsApp, and email communications
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleCheckConfig}
          disabled={checkingConfig}
        >
          {checkingConfig ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Check Services
        </Button>
      </div>

      {/* Service Status */}
      {configStatus && (
        <div className="flex gap-4">
          <Badge variant={configStatus.twilio ? "default" : "secondary"} className="gap-1">
            {configStatus.twilio ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            Twilio (SMS/WhatsApp/Voice)
          </Badge>
          <Badge variant={configStatus.sendgrid ? "default" : "secondary"} className="gap-1">
            {configStatus.sendgrid ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            SendGrid (Email)
          </Badge>
        </div>
      )}

      <Tabs defaultValue="quick-send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quick-send" className="gap-2">
            <Send className="h-4 w-4" />
            Quick Send
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <PhoneCall className="h-4 w-4" />
            Voice & IVR
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* Quick Send Tab */}
        <TabsContent value="quick-send">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Compose Message */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Compose Message</CardTitle>
                <CardDescription>Send a quick message via SMS, WhatsApp, or Email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS
                        </div>
                      </SelectItem>
                      <SelectItem value="whatsapp">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          WhatsApp
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Recipient</Label>
                  <Input
                    placeholder={channel === "email" ? "email@example.com" : "+1 (555) 123-4567"}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>

                {channel === "email" && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      placeholder="Message subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* MMS Attachments - Only for SMS channel */}
                {channel === "sms" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Attachments (MMS)</Label>
                      <span className="text-xs text-muted-foreground">
                        {attachments.length}/10 files
                      </span>
                    </div>
                    
                    {/* Attachment list */}
                    {attachments.length > 0 && (
                      <div className="space-y-2 p-2 bg-muted/50 rounded-md">
                        {attachments.map((att, index) => (
                          <div 
                            key={index} 
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileIcon(att.type)}
                              <span className="truncate">{att.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => removeAttachment(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* File upload button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf,text/plain,audio/*,video/mp4,video/3gpp"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || attachments.length >= 10}
                    >
                      {uploading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      {uploading ? "Uploading..." : "Attach Files"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Images, PDFs, audio, video. Max 5MB per file.
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full gap-2" 
                  onClick={handleQuickSend}
                  disabled={sending || uploading}
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send {channel === "sms" && attachments.length > 0 ? "MMS" : channel.toUpperCase()}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Call */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Click-to-Call</CardTitle>
                <CardDescription>Initiate an outbound call from your Twilio number</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter in E.164 format (+1XXXXXXXXXX) or local format
                  </p>
                </div>

                <Button 
                  className="w-full gap-2" 
                  onClick={handleQuickCall}
                  disabled={calling || !recipient}
                  variant="secondary"
                >
                  {calling ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {calling ? "Calling..." : "Initiate Call"}
                </Button>

                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="gap-1" disabled>
                      <Voicemail className="h-3 w-3" />
                      Check Voicemail
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" disabled>
                      <Clock className="h-3 w-3" />
                      Call History
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Voice & IVR Tab */}
        <TabsContent value="voice">
          <VoiceSettingsPanel />
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Communication Activity</CardTitle>
              <CardDescription>Recent calls, messages, and emails</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Activity logging coming soon</p>
                <p className="text-sm">
                  Communication history will be tracked and displayed here
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

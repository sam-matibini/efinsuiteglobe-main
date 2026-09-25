import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTwilioVoice } from "@/hooks/useTwilioVoice";
import { HybridClickToCall } from "./voice/HybridClickToCall";
import { CallHistoryPanel } from "./voice/CallHistoryPanel";
import { VoiceWalletPanel } from "./voice/VoiceWalletPanel";
import { VoiceRatesPanel } from "./voice/VoiceRatesPanel";
import { 
  Phone, 
  Voicemail, 
  Settings2, 
  Copy, 
  CheckCircle2, 
  RefreshCw,
  PhoneIncoming,
  Clock,
  Play,
  ExternalLink,
  Globe,
  History,
  DollarSign,
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Recording {
  sid: string;
  call_sid: string;
  date_created: string;
  duration: string;
  uri: string;
}

export function VoiceSettingsPanel() {
  const { 
    getRecordings, 
    checkHealth, 
    getWebhookUrl, 
    loadingRecordings 
  } = useTwilioVoice();
  
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [elevenLabsEnabled, setElevenLabsEnabled] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [copied, setCopied] = useState(false);
  
  // IVR Settings
  const [ivrEnabled, setIvrEnabled] = useState(true);
  const [voicemailEnabled, setVoicemailEnabled] = useState(true);

  useEffect(() => {
    checkVoiceHealth();
    loadRecordings();
  }, []);

  const checkVoiceHealth = async () => {
    try {
      const status = await checkHealth();
      setIsHealthy(status?.success ?? false);
      setElevenLabsEnabled(status?.elevenLabsEnabled ?? false);
    } catch (err) {
      console.error("Voice health check error:", err);
      setIsHealthy(false);
    }
  };

  const loadRecordings = async () => {
    try {
      const recs = await getRecordings();
      setRecordings(recs);
    } catch (err) {
      console.error("Load recordings error:", err);
      setRecordings([]);
    }
  };
  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(getWebhookUrl());
    setCopied(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (seconds: string) => {
    const secs = parseInt(seconds, 10);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Twilio Voice</CardTitle>
                <CardDescription>IVR, Click-to-Call, and Voicemail</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isHealthy === null ? (
                <Badge variant="secondary">Checking...</Badge>
              ) : isHealthy ? (
                <>
                  <Badge className="bg-green-500/10 text-green-600 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  {elevenLabsEnabled && (
                    <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">
                      ElevenLabs
                    </Badge>
                  )}
                </>
              ) : (
                <Badge variant="destructive">Not Configured</Badge>
              )}
              <Button variant="ghost" size="icon" onClick={checkVoiceHealth}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="hybrid-call" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="hybrid-call" className="gap-2">
            <Globe className="h-4 w-4" />
            Call
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-2">
            <Wallet className="h-4 w-4" />
            Wallet
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="rates" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Rates
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="voicemail" className="gap-2">
            <Voicemail className="h-4 w-4" />
            Voicemail
          </TabsTrigger>
        </TabsList>

        {/* Hybrid Click-to-Call Tab */}
        <TabsContent value="hybrid-call">
          <HybridClickToCall />
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet">
          <VoiceWalletPanel />
        </TabsContent>

        {/* Call History Tab */}
        <TabsContent value="history">
          <CallHistoryPanel />
        </TabsContent>

        {/* Rates Tab */}
        <TabsContent value="rates">
          <VoiceRatesPanel />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook Configuration</CardTitle>
              <CardDescription>
                Configure this URL in your Twilio console for inbound calls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Inbound Voice Webhook URL</Label>
                <div className="flex gap-2">
                  <Input 
                    value={getWebhookUrl()} 
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" onClick={copyWebhookUrl}>
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set this as your Twilio phone number's voice webhook (HTTP POST)
                </p>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>IVR Menu</Label>
                    <p className="text-sm text-muted-foreground">
                      Interactive voice menu for routing callers
                    </p>
                  </div>
                  <Switch checked={ivrEnabled} onCheckedChange={setIvrEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Voicemail</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow callers to leave voice messages
                    </p>
                  </div>
                  <Switch checked={voicemailEnabled} onCheckedChange={setVoicemailEnabled} />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline" className="gap-2" asChild>
                  <a 
                    href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Twilio Console
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">IVR Menu Structure</CardTitle>
              <CardDescription>Current voice menu configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline">1</Badge>
                  <span>Sales Team</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline">2</Badge>
                  <span>Customer Support</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline">3</Badge>
                  <span>Billing Inquiries</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="outline">0</Badge>
                  <span>Operator</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Badge variant="secondary">Timeout</Badge>
                  <span>Voicemail</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Voicemail Tab */}
        <TabsContent value="voicemail">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Voicemail className="h-5 w-5" />
                    Voicemail Recordings
                  </CardTitle>
                  <CardDescription>
                    Recent voice messages left by callers
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadRecordings}
                  disabled={loadingRecordings}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRecordings ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recordings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Voicemail className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No voicemail recordings yet</p>
                  <p className="text-sm">Recordings will appear here when callers leave messages</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {recordings.map((recording) => (
                      <div 
                        key={recording.sid} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-full">
                            <PhoneIncoming className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              Call: {recording.call_sid.slice(-8)}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(recording.date_created), "MMM d, yyyy h:mm a")}
                              <span>•</span>
                              <span>{formatDuration(recording.duration)}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

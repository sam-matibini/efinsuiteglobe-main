import { useState, useEffect } from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff,
  Voicemail, 
  Loader2, 
  Play, 
  Pause, 
  Clock, 
  RefreshCw,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Settings,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Send,
  Square,
  Circle,
  Trash2,
  ExternalLink,
  Keyboard,
  Delete,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { useTwilioVoice } from '@/hooks/useTwilioVoice';
import { useVoiceDevices } from '@/hooks/useVoiceDevices';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { Contact } from '@/hooks/useContacts';
import { useCommunicationSenders } from '@/hooks/useCommunicationSenders';
import { SenderSelector } from './SenderSelector';
import { ContactSelector } from './ContactSelector';
import { DialPad } from './voice/DialPad';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Recording {
  sid: string;
  call_sid: string;
  date_created: string;
  duration: string;
  uri: string;
}

export function VoiceCallPanel() {
  const { getRecordings, checkHealth, loadingRecordings, fetchRecordingAudio } = useTwilioVoice();
  const {
    hasPermissions,
    micEnabled,
    speakerEnabled,
    cameraEnabled,
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    callState,
    requestPermissions,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setSelectedVideoInput,
    toggleMic,
    toggleSpeaker,
    toggleCamera,
    makeCall,
    endCall,
    answerCall,
    rejectCall,
    audioLevel,
    isLoading,
    isDeviceReady,
    incomingCall,
  } = useVoiceDevices();

  const voiceRecording = useVoiceRecording();
  const { senders, defaultSender } = useCommunicationSenders();

  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showDialPad, setShowDialPad] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappRecipient, setWhatsappRecipient] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [elevenLabsEnabled, setElevenLabsEnabled] = useState(false);
  const [recordingAudioUrls, setRecordingAudioUrls] = useState<Record<string, string>>({});
  const [selectedContactName, setSelectedContactName] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);

  // Get selected sender for display
  const activeSender = selectedSenderId 
    ? senders.find(s => s.id === selectedSenderId) 
    : defaultSender;

  const handleDialPadPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleDirectCall = async () => {
    if (!phoneNumber) return;
    
    // Format number
    let formattedNumber = phoneNumber.trim();
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+1' + formattedNumber.replace(/\D/g, '');
    }
    
    await makeCall(formattedNumber);
  };


  useEffect(() => {
    loadRecordings();
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    const health = await checkHealth();
    if (health) {
      setIsConfigured(health.configured);
      setElevenLabsEnabled(health.elevenLabsEnabled);
    }
  };

  const loadRecordings = async () => {
    const recs = await getRecordings();
    setRecordings(recs);
  };

  const handleInitiateCall = async () => {
    if (!phoneNumber) return;
    
    // Format number
    let formattedNumber = phoneNumber.trim();
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = '+1' + formattedNumber.replace(/\D/g, '');
    }
    
    const success = await makeCall(formattedNumber);
    if (success) {
      setCallDialogOpen(false);
    }
  };

  const getRecordingUrl = async (recordingSid: string): Promise<string | null> => {
    // Check cache first
    if (recordingAudioUrls[recordingSid]) {
      return recordingAudioUrls[recordingSid];
    }
    
    // Fetch via proxy
    const blob = await fetchRecordingAudio(recordingSid);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setRecordingAudioUrls(prev => ({ ...prev, [recordingSid]: url }));
      return url;
    }
    return null;
  };

  const togglePlayRecording = async (recordingId: string) => {
    if (playingId === recordingId) {
      setPlayingId(null);
      const audio = document.getElementById(`audio-${recordingId}`) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    } else {
      if (playingId) {
        const currentAudio = document.getElementById(`audio-${playingId}`) as HTMLAudioElement;
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }
      
      // Get the audio URL if not already loaded
      const audioUrl = await getRecordingUrl(recordingId);
      if (!audioUrl) {
        toast.error("Failed to load recording");
        return;
      }
      
      setPlayingId(recordingId);
      // Wait for state update then play
      setTimeout(() => {
        const audio = document.getElementById(`audio-${recordingId}`) as HTMLAudioElement;
        if (audio) {
          audio.src = audioUrl;
          audio.play();
        }
      }, 50);
    }
  };

  const formatDuration = (seconds: string | number): string => {
    const secs = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const getCallStatusColor = () => {
    switch (callState.status) {
      case 'connecting':
      case 'ringing':
        return 'bg-yellow-500';
      case 'connected':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-muted';
    }
  };

  const isInCall = ['connecting', 'ringing', 'connected'].includes(callState.status);

  return (
    <div className="space-y-4">
      {/* Incoming Call Card */}
      {incomingCall && callState.direction === 'inbound' && callState.status === 'ringing' && (
        <Card className="border-2 border-blue-500/50 bg-blue-500/5 animate-pulse">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Phone className="w-12 h-12 text-blue-500 animate-bounce" />
              <p className="text-lg font-medium">Incoming Call</p>
              <p className="text-2xl font-bold tracking-wide">{callState.remoteNumber || 'Unknown'}</p>
              
              <div className="flex items-center gap-4 pt-2">
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={rejectCall}
                  className="rounded-full w-16 h-16"
                >
                  <PhoneOff className="w-7 h-7" />
                </Button>
                
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 bg-green-600 hover:bg-green-700"
                  onClick={answerCall}
                >
                  <Phone className="w-7 h-7" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Call Card */}
      {isInCall && !(incomingCall && callState.direction === 'inbound' && callState.status === 'ringing') && (
        <Card className="border-2 border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              {/* Call Status */}
              <div className="flex items-center gap-2">
                <span className={cn("w-3 h-3 rounded-full animate-pulse", getCallStatusColor())} />
                <span className="text-lg font-medium capitalize">{callState.status}</span>
              </div>
              
              {/* Phone Number */}
              {callState.remoteNumber && (
                <p className="text-2xl font-bold tracking-wide">{callState.remoteNumber}</p>
              )}
              
              {/* Duration */}
              {callState.status === 'connected' && (
                <p className="text-3xl font-mono text-green-600 dark:text-green-400">
                  {formatDuration(callState.duration)}
                </p>
              )}
              
              {/* Audio Level Indicator */}
              {callState.status === 'connected' && (
                <div className="w-full max-w-xs space-y-1">
                  <Label className="text-xs text-muted-foreground">Audio Level</Label>
                  <Progress value={audioLevel * 100} className="h-2" />
                </div>
              )}
              
              {/* Call Controls */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  size="lg"
                  variant={micEnabled ? "outline" : "destructive"}
                  onClick={toggleMic}
                  className="rounded-full w-14 h-14"
                >
                  {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </Button>
                
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={endCall}
                  className="rounded-full w-16 h-16"
                >
                  <PhoneOff className="w-7 h-7" />
                </Button>
                
                <Button
                  size="lg"
                  variant={speakerEnabled ? "outline" : "secondary"}
                  onClick={toggleSpeaker}
                  className="rounded-full w-14 h-14"
                >
                  {speakerEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </Button>
              </div>
              
              {/* Camera Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCamera}
                className="gap-2"
              >
                {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                {cameraEnabled ? 'Camera On' : 'Camera Off'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Call Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-accent" />
              <CardTitle className="text-lg">Local Call</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {hasPermissions ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Mic Ready
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Mic Required
                </Badge>
              )}
              {isConfigured && (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                  Connected
                </Badge>
              )}
              {elevenLabsEnabled && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                  HD Voice
                </Badge>
              )}
              {isDeviceReady && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                  WebRTC Ready
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>Quick local calls via browser WebRTC</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {!hasPermissions ? (
              <Button
                onClick={requestPermissions}
                disabled={isLoading}
                className="bg-accent hover:bg-accent/90"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4 mr-2" />
                )}
                Enable Microphone
              </Button>
            ) : (
              <Button
                onClick={() => setCallDialogOpen(true)}
                className="bg-accent hover:bg-accent/90"
                disabled={!isConfigured || isInCall}
              >
                <Phone className="w-4 h-4 mr-2" />
                Make a Call
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Audio Settings
            </Button>
            
            <Button
              variant="outline"
              onClick={loadRecordings}
              disabled={loadingRecordings}
            >
              {loadingRecordings ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>

          {/* Dial Pad Section */}
          {hasPermissions && isConfigured && !isInCall && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4" />
                  Dial Pad
                </Label>
                <Switch
                  checked={showDialPad}
                  onCheckedChange={setShowDialPad}
                />
              </div>
              
              {/* Sender Selection */}
              {senders.length > 0 && showDialPad && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Calling as</Label>
                  <SenderSelector
                    selectedSenderId={selectedSenderId}
                    onSelect={(sender) => setSelectedSenderId(sender?.id || null)}
                    className="w-full"
                  />
                  {activeSender?.title && (
                    <p className="text-xs text-muted-foreground">
                      {activeSender.title}
                    </p>
                  )}
                </div>
              )}
              {showDialPad && (
                <div className="space-y-4">
                  {/* Contact Lookup using ContactSelector */}
                  <ContactSelector
                    channel="voice"
                    value={phoneNumber}
                    contactName={selectedContactName}
                    onSelect={(contact: Contact, value: string) => {
                      setPhoneNumber(value);
                      setSelectedContactName(contact.name);
                    }}
                    placeholder="Select a contact..."
                    disabled={isInCall}
                  />

                  {/* Phone Number Input */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={phoneNumber}
                      onChange={(e) => {
                        setPhoneNumber(e.target.value);
                        setSelectedContactName('');
                      }}
                      placeholder="+1 (555) 123-4567"
                      className="text-center text-xl font-mono tracking-wider"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        handleBackspace();
                        if (phoneNumber.length <= 1) setSelectedContactName('');
                      }}
                      disabled={!phoneNumber}
                      className="shrink-0"
                    >
                      <Delete className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Dial Pad Grid */}
                  <DialPad 
                    onDigitPress={handleDialPadPress}
                    disabled={isInCall}
                    className="max-w-xs mx-auto"
                  />
                  
                  {/* Call Button */}
                  <Button
                    onClick={handleDirectCall}
                    disabled={!phoneNumber || isInCall}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call {selectedContactName || phoneNumber || 'Enter Number'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Device Settings */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleContent className="space-y-4 pt-4 border-t">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Microphone Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Microphone
                  </Label>
                  <Select value={selectedAudioInput} onValueChange={setSelectedAudioInput}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select microphone" />
                    </SelectTrigger>
                    <SelectContent>
                      {audioInputDevices
                        .filter((device) => device.deviceId && device.deviceId !== '')
                        .map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Speaker Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    Speaker
                  </Label>
                  <Select value={selectedAudioOutput} onValueChange={setSelectedAudioOutput}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select speaker" />
                    </SelectTrigger>
                    <SelectContent>
                      {audioOutputDevices
                        .filter((device) => device.deviceId && device.deviceId !== '')
                        .map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Camera Selection */}
                <div className="space-y-2 sm:col-span-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Camera (optional)
                  </Label>
                  <Select value={selectedVideoInput} onValueChange={setSelectedVideoInput}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoInputDevices
                        .filter((device) => device.deviceId && device.deviceId !== '')
                        .map((device) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Test Audio */}
              {hasPermissions && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <Label className="text-sm">Microphone Test</Label>
                  <Progress value={audioLevel * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Speak into your microphone to test the audio level
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {!isConfigured && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Voice calls require Twilio configuration. Please ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voicemail Recordings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Voicemail className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-lg">Voicemails</CardTitle>
            </div>
            <Badge variant="secondary">{recordings.length}</Badge>
          </div>
          <CardDescription>Recent voicemail recordings</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRecordings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Voicemail className="w-12 h-12 mb-4 opacity-50" />
              <p>No voicemails yet</p>
              <p className="text-sm mt-1">Voicemails from callers will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {recordings.map((recording) => (
                  <div
                    key={recording.sid}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => togglePlayRecording(recording.sid)}
                        className="shrink-0"
                      >
                        {playingId === recording.sid ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <div>
                        <p className="font-medium text-sm">
                          Call {recording.call_sid.slice(-8)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {formatDuration(recording.duration)}
                          <span className="mx-1">•</span>
                          {format(new Date(recording.date_created), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <audio
                      id={`audio-${recording.sid}`}
                      src={recordingAudioUrls[recording.sid] || ''}
                      onEnded={() => setPlayingId(null)}
                      className="hidden"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Voice Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              <CardTitle className="text-lg">WhatsApp Voice</CardTitle>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
              Voice-to-Text
            </Badge>
          </div>
          <CardDescription>Record voice messages and send to WhatsApp as transcribed text</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Voice Recording Controls */}
          <div className="p-4 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Voice Recording</Label>
              <span className="text-sm text-muted-foreground font-mono">
                {Math.floor(voiceRecording.duration / 60)}:{(voiceRecording.duration % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            {/* Recording Status */}
            {voiceRecording.isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <Circle className="w-3 h-3 fill-current animate-pulse" />
                <span className="text-sm font-medium">Recording...</span>
              </div>
            )}
            
            {/* Recorded Audio Playback */}
            {voiceRecording.audioUrl && !voiceRecording.isRecording && (
              <div className="space-y-2">
                <audio 
                  src={voiceRecording.audioUrl} 
                  controls 
                  className="w-full h-10"
                />
              </div>
            )}
            
            {/* Recording Controls */}
            <div className="flex items-center gap-2">
              {!voiceRecording.isRecording && !voiceRecording.audioBlob && (
                <Button
                  onClick={voiceRecording.startRecording}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Start Recording
                </Button>
              )}
              
              {voiceRecording.isRecording && (
                <Button
                  onClick={voiceRecording.stopRecording}
                  variant="destructive"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
              
              {voiceRecording.audioBlob && !voiceRecording.isRecording && (
                <>
                  <Button
                    variant="outline"
                    onClick={voiceRecording.clearRecording}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Discard
                  </Button>
                  <Button
                    onClick={async () => {
                      const text = await voiceRecording.transcribeAudio();
                      if (text) {
                        setTranscribedText(text);
                      }
                    }}
                    disabled={voiceRecording.isTranscribing}
                    variant="secondary"
                  >
                    {voiceRecording.isTranscribing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mic className="w-4 h-4 mr-2" />
                    )}
                    Transcribe
                  </Button>
                </>
              )}
            </div>
            
            {/* Transcribed Text Display */}
            {transcribedText && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Transcribed Text</Label>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  {transcribedText}
                </div>
              </div>
            )}
          </div>

          {/* Send to WhatsApp */}
          {voiceRecording.audioBlob && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Recipient WhatsApp Number</Label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={whatsappRecipient}
                  onChange={(e) => setWhatsappRecipient(e.target.value)}
                  type="tel"
                />
              </div>
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={!whatsappRecipient || voiceRecording.isSending}
                onClick={async () => {
                  const success = await voiceRecording.sendVoiceToWhatsApp(whatsappRecipient, true);
                  if (success) {
                    setWhatsappRecipient('');
                    setTranscribedText('');
                  }
                }}
              >
                {voiceRecording.isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send as WhatsApp Text
              </Button>
            </div>
          )}

          {/* Click-to-WhatsApp Call */}
          <div className="p-4 border rounded-lg space-y-3">
            <Label className="font-medium flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Click-to-Call via WhatsApp
            </Label>
            <div className="space-y-2">
              <Input
                placeholder="+1 (555) 123-4567"
                id="whatsapp-call-input"
                type="tel"
              />
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => {
                  const input = document.getElementById('whatsapp-call-input') as HTMLInputElement;
                  if (!input?.value) return;
                  // Normalize phone number
                  let normalized = input.value.replace(/[^\d+]/g, '');
                  if (!normalized.startsWith('+')) {
                    normalized = '+1' + normalized;
                  }
                  // Remove + for WhatsApp URL
                  const waNumber = normalized.replace('+', '');
                  window.open(`https://wa.me/${waNumber}`, '_blank');
                }}
              >
                <Phone className="w-4 h-4 mr-2" />
                Open WhatsApp Call
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Opens WhatsApp app to initiate a voice/video call
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Make Call Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-accent" />
              Make a Call
            </DialogTitle>
            <DialogDescription>
              Enter the phone number to call. Your microphone will be used for the conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                type="tel"
              />
              <p className="text-xs text-muted-foreground">
                Enter with country code (e.g., +1 for US/Canada)
              </p>
            </div>
            
            {/* Device Status */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Microphone
                </span>
                {hasPermissions ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600">Ready</Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">Not Enabled</Badge>
                )}
              </div>
              {!hasPermissions && (
                <Button size="sm" variant="outline" onClick={requestPermissions} className="w-full">
                  <Mic className="w-4 h-4 mr-2" />
                  Enable Microphone
                </Button>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCallDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-accent hover:bg-accent/90"
              disabled={!phoneNumber || !hasPermissions || isInCall}
              onClick={handleInitiateCall}
            >
              <PhoneCall className="w-4 h-4 mr-2" />
              Call Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DialPad } from "./DialPad";
import { ContactSelector } from "../ContactSelector";
import { useVoiceOrchestrator } from "@/hooks/useVoiceOrchestrator";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Contact } from "@/hooks/useContacts";
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Wallet, 
  Globe, 
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface HybridClickToCallProps {
  className?: string;
}

export function HybridClickToCall({ className }: HybridClickToCallProps) {
  const { currentOrganization } = useOrganizationContext();
  const {
    initiatingCall,
    currentSession,
    wallet,
    getWallet,
    initiateHybridCall,
    formatDuration,
    formatCurrency,
  } = useVoiceOrchestrator();

  const [myPhoneNumber, setMyPhoneNumber] = useState("");
  const [myContactName, setMyContactName] = useState("");
  const [destinationNumber, setDestinationNumber] = useState("");
  const [destinationContactName, setDestinationContactName] = useState("");
  const [enableRecording, setEnableRecording] = useState(false);
  const [showDialPad, setShowDialPad] = useState(false);
  const [dialPadTarget, setDialPadTarget] = useState<"source" | "destination">("destination");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) {
      getWallet(currentOrganization.id);
    }
    
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, [currentOrganization?.id, getWallet]);

  const handleDialPadDigit = (digit: string) => {
    if (dialPadTarget === "source") {
      setMyPhoneNumber(prev => prev + digit);
    } else {
      setDestinationNumber(prev => prev + digit);
    }
  };

  const handleCall = async () => {
    if (!currentOrganization?.id || !userId) {
      toast.error("Please select an organization");
      return;
    }

    if (!myPhoneNumber) {
      toast.error("Please enter your phone number");
      return;
    }

    if (!destinationNumber) {
      toast.error("Please enter the destination number");
      return;
    }

    const result = await initiateHybridCall(
      currentOrganization.id,
      userId,
      myPhoneNumber,
      destinationNumber,
      enableRecording
    );

    if (result.success) {
      // Call initiated successfully
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "initiated":
      case "leg_a_ringing":
      case "leg_b_ringing":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "leg_a_answered":
      case "leg_b_answered":
      case "bridged":
        return "bg-green-500/10 text-green-600 border-green-200";
      case "completed":
        return "bg-blue-500/10 text-blue-600 border-blue-200";
      case "failed":
      case "leg_a_failed":
      case "leg_b_failed":
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "initiated": return "Initiating...";
      case "leg_a_ringing": return "Calling you...";
      case "leg_a_answered": return "You answered";
      case "leg_b_ringing": return "Calling destination...";
      case "leg_b_answered": return "Connected";
      case "bridged": return "In call";
      case "completed": return "Completed";
      case "failed": return "Failed";
      case "leg_a_failed": return "Your phone failed";
      case "leg_b_failed": return "Destination failed";
      case "cancelled": return "Cancelled";
      case "no_answer": return "No answer";
      case "busy": return "Busy";
      default: return status;
    }
  };

  const isCallActive = currentSession && 
    !["completed", "failed", "cancelled", "no_answer", "busy", "leg_a_failed", "leg_b_failed"].includes(currentSession.call_status);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Wallet Balance */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-full">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Voice Wallet Balance</p>
                <p className="text-2xl font-bold">
                  {wallet ? formatCurrency(wallet.balance, wallet.currency) : "$0.00"}
                </p>
              </div>
            </div>
            {wallet && wallet.balance < wallet.low_balance_threshold && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Low Balance
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Call Status */}
      {currentSession && (
        <Card className="border-primary/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-full",
                  isCallActive ? "bg-green-500/10 animate-pulse" : "bg-muted"
                )}>
                  {isCallActive ? (
                    <PhoneCall className="h-5 w-5 text-green-600" />
                  ) : (
                    <PhoneOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{currentSession.destination_number}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{formatDuration(currentSession.duration_seconds)}</span>
                    {currentSession.final_cost && (
                      <>
                        <span>•</span>
                        <DollarSign className="h-3 w-3" />
                        <span>{formatCurrency(currentSession.final_cost)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Badge className={getStatusColor(currentSession.call_status)}>
                {getStatusLabel(currentSession.call_status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Click-to-Call Form */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Int'l Call</CardTitle>
              <CardDescription>
                Low-cost international calls without internet on your phone
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* My Phone Number */}
          <div className="space-y-2">
            <Label>Your Phone Number</Label>
            <ContactSelector
              channel="voice"
              value={myPhoneNumber}
              contactName={myContactName}
              onSelect={(contact: Contact, value: string) => {
                setMyPhoneNumber(value);
                setMyContactName(contact.name);
              }}
              placeholder="Select your number or enter..."
              disabled={initiatingCall || isCallActive}
            />
            <div className="flex gap-2">
              <Input
                placeholder="+1 (555) 123-4567"
                value={myPhoneNumber}
                onChange={(e) => {
                  setMyPhoneNumber(e.target.value);
                  setMyContactName("");
                }}
                disabled={initiatingCall || isCallActive}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setDialPadTarget("source");
                  setShowDialPad(!showDialPad);
                }}
                disabled={initiatingCall || isCallActive}
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              We'll call this number first, then connect you to the destination
            </p>
          </div>

          {/* Destination Number */}
          <div className="space-y-2">
            <Label>Destination Number</Label>
            <ContactSelector
              channel="voice"
              value={destinationNumber}
              contactName={destinationContactName}
              onSelect={(contact: Contact, value: string) => {
                setDestinationNumber(value);
                setDestinationContactName(contact.name);
              }}
              placeholder="Select destination contact..."
              disabled={initiatingCall || isCallActive}
            />
            <div className="flex gap-2">
              <Input
                placeholder="+234 xxx xxx xxxx"
                value={destinationNumber}
                onChange={(e) => {
                  setDestinationNumber(e.target.value);
                  setDestinationContactName("");
                }}
                disabled={initiatingCall || isCallActive}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setDialPadTarget("destination");
                  setShowDialPad(!showDialPad);
                }}
                disabled={initiatingCall || isCallActive}
              >
                <Phone className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Dial Pad */}
          {showDialPad && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-3 text-center">
                Entering: {dialPadTarget === "source" ? "Your Number" : "Destination"}
              </p>
              <DialPad 
                onDigitPress={handleDialPadDigit} 
                disabled={initiatingCall || isCallActive}
              />
            </div>
          )}

          <Separator />

          {/* Options */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {enableRecording ? (
                <Mic className="h-4 w-4 text-primary" />
              ) : (
                <MicOff className="h-4 w-4 text-muted-foreground" />
              )}
              <div className="space-y-0.5">
                <Label>Record Call</Label>
                <p className="text-xs text-muted-foreground">
                  Save a recording of this call
                </p>
              </div>
            </div>
            <Switch
              checked={enableRecording}
              onCheckedChange={setEnableRecording}
              disabled={initiatingCall || isCallActive}
            />
          </div>

          <Separator />

          {/* Call Button */}
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleCall}
            disabled={
              initiatingCall || 
              isCallActive || 
              !myPhoneNumber || 
              !destinationNumber ||
              !wallet ||
              wallet.balance <= 0
            }
          >
            {initiatingCall ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : isCallActive ? (
              <>
                <PhoneCall className="h-5 w-5 animate-pulse" />
                Call in Progress
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Start Call
              </>
            )}
          </Button>

          {/* Insufficient Balance Warning */}
          {wallet && wallet.balance <= 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Add credits to your wallet to make calls</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">How Int'l Calling Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">1.</span>
              We call your phone number (no internet needed)
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">2.</span>
              When you answer, we connect you to the destination
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">3.</span>
              Calls are routed via lowest-cost provider for each country
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              Perfect for Africa, emerging markets, and poor connectivity
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVoiceOrchestrator } from "@/hooks/useVoiceOrchestrator";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed,
  Clock,
  DollarSign,
  RefreshCw,
  Globe,
  TrendingUp,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CallHistoryPanelProps {
  className?: string;
}

export function CallHistoryPanel({ className }: CallHistoryPanelProps) {
  const { currentOrganization } = useOrganizationContext();
  const {
    loading,
    callHistory,
    getCallHistory,
    formatDuration,
    formatCurrency,
  } = useVoiceOrchestrator();

  useEffect(() => {
    if (currentOrganization?.id) {
      getCallHistory(currentOrganization.id);
    }
  }, [currentOrganization?.id, getCallHistory]);

  const handleRefresh = () => {
    if (currentOrganization?.id) {
      getCallHistory(currentOrganization.id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Completed</Badge>;
      case "failed":
      case "leg_a_failed":
      case "leg_b_failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "no_answer":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">No Answer</Badge>;
      case "busy":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-200">Busy</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCallIcon = (session: any) => {
    if (session.call_status === "completed") {
      return <PhoneOutgoing className="h-4 w-4 text-green-600" />;
    }
    if (["failed", "leg_a_failed", "leg_b_failed"].includes(session.call_status)) {
      return <PhoneMissed className="h-4 w-4 text-red-600" />;
    }
    if (session.call_direction === "inbound") {
      return <PhoneIncoming className="h-4 w-4 text-blue-600" />;
    }
    return <Phone className="h-4 w-4 text-muted-foreground" />;
  };

  // Calculate statistics
  const stats = {
    totalCalls: callHistory.length,
    completedCalls: callHistory.filter(c => c.call_status === "completed").length,
    totalMinutes: Math.round(callHistory.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / 60),
    totalCost: callHistory.reduce((sum, c) => sum + (c.final_cost || 0), 0),
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Calls</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.completedCalls}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Minutes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalMinutes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Spent</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Call History List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Call History
              </CardTitle>
              <CardDescription>Recent voice calls</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {callHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No calls yet</p>
              <p className="text-sm">Your call history will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {callHistory.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-full">
                        {getCallIcon(session)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{session.destination_number}</p>
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {session.destination_country_code}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>
                            {format(new Date(session.initiated_at), "MMM d, yyyy h:mm a")}
                          </span>
                          {session.duration_seconds > 0 && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(session.duration_seconds)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {session.final_cost !== null && (
                        <span className="text-sm font-medium">
                          {formatCurrency(session.final_cost)}
                        </span>
                      )}
                      {getStatusBadge(session.call_status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

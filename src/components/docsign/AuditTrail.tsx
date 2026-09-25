import { useState } from 'react';
import { 
  FileText, 
  Send, 
  Eye, 
  PenTool, 
  Check, 
  X, 
  Clock, 
  Download,
  Shield,
  Globe,
  Smartphone,
  Mail,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2 as _Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { generateAuditCertificate } from '@/lib/docsign/generateAuditCertificate';
import { toast } from 'sonner';

interface AuditEvent {
  id: string;
  action: string;
  actorType: 'user' | 'signer' | 'system';
  actorEmail?: string;
  actorName?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    browser: string;
    os: string;
    device: string;
  };
  details?: Record<string, unknown>;
  location?: string;
}

interface AuditTrailProps {
  documentId: string;
  documentTitle: string;
  documentHash?: string;
}

// Helper to parse device info from user agent
function parseUserAgent(ua?: string): { browser: string; os: string; device: string } | undefined {
  if (!ua) return undefined;
  
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';
  
  // Browser detection
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) { os = 'Android'; device = 'Mobile'; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; device = 'Mobile'; }
  
  return { browser, os, device };
}

// Helper to safely extract string from Json
function extractString(val: Json | undefined): string | undefined {
  if (typeof val === 'string') return val;
  return undefined;
}

// Helper to safely extract details object
function extractDetails(details: Json | null): Record<string, unknown> | undefined {
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }
  return undefined;
}

export function AuditTrail({ documentId, documentTitle, documentHash }: AuditTrailProps) {
  // Fetch real audit logs from database
  const { data: auditLogs = [], isLoading: _isLoading } = useQuery({
    queryKey: ['document-audit-logs', documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_audit_logs')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!documentId,
  });

  // Transform database logs to UI format
  const events: AuditEvent[] = auditLogs.map(log => {
    const details = extractDetails(log.details);
    return {
      id: log.id,
      action: log.action,
      actorType: (log.actor_type || 'system') as AuditEvent['actorType'],
      actorEmail: extractString(details?.actor_email as Json),
      actorName: extractString(details?.actor_name as Json),
      timestamp: log.created_at,
      ipAddress: log.ip_address || undefined,
      userAgent: log.user_agent || undefined,
      deviceInfo: parseUserAgent(log.user_agent || undefined),
      details,
      location: extractString(details?.location as Json),
    };
  });
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const getEventIcon = (action: string) => {
    const icons: Record<string, React.ReactNode> = {
      'document_created': <FileText className="w-4 h-4" />,
      'signers_added': <User className="w-4 h-4" />,
      'document_sent': <Send className="w-4 h-4" />,
      'document_viewed': <Eye className="w-4 h-4" />,
      'consent_given': <Check className="w-4 h-4" />,
      'document_signed': <PenTool className="w-4 h-4" />,
      'document_completed': <Shield className="w-4 h-4" />,
      'reminder_sent': <Mail className="w-4 h-4" />,
      'document_declined': <X className="w-4 h-4" />,
      'document_voided': <AlertCircle className="w-4 h-4" />,
    };
    return icons[action] || <Clock className="w-4 h-4" />;
  };

  const getEventColor = (action: string) => {
    if (action.includes('signed') || action.includes('completed')) return 'bg-green-500';
    if (action.includes('declined') || action.includes('voided')) return 'bg-red-500';
    if (action.includes('sent') || action.includes('reminder')) return 'bg-blue-500';
    if (action.includes('viewed') || action.includes('consent')) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getEventLabel = (action: string) => {
    const labels: Record<string, string> = {
      'document_created': 'Document Created',
      'signers_added': 'Signers Added',
      'document_sent': 'Sent for Signing',
      'document_viewed': 'Document Viewed',
      'consent_given': 'Consent Given',
      'document_signed': 'Document Signed',
      'document_completed': 'Signing Completed',
      'reminder_sent': 'Reminder Sent',
      'document_declined': 'Document Declined',
      'document_voided': 'Document Voided',
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  const getActorLabel = (event: AuditEvent) => {
    if (event.actorType === 'system') return 'System';
    return event.actorName || event.actorEmail || 'Unknown';
  };

  const handleDownloadCertificate = async () => {
    try {
      // Fetch signers for this document
      const { data: signers } = await supabase
        .from('document_signers')
        .select('email, name, signed_at, ip_address')
        .eq('document_id', documentId);

      generateAuditCertificate({
        documentId,
        documentTitle,
        documentHash,
        events: events.map(e => ({
          id: e.id,
          action: e.action,
          actorType: e.actorType,
          actorEmail: e.actorEmail,
          timestamp: e.timestamp,
          ipAddress: e.ipAddress,
          details: e.details,
        })),
        signers: signers?.map(s => ({
          email: s.email,
          name: s.name || undefined,
          signedAt: s.signed_at || undefined,
          ipAddress: s.ip_address || undefined,
        })),
      });

      toast.success('Audit certificate downloaded');
    } catch (err) {
      console.error('Failed to generate certificate:', err);
      toast.error('Failed to generate audit certificate');
    }
  };

  return (
    <div className="space-y-6">
      {/* Document Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            Complete record of all document activities with legal evidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground">Document</span>
              <p className="font-medium">{documentTitle}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground">Document ID</span>
              <p className="font-mono text-xs">{documentId}</p>
            </div>
            {documentHash && (
              <div className="space-y-1 md:col-span-2">
                <span className="text-muted-foreground">Document Hash (SHA-256)</span>
                <p className="font-mono text-xs break-all">{documentHash}</p>
              </div>
            )}
          </div>

          <Button 
            variant="outline" 
            className="mt-4"
            onClick={handleDownloadCertificate}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Audit Certificate
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            {events.map((event, index) => {
              const isExpanded = expandedEvents.has(event.id);
              const isLast = index === events.length - 1;

              return (
                <div key={event.id} className={cn('relative pl-10', !isLast && 'pb-6')}>
                  {/* Timeline dot */}
                  <div 
                    className={cn(
                      'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-white',
                      getEventColor(event.action)
                    )}
                  >
                    {getEventIcon(event.action)}
                  </div>

                  {/* Event content */}
                  <div 
                    className={cn(
                      'p-4 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50',
                      isExpanded && 'bg-muted/30'
                    )}
                    onClick={() => toggleExpand(event.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{getEventLabel(event.action)}</h4>
                          <Badge variant="outline" className="text-xs">
                            {event.actorType}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getActorLabel(event)} • {format(new Date(event.timestamp), 'PPP p')}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3 text-sm">
                        {event.ipAddress && (
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">IP Address:</span>
                            <span className="font-mono">{event.ipAddress}</span>
                            {event.location && (
                              <span className="text-muted-foreground">({event.location})</span>
                            )}
                          </div>
                        )}

                        {event.deviceInfo && (
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Device:</span>
                            <span>
                              {event.deviceInfo.browser} / {event.deviceInfo.os} ({event.deviceInfo.device})
                            </span>
                          </div>
                        )}

                        {event.details && Object.keys(event.details).length > 0 && (
                          <div className="p-3 bg-muted rounded-lg">
                            <span className="text-muted-foreground">Details:</span>
                            <pre className="mt-1 text-xs overflow-auto">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

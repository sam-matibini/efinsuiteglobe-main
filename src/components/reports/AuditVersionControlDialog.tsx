import { useState } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  History,
  Lock,
  Unlock,
  RotateCcw,
  Eye,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  FileText,
  Download,
  Save,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  useCompilationAuditTrail, 
  useCompilationVersions, 
  useCreateCompilationVersion,
  useLockCompilationVersion,
  useRestoreCompilationVersion,
  formatAuditAction,
  CompilationVersion
} from '@/hooks/useCompilationAuditTrail';
import { CompilationReport } from '@/hooks/useCompilationReports';

interface AuditVersionControlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compilation: CompilationReport | null;
}

export function AuditVersionControlDialog({
  open,
  onOpenChange,
  compilation
}: AuditVersionControlDialogProps) {
  const [activeTab, setActiveTab] = useState('versions');
  const [changeSummary, setChangeSummary] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<CompilationVersion | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  const { data: auditTrail = [], isLoading: auditLoading } = useCompilationAuditTrail(compilation?.id);
  const { data: versions = [], isLoading: versionsLoading } = useCompilationVersions(compilation?.id);
  const createVersion = useCreateCompilationVersion();
  const lockVersion = useLockCompilationVersion();
  const restoreVersion = useRestoreCompilationVersion();

  const handleSaveVersion = async () => {
    if (!compilation) return;
    await createVersion.mutateAsync({
      compilationReport: compilation,
      changeSummary: changeSummary || undefined
    });
    setChangeSummary('');
  };

  const handleLockVersion = async (version: CompilationVersion) => {
    if (!compilation) return;
    await lockVersion.mutateAsync({
      versionId: version.id,
      compilationReportId: compilation.id
    });
  };

  const handleRestoreVersion = async () => {
    if (!selectedVersion || !compilation) return;
    await restoreVersion.mutateAsync({
      version: selectedVersion,
      compilationReportId: compilation.id
    });
    setShowConfirmRestore(false);
    setSelectedVersion(null);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
      case 'version_created':
        return <FileText className="w-4 h-4 text-success" />;
      case 'updated':
        return <Save className="w-4 h-4 text-primary" />;
      case 'issued':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'version_locked':
        return <Lock className="w-4 h-4 text-warning" />;
      case 'version_restored':
        return <RotateCcw className="w-4 h-4 text-primary" />;
      case 'downloaded':
      case 'exported_pdf':
      case 'exported_word':
        return <Download className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  if (!compilation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version Control & Audit Trail
          </DialogTitle>
          <DialogDescription>
            Fiscal Year {compilation.fiscal_year} - Track changes and manage versions
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="versions" className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Versions ({versions.length})
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <History className="w-3.5 h-3.5" />
              Audit Trail ({auditTrail.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="versions" className="mt-0 space-y-4">
              {/* Save New Version */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Save Current Version</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Change Summary (Optional)</Label>
                    <Input
                      placeholder="Describe what changed in this version..."
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSaveVersion}
                    disabled={createVersion.isPending}
                    className="w-full gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {createVersion.isPending ? 'Saving...' : 'Save Version'}
                  </Button>
                </CardContent>
              </Card>

              {/* Version List */}
              {versionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading versions...
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Save className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No versions saved yet</p>
                  <p className="text-sm">Save a version to track changes over time</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <Card key={version.id} className={version.is_locked ? 'border-warning/50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Version {version.version_number}</span>
                              {version.is_locked && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1">
                                  <Lock className="w-3 h-3" />
                                  Locked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {version.change_summary || 'No description'}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(parseISO(version.created_at), { addSuffix: true })}
                              </span>
                              {version.locked_at && (
                                <span className="flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  Locked {formatDistanceToNow(parseISO(version.locked_at), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!version.is_locked && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLockVersion(version)}
                                disabled={lockVersion.isPending}
                                title="Lock this version"
                              >
                                <Lock className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedVersion(version);
                                setShowConfirmRestore(true);
                              }}
                              disabled={restoreVersion.isPending}
                              title="Restore this version"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-0 space-y-4">
              {auditLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading audit trail...
                </div>
              ) : auditTrail.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No audit entries yet</p>
                  <p className="text-sm">Changes to this report will be tracked here</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {auditTrail.map((entry, idx) => (
                    <div 
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="mt-0.5">
                        {getActionIcon(entry.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {formatAuditAction(entry.action)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(parseISO(entry.performed_at), { addSuffix: true })}
                          </span>
                        </div>
                        {entry.field_changed && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Changed: {entry.field_changed}
                            {entry.old_value && entry.new_value && (
                              <span className="ml-1">
                                ({entry.old_value} → {entry.new_value})
                              </span>
                            )}
                          </p>
                        )}
                        {entry.action_details && Object.keys(entry.action_details).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {JSON.stringify(entry.action_details)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Restore Confirmation Dialog */}
        {showConfirmRestore && selectedVersion && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Restore Version {selectedVersion.version_number}?</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>This will overwrite the current report with the saved version. This action cannot be undone.</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowConfirmRestore(false);
                    setSelectedVersion(null);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={handleRestoreVersion}
                  disabled={restoreVersion.isPending}
                  className="bg-warning text-warning-foreground hover:bg-warning/90"
                >
                  {restoreVersion.isPending ? 'Restoring...' : 'Restore Version'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

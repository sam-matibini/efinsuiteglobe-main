import { useState } from 'react';

import { FileText, Users, Clock, Plus, Mail, Phone, Loader2, PenTool, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDocument, useDocumentSigners, useAddSigner, useRefreshDocumentStatus, useSignerSigningUrl } from '@/hooks/useDocuments';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface DocumentDetailDialogProps {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrepareAndSend?: (documentId: string) => void;
}

export function DocumentDetailDialog({ documentId, open, onOpenChange, onPrepareAndSend }: DocumentDetailDialogProps) {
  const [newSigner, setNewSigner] = useState({ email: '', name: '', auth_method: 'email' as 'email' | 'sms' });
  
  const { data: document, isLoading: documentLoading } = useDocument(documentId || undefined);
  const { data: signers = [], isLoading: signersLoading } = useDocumentSigners(documentId || undefined);
  const addSigner = useAddSigner();
  const refreshStatus = useRefreshDocumentStatus();
  const getSigningUrl = useSignerSigningUrl();

  const handleAddSigner = async () => {
    if (!newSigner.email || !documentId) {
      toast.error('Please enter signer email');
      return;
    }

    try {
      await addSigner.mutateAsync({
        document_id: documentId,
        email: newSigner.email,
        name: newSigner.name || null,
        role: 'signer',
        signing_order: signers.length + 1,
        auth_method: newSigner.auth_method,
        phone_number: null,
        status: 'pending',
      });
      setNewSigner({ email: '', name: '', auth_method: 'email' });
    } catch {
      // Error handled by hook
    }
  };


  if (!documentId) return null;

  const isLoading = documentLoading || signersLoading;
  const canEdit = document?.status === 'draft';
  const canSend = canEdit && signers.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            {document?.title || 'Document Details'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Loading document...</p>
          </div>
        ) : document ? (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="signers">Signers ({signers.length})</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={document.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                      {document.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span className="text-sm font-medium capitalize">{document.document_type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm font-medium">{format(new Date(document.created_at), 'PPP')}</span>
                  </div>
                  {document.expires_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Expires</span>
                      <span className="text-sm font-medium">{format(new Date(document.expires_at), 'PPP')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Version</span>
                    <span className="text-sm font-medium">v{document.version}</span>
                  </div>
                </CardContent>
              </Card>

              {canSend && onPrepareAndSend && (
                <Button 
                  className="w-full bg-accent hover:bg-accent/90"
                  onClick={() => {
                    onOpenChange(false);
                    onPrepareAndSend(documentId!);
                  }}
                >
                  <PenTool className="w-4 h-4 mr-2" />
                  Prepare & Send
                </Button>
              )}
            </TabsContent>

            <TabsContent value="signers" className="space-y-4 mt-4">
              {/* Existing Signers */}
              {signers.length > 0 ? (
                <div className="space-y-3">
                  {signers.map((signer, index) => (
                    <Card key={signer.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{signer.name || signer.email}</p>
                              {signer.name && <p className="text-sm text-muted-foreground">{signer.email}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={signer.status === 'signed' ? 'default' : 'secondary'} className="capitalize">
                              {signer.status}
                            </Badge>
                            {signer.auth_method === 'sms' ? (
                              <Phone className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Mail className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No signers added yet</p>
                  </CardContent>
                </Card>
              )}

              {/* Add Signer Form */}
              {canEdit && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add Signer
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          placeholder="signer@example.com"
                          value={newSigner.email}
                          onChange={(e) => setNewSigner(prev => ({ ...prev, email: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Name (Optional)</Label>
                        <Input
                          placeholder="John Doe"
                          value={newSigner.name}
                          onChange={(e) => setNewSigner(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Verification Method</Label>
                      <Select 
                        value={newSigner.auth_method} 
                        onValueChange={(v: 'email' | 'sms') => setNewSigner(prev => ({ ...prev, auth_method: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email Verification</SelectItem>
                          <SelectItem value="sms">SMS Verification (Twilio)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleAddSigner}
                      disabled={addSigner.isPending || !newSigner.email}
                      className="w-full"
                    >
                      {addSigner.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Signer
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardContent className="py-8 text-center">
                  <Clock className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Activity timeline coming soon</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Document not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
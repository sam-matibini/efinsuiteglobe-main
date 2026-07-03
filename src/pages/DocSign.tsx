import { useState, useEffect } from 'react';
import { Plus, FileText, Send, Clock, CheckCircle, XCircle, Eye, Search, Filter, MoreVertical, FileSignature, Layout, PenTool, History, FolderOpen, Download, Trash2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useDocuments, useDocumentSigners, useDocumentFields, useAddField, useUpdateDocument, useAddSigner, useSendDocument, useUpdateDocumentField, type Document } from '@/hooks/useDocuments';
import { CreateDocumentDialog } from '@/components/docsign/CreateDocumentDialog';
import { DocumentDetailDialog } from '@/components/docsign/DocumentDetailDialog';
import { DocumentEditor } from '@/components/docsign/DocumentEditor';
import { SignaturePad } from '@/components/docsign/SignaturePad';
import { TemplateManager } from '@/components/docsign/TemplateManager';
import { DocumentWorkflow } from '@/components/docsign/DocumentWorkflow';
import { AuditTrail } from '@/components/docsign/AuditTrail';
import { SigningWorkflow } from '@/components/docsign/SigningWorkflow';
import { DeleteDocumentDialog } from '@/components/docsign/DeleteDocumentDialog';
import { BulkDeleteDialog } from '@/components/docsign/BulkDeleteDialog';
import { DocumentShareDialog } from '@/components/docsign/DocumentShareDialog';
import { Recipient } from '@/components/docsign/RecipientPicker';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { usePdfFlatten } from '@/hooks/usePdfFlatten';
import { useSaveSignature } from '@/hooks/useUserSignatures';

type ViewMode = 'list' | 'editor' | 'workflow' | 'audit' | 'templates' | 'sign' | 'signing-workflow';

export default function DocSign() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  
  // Multi-select state
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; title: string } | null>(null);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState<Document | null>(null);
  
  const { data: documents = [], isLoading } = useDocuments();
  const updateDocument = useUpdateDocument();
  const { data: activeDocSigners = [] } = useDocumentSigners(activeDocumentId || undefined);
  const { data: activeDocFields = [] } = useDocumentFields(activeDocumentId || undefined);
  const _addField = useAddField();
  const updateFieldMutation = useUpdateDocumentField();
  const addSigner = useAddSigner();
  const sendDocument = useSendDocument();
  const { user } = useAuth();
  const { flattenPdf } = usePdfFlatten();
  const saveSignature = useSaveSignature();
  const [documentMetadata, setDocumentMetadata] = useState<Record<string, any>>({});

  // Flatten PDF when document is opened for editing
  useEffect(() => {
    const processDocument = async () => {
      if (!activeDocumentId) return;
      
      const doc = documents.find(d => d.id === activeDocumentId);
      if (!doc?.file_url || !doc.mime_type?.includes('pdf')) return;
      
      // Check if already processed
      const existingMetadata = doc.metadata as Record<string, any> | null;
      if (existingMetadata?.flattenedAt) {
        setDocumentMetadata(prev => ({
          ...prev,
          [activeDocumentId]: existingMetadata
        }));
        return;
      }
      
      // Flatten the PDF
      const result = await flattenPdf(doc.file_url, activeDocumentId);
      if (result) {
        setDocumentMetadata(prev => ({
          ...prev,
          [activeDocumentId]: {
            pageCount: result.pageCount,
            hasXfa: result.hasXfa,
            previewUrls: result.previewUrls,
            flattenedAt: new Date().toISOString(),
          }
        }));
      }
    };
    
    processDocument();
  }, [activeDocumentId, documents, flattenPdf]);

  const normalizeStatus = (status: string | null | undefined) => status?.toLowerCase().trim() ?? '';

  const isResendEligible = (status: string | null | undefined) =>
    ['pending', 'sent', 'viewed', 'signing'].includes(normalizeStatus(status));

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || normalizeStatus(doc.status) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const normalizedStatus = normalizeStatus(status);
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      draft: { variant: 'secondary', icon: <FileText className="w-3 h-3" /> },
      pending: { variant: 'outline', icon: <Clock className="w-3 h-3" /> },
      sent: { variant: 'default', icon: <Send className="w-3 h-3" /> },
      viewed: { variant: 'outline', icon: <Eye className="w-3 h-3" /> },
      signing: { variant: 'default', icon: <FileSignature className="w-3 h-3" /> },
      completed: { variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
      declined: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
      expired: { variant: 'destructive', icon: <Clock className="w-3 h-3" /> },
      voided: { variant: 'secondary', icon: <XCircle className="w-3 h-3" /> },
    };
    const config = variants[normalizedStatus] || variants.draft;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 capitalize">
        {config.icon}
        {normalizedStatus || status}
      </Badge>
    );
  };

  const stats = {
    total: documents.length,
    pending: documents.filter(d => ['pending', 'sent', 'viewed', 'signing'].includes(normalizeStatus(d.status))).length,
    completed: documents.filter(d => normalizeStatus(d.status) === 'completed').length,
    draft: documents.filter(d => normalizeStatus(d.status) === 'draft').length,
  };

  // Multi-select handlers
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocumentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const selectAllDocuments = (docs: Document[]) => {
    setSelectedDocumentIds(new Set(docs.map(d => d.id)));
  };

  const clearSelection = () => {
    setSelectedDocumentIds(new Set());
  };

  const handleBulkMoveToCompleted = async () => {
    const selectedDocs = documents.filter(d => selectedDocumentIds.has(d.id) && d.status !== 'completed');
    if (selectedDocs.length === 0) {
      toast.info('No documents to move (already completed or none selected)');
      return;
    }
    
    try {
      for (const doc of selectedDocs) {
        await updateDocument.mutateAsync({
          id: doc.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
        });
      }
      toast.success(`Moved ${selectedDocs.length} document(s) to Completed`);
      clearSelection();
    } catch {
      toast.error('Failed to move some documents');
    }
  };

  const handleOpenEditor = (docId: string) => {
    setActiveDocumentId(docId);
    setViewMode('editor');
  };

  const _handleOpenWorkflow = (docId: string) => {
    setActiveDocumentId(docId);
    setViewMode('workflow');
  };

  const handleOpenSigningWorkflow = (docId: string) => {
    setActiveDocumentId(docId);
    setViewMode('signing-workflow');
  };

  const handleResendDocument = async (docId: string) => {
    try {
      await sendDocument.mutateAsync(docId);
    } catch {
      // Error toast handled by hook
    }
  };

  const handleOpenAudit = (docId: string) => {
    setActiveDocumentId(docId);
    setViewMode('audit');
  };

  // Handler for when the signing workflow completes
  const handleSigningWorkflowComplete = async (
    recipients: Recipient[], 
    fields: { id: string; type: string; x: number; y: number; width: number; height: number; pageNumber: number; isRequired: boolean; assignedSignerId?: string; value?: string }[],
    settings: { signingOrder: 'sequential' | 'parallel'; expirationDays: number; reminderEnabled: boolean; reminderDays: number; customMessage: string }
  ) => {
    if (!activeDocumentId) return;

    try {
      // === DEBUG: Log all fields/signers being sent ===
      const senderFieldCount = fields.filter(f => f.assignedSignerId === 'sender' || !f.assignedSignerId).length;
      const recipientFieldCount = fields.filter(f => f.assignedSignerId && f.assignedSignerId !== 'sender').length;
      const filledFieldCount = fields.filter(f => !!f.value).length;
      console.log(`[DocSign Send] Recipients: ${recipients.length}, Total fields: ${fields.length}, sender: ${senderFieldCount}, recipient: ${recipientFieldCount}, filled: ${filledFieldCount}`);
      fields.forEach((f, i) => {
        console.log(`[DocSign Send] Field ${i}: type=${f.type}, assignedTo=${f.assignedSignerId || 'sender'}, hasValue=${!!f.value}, valueLen=${f.value?.length || 0}`);
      });

      // Guard: recipient-assigned fields must map to actual recipients
      const recipientAssignedFieldSignerIds = Array.from(
        new Set(
          fields
            .filter((f) => !!f.assignedSignerId && f.assignedSignerId !== 'sender')
            .map((f) => f.assignedSignerId as string)
        )
      );

      const knownRecipientIds = new Set(recipients.map((r) => r.id));
      const unknownRecipientIds = recipientAssignedFieldSignerIds.filter((id) => !knownRecipientIds.has(id));

      if (unknownRecipientIds.length > 0) {
        throw new Error(`Some fields are assigned to missing recipients: ${unknownRecipientIds.join(', ')}`);
      }

      // 1. Clear existing data to avoid duplicates/ghosts
      await supabase.from('document_fields').delete().eq('document_id', activeDocumentId);
      await supabase.from('document_signers').delete().eq('document_id', activeDocumentId);

      // 2. Prepare signers (Include the Sender/Owner as a signer if they have fields)
      const signersToSend = [...recipients];

      // Check if there are fields assigned to the sender
      const hasSenderFields = fields.some(f => f.assignedSignerId === 'sender' || !f.assignedSignerId);

      if (hasSenderFields && user?.email) {
        // Add sender to the list if not already there
        signersToSend.unshift({
          id: 'sender', // Temp ID for matching
          name: user.user_metadata?.full_name || 'Me',
          email: user.email,
          type: 'manual',
          role: 'Sender',
          signingOrder: 0
        });
      }

      if (signersToSend.length === 0) {
        toast.error('No recipients defined');
        return;
      }

      // 3. Create Signers in Database & Create Map
      const recipientIdToDbId: Record<string, string> = {};

      for (let i = 0; i < signersToSend.length; i++) {
        const signer = signersToSend[i];
        const isSender = signer.id === 'sender';

        const result = await addSigner.mutateAsync({
          document_id: activeDocumentId,
          email: signer.email,
          name: signer.name || null,
          role: signer.role || 'Signer',
          signing_order: settings.signingOrder === 'sequential' ? i + 1 : 1,
          auth_method: 'email',
          phone_number: null,
          status: isSender && hasSenderFields ? 'signed' : 'pending',
        });

        if (result?.id) {
          recipientIdToDbId[signer.id] = result.id;
          console.log(`[DocSign Send] Signer created: tempId=${signer.id}, dbId=${result.id}, email=${signer.email}, isSender=${isSender}`);
        }
      }

      // Guard: every recipient-assigned field must resolve to a DB signer id
      const unresolvedRecipientIds = recipientAssignedFieldSignerIds.filter((id) => !recipientIdToDbId[id]);
      if (unresolvedRecipientIds.length > 0) {
        throw new Error(`Could not resolve signer IDs for recipient fields: ${unresolvedRecipientIds.join(', ')}`);
      }

      // 4. Save Fields (PRESERVING VALUES)
      for (const field of fields) {
        if (!field.type) continue;

        // Determine the correct database Signer ID
        let assignedDbId: string | null = null;

        if (field.assignedSignerId === 'sender' || !field.assignedSignerId) {
          assignedDbId = recipientIdToDbId['sender'] || null;
        } else {
          assignedDbId = recipientIdToDbId[field.assignedSignerId] || null;
          if (!assignedDbId) {
            throw new Error(`Missing DB signer mapping for field assigned to ${field.assignedSignerId}`);
          }
        }

        // Only persist filled_value for sender fields — recipient fields must remain blank
        // so that external signers can fill them via the signer portal.
        const isSenderField = field.assignedSignerId === 'sender' || !field.assignedSignerId;
        const shouldSaveValue = isSenderField && !!field.value;

        console.log(`[DocSign Send] Inserting field: type=${field.type}, assignedDbId=${assignedDbId}, isSender=${isSenderField}, shouldSaveValue=${shouldSaveValue}, valueLen=${field.value?.length || 0}`);

        const { error: fieldError } = await supabase
          .from('document_fields')
          .insert({
            document_id: activeDocumentId,
            field_type: field.type as any,
            position_x: field.x,
            position_y: field.y,
            width: field.width,
            height: field.height,
            page_number: field.pageNumber,
            is_required: field.isRequired,
            assigned_signer_id: assignedDbId,
            label: null,
            filled_value: shouldSaveValue ? field.value : null,
            filled_at: shouldSaveValue ? new Date().toISOString() : null,
          });

        if (fieldError) {
          console.error('Error inserting field:', fieldError);
        }
      }

      // 5. Trigger Emails
      await sendDocument.mutateAsync(activeDocumentId);

      toast.success('Document sent successfully!');
      setViewMode('list');
      setActiveDocumentId(null);

    } catch (error) {
      console.error('Error in signing workflow:', error);
      toast.error('Failed to send document');
    }
  };

  const isUuid = (id: string | undefined | null): boolean =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const handleSaveFields = async (fields: { id: string; type: string; x: number; y: number; width: number; height: number; pageNumber: number; isRequired: boolean; assignedSignerId?: string; isSenderField?: boolean; value?: string; pdfPageWidthPt?: number; pdfPageHeightPt?: number }[]) => {
    if (!activeDocumentId) return;
    
    const existingFieldIds = new Set(activeDocFields.map(f => f.id));
    const incomingPersistedFieldIds = new Set(fields.filter((f) => isUuid(f.id)).map((f) => f.id));
    const fieldIdsToDelete = activeDocFields
      .map((f) => f.id)
      .filter((id) => !incomingPersistedFieldIds.has(id));

    if (fieldIdsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('document_fields')
        .delete()
        .eq('document_id', activeDocumentId)
        .in('id', fieldIdsToDelete);

      if (deleteError) {
        console.error('[DocSign] Failed to delete removed fields:', deleteError);
      }
    }

    for (const field of fields) {
      if (!field.type) continue;
      
      // Resolve assignedSignerId: only pass real UUIDs to the database
      const rawSignerId = field.assignedSignerId === 'sender' ? null : (field.assignedSignerId || null);
      const assignedSignerId = rawSignerId && isUuid(rawSignerId) ? rawSignerId : null;
      
      if (isUuid(field.id) && existingFieldIds.has(field.id)) {
        // UPDATE existing field
        const updates: Record<string, any> = {
          position_x: field.x,
          position_y: field.y,
          width: field.width,
          height: field.height,
        };
        
        // Save PDF page dimensions for accurate coordinate mapping
        if (field.pdfPageWidthPt) updates.pdf_page_width_pt = field.pdfPageWidthPt;
        if (field.pdfPageHeightPt) updates.pdf_page_height_pt = field.pdfPageHeightPt;
        
        updates.filled_value = field.value || null;
        updates.filled_at = field.value ? new Date().toISOString() : null;
        
        await updateFieldMutation.mutateAsync({
          fieldId: field.id,
          documentId: activeDocumentId,
          updates,
        });
      } else {
        // INSERT new field with filled_value in ONE step (avoids race conditions)
        const { data: newField, error: insertError } = await supabase
          .from('document_fields')
          .insert({
            document_id: activeDocumentId,
            field_type: field.type as any,
            position_x: field.x,
            position_y: field.y,
            width: field.width,
            height: field.height,
            page_number: field.pageNumber,
            is_required: field.isRequired,
            assigned_signer_id: assignedSignerId,
            label: field.assignedSignerId || null,
            filled_value: field.value || null,
            filled_at: field.value ? new Date().toISOString() : null,
            pdf_page_width_pt: field.pdfPageWidthPt || null,
            pdf_page_height_pt: field.pdfPageHeightPt || null,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[DocSign] Failed to save field:', insertError);
        } else {
          console.log('[DocSign] Field saved:', newField?.id, 'value?', !!field.value, 'label:', field.assignedSignerId);
        }
      }
    }
    
    toast.success('Fields saved successfully');
  };

  const handleSendDocument = async (signers: any[], settings: any) => {
    if (!activeDocumentId) return;

    const validSigners = (signers || []).filter((s) => typeof s?.email === 'string' && s.email.trim());
    if (validSigners.length === 0) {
      toast.error('Please add at least one recipient before sending');
      return;
    }

    try {
      // Persist recipients from the workflow UI
      for (let i = 0; i < validSigners.length; i++) {
        const signer = validSigners[i];
        await addSigner.mutateAsync({
          document_id: activeDocumentId,
          email: signer.email,
          name: signer.name || null,
          role: signer.role || 'signer',
          signing_order: settings?.signingOrder === 'sequential' ? i + 1 : 1,
          auth_method: signer.authMethod || 'email',
          phone_number: signer.phone || null,
          status: 'pending',
        });
      }

      // Dispatch emails (with PDF attachment when eligible)
      await sendDocument.mutateAsync(activeDocumentId);

      toast.success(`Document sent to ${validSigners.length} recipient(s) for signature`);
      setViewMode('list');
      setActiveDocumentId(null);
    } catch (error) {
      console.error('Error sending document from workflow:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send document for signature: ${msg}`);
    }
  };

  const handleSendForSignature = async (signers: any[], signingOrder: 'sequential' | 'parallel') => {
    if (!activeDocumentId) return;
    
    // Validate signers
    const validSigners = (signers || []).filter((s) => typeof s?.email === 'string' && s.email.trim());
    if (validSigners.length === 0) {
      toast.error('Please add at least one recipient with a valid email before sending');
      return;
    }
    
    try {
      const signerIdMap: Record<string, string> = {};

      // First, add all signers to the database and capture temp-id -> db-id map
      for (let i = 0; i < validSigners.length; i++) {
        const signer = validSigners[i];
        const result = await addSigner.mutateAsync({
          document_id: activeDocumentId,
          email: signer.email,
          name: signer.name || null,
          role: signer.role || 'Signer',
          signing_order: signingOrder === 'sequential' ? i + 1 : 1,
          auth_method: signer.auth_method || 'email',
          phone_number: signer.phone_number || null,
          status: 'pending'
        });

        if (signer?.id && result?.id) {
          signerIdMap[String(signer.id)] = result.id;
        }
      }

      // Remap fields from temporary recipient IDs (stored in label) to actual signer UUIDs
      for (const [tempSignerId, dbSignerId] of Object.entries(signerIdMap)) {
        const { error: remapError } = await supabase
          .from('document_fields')
          .update({ assigned_signer_id: dbSignerId })
          .eq('document_id', activeDocumentId)
          .eq('label', tempSignerId);

        if (remapError) {
          console.error('Failed to remap signer fields:', remapError);
        }
      }

      // Backward-compat fallback for older drafts: if one signer and still no assigned fields,
      // assign unassigned/unfilled fields so the signer can complete the document.
      // IMPORTANT: Exclude sender fields (label = 'sender') - those belong to the owner
      if (validSigners.length === 1) {
        const onlySignerId = Object.values(signerIdMap)[0];
        if (onlySignerId) {
          const { data: signerFields, error: signerFieldsError } = await supabase
            .from('document_fields')
            .select('id')
            .eq('document_id', activeDocumentId)
            .eq('assigned_signer_id', onlySignerId)
            .limit(1);

          if (!signerFieldsError && (!signerFields || signerFields.length === 0)) {
            const { error: fallbackAssignError } = await supabase
              .from('document_fields')
              .update({ assigned_signer_id: onlySignerId })
              .eq('document_id', activeDocumentId)
              .is('assigned_signer_id', null)
              .is('filled_value', null)
              .neq('label', 'sender'); // Never reassign sender/owner fields

            if (fallbackAssignError) {
              console.error('Fallback signer assignment failed:', fallbackAssignError);
            }
          }
        }
      }

      // Embed owner's signature into the PDF before sending to external signers
      try {
        console.log('[DocSign] Embedding owner signature before send...');
        const { data: embedResult, error: embedError } = await supabase.functions.invoke('embed-pdf-signatures', {
          body: { documentId: activeDocumentId },
        });
        if (embedError) {
          console.error('[DocSign] Failed to embed owner signature:', embedError);
        } else if (embedResult?.downloadUrl) {
          const { error: updateErr } = await supabase
            .from('documents')
            .update({ file_url: embedResult.downloadUrl })
            .eq('id', activeDocumentId);
          if (updateErr) {
            console.error('[DocSign] Failed to update file_url after embed:', updateErr);
          } else {
            console.log('[DocSign] Owner signature embedded successfully');
          }
        }
      } catch (embedErr) {
        console.error('[DocSign] Embed error:', embedErr);
      }
      
      // Then send the document (updates status to 'sent')
      await sendDocument.mutateAsync(activeDocumentId);
      
      toast.success(`Document sent to ${validSigners.length} recipient(s) for signature`);
      setViewMode('list');
      setActiveDocumentId(null);
    } catch (error) {
      console.error('Error sending document:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send document: ${msg}`);
    }
  };

  const handleVoidDocument = async () => {
    if (!activeDocumentId) return;
    
    await updateDocument.mutateAsync({
      id: activeDocumentId,
      status: 'voided'
    });
    
    toast.success('Document has been voided');
    setViewMode('list');
    setActiveDocumentId(null);
  };

  const activeDocument = documents.find(d => d.id === activeDocumentId);

  // Render different views
  if (viewMode === 'editor' && activeDocumentId && activeDocument) {
    const meta = documentMetadata[activeDocumentId] || (activeDocument.metadata as Record<string, any>) || null;
    
    // Full screen editor - renders outside normal layout
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <DocumentEditor
          documentId={activeDocumentId}
          documentTitle={activeDocument.title}
          fileUrl={activeDocument.file_url}
          mimeType={activeDocument.mime_type}
          metadata={meta}
          signers={activeDocSigners}
          fields={activeDocFields}
          onSaveFields={handleSaveFields}
          onBack={() => setViewMode('list')}
          onSendForSignature={handleSendForSignature}
          onVoidDocument={handleVoidDocument}
          mode="edit"
          documentStatus={activeDocument.status}
          signedPdfUrl={(activeDocument as any).signed_pdf_url || null}
          currentUserEmail={user?.email || ''}
          currentUserName={user?.email?.split('@')[0] || 'Me'}
        />
      </div>
    );
  }

  if (viewMode === 'workflow' && activeDocumentId && activeDocument) {
    return (
      <div className="space-y-6">
        <DocumentWorkflow
          documentId={activeDocumentId}
          documentTitle={activeDocument.title}
          onSend={handleSendDocument}
          onBack={() => setViewMode('list')}
        />
      </div>
    );
  }

  // New Signing Workflow - combines recipients, field placement, and settings in one flow
  if (viewMode === 'signing-workflow' && activeDocumentId && activeDocument) {
    const meta = documentMetadata[activeDocumentId] || (activeDocument.metadata as Record<string, any>) || null;
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <SigningWorkflow
          documentId={activeDocumentId}
          documentTitle={activeDocument.title}
          fileUrl={activeDocument.file_url}
          mimeType={activeDocument.mime_type}
          pageCount={meta?.pageCount || 1}
          currentUserEmail={user?.email || ''}
          currentUserName={user?.email?.split('@')[0] || 'Me'}
          initialFields={activeDocFields.map(f => ({
            id: f.id,
            type: f.field_type as any,
            x: f.position_x,
            y: f.position_y,
            width: f.width,
            height: f.height,
            pageNumber: f.page_number,
            assignedSignerId: f.assigned_signer_id || (f.label === 'sender' ? 'sender' : undefined),
            label: f.label || undefined,
            isRequired: f.is_required,
            value: f.filled_value || undefined,
          }))}
          onComplete={handleSigningWorkflowComplete}
          onBack={() => setViewMode('list')}
        />
      </div>
    );
  }

  if (viewMode === 'audit' && activeDocumentId && activeDocument) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setViewMode('list')}>← Back to Documents</Button>
        <AuditTrail
          documentId={activeDocumentId}
          documentTitle={activeDocument.title}
          documentHash={activeDocument.document_hash || undefined}
        />
      </div>
    );
  }

  if (viewMode === 'templates') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FolderOpen className="w-8 h-8 text-accent" />
              Document Templates
            </h1>
            <p className="text-muted-foreground mt-1">Manage reusable document templates</p>
          </div>
          <Button variant="outline" onClick={() => setViewMode('list')}>← Back to Documents</Button>
        </div>
        <TemplateManager
          onUseTemplate={(_templateId) => {
            setCreateDialogOpen(true);
            setViewMode('list');
          }}
          onCreateDocument={() => setCreateDialogOpen(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileSignature className="w-8 h-8 text-accent" />
              DocSign
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">Create, send, and manage electronic signatures</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewMode('templates')}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Templates
          </Button>
          <Button variant="outline" onClick={() => setSignaturePadOpen(true)}>
            <PenTool className="w-4 h-4 mr-2" />
            My Signature
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            New Document
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></div><FileText className="w-8 h-8 text-muted-foreground/50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Awaiting</p><p className="text-2xl font-bold text-amber-600">{stats.pending}</p></div><Clock className="w-8 h-8 text-amber-500/50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Completed</p><p className="text-2xl font-bold text-green-600">{stats.completed}</p></div><CheckCircle className="w-8 h-8 text-green-500/50" /></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Drafts</p><p className="text-2xl font-bold">{stats.draft}</p></div><FileText className="w-8 h-8 text-muted-foreground/50" /></div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Action Bar */}
      {selectedDocumentIds.size > 0 && (
        <Card className="border-accent">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">{selectedDocumentIds.size} selected</span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkMoveToCompleted}
                  disabled={updateDocument.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Move to Completed
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="action">Action Required</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredDocuments.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FileSignature className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No documents yet</h3>
              <Button onClick={() => setCreateDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Document</Button>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-2">
                <Checkbox 
                  checked={selectedDocumentIds.size === filteredDocuments.length && filteredDocuments.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      selectAllDocuments(filteredDocuments);
                    } else {
                      clearSelection();
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className={`hover:border-accent/50 transition-colors ${selectedDocumentIds.has(doc.id) ? 'border-accent bg-accent/5' : ''}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Checkbox 
                          checked={selectedDocumentIds.has(doc.id)}
                          onCheckedChange={() => toggleDocumentSelection(doc.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center cursor-pointer" onClick={() => setSelectedDocument(doc.id)}><FileText className="w-5 h-5 text-accent" /></div>
                        <div className="cursor-pointer min-w-0 flex-1" onClick={() => setSelectedDocument(doc.id)}>
                          <h3 className="font-medium truncate max-w-xs sm:max-w-sm md:max-w-md">{doc.title}</h3>
                          <p className="text-sm text-muted-foreground">{doc.document_type} • {format(new Date(doc.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(doc.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isResendEligible(doc.status) && (
                              <DropdownMenuItem disabled={sendDocument.isPending} onClick={(e) => { e.stopPropagation(); void handleResendDocument(doc.id); }}><Send className="w-4 h-4 mr-2" />Resend</DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDocumentToDelete({ id: doc.id, title: doc.title }); setDeleteDialogOpen(true); }} 
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />Delete
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc.id); }}><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAudit(doc.id); }}><History className="w-4 h-4 mr-2" />Audit Trail</DropdownMenuItem>
                            {normalizeStatus(doc.status) === 'draft' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEditor(doc.id); }}><Layout className="w-4 h-4 mr-2" />Edit Fields</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenSigningWorkflow(doc.id); }}><Send className="w-4 h-4 mr-2" />Prepare & Send</DropdownMenuItem>
                              </>
                            )}
                            {normalizeStatus(doc.status) !== 'completed' && (
                              <DropdownMenuItem onClick={(e) => { 
                                e.stopPropagation(); 
                                updateDocument.mutate({ id: doc.id, status: 'completed', completed_at: new Date().toISOString() });
                              }}>
                                <CheckCircle className="w-4 h-4 mr-2" />Move to Completed
                              </DropdownMenuItem>
                            )}
                            {normalizeStatus(doc.status) === 'completed' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDocumentToShare(doc); setShareDialogOpen(true); }}><Share2 className="w-4 h-4 mr-2" />Download / Share</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="action" className="mt-4">
          {(() => {
            const actionDocs = filteredDocuments.filter(d => ['pending', 'sent', 'viewed', 'signing'].includes(normalizeStatus(d.status)));
            return actionDocs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No documents requiring action</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {actionDocs.map((doc) => (
                  <Card key={doc.id} className={`hover:border-accent/50 transition-colors ${selectedDocumentIds.has(doc.id) ? 'border-accent bg-accent/5' : ''}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Checkbox 
                            checked={selectedDocumentIds.has(doc.id)}
                            onCheckedChange={() => toggleDocumentSelection(doc.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center cursor-pointer" onClick={() => setSelectedDocument(doc.id)}><Clock className="w-5 h-5 text-amber-600" /></div>
                          <div className="cursor-pointer min-w-0 flex-1" onClick={() => setSelectedDocument(doc.id)}>
                            <h3 className="font-medium truncate max-w-xs sm:max-w-sm md:max-w-md">{doc.title}</h3>
                            <p className="text-sm text-muted-foreground">{doc.document_type} • {format(new Date(doc.created_at), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(doc.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isResendEligible(doc.status) && (
                                <DropdownMenuItem disabled={sendDocument.isPending} onClick={(e) => { e.stopPropagation(); void handleResendDocument(doc.id); }}><Send className="w-4 h-4 mr-2" />Resend</DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setDocumentToDelete({ id: doc.id, title: doc.title }); setDeleteDialogOpen(true); }} 
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />Delete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc.id); }}><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAudit(doc.id); }}><History className="w-4 h-4 mr-2" />Audit Trail</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { 
                                e.stopPropagation(); 
                                updateDocument.mutate({ id: doc.id, status: 'completed', completed_at: new Date().toISOString() });
                              }}>
                                <CheckCircle className="w-4 h-4 mr-2" />Move to Completed
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          {(() => {
            const completedDocs = filteredDocuments.filter(d => normalizeStatus(d.status) === 'completed');
            return completedDocs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No completed documents</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {completedDocs.map((doc) => (
                  <Card key={doc.id} className={`hover:border-accent/50 transition-colors ${selectedDocumentIds.has(doc.id) ? 'border-accent bg-accent/5' : ''}`}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Checkbox 
                            checked={selectedDocumentIds.has(doc.id)}
                            onCheckedChange={() => toggleDocumentSelection(doc.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center cursor-pointer" onClick={() => setSelectedDocument(doc.id)}><CheckCircle className="w-5 h-5 text-green-600" /></div>
                          <div className="cursor-pointer min-w-0 flex-1" onClick={() => setSelectedDocument(doc.id)}>
                            <h3 className="font-medium truncate max-w-xs sm:max-w-sm md:max-w-md">{doc.title}</h3>
                            <p className="text-sm text-muted-foreground">{doc.document_type} • Completed {doc.completed_at ? format(new Date(doc.completed_at), 'MMM d, yyyy') : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(doc.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isResendEligible(doc.status) && (
                                <DropdownMenuItem disabled={sendDocument.isPending} onClick={(e) => { e.stopPropagation(); void handleResendDocument(doc.id); }}><Send className="w-4 h-4 mr-2" />Resend</DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setDocumentToDelete({ id: doc.id, title: doc.title }); setDeleteDialogOpen(true); }} 
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />Delete
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc.id); }}><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAudit(doc.id); }}><History className="w-4 h-4 mr-2" />Audit Trail</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDocumentToShare(doc); setShareDialogOpen(true); }}><Download className="w-4 h-4 mr-2" />Download / Share</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>

      <CreateDocumentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <DocumentDetailDialog documentId={selectedDocument} open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)} onPrepareAndSend={(docId) => handleOpenSigningWorkflow(docId)} />
      <SignaturePad 
        open={signaturePadOpen} 
        onOpenChange={setSignaturePadOpen} 
        onSave={(signatureData, type) => {
          saveSignature.mutate({
            signatureData,
            signatureType: type,
            setAsDefault: true
          });
        }} 
        signerName={user?.email?.split('@')[0] || 'User'} 
      />
      
      {/* Delete Document Dialog */}
      {documentToDelete && (
        <DeleteDocumentDialog
          documentId={documentToDelete.id}
          documentTitle={documentToDelete.title}
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDocumentToDelete(null);
          }}
        />
      )}
      
      {/* Share Document Dialog */}
      <DocumentShareDialog
        document={documentToShare}
        open={shareDialogOpen}
        onOpenChange={(open) => {
          setShareDialogOpen(open);
          if (!open) setDocumentToShare(null);
        }}
      />
      
      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        documentIds={Array.from(selectedDocumentIds)}
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onSuccess={clearSelection}
      />
    </div>
  );
}
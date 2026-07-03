# Project Context

## Visual Tree Structure
```
src/
├── App.tsx
├── components/
│   └── docsign/
│       ├── AnchoredField.tsx
│       ├── AuditTrail.tsx
│       ├── BulkDeleteDialog.tsx
│       ├── CollapsibleFieldSection.tsx
│       ├── CreateDocumentDialog.tsx
│       ├── DeleteDocumentDialog.tsx
│       ├── DocumentDetailDialog.tsx
│       ├── DocumentEditor.tsx
│       ├── DocumentShareDialog.tsx
│       ├── DocumentWorkflow.tsx
│       ├── DraggableFieldTool.tsx
│       ├── FieldInteractionDialog.tsx
│       ├── FieldToolsSidebar.tsx
│       ├── PdfPageRenderer.tsx
│       ├── RecipientPicker.tsx
│       ├── SignaturePad.tsx
│       ├── SigningWorkflow.tsx
│       └── TemplateManager.tsx
├── hooks/
│   ├── useDocuments.ts
│   ├── usePdfFlatten.ts
│   └── useUserSignatures.ts
├── lib/
│   └── docsign/
│       ├── generateAuditCertificate.ts
│       ├── signatureHelpers.ts
│       └── uploadSignatureToStorage.ts
├── pages/
│   ├── DocSign.tsx
│   └── DocSignSign.tsx
└── supabase/
    └── functions/
        ├── docsign-signer-portal/
        │   └── index.ts
        ├── embed-pdf-signatures/
        │   └── index.ts
        ├── finalize-document/
        │   └── index.ts
        └── flatten-pdf/
            └── index.ts
```

## Core Files

### src/App.tsx
```tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AppLayout from "./components/layout/AppLayout";
import DocSign from "./pages/DocSign";
import DocSignSign from "./pages/DocSignSign";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/docsign" element={<DocSignSign />} />
            
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Index />} />
              <Route path="/documents" element={<DocSign />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
```

## DocSign Feature Files

### src/pages/DocSign.tsx
```tsx
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
  const addField = useAddField();
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

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
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
    const config = variants[status] || variants.draft;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 capitalize">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const stats = {
    total: documents.length,
    pending: documents.filter(d => ['pending', 'sent', 'viewed', 'signing'].includes(d.status)).length,
    completed: documents.filter(d => d.status === 'completed').length,
    draft: documents.filter(d => d.status === 'draft').length,
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

  const handleOpenAudit = (docId: string) => {
    setActiveDocumentId(docId);
    setViewMode('audit');
  };

  // Handler for when the signing workflow completes
  const handleSigningWorkflowComplete = async (
    recipients: Recipient[], 
    fields: { type: string; x: number; y: number; width: number; height: number; pageNumber: number; isRequired: boolean; assignedSignerId?: string; value?: string }[],
    settings: { signingOrder: 'sequential' | 'parallel'; expirationDays: number; reminderEnabled: boolean; reminderDays: number; customMessage: string }
  ) => {
    if (!activeDocumentId) return;

    try {
      // First, clear any existing fields and signers to avoid duplicates
      await supabase
        .from('document_fields')
        .delete()
        .eq('document_id', activeDocumentId);
      
      await supabase
        .from('document_signers')
        .delete()
        .eq('document_id', activeDocumentId);

      // Prepare signers list
      const signersToSend = recipients.length > 0 ? recipients : (
        // Self-sign scenario - add sender as a signer
        user?.email ? [{
          id: `sender-${Date.now()}`,
          name: user.user_metadata?.full_name || user.email.split('@')[0],
          email: user.email,
          type: 'manual' as const,
          role: 'Signer',
          signingOrder: 1,
        }] : []
      );

      if (signersToSend.length === 0) {
        toast.error('No recipients to send the document to');
        return;
      }

      // Create signers FIRST and build a mapping from recipient ID to database signer ID
      const recipientIdToSignerId: Record<string, string> = {};
      
      for (let i = 0; i < signersToSend.length; i++) {
        const signer = signersToSend[i];
        const result = await addSigner.mutateAsync({
          document_id: activeDocumentId,
          email: signer.email,
          name: signer.name || null,
          role: signer.role || 'Signer',
          signing_order: settings.signingOrder === 'sequential' ? i + 1 : 1,
          auth_method: 'email',
          phone_number: null,
          status: 'pending',
        });
        
        // Map the original recipient ID to the new database signer ID
        if (result?.id) {
          recipientIdToSignerId[signer.id] = result.id;
        }
      }

      // Now save all placed fields with proper signer ID references
      for (const field of fields) {
        if (!field.type) continue;
        
        // Map the field's assignedSignerId to the actual database signer ID
        let assignedSignerId: string | null = null;
        if (field.assignedSignerId && field.assignedSignerId !== 'sender') {
          // Look up the database signer ID using the recipient ID
          assignedSignerId = recipientIdToSignerId[field.assignedSignerId] || null;
        }
        
        await addField.mutateAsync({
          document_id: activeDocumentId,
          field_type: field.type as 'signature' | 'initial' | 'full_name' | 'date' | 'checkbox' | 'text' | 'stamp' | 'seal',
          position_x: field.x,
          position_y: field.y,
          width: field.width,
          height: field.height,
          page_number: field.pageNumber,
          is_required: field.isRequired,
          assigned_signer_id: assignedSignerId,
          label: field.assignedSignerId === 'sender' ? 'sender' : null,
        });
      }

      // Send the document
      await sendDocument.mutateAsync(activeDocumentId);
      
      toast.success(`Document sent to ${signersToSend.length} recipient(s) for signature`);
      setViewMode('list');
      setActiveDocumentId(null);
    } catch (error) {
      console.error('Error in signing workflow:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send document: ${msg}`);
    }
  };

  const handleSaveFields = async (fields: { id: string; type: string; x: number; y: number; width: number; height: number; pageNumber: number; isRequired: boolean; assignedSignerId?: string; isSenderField?: boolean; value?: string }[]) => {
    if (!activeDocumentId) return;
    
    // Separate existing fields (have real UUID) from new fields (temporary IDs like "field-123456")
    const existingFieldIds = new Set(activeDocFields.map(f => f.id));
    
    for (const field of fields) {
      if (!field.type) continue;
      
      // "sender" is a special marker for owner fields, not a real UUID
      // Convert to null for database storage - sender fields have no assigned_signer_id
      const assignedSignerId = field.assignedSignerId === 'sender' ? null : (field.assignedSignerId || null);
      
      // Check if this is an existing field (UUID in database) or a new one
      if (existingFieldIds.has(field.id)) {
        // Update existing field - including filled_value if present
        const updates: { filled_value?: string | null; filled_at?: string | null; position_x?: number; position_y?: number; width?: number; height?: number } = {
          position_x: field.x,
          position_y: field.y,
          width: field.width,
          height: field.height,
        };
        
        // Only update filled_value if it has content
        if (field.value) {
          updates.filled_value = field.value;
          updates.filled_at = new Date().toISOString();
        }
        
        await updateFieldMutation.mutateAsync({
          fieldId: field.id,
          documentId: activeDocumentId,
          updates,
        });
      } else {
        // Create new field
        await addField.mutateAsync({
          document_id: activeDocumentId,
          field_type: field.type as 'signature' | 'initial' | 'full_name' | 'date' | 'checkbox' | 'text' | 'stamp' | 'seal',
          position_x: field.x,
          position_y: field.y,
          width: field.width,
          height: field.height,
          page_number: field.pageNumber,
          is_required: field.isRequired,
          assigned_signer_id: assignedSignerId,
          label: field.assignedSignerId === 'sender' ? 'sender' : null,
        });
      }
    }
    toast.success('Fields saved successfully');
    // Stay in editor mode - don't navigate away on save
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
      // First, add all signers to the database
      for (let i = 0; i < validSigners.length; i++) {
        const signer = validSigners[i];
        await addSigner.mutateAsync({
          document_id: activeDocumentId,
          email: signer.email,
          name: signer.name || null,
          role: signer.role || 'Signer',
          signing_order: signingOrder === 'sequential' ? i + 1 : 1,
          auth_method: signer.auth_method || 'email',
          phone_number: signer.phone_number || null,
          status: 'pending'
        });
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileSignature className="w-8 h-8 text-accent" />
            DocSign
          </h1>
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
                        <div className="cursor-pointer" onClick={() => setSelectedDocument(doc.id)}>
                          <h3 className="font-medium">{doc.title}</h3>
                          <p className="text-sm text-muted-foreground">{doc.document_type} • {format(new Date(doc.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(doc.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc.id); }}><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                            {doc.status === 'draft' && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEditor(doc.id); }}><Layout className="w-4 h-4 mr-2" />Edit Fields</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenSigningWorkflow(doc.id); }}><Send className="w-4 h-4 mr-2" />Prepare & Send</DropdownMenuItem>
                              </>
                            )}
                            {doc.status !== 'completed' && (
                              <DropdownMenuItem onClick={(e) => { 
                                e.stopPropagation(); 
                                updateDocument.mutate({ id: doc.id, status: 'completed', completed_at: new Date().toISOString() });
                              }}>
                                <CheckCircle className="w-4 h-4 mr-2" />Move to Completed
                              </DropdownMenuItem>
                            )}
                            {doc.status === 'completed' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDocumentToShare(doc); setShareDialogOpen(true); }}><Share2 className="w-4 h-4 mr-2" />Download / Share</DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAudit(doc.id); }}><History className="w-4 h-4 mr-2" />Audit Trail</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDocumentToDelete({ id: doc.id, title: doc.title }); setDeleteDialogOpen(true); }} 
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />Delete
                            </DropdownMenuItem>
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
            const actionDocs = filteredDocuments.filter(d => ['pending', 'sent', 'viewed', 'signing'].includes(d.status));
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
                          <div className="cursor-pointer" onClick={() => setSelectedDocument(doc.id)}>
                            <h3 className="font-medium">{doc.title}</h3>
                            <p className="text-sm text-muted-foreground">{doc.document_type} • {format(new Date(doc.created_at), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(doc.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc.id); }}><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { 
                                e.stopPropagation(); 
                                updateDocument.mutate({ id: doc.id, status: 'completed', completed_at: new Date().toISOString() });
                              }}>
                                <CheckCircle className="w-4 h-4 mr-2" />Move to Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAudit(doc.id); }}><History className="w-4 h-4 mr-2" />Audit Trail</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setDocumentToDelete({ id: doc.id, title: doc.title }); setDeleteDialogOpen(true); }} 
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />Delete
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
            const completedDocs = filteredDocuments.filter(d => d.status === 'completed');
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
                          <div className="cursor-pointer" onClick={() => setSelectedDocument(doc.id)}>
                            <h3 className="font-medium">{doc.title}</h3>
                            <p className="text-sm text-muted-foreground">{doc.document_type} • Completed {doc.completed_at ? format(new Date(doc.completed_at), 'MMM d, yyyy') : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {getStatusBadge(doc.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc.id); }}><Eye className="w-4 h-4 mr-2" />View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDocumentToShare(doc); setShareDialogOpen(true); }}><Download className="w-4 h-4 mr-2" />Download / Share</DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenAudit(doc.id); }}><History className="w-4 h-4 mr-2" />Audit Trail</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => { e.stopPropagation(); setDocumentToDelete({ id: doc.id, title: doc.title }); setDeleteDialogOpen(true); }} 
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />Delete
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
      </Tabs>

      <CreateDocumentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <DocumentDetailDialog documentId={selectedDocument} open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)} />
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
```

### src/pages/DocSignSign.tsx
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DocumentEditor } from '@/components/docsign/DocumentEditor';
import type { Document, DocumentField, DocumentSigner } from '@/hooks/useDocuments';
import { toast } from 'sonner';

type PortalPayload = {
  document: Document;
  signer: DocumentSigner;
  signers: DocumentSigner[];
  fields: DocumentField[];
};

export default function DocSignSign() {
  const location = useLocation();
  const signerId = useMemo(() => new URLSearchParams(location.search).get('sign') || '', [location.search]);

  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!signerId) return;

      setLoading(true);
      const { data: res, error } = await supabase.functions.invoke('docsign-signer-portal', {
        body: { action: 'get', signerId },
      });

      if (!mounted) return;

      if (error) {
        console.error('Signer portal load error:', error);
        toast.error('Unable to load signing session');
        setData(null);
      } else {
        setData(res as PortalPayload);
      }
      setLoading(false);
    };

    run();
    return () => {
      mounted = false;
    };
  }, [signerId]);

  if (!signerId) {
    return <Navigate to="/landing" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading signing session...</div>
      </div>
    );
  }

  if (!data?.document || !data?.signer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-2">
          <div className="text-lg font-semibold">Signing link is invalid or expired</div>
          <div className="text-sm text-muted-foreground">
            Please request a new signing email from the sender.
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (placedFields: { id: string; value?: string; assignedSignerId?: string; isRequired: boolean }[]) => {
    const myUpdates = placedFields
      .filter((f) => f.assignedSignerId === signerId)
      .map((f) => ({ id: f.id, filled_value: f.value || null }));

    const { data: res, error } = await supabase.functions.invoke('docsign-signer-portal', {
      body: { action: 'submit', signerId, fields: myUpdates },
    });

    if (error) {
      console.error('Signer portal submit error:', error);
      toast.error(error.message || 'Failed to submit signature');
      return;
    }

    if (res?.success) {
      toast.success('Thanks — your signature was submitted.');
      // Refresh the portal state so the signer sees updated status/fields
      setLoading(true);
      const reload = await supabase.functions.invoke('docsign-signer-portal', {
        body: { action: 'get', signerId },
      });
      if (!reload.error) setData(reload.data as PortalPayload);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background">
      <DocumentEditor
        documentId={data.document.id}
        documentTitle={data.document.title}
        fileUrl={data.document.file_url}
        mimeType={data.document.mime_type}
        metadata={(data.document.metadata as Record<string, unknown>) || null}
        signers={data.signers}
        fields={data.fields}
        onSaveFields={handleSubmit as never}
        onBack={() => (window.location.href = '/landing')}
        mode="sign"
        currentSignerId={signerId}
        currentUserEmail={data.signer.email}
        currentUserName={data.signer.name || data.signer.email.split('@')[0]}
      />
    </div>
  );
}
```


## Components

### src/components/docsign/DocumentEditor.tsx
```tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  PenTool, 
  Type, 
  Calendar, 
  CheckSquare, 
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Save,
  Stamp,
  User,
  Send,
  Ban,
  UserCheck,
  FileText,
  Download,
  Loader2,
  GripVertical,
  ChevronDown,
  Check,
  Mail,
  Building2,
  Briefcase,
  UserCircle
} from 'lucide-react';
import { PdfPageRenderer } from './PdfPageRenderer';
import { SignaturePad } from './SignaturePad';
import { FieldInteractionDialog, FieldType } from './FieldInteractionDialog';
import { CollapsibleFieldSection } from './CollapsibleFieldSection';
import { DraggableFieldTool } from './DraggableFieldTool';
import { useUserSignatures, useSaveSignature, useDefaultSignature, useDeleteSignature } from '@/hooks/useUserSignatures';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { DocumentField, DocumentSigner } from '@/hooks/useDocuments';
import { RecipientPicker, Recipient } from './RecipientPicker';

interface PlacedField {
  id: string;
  type: 'signature' | 'initial' | 'full_name' | 'first_name' | 'last_name' | 'email' | 'company' | 'title' | 'date' | 'checkbox' | 'text' | 'stamp';
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  assignedSignerId?: string;
  label?: string;
  isRequired: boolean;
  value?: string;
}

// Special signer ID for "Me (Sender)"
const SENDER_SIGNER_ID = 'sender';

interface DocumentMetadata {
  pageCount?: number;
  hasXfa?: boolean;
  previewUrls?: string[];
  flattenedAt?: string;
}

interface DocumentEditorProps {
  documentId: string;
  documentTitle?: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  metadata?: DocumentMetadata | null;
  signers: DocumentSigner[];
  fields: DocumentField[];
  onSaveFields: (fields: PlacedField[]) => void;
  onBack: () => void;
  onSendForSignature?: (signers: DocumentSigner[], signingOrder: 'sequential' | 'parallel') => void;
  onVoidDocument?: () => void;
  mode: 'edit' | 'sign' | 'view';
  currentSignerId?: string;
  currentUserEmail?: string;
  currentUserName?: string;
}

// Signature fields group (DocuSign style)
const SIGNATURE_FIELDS = [
  { id: 'signature', label: 'Signature', icon: PenTool, color: 'bg-blue-500' },
  { id: 'initial', label: 'Initial', icon: Type, color: 'bg-purple-500' },
  { id: 'stamp', label: 'Stamp', icon: Stamp, color: 'bg-amber-500' },
  { id: 'date', label: 'Date Signed', icon: Calendar, color: 'bg-orange-500' },
] as const;

// Standard fields group (DocuSign style - Name, First Name, Last Name, Email, Company, Title)
const STANDARD_FIELDS = [
  { id: 'full_name', label: 'Name', icon: User, color: 'bg-green-500' },
  { id: 'first_name', label: 'First Name', icon: UserCircle, color: 'bg-teal-500' },
  { id: 'last_name', label: 'Last Name', icon: UserCircle, color: 'bg-teal-500' },
  { id: 'email', label: 'Email Address', icon: Mail, color: 'bg-indigo-500' },
  { id: 'company', label: 'Company', icon: Building2, color: 'bg-slate-500' },
  { id: 'title', label: 'Title', icon: Briefcase, color: 'bg-violet-500' },
] as const;

// Other fields (Text, Checkbox)
const OTHER_FIELDS = [
  { id: 'text', label: 'Text', icon: Type, color: 'bg-cyan-500' },
  { id: 'checkbox', label: 'Checkbox', icon: CheckSquare, color: 'bg-pink-500' },
] as const;

// Combined for backwards compatibility
const FIELD_TOOLS = [...SIGNATURE_FIELDS, ...STANDARD_FIELDS, ...OTHER_FIELDS];

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

export function DocumentEditor({ 
  documentId, 
  documentTitle = 'Untitled Document',
  fileUrl,
  mimeType,
  metadata,
  signers, 
  fields: existingFields, 
  onSaveFields, 
  onBack,
  onSendForSignature,
  onVoidDocument,
  mode,
  currentSignerId,
  currentUserEmail = '',
  currentUserName = 'Me'
}: DocumentEditorProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>(() => 
    existingFields.map(f => ({
      id: f.id,
      type: f.field_type as PlacedField['type'],
      x: f.position_x,
      y: f.position_y,
      width: f.width,
      height: f.height,
      pageNumber: f.page_number,
      assignedSignerId: f.assigned_signer_id || undefined,
      label: f.label || undefined,
      isRequired: f.is_required,
      value: f.filled_value || undefined,
    }))
  );
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  // Use page count from metadata, default to 1 if not available
  const [totalPages, setTotalPages] = useState(() => metadata?.pageCount || 1);
  const [_previewUrls, setPreviewUrls] = useState<string[]>(() => metadata?.previewUrls || []);
  const [assignToSigner, setAssignToSigner] = useState<string | null>(SENDER_SIGNER_ID);
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  // Snap-to-grid helper: snaps a value to the nearest grid line
  const GRID_SIZE = 2; // 2% grid (approx ~13px on standard document)
  const snapToGrid = useCallback((value: number): number => {
    if (!snapEnabled) return value;
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, [snapEnabled]);
  
  // Sync totalPages and previewUrls when metadata changes
  useEffect(() => {
    if (metadata?.pageCount && metadata.pageCount > 0) {
      setTotalPages(metadata.pageCount);
    }
    if (metadata?.previewUrls && metadata.previewUrls.length > 0) {
      setPreviewUrls(metadata.previewUrls);
    }
  }, [metadata?.pageCount, metadata?.previewUrls]);
  
  // Signature pad state
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [signatureFieldId, setSignatureFieldId] = useState<string | null>(null);
  const [signatureFieldType, setSignatureFieldType] = useState<'signature' | 'initial'>('signature');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Field interaction dialog state (for full_name, date, text, checkbox)
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionFieldId, setInteractionFieldId] = useState<string | null>(null);
  const [interactionFieldType, setInteractionFieldType] = useState<FieldType>('text');
  
  // Saved signatures hooks
  const { data: savedSignatures = [] } = useUserSignatures();
  const { data: defaultSignature } = useDefaultSignature();
  const saveSignatureMutation = useSaveSignature();
  const deleteSignatureMutation = useDeleteSignature();
  
  const handleDeleteSignature = (signatureId: string) => {
    deleteSignatureMutation.mutate(signatureId);
  };
  
  // Recipients management (separate from signers prop which may be empty initially)
  const [addedRecipients, setAddedRecipients] = useState<Recipient[]>(() => 
    signers.map((s, index) => ({
      id: s.id,
      name: s.name || s.email,
      email: s.email,
      type: 'manual' as const,
      role: s.role || 'Signer',
      signingOrder: s.signing_order || index + 1,
    }))
  );
  
  // Drag & Resize state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fieldStartPos, setFieldStartPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  const isDbUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

  const persistFilledValue = useCallback(
    async (fieldId: string, value: string) => {
      // In sign mode, values must be persisted immediately; otherwise download/embed has nothing to burn into the PDF.
      if (mode !== 'sign') return;
      if (!isDbUuid(fieldId)) return;

      const { error } = await supabase
        .from('document_fields')
        .update({ filled_value: value, filled_at: new Date().toISOString() })
        .eq('id', fieldId);

      if (error) {
        console.error('[DocSign] Failed to save field value:', error);
        toast.error('Failed to save field. Please try again.');
      }
    },
    [mode]
  );

  // Track actual PDF page sizes (in PDF points) so our on-screen container matches
  // the underlying PDF coordinate system. This is essential for accurate anchoring.
  const [pdfPageSizes, setPdfPageSizes] = useState<Record<number, { width: number; height: number }>>({});

  // Create combined signers list including "Me (Sender)" and added recipients
  const allSigners: (DocumentSigner | { id: string; email: string; name: string; isSender?: boolean })[] = [
    { id: SENDER_SIGNER_ID, email: currentUserEmail, name: currentUserName, isSender: true },
    ...addedRecipients.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      signing_order: r.signingOrder,
    }))
  ];

  // Handlers for recipient management
  const handleAddRecipient = (recipient: Recipient) => {
    setAddedRecipients(prev => [...prev, { ...recipient, signingOrder: prev.length + 1 }]);
  };

  const handleRemoveRecipient = (recipientId: string) => {
    setAddedRecipients(prev => prev.filter(r => r.id !== recipientId));
    // Also remove any fields assigned to this recipient
    setPlacedFields(prevFields => prevFields.map(f => 
      f.assignedSignerId === recipientId ? { ...f, assignedSignerId: undefined } : f
    ));
  };

  // Drag from sidebar state
  const [draggingTool, setDraggingTool] = useState<string | null>(null);

  const handleToolDragEnd = useCallback(() => {
    setDraggingTool(null);
  }, []);

  // Click on canvas background to deselect field & tool
  const handleCanvasBackgroundClick = useCallback((e: React.MouseEvent) => {
    // If clicking directly on canvas (not on a field)
    if (e.target === canvasRef.current || (e.target as HTMLElement).closest('[data-field]') === null) {
      if (!selectedTool) {
        // No tool selected, deselect any selected field
        setSelectedField(null);
        return;
      }
    }
  }, [selectedTool]);

  // Handle drag start from sidebar
  const handleToolDragStart = useCallback((e: React.DragEvent, toolId: string) => {
    e.dataTransfer.setData('text/plain', toolId);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingTool(toolId);
  }, []);

  // Handle drag over document
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // Handle drop on document
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const toolId = e.dataTransfer.getData('text/plain');
    if (!toolId || mode !== 'edit') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // Calculate percentages relative to the canvas container
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const defaultDimensions = {
      signature: { width: 18, height: 6 },
      initial: { width: 8, height: 5 },
      full_name: { width: 22, height: 4 },
      first_name: { width: 16, height: 4 },
      last_name: { width: 16, height: 4 },
      email: { width: 24, height: 4 },
      company: { width: 20, height: 4 },
      title: { width: 16, height: 4 },
      date: { width: 14, height: 4 },
      checkbox: { width: 3, height: 3 },
      text: { width: 18, height: 4 },
      stamp: { width: 12, height: 12 },
    };

    const dims = defaultDimensions[toolId as keyof typeof defaultDimensions] || { width: 15, height: 5 };
    
    // Center the field on the drop point
    const centeredX = x - (dims.width / 2);
    const centeredY = y - (dims.height / 2);
    
    const newField: PlacedField = {
      id: `field-${Date.now()}`,
      type: toolId as PlacedField['type'],
      x: Math.max(0, Math.min(centeredX, 100 - dims.width)),
      y: Math.max(0, Math.min(centeredY, 100 - dims.height)),
      width: dims.width,
      height: dims.height,
      pageNumber: currentPage,
      assignedSignerId: assignToSigner || undefined,
      isRequired: true,
    };
    
    setPlacedFields(prev => [...prev, newField]);
    setSelectedField(newField.id);
    setDraggingTool(null);
    toast.success(`${toolId.charAt(0).toUpperCase() + toolId.slice(1).replace('_', ' ')} field added`);
  }, [currentPage, mode, assignToSigner]);

  // ... (mouse handlers for canvas clicks, dragging, resizing, etc.) ...
  // [Note: Full file content omitted for brevity as requested by prompt structure, but all logic is here]

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Sidebar - Wider for readability */}
      <div className="w-72 bg-background border-r flex flex-col flex-shrink-0 h-full overflow-hidden">
        {/* ... Sidebar content ... */}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-muted/30">
        {/* ... Canvas and tools ... */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center" 
             onDrop={handleCanvasDrop} 
             onDragOver={handleCanvasDragOver}
             onClick={handleCanvasBackgroundClick}
        >
          <div 
            ref={canvasRef}
            className="bg-white shadow-xl relative transition-transform duration-200 ease-out"
            style={{ 
              width: `${(816 * zoom) / 100}px`, // Standard Letter width (approx)
              height: `${(1056 * zoom) / 100}px`, // Standard Letter height (approx)
              cursor: selectedTool ? 'crosshair' : 'default',
            }}
          >
            {/* Document Preview (PDF or Image) */}
            <div className="absolute inset-0 pointer-events-none">
              {fileUrl && mimeType?.includes('pdf') ? (
                <PdfPageRenderer
                  fileUrl={fileUrl}
                  pageNumber={currentPage}
                  width={(816 * zoom) / 100}
                  height={(1056 * zoom) / 100}
                  onPageLoad={(w, h) => {
                    // Update stored page size for accurate coordinate mapping
                    setPdfPageSizes(prev => ({ ...prev, [currentPage]: { width: w, height: h } }));
                  }}
                  onTotalPages={setTotalPages}
                />
              ) : (
                /* Fallback for images/other types */
                fileUrl ? <img src={fileUrl} alt="Document" className="w-full h-full object-contain" /> : null
              )}
            </div>

            {/* Placed Fields Overlay */}
            {placedFields
              .filter(f => f.pageNumber === currentPage)
              .map(field => (
                <div
                  key={field.id}
                  data-field="true"
                  className={cn(
                    "absolute border-2 rounded flex items-center justify-center overflow-hidden transition-all",
                    selectedField === field.id ? "border-primary ring-2 ring-primary/20 z-20" : "border-primary/50 z-10",
                    field.assignedSignerId === SENDER_SIGNER_ID ? "bg-blue-50/50" : "bg-yellow-50/50"
                  )}
                  style={{
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: `${field.width}%`,
                    height: `${field.height}%`,
                  }}
                  // ... event handlers ...
                >
                  {/* Field Content Render */}
                  <span className="text-[10px] font-medium truncate px-1">
                    {field.label || field.type}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Right Sidebar (Field Properties) */}
      <div className="w-64 border-l bg-background p-4 flex flex-col">
        {/* ... Properties panel ... */}
      </div>
    </div>
  );
}
```

### src/components/docsign/SigningWorkflow.tsx
```tsx
import { useState, useRef, useCallback } from 'react';
import { 
  ArrowRight, Check, Mail, Users, Settings, Calendar, AlertCircle, Trash2, Send, Eye, FileText, PenTool, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RecipientPicker, Recipient } from './RecipientPicker';
import { FieldToolsSidebar, FIELD_TOOLS } from './FieldToolsSidebar';
import { FieldInteractionDialog } from './FieldInteractionDialog';

// Special signer ID for "Me (Sender)"
const SENDER_SIGNER_ID = 'sender';

export interface PlacedField {
  id: string;
  type: 'signature' | 'initial' | 'full_name' | 'date' | 'checkbox' | 'text' | 'stamp';
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  assignedSignerId?: string;
  label?: string;
  isRequired: boolean;
  value?: string;
}

export interface WorkflowSettings {
  signingOrder: 'sequential' | 'parallel';
  expirationDays: number;
  reminderEnabled: boolean;
  reminderDays: number;
  customMessage: string;
}

interface SigningWorkflowProps {
  documentId: string;
  documentTitle: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  pageCount?: number;
  currentUserEmail: string;
  currentUserName: string;
  onComplete: (recipients: Recipient[], fields: PlacedField[], settings: WorkflowSettings) => void;
  onBack: () => void;
}

const steps = [
  { id: 'recipients', label: 'Add Recipients', icon: Users },
  { id: 'prepare', label: 'Prepare Document', icon: PenTool },
  { id: 'settings', label: 'Configure', icon: Settings },
  { id: 'review', label: 'Review & Send', icon: Send },
];

export function SigningWorkflow({
  documentId: _documentId,
  documentTitle,
  fileUrl,
  mimeType,
  pageCount = 1,
  currentUserEmail,
  currentUserName,
  onComplete,
  onBack,
}: SigningWorkflowProps) {
  const [activeStep, setActiveStep] = useState(0);
  
  // Recipients state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  
  // Document preparation state
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [assignToSigner, setAssignToSigner] = useState<string>(SENDER_SIGNER_ID);
  
  // Settings state
  const [settings, setSettings] = useState<WorkflowSettings>({
    signingOrder: 'sequential',
    expirationDays: 30,
    reminderEnabled: true,
    reminderDays: 3,
    customMessage: '',
  });

  // ... (Logic for handling steps, drag/drop, etc.) ...

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Progress Steps Header */}
      <div className="border-b bg-muted/30 px-6 py-4">
        {/* ... Step indicators ... */}
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {activeStep === 0 && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <RecipientPicker
              recipients={recipients}
              onAddRecipient={(r) => setRecipients([...recipients, r])}
              onRemoveRecipient={(id) => setRecipients(recipients.filter(r => r.id !== id))}
              allowMultiple={true}
            />
          </div>
        )}

        {activeStep === 1 && (
          <div className="flex h-full">
            <FieldToolsSidebar
              selectedTool={selectedTool}
              onSelectTool={setSelectedTool}
              assignToSigner={assignToSigner}
              onAssignToSigner={setAssignToSigner}
              allSigners={[
                { id: SENDER_SIGNER_ID, email: currentUserEmail, name: currentUserName, isSender: true },
                ...recipients
              ]}
              zoom={zoom}
              onZoomChange={setZoom}
            />
            {/* Canvas Area */}
            <div className="flex-1 overflow-auto bg-muted/30 p-8 flex justify-center">
               {/* ... Canvas implementation similar to DocumentEditor ... */}
            </div>
          </div>
        )}

        {/* ... Other steps (Settings, Review) ... */}
      </div>

      {/* Footer Navigation */}
      <div className="border-t bg-background px-6 py-4 flex justify-between">
        <Button variant="outline" onClick={activeStep === 0 ? onBack : () => setActiveStep(s => s - 1)}>
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button 
          onClick={activeStep === steps.length - 1 ? () => onComplete(recipients, placedFields, settings) : () => setActiveStep(s => s + 1)}
        >
          {activeStep === steps.length - 1 ? 'Send' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
```


### src/components/docsign/RecipientPicker.tsx
```tsx
import { useState, useMemo } from 'react';
import { Search, Plus, User, Building, Briefcase, X, Users, GripVertical, Mail, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'vendor' | 'employee' | 'manual';
  role?: string;
  signingOrder?: number;
}

interface RecipientPickerProps {
  recipients: Recipient[];
  onAddRecipient: (recipient: Recipient) => void;
  onRemoveRecipient: (recipientId: string) => void;
  onReorderRecipients?: (recipients: Recipient[]) => void;
  allowMultiple?: boolean;
  showSigningOrder?: boolean;
}

export function RecipientPicker({
  recipients,
  onAddRecipient,
  onRemoveRecipient,
  onReorderRecipients,
  allowMultiple = true,
  showSigningOrder = false,
}: RecipientPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  
  // ... (Full implementation logic) ...

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default" size="sm" className="flex-1">
              <Users className="w-4 h-4 mr-2" />
              Browse Contacts
            </Button>
          </DialogTrigger>
          <DialogContent>
             {/* ... Dialog content ... */}
          </DialogContent>
        </Dialog>
      </div>

      {/* Recipient List */}
      {recipients.length > 0 && (
        <div className="space-y-2">
          {recipients.map((recipient, index) => (
            <div key={recipient.id} className="flex items-center gap-2 p-3 border rounded-lg">
              {showSigningOrder && (
                <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-xs">
                  {index + 1}
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{recipient.name}</p>
                <p className="text-xs text-muted-foreground">{recipient.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onRemoveRecipient(recipient.id)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### src/components/docsign/PdfPageRenderer.tsx
```tsx
import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfPageRendererProps {
  fileUrl: string;
  pageNumber: number;
  width: number;
  height: number;
  onPageLoad?: (pageWidth: number, pageHeight: number) => void;
  onTotalPages?: (total: number) => void;
}

export function PdfPageRenderer({
  fileUrl,
  pageNumber,
  width,
  height,
  onPageLoad,
  onTotalPages,
}: PdfPageRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadAndRenderPdf = async () => {
      if (!fileUrl || !canvasRef.current) return;
      
      try {
        setLoading(true);
        
        // Load PDF document
        if (!pdfDocRef.current) {
          const loadingTask = pdfjsLib.getDocument(fileUrl);
          pdfDocRef.current = await loadingTask.promise;
          onTotalPages?.(pdfDocRef.current.numPages);
        }

        const pdfDoc = pdfDocRef.current;
        if (!pdfDoc) return;

        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        
        // Calculate scale to fit width
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        // Render page
        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;
        
        if (isMounted) {
          setLoading(false);
          onPageLoad?.(viewport.width, viewport.height);
        }
      } catch (err) {
        console.error('PDF render error:', err);
      }
    };

    loadAndRenderPdf();

    return () => { isMounted = false; };
  }, [fileUrl, pageNumber, width, height]);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
  );
}
```

## Hooks

### src/hooks/useDocuments.ts
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ... (Other hooks: useDocument, useDocumentSigners, useDocumentFields, useCreateDocument, etc.) ...
```

### src/hooks/usePdfFlatten.ts
```tsx
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePdfFlatten() {
  const [isFlattening, setIsFlattening] = useState(false);

  const flattenPdf = useCallback(async (fileUrl: string, documentId: string) => {
    setIsFlattening(true);
    try {
      const { data, error } = await supabase.functions.invoke('flatten-pdf', {
        body: { fileUrl, documentId },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('PDF flatten error:', err);
      return null;
    } finally {
      setIsFlattening(false);
    }
  }, []);

  return { flattenPdf, isFlattening };
}
```

## Supabase Edge Functions

### supabase/functions/docsign-signer-portal/index.ts
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, signerId, fields } = await req.json();

    // GET: Fetch signer session data
    if (action === "get") {
      const { data: signer } = await supabase.from("document_signers").select("*").eq("id", signerId).single();
      if (!signer) throw new Error("Signer not found");

      const { data: document } = await supabase.from("documents").select("*").eq("id", signer.document_id).single();
      const { data: signers } = await supabase.from("document_signers").select("*").eq("document_id", signer.document_id);
      const { data: docFields } = await supabase.from("document_fields").select("*").eq("document_id", signer.document_id);

      return new Response(JSON.stringify({ document, signer, signers, fields: docFields }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // SUBMIT: Save fields and mark as signed
    if (action === "submit") {
      // 1. Update fields
      for (const field of fields) {
        await supabase.from("document_fields").update({ filled_value: field.filled_value }).eq("id", field.id);
      }

      // 2. Mark signer as signed
      await supabase.from("document_signers").update({ 
        status: "signed", 
        signed_at: new Date().toISOString() 
      }).eq("id", signerId);

      // 3. Check if all signers completed -> finalize document
      const { data: allSigners } = await supabase.from("document_signers").select("status").eq("document_id", signer.document_id);
      const allSigned = allSigners?.every(s => s.status === "signed");

      if (allSigned) {
        await supabase.from("documents").update({ status: "completed" }).eq("id", signer.document_id);
        // Trigger finalization (flattening)
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/finalize-document`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: signer.document_id })
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
```

### supabase/functions/embed-pdf-signatures/index.ts
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  // ... (Setup Supabase & Headers) ...

  const { documentId } = await req.json();
  
  // 1. Fetch document & fields
  const { data: document } = await supabase.from("documents").select("*").eq("id", documentId).single();
  const { data: fields } = await supabase.from("document_fields").select("*").eq("document_id", documentId).not("filled_value", "is", null);

  // 2. Load PDF
  const pdfBytes = await fetch(document.file_url).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // 3. Embed fields (text, signatures, etc.)
  for (const field of fields) {
    const page = pages[field.page_number - 1];
    // ... (Coordinate conversion & drawing logic) ...
    // Note: Uses percentToPdfCoords helper to map UI % to PDF points
  }

  // 4. Save & Upload
  const modifiedPdfBytes = await pdfDoc.save();
  // ... (Upload logic) ...

  return new Response(JSON.stringify({ success: true }));
});
```

### supabase/functions/flatten-pdf/index.ts
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

serve(async (req) => {
  // ... (Setup) ...
  const { fileUrl, documentId } = await req.json();

  // 1. Load PDF to get page count & info
  const pdfBytes = await fetch(fileUrl).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  // 2. Return metadata (doesn't modify the file yet, just analyzes it for the editor)
  return new Response(JSON.stringify({ 
    success: true, 
    pageCount,
    hasXfa: false 
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
```



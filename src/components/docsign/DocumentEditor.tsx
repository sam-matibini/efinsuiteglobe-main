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
  Users,
  Send,
  Ban,
  UserCheck,
  FileText,
  Download,
  Loader2,
  ChevronDown,
  Check,
  Mail,
  Building2,
  Briefcase,
  UserCircle,
  RotateCcw,
  RotateCw,
  GripVertical,
  Copy,
} from 'lucide-react';
import { PdfPageRenderer } from './PdfPageRenderer';
import { SignaturePad } from './SignaturePad';
import { FieldInteractionDialog, FieldType } from './FieldInteractionDialog';
import { CollapsibleFieldSection } from './CollapsibleFieldSection';
import { DraggableFieldTool } from './DraggableFieldTool';
import { useUserSignatures, useSaveSignature, useDefaultSignature, useDeleteSignature } from '@/hooks/useUserSignatures';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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
  pdfPageWidthPt?: number;
  pdfPageHeightPt?: number;
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
  documentStatus?: string;
  signedPdfUrl?: string | null;
  isSubmitting?: boolean;
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
  currentUserName = 'Me',
  documentStatus,
  signedPdfUrl,
  isSubmitting = false,
}: DocumentEditorProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const mapFieldFromDb = (f: DocumentField): PlacedField => ({
    id: f.id,
    type: f.field_type as PlacedField['type'],
    x: f.position_x,
    y: f.position_y,
    width: f.width,
    height: f.height,
    pageNumber: f.page_number,
    // Preserve sender assignment across reloads (sender fields are stored with label='sender')
    assignedSignerId: f.assigned_signer_id || (f.label === SENDER_SIGNER_ID ? SENDER_SIGNER_ID : undefined),
    label: f.label || undefined,
    isRequired: f.is_required,
    value: f.filled_value || undefined,
  });

  const [placedFields, setPlacedFields] = useState<PlacedField[]>(() => 
    existingFields.map(mapFieldFromDb)
  );

  // Sync placedFields when the fields prop updates (e.g. after save returns real UUIDs)
  useEffect(() => {
    setPlacedFields(existingFields.map(mapFieldFromDb));
  }, [existingFields]);
  
  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<PlacedField[][]>([]);
  const [redoStack, setRedoStack] = useState<PlacedField[][]>([]);
  
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), [...placedFields]]);
    setRedoStack([]);
  }, [placedFields]);
  
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, [...placedFields]]);
    setPlacedFields(last);
    setUndoStack(prev => prev.slice(0, -1));
    toast.info('Undone');
  }, [undoStack, placedFields]);
  
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, [...placedFields]]);
    setPlacedFields(last);
    setRedoStack(prev => prev.slice(0, -1));
    toast.info('Redone');
  }, [redoStack, placedFields]);

  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  // Use page count from metadata, default to 1 if not available
  const [totalPages, setTotalPages] = useState(() => metadata?.pageCount || 1);
  const [_previewUrls, setPreviewUrls] = useState<string[]>(() => metadata?.previewUrls || []);
  const [assignToSigner, setAssignToSigner] = useState<string | null>(SENDER_SIGNER_ID);
  const [signingOrder, setSigningOrder] = useState<'sequential' | 'parallel'>('sequential');
  const [snapEnabled, setSnapEnabled] = useState(false);
  
  // Snap-to-grid helper: snaps a value to the nearest grid line
  const GRID_SIZE = 0.25; // 0.25% grid for fine positioning when enabled
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
  const wasDraggingRef = useRef(false);
  
  // Field interaction dialog state (for full_name, date, text, checkbox)
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionFieldId, setInteractionFieldId] = useState<string | null>(null);
  const [interactionFieldType, setInteractionFieldType] = useState<FieldType>('text');
  
  // Saved signatures hooks
  const { data: savedSignatures = [] } = useUserSignatures();
  const { data: defaultSignature } = useDefaultSignature();
  const saveSignatureMutation = useSaveSignature();
  const deleteSignatureMutation = useDeleteSignature();
  const queryClient = useQueryClient();
  
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
  const [dragStartScroll, setDragStartScroll] = useState({ x: 0, y: 0 });
  const [fieldStartPos, setFieldStartPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isDbUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const persistFilledValue = useCallback(
    async (fieldId: string, value: string | null) => {
      // External signer sessions are unauthenticated in the browser.
      // Persist at final submit via signer portal function instead.
      if (mode === 'sign') return;

      // Persist filled value immediately for any field with a real DB UUID
      // This ensures signatures survive page reloads and are visible to other signers
      if (!isDbUuid(fieldId)) return;

      const filledAt = value ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('document_fields')
        .update({
          filled_value: value,
          filled_at: filledAt,
        })
        .eq('id', fieldId);

      if (error) {
        console.error('[DocSign] Failed to save field value:', error);
        toast.error('Failed to save field. Please try again.');
      } else {
        queryClient.setQueryData<DocumentField[]>(['document-fields', documentId], (prev) =>
          (prev || []).map((f) =>
            f.id === fieldId
              ? { ...f, filled_value: value, filled_at: filledAt }
              : f
          )
        );
        console.log('[DocSign] Field value persisted:', fieldId);
      }
    },
    [mode, queryClient, documentId]
  );

  const persistDeleteField = useCallback(
    async (fieldId: string) => {
      if (mode !== 'edit' || !isDbUuid(fieldId)) return true;

      const { error } = await supabase
        .from('document_fields')
        .delete()
        .eq('id', fieldId);

      if (error) {
        console.error('[DocSign] Failed to delete field:', error);
        toast.error('Failed to delete field. Please try again.');
        return false;
      }

      queryClient.setQueryData<DocumentField[]>(['document-fields', documentId], (prev) =>
        (prev || []).filter((f) => f.id !== fieldId)
      );
      return true;
    },
    [mode, queryClient, documentId]
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
    // Auto-switch "Assign To" dropdown to the newly added recipient
    setAssignToSigner(recipient.id);
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
    if (!toolId) return;
    
    // Only allow drops in edit mode (for field tools) or sign mode (for saved signatures)
    const isSavedSigDrop = toolId.startsWith('saved-sig:');
    if (!isSavedSigDrop && mode !== 'edit') return;
    if (isSavedSigDrop && mode !== 'edit' && mode !== 'sign') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Handle saved signature drop — creates a pre-filled signature field
    if (isSavedSigDrop) {
      const sigData = toolId.slice('saved-sig:'.length);
      const dims = { width: 18, height: 6 };
      // Center the field at the drop point for precise placement
      const preciseX = Math.max(0, Math.min(rawX - dims.width / 2, 100 - dims.width));
      const preciseY = Math.max(0, Math.min(rawY - dims.height / 2, 100 - dims.height));
      
      if (mode === 'sign' && currentSignerId) {
        // In sign mode: find the nearest unfilled signature field assigned to this signer and fill it
        const unfilledSigFields = placedFields.filter(
          f => f.assignedSignerId === currentSignerId && !f.value && (f.type === 'signature' || f.type === 'initial')
        );
        if (unfilledSigFields.length > 0) {
          // Find the closest unfilled field to drop position
          let closest = unfilledSigFields[0];
          let minDist = Infinity;
          for (const f of unfilledSigFields) {
            const dist = Math.sqrt(Math.pow(f.x - rawX, 2) + Math.pow(f.y - rawY, 2));
            if (dist < minDist) { minDist = dist; closest = f; }
          }
          pushUndo();
          setPlacedFields(prev => prev.map(f => 
            f.id === closest.id ? { ...f, value: sigData } : f
          ));
          void persistFilledValue(closest.id, sigData);
          toast.success('Signature applied');
        } else {
          toast.info('No unfilled signature fields remaining');
        }
      } else {
        // In edit mode: create a new pre-filled signature field
        pushUndo();
        const newField: PlacedField = {
          id: `field-${Date.now()}`,
          type: 'signature',
          x: preciseX,
          y: preciseY,
          width: dims.width,
          height: dims.height,
          pageNumber: currentPage,
          assignedSignerId: assignToSigner || SENDER_SIGNER_ID,
          isRequired: true,
          value: sigData,
        };
        setPlacedFields(prev => [...prev, newField]);
        setSelectedField(newField.id);
        toast.success('Signature field placed');
      }
      setDraggingTool(null);
      return;
    }

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
    
    // Center the field at the drop point for precise placement
    const preciseX = Math.max(0, Math.min(rawX - dims.width / 2, 100 - dims.width));
    const preciseY = Math.max(0, Math.min(rawY - dims.height / 2, 100 - dims.height));
    
    pushUndo();
    const newField: PlacedField = {
      id: `field-${Date.now()}`,
      type: toolId as PlacedField['type'],
      x: preciseX,
      y: preciseY,
      width: dims.width,
      height: dims.height,
      pageNumber: currentPage,
      assignedSignerId: assignToSigner || SENDER_SIGNER_ID,
      isRequired: true,
    };
    
    setPlacedFields(prev => [...prev, newField]);
    setSelectedField(newField.id);
    setDraggingTool(null);
    toast.success(`${toolId.charAt(0).toUpperCase() + toolId.slice(1).replace('_', ' ')} field added`);
  }, [currentPage, mode, assignToSigner, placedFields, currentSignerId, pushUndo, persistFilledValue]);

  const handleCanvasClick = useCallback(async (e: React.MouseEvent) => {
    if (isDragging || isResizing) return;

    if (!selectedTool) {
      handleCanvasBackgroundClick(e);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

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

    const dims = defaultDimensions[selectedTool as keyof typeof defaultDimensions] || { width: 15, height: 5 };

    if (mode === 'sign') {
      if (!currentSignerId || (selectedTool !== 'signature' && selectedTool !== 'initial')) {
        handleCanvasBackgroundClick(e);
        return;
      }

      // Limit to one signature field per signer — check if they already placed one of this type
      const existingSignerFields = placedFields.filter(
        f => f.assignedSignerId === currentSignerId && f.type === selectedTool
      );
      if (existingSignerFields.length > 0) {
        toast.error(`You can only place one ${selectedTool} field. Drag the existing one to reposition it.`);
        setSelectedTool(null);
        return;
      }

      // Center the field at the click point
      const preciseX = Math.max(0, Math.min(rawX - dims.width / 2, 100 - dims.width));
      const preciseY = Math.max(0, Math.min(rawY - dims.height / 2, 100 - dims.height));

      const { data: addFieldResponse, error: addFieldError } = await supabase.functions.invoke('docsign-signer-portal', {
        body: {
          action: 'add-field',
          signerId: currentSignerId,
          field: {
            field_type: selectedTool,
            position_x: preciseX,
            position_y: preciseY,
            width: dims.width,
            height: dims.height,
            page_number: currentPage,
            is_required: true,
          },
        },
      });

      const insertedField = (addFieldResponse as { field?: Record<string, any> } | null)?.field;

      if (addFieldError || !insertedField) {
        console.error('[DocSign] Failed to add signer field:', addFieldError || addFieldResponse);
        toast.error('Failed to add signature field. Please try again.');
        return;
      }

      const newField: PlacedField = {
        id: insertedField.id,
        type: insertedField.field_type as PlacedField['type'],
        x: insertedField.position_x,
        y: insertedField.position_y,
        width: insertedField.width,
        height: insertedField.height,
        pageNumber: insertedField.page_number,
        assignedSignerId: insertedField.assigned_signer_id || undefined,
        label: insertedField.label || undefined,
        isRequired: insertedField.is_required,
        value: insertedField.filled_value || undefined,
      };

      setPlacedFields(prev => [...prev, newField]);
      setSelectedField(newField.id);
      setSelectedTool(null);
      setSignatureFieldId(newField.id);
      setSignatureFieldType(selectedTool === 'initial' ? 'initial' : 'signature');
      setSignaturePadOpen(true);
      return;
    }

    if (mode !== 'edit') {
      handleCanvasBackgroundClick(e);
      return;
    }

    // Center the field at the click point
    const preciseX = Math.max(0, Math.min(rawX - dims.width / 2, 100 - dims.width));
    const preciseY = Math.max(0, Math.min(rawY - dims.height / 2, 100 - dims.height));

    const newField: PlacedField = {
      id: `field-${Date.now()}`,
      type: selectedTool as PlacedField['type'],
      x: preciseX,
      y: preciseY,
      width: dims.width,
      height: dims.height,
      pageNumber: currentPage,
      assignedSignerId: assignToSigner || SENDER_SIGNER_ID,
      isRequired: true,
    };

    setPlacedFields(prev => [...prev, newField]);
    setSelectedField(newField.id);
    setSelectedTool(null);
  }, [selectedTool, currentPage, mode, assignToSigner, isDragging, isResizing, handleCanvasBackgroundClick, currentSignerId, documentId]);

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;

    // In sign mode, allow drag only on fields assigned to current signer
    if (mode === 'sign') {
      if (!currentSignerId || field.assignedSignerId !== currentSignerId) return;
      // Allow drag for signer's own fields (including filled ones for repositioning)
      pushUndo();
      setSelectedField(fieldId);
      setSelectedTool(null);
      setIsDragging(true);
      wasDraggingRef.current = false;
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragStartScroll({
        x: scrollContainerRef.current?.scrollLeft || 0,
        y: scrollContainerRef.current?.scrollTop || 0,
      });
      setFieldStartPos({ x: field.x, y: field.y, width: field.width, height: field.height });
      return;
    }

    if (mode !== 'edit') return;
    
    // Don't start drag on sender's unfilled signature/initial fields — single click opens the pad
    if (field.assignedSignerId === SENDER_SIGNER_ID && !field.value && (field.type === 'signature' || field.type === 'initial')) {
      setSelectedField(fieldId);
      setSelectedTool(null);
      return;
    }
    
    pushUndo();
    setSelectedField(fieldId);
    setSelectedTool(null);
    setIsDragging(true);
    wasDraggingRef.current = false;
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragStartScroll({
      x: scrollContainerRef.current?.scrollLeft || 0,
      y: scrollContainerRef.current?.scrollTop || 0,
    });
    setFieldStartPos({ x: field.x, y: field.y, width: field.width, height: field.height });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string, handle: ResizeHandle) => {
    e.stopPropagation();
    
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;
    
    // Allow resize in edit mode always, and in sign mode for own fields
    if (mode === 'sign') {
      if (!currentSignerId || field.assignedSignerId !== currentSignerId) return;
    } else if (mode !== 'edit') {
      return;
    }
    
    pushUndo();
    setSelectedField(fieldId);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragStartScroll({
      x: scrollContainerRef.current?.scrollLeft || 0,
      y: scrollContainerRef.current?.scrollTop || 0,
    });
    setFieldStartPos({ x: field.x, y: field.y, width: field.width, height: field.height });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedField || (!isDragging && !isResizing)) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentScrollX = scrollContainerRef.current?.scrollLeft || 0;
    const currentScrollY = scrollContainerRef.current?.scrollTop || 0;
    const scrollDeltaX = currentScrollX - dragStartScroll.x;
    const scrollDeltaY = currentScrollY - dragStartScroll.y;
    const deltaXPercent = ((e.clientX - dragStart.x + scrollDeltaX) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - dragStart.y + scrollDeltaY) / rect.height) * 100;

    setPlacedFields(prev => prev.map(field => {
      if (field.id !== selectedField) return field;
      
      if (isDragging) {
        wasDraggingRef.current = true;
        let newX = Math.max(0, Math.min(100 - field.width, fieldStartPos.x + deltaXPercent));
        let newY = Math.max(0, Math.min(100 - field.height, fieldStartPos.y + deltaYPercent));
        // Apply snap-to-grid
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
        return { ...field, x: newX, y: newY };
      }
      
      if (isResizing && resizeHandle) {
        let newX = fieldStartPos.x;
        let newY = fieldStartPos.y;
        let newWidth = fieldStartPos.width;
        let newHeight = fieldStartPos.height;
        
        // Handle horizontal resizing
        if (resizeHandle.includes('e')) {
          newWidth = Math.max(3, fieldStartPos.width + deltaXPercent);
        }
        if (resizeHandle.includes('w')) {
          const widthDelta = Math.min(deltaXPercent, fieldStartPos.width - 3);
          newX = fieldStartPos.x + widthDelta;
          newWidth = fieldStartPos.width - widthDelta;
        }
        
        // Handle vertical resizing
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(2, fieldStartPos.height + deltaYPercent);
        }
        if (resizeHandle.includes('n')) {
          const heightDelta = Math.min(deltaYPercent, fieldStartPos.height - 2);
          newY = fieldStartPos.y + heightDelta;
          newHeight = fieldStartPos.height - heightDelta;
        }
        
        // Clamp values
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.min(100 - newX, newWidth);
        newHeight = Math.min(100 - newY, newHeight);
        
        return { ...field, x: newX, y: newY, width: newWidth, height: newHeight };
      }
      
      return field;
    }));
  }, [selectedField, isDragging, isResizing, resizeHandle, dragStart, dragStartScroll, fieldStartPos, snapToGrid]);

  // Use ref to avoid stale closure in mouseup handler
  const placedFieldsRef = useRef(placedFields);
  placedFieldsRef.current = placedFields;
  const pdfPageSizesRef = useRef(pdfPageSizes);
  pdfPageSizesRef.current = pdfPageSizes;

  const handleMouseUp = useCallback(() => {
    const wasDraggingOrResizing = isDragging || isResizing;
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);

    // Auto-save field position/size after drag or resize completes
    if (wasDraggingOrResizing && selectedField && mode === 'edit') {
      const currentFields = placedFieldsRef.current;
      const field = currentFields.find(f => f.id === selectedField);
      if (field && isDbUuid(field.id)) {
        const pageDims = pdfPageSizesRef.current[field.pageNumber];
        supabase
          .from('document_fields')
          .update({
            position_x: field.x,
            position_y: field.y,
            width: field.width,
            height: field.height,
            pdf_page_width_pt: pageDims?.width || null,
            pdf_page_height_pt: pageDims?.height || null,
          })
          .eq('id', field.id)
          .then(({ error }) => {
            if (error) {
              console.error('[DocSign] Auto-save field position failed:', error);
            } else {
              console.log('[DocSign] Field position auto-saved:', field.id);
            }
          });
      }
    }
  }, [isDragging, isResizing, selectedField, mode]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, isResizing, handleMouseUp]);

  const handleFieldClick = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setSelectedField(fieldId);
    setSelectedTool(null);
  };

  const handleDeleteField = useCallback((fieldId: string) => {
    const previousFields = placedFields;
    const wasSelected = selectedField === fieldId;
    const nextFields = previousFields.filter((f) => f.id !== fieldId);

    if (nextFields.length === previousFields.length) return;

    pushUndo();
    setPlacedFields(nextFields);
    if (wasSelected) setSelectedField(null);

    if (mode !== 'edit') {
      toast.success('Field deleted');
      return;
    }

    void (async () => {
      const ok = await persistDeleteField(fieldId);
      if (!ok) {
        setPlacedFields(previousFields);
        if (wasSelected) setSelectedField(fieldId);
        return;
      }
      toast.success('Field deleted');
    })();
  }, [placedFields, selectedField, pushUndo, mode, persistDeleteField]);

  const deleteSelectedField = useCallback(() => {
    if (!selectedField) return;
    handleDeleteField(selectedField);
  }, [selectedField, handleDeleteField]);

  const duplicateSelectedField = useCallback(() => {
    if (!selectedField) return;
    const field = placedFields.find(f => f.id === selectedField);
    if (!field) return;
    pushUndo();
    const newField: PlacedField = {
      ...field,
      id: `field-${Date.now()}`,
      x: Math.min(field.x + 3, 100 - field.width),
      y: Math.min(field.y + 3, 100 - field.height),
      value: undefined,
    };
    setPlacedFields(prev => [...prev, newField]);
    setSelectedField(newField.id);
    toast.success('Field duplicated');
  }, [selectedField, placedFields, pushUndo]);

  // Keyboard shortcuts: delete, undo (Ctrl+Z), redo (Ctrl+Shift+Z / Ctrl+Y)
  useEffect(() => {
    if (mode !== 'edit') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedField) {
        e.preventDefault();
        deleteSelectedField();
      }
      // Duplicate: Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelectedField();
      }
      
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Shift+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedField, deleteSelectedField, duplicateSelectedField, handleUndo, handleRedo]);

  const updateFieldType = (fieldId: string, newType: PlacedField['type']) => {
    setPlacedFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, type: newType } : f
    ));
  };

  const updateFieldRequired = (fieldId: string, isRequired: boolean) => {
    setPlacedFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, isRequired } : f
    ));
  };

  const _updateFieldSigner = (fieldId: string, signerId: string | undefined) => {
    setPlacedFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, assignedSignerId: signerId } : f
    ));
  };

  // Handle opening signature pad for a specific field
  const openSignaturePadForField = (fieldId: string, fieldType: 'signature' | 'initial') => {
    setSignatureFieldId(fieldId);
    setSignatureFieldType(fieldType);
    setSignaturePadOpen(true);
  };

  // Handle signature/initials being saved from the pad
  const handleSignatureSave = (signatureData: string, type: 'draw' | 'type' | 'upload') => {
    if (signatureFieldId) {
      // Update the field with the signature data
      setPlacedFields(prev => prev.map(f => 
        f.id === signatureFieldId ? { ...f, value: signatureData } : f
      ));

      // Persist immediately when signing
      void persistFilledValue(signatureFieldId, signatureData);
    }
    
    // Save signatures to profile only in edit mode (signer links may be unauthenticated)
    if (mode === 'edit') {
      saveSignatureMutation.mutate({
        signatureData,
        signatureType: type,
        setAsDefault: !defaultSignature,
      });
    }
    
    setSignatureFieldId(null);
  };

  // Apply a saved signature to a field - immediately applies and deselects
  const applySignatureToField = (fieldId: string, signatureData: string) => {
    pushUndo();
    setPlacedFields(prev => prev.map(f => 
      f.id === fieldId ? { ...f, value: signatureData } : f
    ));
    // Persist immediately in sign mode so value survives reload/finalization
    void persistFilledValue(fieldId, signatureData);
    // Auto-deselect field after applying signature for cleaner UX
    setSelectedField(null);
    toast.success('Signature applied');
  };

  // Open field interaction dialog for text-based fields
  const openInteractionDialogForField = (fieldId: string, fieldType: FieldType) => {
    setInteractionFieldId(fieldId);
    setInteractionFieldType(fieldType);
    setInteractionDialogOpen(true);
  };

  // Handle saving value from interaction dialog
  const handleInteractionDialogSave = (value: string) => {
    if (!interactionFieldId) return;
    setPlacedFields(prev => prev.map(f => 
      f.id === interactionFieldId ? { ...f, value } : f
    ));

    // Persist immediately when signing
    void persistFilledValue(interactionFieldId, value);

    setInteractionFieldId(null);
    setInteractionDialogOpen(false);
  };

  // Handle opening the appropriate dialog for a field (used by both click and double-click)
  const openFieldDialog = useCallback((fieldId: string) => {
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;

    // In sign mode, only allow editing fields assigned to the current signer
    if (mode === 'sign') {
      if (!currentSignerId) return;
      if (!field.assignedSignerId) return;
      if (field.assignedSignerId !== currentSignerId) return;
      // Allow re-signing: user can click a filled field to replace their signature
    }
    
    // Open appropriate dialog based on field type
    if (field.type === 'signature' || field.type === 'initial') {
      openSignaturePadForField(fieldId, field.type);
    } else if (['full_name', 'first_name', 'last_name', 'email', 'company', 'title', 'date', 'text', 'checkbox', 'stamp'].includes(field.type)) {
      openInteractionDialogForField(fieldId, field.type);
    }
  }, [placedFields, mode, currentSignerId]);

  // Handle double-click on fields to open appropriate dialog
  const handleFieldDoubleClick = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    openFieldDialog(fieldId);
  };

  // In sign mode, single click on own fields should open the dialog immediately
  const handleFieldClickSign = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    // Skip opening dialog if we just finished dragging
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    if (mode === 'sign') {
      const field = placedFields.find(f => f.id === fieldId);
      if (field && field.assignedSignerId === currentSignerId) {
        openFieldDialog(fieldId);
        return;
      }
    }
    // In edit mode, single-click on sender signature/initial fields opens the dialog
    if (mode === 'edit') {
      const field = placedFields.find(f => f.id === fieldId);
      if (field && field.assignedSignerId === SENDER_SIGNER_ID && (field.type === 'signature' || field.type === 'initial')) {
        openFieldDialog(fieldId);
        return;
      }
    }
    handleFieldClick(e, fieldId);
  };

  // Download document with signatures overlaid on the original document via Edge Function
  const handleDownloadWithSignatures = async () => {
    if (!fileUrl) {
      toast.error('No document to download');
      return;
    }

    // For completed documents with a finalized signed PDF, download directly
    if (documentStatus === 'completed' && signedPdfUrl) {
      setIsDownloading(true);
      try {
        const response = await fetch(signedPdfUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const sanitizedTitle = documentTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        link.download = `${sanitizedTitle}_signed_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Signed PDF downloaded — signatures flattened (non-editable)');
      } catch {
        window.open(signedPdfUrl, '_blank');
        toast.success('Signed PDF opened in new tab');
      } finally {
        setIsDownloading(false);
      }
      return;
    }

    // Allow downloading with signatures at any status — embed whatever is filled so far
    
    setIsDownloading(true);
    
    try {
      const isPdf = (mimeType || '').toLowerCase().includes('pdf') || 
                    fileUrl.toLowerCase().endsWith('.pdf');
      
      if (!isPdf) {
        toast.info('Non-PDF documents download as original. Signatures shown on preview only.');
        window.open(fileUrl, '_blank');
        setIsDownloading(false);
        return;
      }

      const fieldsForDownload = placedFields
        .filter((f) => (f.value ?? '').length > 0)
        .map((f) => ({
          id: f.id,
          field_type: f.type,
          position_x: f.x,
          position_y: f.y,
          width: f.width,
          height: f.height,
          page_number: f.pageNumber,
          filled_value: f.value || null,
          pdf_page_width_pt: pdfPageSizes[f.pageNumber]?.width ?? f.pdfPageWidthPt ?? null,
          pdf_page_height_pt: pdfPageSizes[f.pageNumber]?.height ?? f.pdfPageHeightPt ?? null,
        }));

      // Call embed-pdf-signatures with the exact on-screen field snapshot
      console.log('[Download] Invoking embed-pdf-signatures edge function');
      const { data, error } = await supabase.functions.invoke('embed-pdf-signatures', {
        body: { documentId, fields: fieldsForDownload },
      });

      if (error) throw new Error(error.message || 'Failed to process document');
      if (!data?.success) throw new Error(data?.error || 'Failed to process document');

      // Download via base64 or URL
      const downloadBlob = async (blobData: Blob) => {
        const url = URL.createObjectURL(blobData);
        const link = document.createElement('a');
        link.href = url;
        const sanitizedTitle = documentTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        link.download = `${sanitizedTitle}_signed_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      if (data.pdfBase64) {
        const binaryString = atob(data.pdfBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        await downloadBlob(new Blob([bytes], { type: 'application/pdf' }));
        toast.success('Document downloaded with signatures');
      } else if (data.downloadUrl) {
        try {
          const response = await fetch(data.downloadUrl);
          await downloadBlob(await response.blob());
          toast.success(`Document downloaded with ${data.fieldsEmbedded || 0} fields embedded`);
        } catch {
          window.open(data.downloadUrl, '_blank');
          toast.success('Document opened in new tab');
        }
      } else {
        throw new Error('No download URL returned');
      }

    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document. Try downloading the original instead.');
      window.open(fileUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSave = () => {
    // Attach PDF page dimensions to each field for accurate coordinate mapping in embed functions
    const fieldsWithDimensions = placedFields.map(f => {
      const pageDims = pdfPageSizes[f.pageNumber];
      return {
        ...f,
        pdfPageWidthPt: pageDims?.width || undefined,
        pdfPageHeightPt: pageDims?.height || undefined,
      };
    });
    onSaveFields(fieldsWithDimensions);
  };

  const handleSendForSignature = async () => {
    if (onSendForSignature) {
      const senderFields = placedFields.filter((f) => f.assignedSignerId === SENDER_SIGNER_ID);
      if (senderFields.length === 0) {
        setAssignToSigner(SENDER_SIGNER_ID);
        toast.error('Add at least one field for yourself and sign it before sending.');
        return;
      }

      if (!senderFields.some((f) => !!f.value)) {
        setSelectedField(senderFields[0]?.id || null);
        setCurrentPage(senderFields[0]?.pageNumber || 1);
        toast.error('Please preview and sign your own field(s) before sending.');
        return;
      }

      // Validate: all required sender fields must be filled before sending
      const unfilled = senderFields.filter((f) => f.isRequired && !f.value);
      if (unfilled.length > 0) {
        toast.error(`Please complete all required sender fields first (${unfilled.length} remaining)`);
        setSelectedField(unfilled[0].id);
        setCurrentPage(unfilled[0].pageNumber);
        return;
      }

      // Validate: every recipient must have at least one field assigned
      if (addedRecipients.length > 0) {
        const recipientsWithoutFields = addedRecipients.filter(
          r => !placedFields.some(f => f.assignedSignerId === r.id)
        );
        if (recipientsWithoutFields.length > 0) {
          const names = recipientsWithoutFields.map(r => r.name || r.email).join(', ');
          toast.error(`Missing fields for ${names}. Please select them in the 'Assign To' dropdown on the left and place a signature box for them.`);
          return;
        }
      }

      // Auto-save fields before sending (with PDF page dimensions)
      const fieldsWithDimensions = placedFields.map(f => {
        const pageDims = pdfPageSizes[f.pageNumber];
        return { ...f, pdfPageWidthPt: pageDims?.width, pdfPageHeightPt: pageDims?.height };
      });
      await onSaveFields(fieldsWithDimensions);

      // Embed owner's signature into PDF so external signers see it
      try {
        toast.info('Embedding your signature into the document...');
        const { data: embedResult, error: embedError } = await supabase.functions.invoke('embed-pdf-signatures', {
          body: { documentId },
        });
        if (embedError) {
          console.error('[DocSign] Failed to embed owner signature:', embedError);
          toast.error('Failed to embed your signature. Sending with original document.');
        } else if (embedResult?.downloadUrl) {
          // Update the document's file_url to the new PDF with owner signature embedded
          const { error: updateErr } = await supabase
            .from('documents')
            .update({ file_url: embedResult.downloadUrl })
            .eq('id', documentId);
          if (updateErr) {
            console.error('[DocSign] Failed to update document file_url:', updateErr);
          } else {
            console.log('[DocSign] Owner signature embedded in PDF successfully');
          }
        }
      } catch (embedErr) {
        console.error('[DocSign] Embed signature error:', embedErr);
      }

      // Convert added recipients to DocumentSigner-like format for the callback
      let signersToSend = addedRecipients.map((r, index) => ({
        id: r.id,
        document_id: documentId,
        email: r.email,
        name: r.name,
        role: r.role || 'Signer',
        status: 'pending' as const,
        signing_order: signingOrder === 'sequential' ? index + 1 : 1,
        auth_method: 'email' as const,
        phone_number: null,
        viewed_at: null,
        signed_at: null,
        declined_at: null,
        decline_reason: null,
        consent_given: false,
        consent_timestamp: null,
        signature_data: null,
      }));
      
      // If no external recipients but sender has fields (self-sign scenario),
      // add the sender as a signer so they receive the signing email
      if (signersToSend.length === 0 && hasSenderFields && currentUserEmail) {
        signersToSend = [{
          id: `sender-${Date.now()}`,
          document_id: documentId,
          email: currentUserEmail,
          name: currentUserName,
          role: 'Signer',
          status: 'pending' as const,
          signing_order: 1,
          auth_method: 'email' as const,
          phone_number: null,
          viewed_at: null,
          signed_at: null,
          declined_at: null,
          decline_reason: null,
          consent_given: false,
          consent_timestamp: null,
          signature_data: null,
        }];
      }
      
      onSendForSignature(signersToSend, signingOrder);
    }
  };

  const handleVoidDocument = () => {
    if (onVoidDocument) {
      onVoidDocument();
    }
  };

  const getSignerColor = (signerId?: string) => {
    // No background, only border colors for cleaner look
    if (!signerId) return 'border-gray-400';
    if (signerId === SENDER_SIGNER_ID) return 'border-emerald-500';
    const index = signers.findIndex(s => s.id === signerId);
    const colors = [
      'border-blue-500',
      'border-green-500',
      'border-purple-500',
      'border-orange-500',
      'border-pink-500',
    ];
    return colors[index % colors.length];
  };

  const getSignerBgColor = (signerId: string, index: number) => {
    if (signerId === SENDER_SIGNER_ID) return 'bg-emerald-500';
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    return colors[index % colors.length];
  };

  const getToolIcon = (type: string) => {
    const tool = FIELD_TOOLS.find(t => t.id === type);
    if (!tool) return Type;
    return tool.icon;
  };

  const pageFields = placedFields.filter(f => f.pageNumber === currentPage);

  // Document container sizing: width is fixed (then zoomed), height is derived from actual PDF ratio.
  // Use actual PDF page dimensions when available, fallback to US Letter (612x792pt).
  const currentPdfWidth = pdfPageSizes[currentPage]?.width || 612;
  const currentPdfHeight = pdfPageSizes[currentPage]?.height || 792;
  const baseDocWidthPx = 680;
  const pageRatio = currentPdfHeight / currentPdfWidth;
  const containerWidth = (baseDocWidthPx * zoom) / 100;
  const containerHeight = (baseDocWidthPx * pageRatio * zoom) / 100;
  
  // Check if there are fields for recipients (not just sender)
  const _hasRecipientFields = placedFields.some(f => f.assignedSignerId && f.assignedSignerId !== SENDER_SIGNER_ID);
  const hasSenderFields = placedFields.some(f => f.assignedSignerId === SENDER_SIGNER_ID);
  const hasAnyFields = placedFields.length > 0;
  
  // Check sender signing status
  const senderFields = placedFields.filter(f => f.assignedSignerId === SENDER_SIGNER_ID);
  const unfilledSenderFields = senderFields.filter(f => f.isRequired && !f.value);
  const senderHasSigned = hasSenderFields && unfilledSenderFields.length === 0 && senderFields.some(f => !!f.value);
  
  // Can send if:
  // 1. Has recipients with assigned fields, OR
  // 2. Sender is the only signer and has fields (self-sign scenario)
  const canSend = addedRecipients.length > 0 || 
                  (hasSenderFields && addedRecipients.length === 0 && hasAnyFields);

  // For sign mode: signer can submit only when all their required fields are filled
  const signerRequiredFields = (mode === 'sign' && currentSignerId)
    ? placedFields.filter((f) => f.assignedSignerId === currentSignerId && f.isRequired)
    : [];
  const canSubmit = mode !== 'sign' ? true : signerRequiredFields.every((f) => !!f.value);

  // Quick add function for sender (reserved for future use)
  const _handleQuickAddSenderField = (type: 'signature' | 'initial' | 'date') => {
    const defaultDimensions = {
      signature: { width: 18, height: 6 },
      initial: { width: 8, height: 5 },
      date: { width: 14, height: 4 },
    };
    const dims = defaultDimensions[type];
    
    // Place field at center-bottom of current page
    const newField: PlacedField = {
      id: `field-${Date.now()}`,
      type,
      x: 40,
      y: 70 + Math.random() * 10,
      width: dims.width,
      height: dims.height,
      pageNumber: currentPage,
      assignedSignerId: SENDER_SIGNER_ID,
      isRequired: true,
    };
    
    setPlacedFields(prev => [...prev, newField]);
    setSelectedField(newField.id);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Sidebar - Wider for readability */}
      <div className="w-72 bg-background border-r flex flex-col flex-shrink-0 h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-background flex items-center justify-between">
          <Button variant="ghost" size="sm" className="h-8 -ml-2" onClick={async () => { if (mode === 'edit') { const fwd = placedFields.map(f => ({ ...f, pdfPageWidthPt: pdfPageSizes[f.pageNumber]?.width, pdfPageHeightPt: pdfPageSizes[f.pageNumber]?.height })); await onSaveFields(fwd); } onBack(); }}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          {mode === 'edit' && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)">
                <RotateCw className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={handleSave}>
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            
            {/* Document Actions - Edit Mode - Always visible */}
            {mode === 'edit' && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">Document Actions</p>
                
                {/* Download - with dropdown for both options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between" 
                      size="sm"
                      disabled={isDownloading}
                    >
                      <span className="flex items-center">
                        <Download className="w-4 h-4 mr-1.5 flex-shrink-0" />
                        Download
                      </span>
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem 
                      onClick={() => window.open(fileUrl, '_blank')}
                      className="cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      Download Original
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDownloadWithSignatures}
                      disabled={isDownloading}
                      className="cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-2 text-accent" />
                      Download with Signatures
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Void Document */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5" 
                      size="sm"
                    >
                      <Ban className="w-4 h-4 mr-1.5 flex-shrink-0" />
                      Void Document
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Void this document?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will void the document and cancel all pending signatures. 
                        This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleVoidDocument} className="bg-destructive hover:bg-destructive/90">
                        Void Document
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Separator className="my-2" />

                {/* Recipients removed from edit fields - managed in Prepare & Send workflow */}

                {/* Send for Signature - removed from here, moved to fixed footer */}

                <Separator className="my-2" />
              </div>
            )}

            {mode === 'sign' && (
              <div className="space-y-3">
                {/* Add Signature Button - Prominent */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground uppercase tracking-widest">Sign Document</p>
                  <Button
                    variant={selectedTool === 'signature' ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-center font-medium',
                      selectedTool === 'signature' && 'bg-accent hover:bg-accent/90 text-accent-foreground'
                    )}
                    size="sm"
                    onClick={() => {
                      const enablePlacement = selectedTool !== 'signature';
                      setSelectedTool(enablePlacement ? 'signature' : null);
                      toast.info(enablePlacement ? 'Click anywhere on the document to place your signature.' : 'Signature placement cancelled.');
                    }}
                  >
                    <PenTool className="w-4 h-4 mr-1.5" />
                    {selectedTool === 'signature' ? 'Click on document to sign...' : 'Add Signature'}
                  </Button>
                  <Button
                    variant={selectedTool === 'initial' ? 'default' : 'outline'}
                    className={cn(
                      'w-full justify-center font-medium',
                      selectedTool === 'initial' && 'bg-accent hover:bg-accent/90 text-accent-foreground'
                    )}
                    size="sm"
                    onClick={() => {
                      const enablePlacement = selectedTool !== 'initial';
                      setSelectedTool(enablePlacement ? 'initial' : null);
                      toast.info(enablePlacement ? 'Click anywhere on the document to place your initials.' : 'Initials placement cancelled.');
                    }}
                  >
                    <Type className="w-4 h-4 mr-1.5" />
                    {selectedTool === 'initial' ? 'Click on document for initials...' : 'Add Initials'}
                  </Button>
                </div>

                <Separator />

                {/* Signing Guide */}
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 space-y-2">
                  <p className="text-xs font-semibold text-accent">How to sign</p>
                  <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Click "Add Signature" above, then click on the document</li>
                    <li>Or click on any highlighted field on the document</li>
                    <li>Draw, type, or upload your signature in the popup</li>
                    <li>Click "Finish & Submit" when done</li>
                  </ol>
                </div>

                {/* Progress indicator */}
                {signerRequiredFields.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {signerRequiredFields.filter(f => !!f.value).length} / {signerRequiredFields.length} fields
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${signerRequiredFields.length > 0 ? (signerRequiredFields.filter(f => !!f.value).length / signerRequiredFields.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Finish & Submit Button */}
                <Button
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin flex-shrink-0" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5 flex-shrink-0" />
                      <span>Finish & Submit</span>
                    </>
                  )}
                </Button>
                {!canSubmit && !isSubmitting && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Complete all required fields to submit.
                  </p>
                )}
                
                {/* Download - Always visible with dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between" 
                      size="sm"
                      disabled={isDownloading}
                    >
                      <span className="flex items-center">
                        <Download className="w-4 h-4 mr-1.5 flex-shrink-0" />
                        Download
                      </span>
                      <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem 
                      onClick={() => window.open(fileUrl || '', '_blank')}
                      disabled={!fileUrl}
                      className="cursor-pointer"
                    >
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      Download Original
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDownloadWithSignatures}
                      disabled={isDownloading}
                      className="cursor-pointer"
                    >
                      <Download className="w-4 h-4 mr-2 text-accent" />
                      Download with Signatures
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {mode === 'view' && (
              <div className="space-y-2">
                {/* Download Button for View Mode */}
                <Button
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
                  size="sm"
                  onClick={handleDownloadWithSignatures}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin flex-shrink-0" />
                  ) : (
                    <Download className="w-4 h-4 mr-1.5 flex-shrink-0" />
                  )}
                  <span>Download PDF</span>
                </Button>
              </div>
            )}

            {/* Field Tools - DocuSign Style */}
            {mode === 'edit' && (
              <div className="space-y-2">
                {/* Header */}
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">Fields</p>
                
                {/* Signature Fields Group */}
                <div className="flex flex-col space-y-0.5">
                  {SIGNATURE_FIELDS.map((tool) => (
                    <DraggableFieldTool
                      key={tool.id}
                      id={tool.id}
                      label={tool.label}
                      icon={tool.icon}
                      isSelected={selectedTool === tool.id}
                      onSelect={() => setSelectedTool(selectedTool === tool.id ? null : tool.id)}
                      onDragStart={handleToolDragStart}
                      onDragEnd={handleToolDragEnd}
                    />
                  ))}
                </div>

                <Separator className="my-2" />

                {/* Standard Fields Group (Name, First Name, etc.) */}
                <div className="flex flex-col space-y-0.5">
                  {STANDARD_FIELDS.map((tool) => (
                    <DraggableFieldTool
                      key={tool.id}
                      id={tool.id}
                      label={tool.label}
                      icon={tool.icon}
                      isSelected={selectedTool === tool.id}
                      onSelect={() => setSelectedTool(selectedTool === tool.id ? null : tool.id)}
                      onDragStart={handleToolDragStart}
                      onDragEnd={handleToolDragEnd}
                    />
                  ))}
                </div>

                <Separator className="my-2" />

                {/* Other Fields Group (Text, Checkbox) */}
                <div className="flex flex-col space-y-0.5">
                  {OTHER_FIELDS.map((tool) => (
                    <DraggableFieldTool
                      key={tool.id}
                      id={tool.id}
                      label={tool.label}
                      icon={tool.icon}
                      isSelected={selectedTool === tool.id}
                      onSelect={() => setSelectedTool(selectedTool === tool.id ? null : tool.id)}
                      onDragStart={handleToolDragStart}
                      onDragEnd={handleToolDragEnd}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* My Signatures - Draggable saved signatures */}
            {mode === 'sign' && (savedSignatures.length > 0 || mode === 'sign') && (
              <CollapsibleFieldSection title="My Signatures" defaultOpen={true}>
                <div className="pt-2 space-y-2">
                  {savedSignatures.length > 0 ? (
                    <>
                      <p className="text-[10px] text-muted-foreground">
                        Drag a saved signature onto the document to place it
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {savedSignatures.map((sig) => {
                          const sigSrc = sig.storage_url || (sig.signature_data?.startsWith('data:image') ? sig.signature_data : `data:image/png;base64,${sig.signature_data}`);
                          return (
                            <div
                              key={sig.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', `saved-sig:${sigSrc}`);
                                e.dataTransfer.effectAllowed = 'copy';
                                setDraggingTool('saved-sig');
                              }}
                              onDragEnd={() => setDraggingTool(null)}
                              className="relative group border rounded-lg p-2 cursor-grab active:cursor-grabbing hover:border-accent hover:bg-accent/5 transition-all"
                            >
                              <img
                                src={sigSrc}
                                alt="Saved signature"
                                className="h-10 w-full object-contain"
                                draggable={false}
                              />
                              {sig.is_default && (
                                <span className="absolute top-0.5 right-0.5 text-[8px] bg-accent text-accent-foreground px-1 rounded">
                                  Default
                                </span>
                              )}
                              <button
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSignature(sig.id);
                                }}
                                title="Delete"
                              >
                                ×
                              </button>
                              <GripVertical className="absolute bottom-0.5 left-0.5 w-3 h-3 text-muted-foreground/40" />
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No saved signatures yet.</p>
                  )}
                  <Button
                    variant={mode === 'sign' && selectedTool === 'signature' ? 'default' : 'outline'}
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      if (mode === 'sign') {
                        const enablePlacement = selectedTool !== 'signature';
                        setSelectedTool(enablePlacement ? 'signature' : null);
                        toast.info(enablePlacement ? 'Click anywhere on the document to place your signature field.' : 'Signature placement cancelled.');
                        return;
                      }

                      setSignatureFieldType('signature');
                      setSignatureFieldId(null);
                      setSignaturePadOpen(true);
                    }}
                  >
                    <PenTool className="w-3 h-3 mr-1.5" />
                    {mode === 'sign' ? (selectedTool === 'signature' ? 'Tap document to place signature' : 'Add Signature on Document') : 'Create New Signature'}
                  </Button>
                </div>
              </CollapsibleFieldSection>
            )}

            {/* Snap to Grid Toggle */}
            {mode === 'edit' && (
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-muted-foreground">Snap to Grid</span>
                <Switch 
                  checked={snapEnabled} 
                  onCheckedChange={setSnapEnabled}
                />
              </div>
            )}

            <Separator />

            {/* Selected Field Properties */}
            {selectedField && mode === 'edit' && (() => {
              const field = placedFields.find(f => f.id === selectedField);
              if (!field) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Field</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={duplicateSelectedField}
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Duplicate (Ctrl+D)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={deleteSelectedField}
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title="Delete (Del)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Select 
                      value={field.type} 
                      onValueChange={(value) => updateFieldType(field.id, value as PlacedField['type'])}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TOOLS.map(tool => (
                          <SelectItem key={tool.id} value={tool.id}>
                            <div className="flex items-center gap-2">
                              <tool.icon className="w-3 h-3" />
                              <span>{tool.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Required</span>
                      <Switch 
                        checked={field.isRequired} 
                        onCheckedChange={(checked) => updateFieldRequired(field.id, checked)}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Fields List */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Fields ({placedFields.length})
              </p>
              {placedFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {mode === 'edit' ? 'Click a tool and place on document' : 'No fields'}
                </p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-auto">
                  {placedFields.map((field) => {
                    const Icon = getToolIcon(field.type);
                    return (
                      <button
                        key={field.id}
                        className={cn(
                          'w-full flex items-center gap-2 p-1.5 rounded text-left text-xs hover:bg-muted',
                          selectedField === field.id && 'bg-muted'
                        )}
                        onClick={() => {
                          setSelectedField(field.id);
                          setCurrentPage(field.pageNumber);
                        }}
                      >
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="capitalize flex-1 truncate">{field.type.replace('_', ' ')}</span>
                        <span className="text-[10px] text-muted-foreground">p{field.pageNumber}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer - Prepare & Send + Zoom & Page Controls */}
        <div className="border-t bg-background">
          {/* Prepare & Send - Always visible at bottom */}
          {mode === 'edit' && onSendForSignature && (
            <div className="p-3 space-y-1.5 border-b">
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-10"
                onClick={handleSendForSignature}
                disabled={!canSend || !senderHasSigned}
              >
                <Send className="w-4 h-4 mr-2 flex-shrink-0" />
                Prepare & Send
              </Button>
              {!hasSenderFields && !hasAnyFields && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Place fields on the document first
                </p>
              )}
              {!senderHasSigned && hasSenderFields && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Sign your fields first before sending
                </p>
              )}
              {hasSenderFields && senderHasSigned && addedRecipients.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Add recipients or send as self-sign
                </p>
              )}
            </div>
          )}
          
          <div className="p-3 space-y-2">
            {/* Page Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setCurrentPage(Math.max(1, Math.min(totalPages, val)));
                  }}
                  className="w-10 text-center text-xs border rounded px-1 py-0.5"
                />
                <span className="text-muted-foreground">/ {totalPages}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(50, z - 25))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{zoom}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.min(200, z + 25))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Document Area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden bg-muted/30"
      >
        {/* Top Banner - contextual instruction */}
        {mode === 'edit' && (
          <div className="bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 opacity-70" />
              <span className="font-medium">Edit Fields — drag fields onto the document, then Save or Download</span>
            </div>
            <div className="flex items-center gap-4 text-sm opacity-80">
              <span>{placedFields.length} field{placedFields.length !== 1 ? 's' : ''} placed</span>
              {totalPages > 1 && <span>Page {currentPage} of {totalPages}</span>}
            </div>
          </div>
        )}

        {/* Sign mode banner */}
        {mode === 'sign' && (
          <div className="bg-accent text-accent-foreground px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <PenTool className="w-5 h-5 opacity-70" />
              <span className="font-medium">
                {canSubmit 
                  ? 'All fields completed — click "Finish & Submit" to sign'
                  : `Click on each highlighted field below to sign (${signerRequiredFields.filter(f => !f.value).length} remaining)`
                }
              </span>
            </div>
          </div>
        )}
        
        {/* Scrollable Document Container */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="flex flex-col items-center p-6 min-h-full">
          {(() => {
            const _isWordDoc = mimeType?.includes('word') || fileUrl?.toLowerCase().includes('.doc');
            
            return (
              <>
                {/* Document Container - FIXED US Letter aspect ratio for precise field anchoring */}
                {/* NOTE: Container height is derived from the actual PDF page ratio for accurate anchoring */}
                <div 
                  className={cn(
                    "bg-white shadow-xl relative rounded-sm overflow-hidden",
                    draggingTool && "ring-2 ring-accent ring-dashed"
                  )}
                  style={{ 
                    width: `${containerWidth}px`,
                    height: `${containerHeight}px`,
                    cursor: selectedTool ? 'crosshair' : 'default',
                  }}
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  onDragOver={handleCanvasDragOver}
                  onDrop={handleCanvasDrop}
                >
          {/* Document Content - PDF rendering */}
          {fileUrl ? (
            (() => {
              const isPdf = mimeType === 'application/pdf' || fileUrl.toLowerCase().includes('.pdf');
              const isWord = mimeType?.includes('word') || fileUrl.toLowerCase().includes('.doc');
              
              if (isPdf) {
                // Use pdf.js for direct rendering - no iframe chrome/offset
                // This ensures field coordinates match the actual PDF content exactly
                return (
                  <PdfPageRenderer
                    key={`pdf-${documentId}-${currentPage}-${zoom}`}
                    fileUrl={fileUrl}
                    pageNumber={currentPage}
                    width={containerWidth}
                    height={containerHeight}
                    onPageLoad={(pageWidthPt, pageHeightPt) => {
                      setPdfPageSizes((prev) => {
                        const next = { ...prev, [currentPage]: { width: pageWidthPt, height: pageHeightPt } };
                        return next;
                      });
                    }}
                    onTotalPages={(total) => setTotalPages(total)}
                  />
                );
              }

              if (isWord) {
                // Use Microsoft Office Online viewer for better Word support
                const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
                const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
                
                return (
                  <iframe
                    src={officeViewerUrl}
                    title={`${documentTitle}`}
                    className="absolute inset-0 w-full h-full border-0 z-10"
                    style={{ backgroundColor: 'white' }}
                    onError={() => {
                      // Fallback to Google Docs viewer
                      const iframe = document.querySelector(`iframe[title="${documentTitle}"]`) as HTMLIFrameElement;
                      if (iframe) {
                        iframe.src = googleViewerUrl;
                      }
                    }}
                  />
                );
              }

              return (
                <img 
                  src={fileUrl} 
                  alt={`${documentTitle} - Page ${currentPage}`}
                  className="absolute inset-0 w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              );
            })()
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-8 select-none bg-white">
              <div className="text-center text-muted-foreground">
                <FileText className="w-32 h-32 mx-auto mb-6 opacity-20" />
                <h3 className="text-2xl font-medium mb-3">{documentTitle}</h3>
                <p className="text-lg">No document file uploaded</p>
                <p className="text-sm mt-3 text-muted-foreground/70">Upload a PDF or Word document to see the original file</p>
              </div>
            </div>
          )}

          {/* Drop Zone Layer - handles drag & drop and click-to-place */}
          {/* In edit mode: always catches drags, catches clicks only when tool selected */}
          {/* In other modes: transparent */}
          {/* Drop Zone Layer - handles drag & drop and click-to-place */}
          {/* pointer-events-auto ONLY when dragging or tool selected, otherwise pass through */}
          {(mode === 'edit' || (mode === 'sign' && (draggingTool === 'saved-sig' || !!selectedTool))) && (
            <div 
              className={cn(
                "absolute inset-0",
                (draggingTool || selectedTool) ? "pointer-events-auto" : "pointer-events-none"
              )}
              style={{ 
                zIndex: 15, 
                cursor: selectedTool ? 'crosshair' : draggingTool ? 'copy' : 'default',
                backgroundColor: 'transparent',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCanvasDrop(e);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedTool && (mode === 'edit' || mode === 'sign')) {
                  handleCanvasClick(e);
                }
              }}
            />
          )}

          {/* Fields Overlay Layer - matches the exact PDF render box (same container) */}
          <div 
            className="absolute inset-0 z-20 pointer-events-none"
            style={{ 
              transform: 'none',
            }}
          >
          {pageFields.map((field) => {
            const Icon = getToolIcon(field.type);
            const isSelected = selectedField === field.id;
            const isSenderField = field.assignedSignerId === SENDER_SIGNER_ID;
            const isSignatureLike = field.type === 'signature' || field.type === 'initial';
            const canInteractInSignMode =
              mode !== 'sign'
                ? true
                : !!currentSignerId && field.assignedSignerId === currentSignerId;
            
            // Use field.y directly for positioning
            const displayY = field.y;
            
            return (
              <div
                key={field.id}
                data-field="true"
                className={cn(
                  'absolute rounded-sm transition-all group bg-transparent',
                  field.value ? 'border-0' : 'border border-foreground/60',
                  !field.value && getSignerColor(field.assignedSignerId),
                  isSelected && !field.value && 'ring-1 ring-accent ring-offset-1',
                  mode === 'edit' && 'cursor-pointer pointer-events-auto',
                  mode === 'sign' && canInteractInSignMode && !field.value && 'pointer-events-auto cursor-move animate-pulse border-2 bg-accent/10',
                  mode === 'sign' && canInteractInSignMode && field.value && 'pointer-events-auto cursor-move hover:ring-2 hover:ring-accent/50',
                  mode === 'sign' && !canInteractInSignMode && 'pointer-events-none opacity-80',
                  mode === 'view' && 'pointer-events-none',
                )}
                style={{
                  left: `${field.x}%`,
                  top: `${displayY}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                }}
                onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                onClick={(e) => handleFieldClickSign(e, field.id)}
                onDoubleClick={(e) => handleFieldDoubleClick(e, field.id)}
              >
                {/* Remove appended signature/stamp value in edit mode */}
                {mode === 'edit' && field.value && (isSignatureLike || field.type === 'stamp') && (
                  <button
                    className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-background text-foreground border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      pushUndo();
                      setPlacedFields(prev => prev.map(f => (f.id === field.id ? { ...f, value: undefined } : f)));
                      void persistFilledValue(field.id, null);
                      toast.success('Signature removed');
                    }}
                    title="Remove signature"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}

                {/* Delete field - visible on hover in edit mode */}
                {mode === 'edit' && (
                  <button
                    className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-destructive/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteField(field.id);
                    }}
                    title="Delete field"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {/* Render field content */}
                {field.value && (field.type === 'signature' || field.type === 'initial') ? (
                  <img 
                    src={field.value} 
                    alt={field.type === 'initial' ? 'Initials' : 'Signature'} 
                    className="absolute inset-0 w-full h-full object-contain p-0.5"
                    style={{ mixBlendMode: 'multiply' }}
                    draggable={false}
                  />
                ) : field.value && field.type === 'stamp' ? (
                  <img 
                    src={field.value} 
                    alt="Stamp" 
                    className="absolute inset-0 w-full h-full object-contain p-1"
                    style={{ mixBlendMode: 'multiply' }}
                    draggable={false}
                  />
                ) : field.value && field.type === 'checkbox' ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {field.value === 'true' ? (
                      <CheckSquare className="w-5 h-5 text-accent" />
                    ) : (
                      <div className="w-4 h-4 border-2 border-muted-foreground/50 rounded-sm" />
                    )}
                  </div>
                ) : field.value && (field.type === 'full_name' || field.type === 'first_name' || field.type === 'last_name' || field.type === 'email' || field.type === 'company' || field.type === 'title' || field.type === 'text' || field.type === 'date') ? (
                  <div className="absolute inset-0 flex items-center justify-center p-1 overflow-hidden">
                    <span className="text-xs font-medium text-foreground truncate">{field.value}</span>
                  </div>
                ) : !field.value ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1 overflow-hidden">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-[9px] text-muted-foreground/60 truncate max-w-full leading-none">
                      {isSignatureLike
                        ? (mode === 'sign' && !canInteractInSignMode)
                          ? 'Assigned to another signer'
                          : 'Double-click to sign'
                        : field.type === 'checkbox' 
                          ? 'Double-click to toggle'
                          : `Double-click to edit`}
                    </span>
                  </div>
                ) : null}
                {field.isRequired && !field.value && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
                {isSenderField && !isSelected && !field.value && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center z-10">
                    <UserCheck className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
                
                {/* Resize Handles - only show when selected and in edit mode */}
                {isSelected && (mode === 'edit' || (mode === 'sign' && canInteractInSignMode)) && (
                  <>
                    {/* Corner handles */}
                    <div 
                      className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-nw-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')}
                    />
                    <div 
                      className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-ne-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')}
                    />
                    <div 
                      className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-sw-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')}
                    />
                    <div 
                      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-se-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')}
                    />
                    {/* Edge handles */}
                    <div 
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground border border-background rounded-sm cursor-n-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'n')}
                    />
                    <div 
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-foreground border border-background rounded-sm cursor-s-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 's')}
                    />
                    <div 
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-foreground border border-background rounded-sm cursor-w-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'w')}
                    />
                    <div 
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-foreground border border-background rounded-sm cursor-e-resize"
                      onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'e')}
                    />
                  </>
                )}
              </div>
            );
          })}
          </div>
              </div>
            </>
          );
        })()}
          </div>
        </div>
      </div>


      {/* Signature Pad Dialog */}
      <SignaturePad
        open={signaturePadOpen}
        onOpenChange={setSignaturePadOpen}
        onSave={handleSignatureSave}
        signerName={currentUserName}
        fieldType={signatureFieldType}
      />

      {/* Saved Signatures Quick Select - show when field is selected and has saved signatures */}
      {selectedField && savedSignatures.length > 0 && (() => {
        const field = placedFields.find(f => f.id === selectedField);
        if (!field || (field.type !== 'signature' && field.type !== 'initial')) return null;
        
        return (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg shadow-lg p-3 z-50">
            <p className="text-xs font-medium text-muted-foreground mb-2">Use a saved signature:</p>
            <div className="flex gap-2">
              {savedSignatures.slice(0, 3).map((sig) => (
                <div key={sig.id} className="relative group">
                  <button
                    className="border rounded p-2 hover:border-accent transition-colors"
                    onClick={() => {
                      const sigSrc = sig.storage_url || (sig.signature_data?.startsWith('data:image') ? sig.signature_data : `data:image/png;base64,${sig.signature_data}`);
                      applySignatureToField(selectedField, sigSrc);
                    }}
                  >
                    <img 
                      src={sig.storage_url || (sig.signature_data?.startsWith('data:image') ? sig.signature_data : `data:image/png;base64,${sig.signature_data}`)} 
                      alt="Saved signature" 
                      className="h-8 w-auto max-w-24 object-contain"
                    />
                  </button>
                  <button
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-destructive/90"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSignature(sig.id);
                    }}
                    title="Delete signature"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="border rounded px-3 py-2 hover:border-accent transition-colors text-sm text-muted-foreground"
                onClick={() => openSignaturePadForField(selectedField, field.type as 'signature' | 'initial')}
              >
                + New
              </button>
            </div>
          </div>
        );
      })()}

      {/* Field Interaction Dialog for full_name, date, text, checkbox, stamp */}
      <FieldInteractionDialog
        open={interactionDialogOpen}
        onOpenChange={(open) => {
          setInteractionDialogOpen(open);
          if (!open) setInteractionFieldId(null);
        }}
        fieldType={interactionFieldType}
        currentValue={placedFields.find(f => f.id === interactionFieldId)?.value}
        onSave={handleInteractionDialogSave}
        signerName={currentUserName}
      />
    </div>
  );
}

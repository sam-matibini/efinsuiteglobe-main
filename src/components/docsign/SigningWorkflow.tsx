import { useState, useRef, useCallback } from 'react';
import { 
  ArrowRight, 
  Check, 
  Mail, 
  Users, 
  Settings, 
  Calendar,
  AlertCircle,
  Trash2,
  Send,
  Eye,
  FileText,
  PenTool,
  Type,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { RecipientPicker, Recipient } from './RecipientPicker';
import { FieldToolsSidebar, FIELD_TOOLS } from './FieldToolsSidebar';
import { FieldInteractionDialog } from './FieldInteractionDialog';
import { PdfPageRenderer } from './PdfPageRenderer';
import { format } from 'date-fns';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

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
  initialFields?: PlacedField[];
  onComplete: (recipients: Recipient[], fields: PlacedField[], settings: WorkflowSettings) => void;
  onBack: () => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

const STEPS_BASE = [
  { id: 'recipients', label: 'Add Recipients', icon: Users },
  { id: 'prepare', label: 'Prepare Document', icon: PenTool },
  { id: 'sign', label: 'Sign Your Fields', icon: PenTool },
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
  initialFields = [],
  onComplete,
  onBack,
}: SigningWorkflowProps) {
  const confirmDelete = useConfirmDelete();
  const [activeStep, setActiveStep] = useState(0);
  
  // Recipients state
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  
  // Document preparation state
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>(initialFields);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(pageCount);
  const [zoom, setZoom] = useState(100);
  const [pdfPageSizes, setPdfPageSizes] = useState<Record<number, { width: number; height: number }>>({});
  const [assignToSigner, setAssignToSigner] = useState<string>(SENDER_SIGNER_ID);
  
  // Field interaction state
  const [editingField, setEditingField] = useState<PlacedField | null>(null);
  
  // Drag & Resize state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fieldStartPos, setFieldStartPos] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Settings state
  const [settings, setSettings] = useState<WorkflowSettings>({
    signingOrder: 'sequential',
    expirationDays: 30,
    reminderEnabled: true,
    reminderDays: 3,
    customMessage: '',
  });

  // Combined signers list including sender
  const allSigners = [
    { id: SENDER_SIGNER_ID, email: currentUserEmail, name: currentUserName, isSender: true },
    ...recipients.map((r, index) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      signingOrder: settings.signingOrder === 'sequential' ? index + 1 : 1,
    })),
  ];

  const handleAddRecipient = (recipient: Recipient) => {
    setRecipients(prev => [...prev, { ...recipient, signingOrder: prev.length + 1 }]);
  };

  const handleRemoveRecipient = (recipientId: string) => {
    setRecipients(prev => {
      const filtered = prev.filter(r => r.id !== recipientId);
      // Reorder remaining recipients
      return filtered.map((r, idx) => ({ ...r, signingOrder: idx + 1 }));
    });
    // Remove fields assigned to this recipient
    setPlacedFields(prev => prev.map(f => 
      f.assignedSignerId === recipientId ? { ...f, assignedSignerId: undefined } : f
    ));
  };

  const handleReorderRecipients = (reorderedRecipients: Recipient[]) => {
    setRecipients(reorderedRecipients);
  };

  // Canvas click handler for placing fields
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    
    // If no tool selected or 'select' tool, just deselect the field
    if (!selectedTool || selectedTool === 'select') {
      setSelectedField(null);
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const defaultDimensions: Record<string, { width: number; height: number }> = {
      signature: { width: 20, height: 6 },
      initial: { width: 8, height: 6 },
      full_name: { width: 25, height: 4 },
      date: { width: 15, height: 4 },
      checkbox: { width: 3, height: 3 },
      text: { width: 20, height: 4 },
      stamp: { width: 15, height: 15 },
    };

    const dims = defaultDimensions[selectedTool] || { width: 15, height: 5 };
    
    const newField: PlacedField = {
      id: `field-${Date.now()}`,
      type: selectedTool as PlacedField['type'],
      x: Math.max(0, Math.min(x - (dims.width / 2), 100 - dims.width)),
      y: Math.max(0, Math.min(y - (dims.height / 2), 100 - dims.height)),
      width: dims.width,
      height: dims.height,
      pageNumber: currentPage,
      assignedSignerId: assignToSigner || undefined,
      isRequired: true,
    };
    
    setPlacedFields(prev => [...prev, newField]);
    setSelectedField(newField.id);
    // Don't clear the tool so user can place multiple fields quickly
  }, [selectedTool, currentPage, assignToSigner, isDragging, isResizing]);

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;
    
    setSelectedField(fieldId);
    setSelectedTool(null);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setFieldStartPos({ x: field.x, y: field.y, width: field.width, height: field.height });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string, handle: ResizeHandle) => {
    e.stopPropagation();
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;
    
    setSelectedField(fieldId);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setFieldStartPos({ x: field.x, y: field.y, width: field.width, height: field.height });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedField || (!isDragging && !isResizing)) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const deltaXPercent = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - dragStart.y) / rect.height) * 100;

    setPlacedFields(prev => prev.map(field => {
      if (field.id !== selectedField) return field;
      
      if (isDragging) {
        const newX = Math.max(0, Math.min(100 - field.width, fieldStartPos.x + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - field.height, fieldStartPos.y + deltaYPercent));
        return { ...field, x: newX, y: newY };
      }
      
      if (isResizing && resizeHandle) {
        let newX = fieldStartPos.x;
        let newY = fieldStartPos.y;
        let newWidth = fieldStartPos.width;
        let newHeight = fieldStartPos.height;
        
        if (resizeHandle.includes('e')) newWidth = Math.max(3, fieldStartPos.width + deltaXPercent);
        if (resizeHandle.includes('w')) {
          const widthDelta = Math.min(deltaXPercent, fieldStartPos.width - 3);
          newX = fieldStartPos.x + widthDelta;
          newWidth = fieldStartPos.width - widthDelta;
        }
        if (resizeHandle.includes('s')) newHeight = Math.max(2, fieldStartPos.height + deltaYPercent);
        if (resizeHandle.includes('n')) {
          const heightDelta = Math.min(deltaYPercent, fieldStartPos.height - 2);
          newY = fieldStartPos.y + heightDelta;
          newHeight = fieldStartPos.height - heightDelta;
        }
        
        return { 
          ...field, 
          x: Math.max(0, newX), 
          y: Math.max(0, newY), 
          width: Math.min(100 - Math.max(0, newX), newWidth), 
          height: Math.min(100 - Math.max(0, newY), newHeight) 
        };
      }
      
      return field;
    }));
  }, [selectedField, isDragging, isResizing, resizeHandle, dragStart, fieldStartPos]);

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  const deleteSelectedField = () => {
    if (!selectedField) return;
    setPlacedFields(prev => prev.filter(f => f.id !== selectedField));
    setSelectedField(null);
  };

  const getSignerColor = (signerId?: string, index = 0) => {
    if (!signerId) return 'border-muted-foreground/30 bg-muted/30';
    if (signerId === SENDER_SIGNER_ID) return 'border-emerald-500 bg-emerald-50';
    const colors = [
      'border-blue-500 bg-blue-50',
      'border-purple-500 bg-purple-50',
      'border-orange-500 bg-orange-50',
      'border-pink-500 bg-pink-50',
    ];
    return colors[index % colors.length];
  };


  const getToolIcon = (type: string) => {
    const tool = FIELD_TOOLS.find(t => t.id === type);
    return tool?.icon || Type;
  };

  // Handle double-click on field to edit its value
  const handleFieldDoubleClick = (e: React.MouseEvent, field: PlacedField) => {
    e.stopPropagation();
    // Only allow editing sender fields during preparation
    if (field.assignedSignerId === SENDER_SIGNER_ID) {
      setEditingField(field);
    }
  };

  // Handle saving field value
  const handleFieldValueSave = (value: string) => {
    if (!editingField) return;
    setPlacedFields(prev => prev.map(f => 
      f.id === editingField.id ? { ...f, value } : f
    ));
    setEditingField(null);
  };

  // Get display value for a field
  const getFieldDisplayValue = (field: PlacedField) => {
    if (!field.value) return null;
    
    if (field.type === 'signature' || field.type === 'initial' || field.type === 'stamp') {
      return (
        <img 
          src={field.value} 
          alt={field.type} 
          className="absolute inset-0 w-full h-full object-contain p-0.5"
          style={{ mixBlendMode: 'multiply' }}
        />
      );
    }
    
    if (field.type === 'checkbox') {
      return field.value === 'true' ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 bg-accent rounded flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      ) : null;
    }
    
    if (field.type === 'date') {
      try {
        const formattedDate = format(new Date(field.value), 'MMM d, yyyy');
        return (
          <span className="text-[10px] font-medium text-foreground truncate px-1">
            {formattedDate}
          </span>
        );
      } catch {
        return <span className="text-[10px] font-medium text-foreground truncate px-1">{field.value}</span>;
      }
    }
    
    return (
      <span className="text-[10px] font-medium text-foreground truncate px-1">
        {field.value}
      </span>
    );
  };

  const pageFields = placedFields.filter(f => f.pageNumber === currentPage);

  // Document container sizing from actual PDF dimensions (matching DocumentEditor approach)
  const currentPdfWidth = pdfPageSizes[currentPage]?.width || 612;
  const currentPdfHeight = pdfPageSizes[currentPage]?.height || 792;
  const baseDocWidthPx = 680;
  const pageRatio = currentPdfHeight / currentPdfWidth;
  const containerWidth = (baseDocWidthPx * zoom) / 100;
  const containerHeight = (baseDocWidthPx * pageRatio * zoom) / 100;
  const _recipientSignerIds = new Set(recipients.map((r) => r.id));
  const _recipientAssignedFields = placedFields.filter((f) =>
    !!f.assignedSignerId && f.assignedSignerId !== SENDER_SIGNER_ID && _recipientSignerIds.has(f.assignedSignerId)
  );
  const _hasRecipientFields = _recipientAssignedFields.length > 0;
  const hasSenderFields = placedFields.some(f => f.assignedSignerId === SENDER_SIGNER_ID);
  
  // Sender signing status
  const senderFields = placedFields.filter(f => f.assignedSignerId === SENDER_SIGNER_ID);
  const unfilledSenderFields = senderFields.filter(f => f.isRequired && !f.value);
  const senderHasSigned = hasSenderFields && unfilledSenderFields.length === 0 && senderFields.some(f => !!f.value);
  const senderHasUnsignedRequiredFields = unfilledSenderFields.length > 0;

  // Dynamic steps: include "Sign Your Fields" only when sender has fields
  const steps = STEPS_BASE.filter(s => {
    if (s.id === 'sign') return hasSenderFields;
    return true;
  });
  
  const canProceedFromPrepare = placedFields.length > 0;
  const canSend = placedFields.length > 0
    && (!hasSenderFields || !senderHasUnsignedRequiredFields);

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

  // Helper to get step ID for current index
  const currentStepId = steps[activeStep]?.id || '';

  const [isSending, setIsSending] = useState(false);
  const handleSend = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      await onComplete(recipients, placedFields, settings);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Progress Steps Header */}
      <div className="border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h2 className="font-semibold text-lg">{documentTitle}</h2>
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => setActiveStep(index)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors',
                    activeStep === index 
                      ? 'bg-accent text-accent-foreground' 
                      : activeStep > index
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {activeStep > index ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                  <span className="hidden md:inline font-medium">{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <ArrowRight className="w-4 h-4 mx-1 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {/* Step: Add Recipients */}
        {currentStepId === 'recipients' && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Add Recipients
                </CardTitle>
                <CardDescription>
                  Add the people who need to sign this document. You can also sign it yourself.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecipientPicker
                  recipients={recipients}
                  onAddRecipient={handleAddRecipient}
                  onRemoveRecipient={handleRemoveRecipient}
                  onReorderRecipients={handleReorderRecipients}
                  allowMultiple={true}
                  showSigningOrder={settings.signingOrder === 'sequential'}
                />
                
                {recipients.length === 0 && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center">
                    <UserCheck className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No recipients added. You can sign the document yourself by placing "Me (Sender)" fields in the next step.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Prepare Document (Place Fields) */}
        {currentStepId === 'prepare' && (
          <div 
            className="flex h-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Left Sidebar - Field Tools */}
            <FieldToolsSidebar
              selectedTool={selectedTool}
              onSelectTool={setSelectedTool}
              assignToSigner={assignToSigner}
              onAssignToSigner={setAssignToSigner}
              allSigners={allSigners.map(s => ({
                id: s.id,
                email: s.email,
                name: s.name,
                isSender: 'isSender' in s ? s.isSender : false,
              }))}
              zoom={zoom}
              onZoomChange={setZoom}
            />

            {/* Document Canvas */}
            <div className="flex-1 overflow-auto p-4 bg-muted/30 flex items-start justify-center">
               <div 
                ref={canvasRef}
                className="bg-white shadow-xl relative"
                style={{ 
                  width: `${containerWidth}px`,
                  height: `${containerHeight}px`,
                  cursor: selectedTool ? 'crosshair' : 'default',
                }}
                onClick={handleCanvasClick}
              >
                {/* Document preview */}
                {fileUrl ? (
                  (() => {
                    const isPdf = mimeType === 'application/pdf' || fileUrl.toLowerCase().includes('.pdf');
                    const isWord = mimeType?.includes('word') || fileUrl.toLowerCase().includes('.doc');
                    
                    if (isPdf) {
                      return (
                        <PdfPageRenderer
                          key={`pdf-prepare-${currentPage}-${zoom}`}
                          fileUrl={fileUrl}
                          pageNumber={currentPage}
                          width={containerWidth}
                          height={containerHeight}
                          onPageLoad={(pageWidthPt, pageHeightPt) => {
                            setPdfPageSizes((prev) => ({
                              ...prev,
                              [currentPage]: { width: pageWidthPt, height: pageHeightPt },
                            }));
                          }}
                          onTotalPages={(total) => {
                            if (total > 0) setTotalPages(total);
                          }}
                        />
                      );
                    }
                    
                    if (isWord) {
                      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
                      return (
                        <iframe
                          src={officeViewerUrl}
                          title={documentTitle}
                          className="absolute inset-0 w-full h-full border-0"
                          style={{ backgroundColor: 'white', pointerEvents: selectedTool ? 'none' : 'auto' }}
                        />
                      );
                    }
                    
                    return (
                      <img src={fileUrl} alt={documentTitle} className="absolute inset-0 w-full h-full object-contain" style={{ pointerEvents: selectedTool ? 'none' : 'auto' }} />
                    );
                  })()
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                    <div className="text-center text-muted-foreground">
                      <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p>{documentTitle}</p>
                    </div>
                  </div>
                )}

                {/* Transparent overlay to capture clicks when a tool is selected */}
                {selectedTool && selectedTool !== 'select' && (
                  <div 
                    className="absolute inset-0 z-[5] cursor-crosshair"
                    style={{ backgroundColor: 'transparent' }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent double-firing from parent canvas
                      handleCanvasClick(e);
                    }}
                  />
                )}

                {/* Placed Fields */}
                {pageFields.map((field) => {
                  const Icon = getToolIcon(field.type);
                  const isSelected = selectedField === field.id;
                  const signerIndex = allSigners.findIndex(s => s.id === field.assignedSignerId);
                  const isSenderField = field.assignedSignerId === SENDER_SIGNER_ID;
                  const hasValue = !!field.value;
                  const displayValue = getFieldDisplayValue(field);
                  
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        'absolute rounded-sm transition-all z-10 group bg-transparent',
                        hasValue ? 'border-0' : 'border border-foreground/60',
                        !hasValue && getSignerColor(field.assignedSignerId, signerIndex),
                        isSelected && !hasValue && 'ring-1 ring-accent ring-offset-1 z-20',
                        'cursor-pointer pointer-events-auto',
                        isSenderField && !hasValue && 'hover:shadow-md',
                      )}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                      }}
                      onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedField(field.id); setSelectedTool(null); }}
                      onDoubleClick={(e) => handleFieldDoubleClick(e, field)}
                    >
                      {/* Show value if field has been filled */}
                      {hasValue && (field.type === 'signature' || field.type === 'initial') ? (
                        <img 
                          src={field.value} 
                          alt={field.type === 'initial' ? 'Initials' : 'Signature'} 
                          className="absolute inset-0 w-full h-full object-contain p-0.5"
                          style={{ mixBlendMode: 'multiply' }}
                          draggable={false}
                        />
                      ) : hasValue && field.type === 'stamp' ? (
                        <img 
                          src={field.value} 
                          alt="Stamp" 
                          className="absolute inset-0 w-full h-full object-contain p-1"
                          style={{ mixBlendMode: 'multiply' }}
                          draggable={false}
                        />
                      ) : hasValue ? (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                          {displayValue}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1 overflow-hidden">
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-[9px] text-muted-foreground/60 truncate max-w-full leading-none capitalize">
                            {field.type.replace('_', ' ')}
                          </span>
                          {isSenderField && (
                            <span className="text-[8px] text-accent font-medium">
                              Double-click to fill
                            </span>
                          )}
                        </div>
                      )}
                      {field.isRequired && !hasValue && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                      )}
                      {isSenderField && !isSelected && !hasValue && (
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center z-10">
                          <UserCheck className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      {/* Remove signature button on hover */}
                      {hasValue && (field.type === 'signature' || field.type === 'initial' || field.type === 'stamp') && (
                        <button
                          className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-background text-foreground border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlacedFields(prev => prev.map(f => f.id === field.id ? { ...f, value: undefined } : f));
                          }}
                          title="Remove signature"
                        >
                          ×
                        </button>
                      )}
                      {/* Delete field on hover */}
                      <button
                        className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-destructive/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlacedFields(prev => prev.filter(f => f.id !== field.id));
                          if (selectedField === field.id) setSelectedField(null);
                        }}
                        title="Delete field"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      
                      {/* Resize Handles */}
                      {isSelected && (
                        <>
                          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-nw-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')} />
                          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-ne-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')} />
                          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-sw-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')} />
                          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-se-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Sidebar - Field Properties & Summary */}
            <div className="w-64 border-l bg-background p-4 flex flex-col">
              {/* Page Navigation */}
              <Card className="mb-4">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">Page {currentPage} of {totalPages}</span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Selected Field Properties */}
              {selectedField && (
                <Card className="mb-4">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Field Properties</p>
                      <Button variant="ghost" size="icon" onClick={() => confirmDelete(() => deleteSelectedField(), { title: 'Delete field?' })} className="h-7 w-7 text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {(() => {
                      const field = placedFields.find(f => f.id === selectedField);
                      if (!field) return null;
                      return (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Field Type</Label>
                            <Select 
                              value={field.type} 
                              onValueChange={(value) => setPlacedFields(prev => prev.map(f => f.id === field.id ? { ...f, type: value as PlacedField['type'] } : f))}
                            >
                              <SelectTrigger className="h-8 text-sm mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FIELD_TOOLS.map(tool => (
                                  <SelectItem key={tool.id} value={tool.id}>
                                    <div className="flex items-center gap-2">
                                      <tool.icon className="w-3.5 h-3.5" />
                                      <span>{tool.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Assigned To</Label>
                            <Select 
                              value={field.assignedSignerId || ''} 
                              onValueChange={(value) => setPlacedFields(prev => prev.map(f => f.id === field.id ? { ...f, assignedSignerId: value || undefined } : f))}
                            >
                              <SelectTrigger className="h-8 text-sm mt-1">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                {allSigners.map((signer) => (
                                  <SelectItem key={signer.id} value={signer.id}>
                                    {'isSender' in signer && signer.isSender ? 'Me (Sender)' : (signer.name || signer.email)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Required</Label>
                            <Switch 
                              checked={field.isRequired} 
                              onCheckedChange={(checked) => setPlacedFields(prev => prev.map(f => f.id === field.id ? { ...f, isRequired: checked } : f))}
                            />
                          </div>
                          
                          {/* Fill Field Button - Only for sender fields */}
                          {field.assignedSignerId === SENDER_SIGNER_ID && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-2"
                              onClick={() => setEditingField(field)}
                            >
                              <PenTool className="w-3.5 h-3.5 mr-2" />
                              {field.value ? 'Edit Value' : 'Fill Field'}
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Fields Summary */}
              <Card className="flex-1 overflow-auto">
                <CardContent className="py-3">
                  <p className="text-sm font-medium mb-2">Placed Fields ({placedFields.length})</p>
                  {placedFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Select a field type and click on the document to place it
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {placedFields.map((field) => {
                        const Icon = getToolIcon(field.type);
                        const isSenderField = field.assignedSignerId === SENDER_SIGNER_ID;
                        return (
                          <div
                            key={field.id}
                            className={cn(
                              'w-full flex items-center gap-2 p-2 rounded text-left text-xs hover:bg-muted',
                              selectedField === field.id && 'bg-muted'
                            )}
                          >
                            <button
                              className="flex items-center gap-2 flex-1 min-w-0"
                              onClick={() => { setSelectedField(field.id); setCurrentPage(field.pageNumber); }}
                            >
                              {field.value ? (
                                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              ) : (
                                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="capitalize flex-1 truncate">{field.type.replace('_', ' ')}</span>
                              <span className="text-muted-foreground flex-shrink-0">p{field.pageNumber}</span>
                            </button>
                            {isSenderField && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setEditingField(field); }}
                              >
                                <PenTool className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step: Sign Your Fields (Owner signing) — full document preview */}
        {currentStepId === 'sign' && (
          <div 
            className="flex h-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Left sidebar — signing progress */}
            <div className="w-60 border-r bg-card flex flex-col shadow-sm">
              <div className="p-4 border-b bg-gradient-to-r from-accent/10 to-transparent">
                <div className="flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-accent" />
                  <h3 className="font-bold text-sm">Sign Your Fields</h3>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {senderFields.filter(f => !!f.value).length} / {senderFields.length}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-300"
                        style={{ width: `${senderFields.length > 0 ? (senderFields.filter(f => !!f.value).length / senderFields.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Fields list */}
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Your Fields</p>
                  {senderFields.map((field, idx) => {
                    const Icon = getToolIcon(field.type);
                    const hasValue = !!field.value;
                    return (
                      <button
                        key={field.id}
                        className={cn(
                          'w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-xs transition-all',
                          hasValue ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'hover:bg-muted/80 border border-transparent'
                        )}
                        onClick={() => {
                          setCurrentPage(field.pageNumber);
                          if (!hasValue) setEditingField(field);
                        }}
                      >
                        <div className={cn(
                          'w-7 h-7 rounded flex items-center justify-center flex-shrink-0',
                          hasValue ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                        )}>
                          {hasValue ? <Check className="w-4 h-4 text-green-600" /> : <Icon className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium block truncate capitalize">{field.type.replace('_', ' ')} {idx + 1}</span>
                          <span className="text-[10px] text-muted-foreground">Page {field.pageNumber}</span>
                        </div>
                        {!hasValue && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">Sign</Badge>
                        )}
                      </button>
                    );
                  })}

                  {/* Status messages */}
                  {unfilledSenderFields.length > 0 && (
                    <div className="flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="text-[11px]">
                        {unfilledSenderFields.length} field(s) remaining. Double-click a field to sign it. Drag to reposition.
                      </span>
                    </div>
                  )}
                  {senderHasSigned && (
                    <div className="flex items-start gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="text-[11px] font-medium">All fields signed! Click Continue.</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Document Canvas — same as prepare but read-only for placement */}
            <div className="flex-1 overflow-auto p-4 bg-muted/30 flex items-start justify-center">
              <div
                ref={canvasRef}
                className="bg-white shadow-xl relative"
                style={{
                  width: `${containerWidth}px`,
                  height: `${containerHeight}px`,
                  cursor: 'default',
                }}
              >
                {/* Document preview */}
                {fileUrl ? (
                  (() => {
                    const isPdf = mimeType === 'application/pdf' || fileUrl.toLowerCase().includes('.pdf');
                    const isWord = mimeType?.includes('word') || fileUrl.toLowerCase().includes('.doc');

                    if (isPdf) {
                      return (
                        <PdfPageRenderer
                          key={`pdf-sign-${currentPage}-${zoom}`}
                          fileUrl={fileUrl}
                          pageNumber={currentPage}
                          width={containerWidth}
                          height={containerHeight}
                          onPageLoad={(pageWidthPt, pageHeightPt) => {
                            setPdfPageSizes((prev) => ({
                              ...prev,
                              [currentPage]: { width: pageWidthPt, height: pageHeightPt },
                            }));
                          }}
                          onTotalPages={(total) => {
                            if (total > 0) setTotalPages(total);
                          }}
                        />
                      );
                    }

                    if (isWord) {
                      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
                      return (
                        <iframe
                          src={officeViewerUrl}
                          title={documentTitle}
                          className="absolute inset-0 w-full h-full border-0"
                          style={{ backgroundColor: 'white', pointerEvents: 'none' }}
                        />
                      );
                    }

                    return (
                      <img src={fileUrl} alt={documentTitle} className="absolute inset-0 w-full h-full object-contain" style={{ pointerEvents: 'none' }} />
                    );
                  })()
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                    <div className="text-center text-muted-foreground">
                      <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p>{documentTitle}</p>
                    </div>
                  </div>
                )}

                {/* Render ALL fields on this page — sender fields are draggable/resizable & clickable, others are dimmed */}
                {pageFields.map((field) => {
                  const Icon = getToolIcon(field.type);
                  const isSenderField = field.assignedSignerId === SENDER_SIGNER_ID;
                  const isSelected = selectedField === field.id;
                  const hasValue = !!field.value;
                  const displayValue = getFieldDisplayValue(field);

                  return (
                    <div
                      key={field.id}
                      className={cn(
                        'absolute rounded-sm transition-all z-10 group bg-transparent',
                        isSenderField
                          ? hasValue
                            ? 'border-0 cursor-move'
                            : 'border border-emerald-500 cursor-move hover:shadow-lg animate-pulse'
                          : 'border border-muted-foreground/20 opacity-40 pointer-events-none',
                        isSelected && isSenderField && !hasValue && 'ring-1 ring-accent ring-offset-1 z-20',
                      )}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                      }}
                      onMouseDown={(e) => {
                        if (isSenderField) {
                          handleFieldMouseDown(e, field.id);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSenderField) {
                          setSelectedField(field.id);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (isSenderField) setEditingField(field);
                      }}
                    >
                      {hasValue && (field.type === 'signature' || field.type === 'initial') ? (
                        <img 
                          src={field.value} 
                          alt={field.type === 'initial' ? 'Initials' : 'Signature'} 
                          className="absolute inset-0 w-full h-full object-contain p-0.5"
                          style={{ mixBlendMode: 'multiply' }}
                          draggable={false}
                        />
                      ) : hasValue && field.type === 'stamp' ? (
                        <img 
                          src={field.value} 
                          alt="Stamp" 
                          className="absolute inset-0 w-full h-full object-contain p-1"
                          style={{ mixBlendMode: 'multiply' }}
                          draggable={false}
                        />
                      ) : hasValue ? (
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                          {displayValue}
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1 overflow-hidden">
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-[9px] text-muted-foreground/60 truncate max-w-full leading-none capitalize">
                            {field.type.replace('_', ' ')}
                          </span>
                          {isSenderField && !hasValue && (
                            <span className="text-[8px] text-accent font-semibold">Double-click to sign</span>
                          )}
                        </div>
                      )}
                      {/* Remove signature on hover */}
                      {isSenderField && hasValue && (field.type === 'signature' || field.type === 'initial' || field.type === 'stamp') && (
                        <button
                          className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-background text-foreground border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlacedFields(prev => prev.map(f => f.id === field.id ? { ...f, value: undefined } : f));
                            if (selectedField === field.id) setSelectedField(null);
                          }}
                          title="Remove signature"
                        >
                          ×
                        </button>
                      )}
                      {isSenderField && !hasValue && field.isRequired && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                      )}
                      {isSenderField && !isSelected && !hasValue && (
                        <span className="absolute -top-1 -left-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center z-10">
                          <UserCheck className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                      {/* Resize Handles for sender fields */}
                      {isSelected && isSenderField && (
                        <>
                          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-nw-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')} />
                          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-ne-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')} />
                          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-sw-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')} />
                          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-foreground border border-background rounded-sm cursor-se-resize" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right sidebar — page nav */}
            <div className="w-48 border-l bg-background p-4 flex flex-col gap-4">
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">Page {currentPage}/{totalPages}</span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentStepId === 'settings' && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Signing Order */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-accent" />
                  Signing Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    className={cn(
                      'p-4 border rounded-lg text-left transition-colors',
                      settings.signingOrder === 'sequential' && 'border-accent bg-accent/5'
                    )}
                    onClick={() => setSettings(s => ({ ...s, signingOrder: 'sequential' }))}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRight className="w-5 h-5 text-accent" />
                      <span className="font-medium">Sequential</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Recipients sign one after another in order
                    </p>
                  </button>

                  <button
                    className={cn(
                      'p-4 border rounded-lg text-left transition-colors',
                      settings.signingOrder === 'parallel' && 'border-accent bg-accent/5'
                    )}
                    onClick={() => setSettings(s => ({ ...s, signingOrder: 'parallel' }))}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-accent" />
                      <span className="font-medium">Parallel</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      All recipients can sign at the same time
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Expiration & Reminders */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent" />
                  Expiration & Reminders
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Document Expiration</Label>
                    <p className="text-sm text-muted-foreground">Auto-expire if not completed</p>
                  </div>
                  <Select 
                    value={settings.expirationDays.toString()} 
                    onValueChange={(v) => setSettings(s => ({ ...s, expirationDays: parseInt(v) }))}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Send Reminders</Label>
                    <p className="text-sm text-muted-foreground">Automatically remind recipients</p>
                  </div>
                  <Switch
                    checked={settings.reminderEnabled}
                    onCheckedChange={(checked) => setSettings(s => ({ ...s, reminderEnabled: checked }))}
                  />
                </div>

                {settings.reminderEnabled && (
                  <div className="flex items-center justify-between pl-4 border-l-2 border-accent">
                    <Label className="text-sm text-accent">Remind every</Label>
                    <Select 
                      value={settings.reminderDays.toString()} 
                      onValueChange={(v) => setSettings(s => ({ ...s, reminderDays: parseInt(v) }))}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day</SelectItem>
                        <SelectItem value="2">2 days</SelectItem>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="5">5 days</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Custom Message */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-accent" />
                  Custom Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add a personal message to include in the signing request email..."
                  value={settings.customMessage}
                  onChange={(e) => setSettings(s => ({ ...s, customMessage: e.target.value }))}
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Review & Send */}
        {currentStepId === 'review' && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-accent" />
                  Review & Send
                </CardTitle>
                <CardDescription>
                  Review your document settings before sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Document Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Document
                  </h4>
                  <p className="text-sm">{documentTitle}</p>
                </div>

                {/* Recipients Summary */}
                <div>
                  <h4 className="font-medium mb-3">
                    Recipients ({recipients.length > 0 ? recipients.length : 'Self-sign'})
                  </h4>
                  <div className="space-y-2">
                    {recipients.length === 0 ? (
                      <div className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">You (Self-sign)</p>
                          <p className="text-sm text-muted-foreground">{currentUserEmail}</p>
                        </div>
                      </div>
                    ) : (
                      recipients.map((recipient, index) => (
                        <div key={recipient.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {settings.signingOrder === 'sequential' && (
                              <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </span>
                            )}
                            <div>
                              <p className="font-medium">{recipient.name}</p>
                              <p className="text-sm text-muted-foreground">{recipient.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {recipient.role || 'Signer'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Fields Summary */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Fields Placed:</span>
                    <p className="font-medium">{placedFields.length} fields</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Signing Order:</span>
                    <p className="font-medium capitalize">{settings.signingOrder}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Expires in:</span>
                    <p className="font-medium">{settings.expirationDays} days</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <span className="text-muted-foreground">Reminders:</span>
                    <p className="font-medium">
                      {settings.reminderEnabled ? `Every ${settings.reminderDays} day(s)` : 'Disabled'}
                    </p>
                  </div>
                </div>

                {/* Validation Warning */}
                {!canSend && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">
                      {hasSenderFields && !senderHasSigned
                        ? 'You must sign all your required fields before sending. Go back to the "Sign Your Fields" step.'
                        : 'Please add recipients and place signature fields to send the document.'}
                    </span>
                  </div>
                )}

                {/* Sender signed confirmation */}
                {hasSenderFields && senderHasSigned && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">Your fields are signed and ready to send.</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t bg-background px-6 py-4">
        <div className="flex justify-between max-w-4xl mx-auto">
          <Button variant="outline" onClick={handlePrev}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {activeStep === 0 ? 'Back' : 'Previous'}
          </Button>
          
          {activeStep < steps.length - 1 ? (
            <Button 
              onClick={handleNext} 
              className="bg-accent hover:bg-accent/90"
              disabled={
                (currentStepId === 'prepare' && !canProceedFromPrepare) ||
                (currentStepId === 'sign' && !senderHasSigned)
              }
            >
              {currentStepId === 'prepare' && placedFields.length === 0
                ? 'Place at least one field to continue'
                : currentStepId === 'sign' && !senderHasSigned
                  ? `Sign ${unfilledSenderFields.length} field(s) to continue`
                  : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleSend}
              disabled={!canSend}
              className="bg-accent hover:bg-accent/90"
            >
              <Send className="w-4 h-4 mr-2" />
              Prepare & Send
            </Button>
          )}
        </div>
      </div>

      {/* Field Interaction Dialog */}
      {editingField && (
        <FieldInteractionDialog
          open={!!editingField}
          onOpenChange={(open) => !open && setEditingField(null)}
          fieldType={editingField.type}
          currentValue={editingField.value}
          onSave={handleFieldValueSave}
          signerName={currentUserName}
        />
      )}
    </div>
  );
}

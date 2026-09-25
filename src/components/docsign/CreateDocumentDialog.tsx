import { useState } from 'react';
import { Upload, FileText, FileType, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useCreateDocument } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Filename sanitisation per the DocSign spec:
//   * special chars (em dashes, punctuation) → hyphens
//   * spaces → underscores
//   * preserve extension case-normalised to lowercase
//   * cap the stem length so storage keys stay reasonable
function sanitiseFilename(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const stem = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const cleanStem = stem
    .normalize('NFKD')
    .replace(/[‐-―−]/g, '-') // various dashes / minus → hyphen
    .replace(/\s+/g, '_')                    // spaces → underscore
    .replace(/[^a-zA-Z0-9._-]/g, '-')        // anything else → hyphen
    .replace(/-+/g, '-')                     // collapse hyphens
    .replace(/^[-_.]+|[-_.]+$/g, '')         // trim leading/trailing junk
    .slice(0, 80) || 'document';
  return ext ? `${cleanStem}.${ext}` : cleanStem;
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;   // 20 MB per spec

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (documentId: string) => void;
}

// Sorted alphabetically, with "Other" at the end
const DOCUMENT_TYPES = [
  { value: 'agreement', label: 'Agreement' },
  { value: 'authorization', label: 'Authorization Form' },
  { value: 'bill_of_sale', label: 'Bill of Sale' },
  { value: 'contract', label: 'Contract' },
  { value: 'employment_letter', label: 'Employment Letter' },
  { value: 'engagement_letter', label: 'Engagement Letter' },
  { value: 'financial_statements', label: 'Financial Statements' },
  { value: 'form', label: 'Forms' },
  { value: 'internal_approval', label: 'Internal Approval' },
  { value: 'letter', label: 'Letters' },
  { value: 't183_authorization', label: 'T183 - Authorization to File' },
  { value: 'other', label: 'Other' },
];

export function CreateDocumentDialog({ open, onOpenChange, onCreated }: CreateDocumentDialogProps) {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState('contract');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  
  const createDocument = useCreateDocument();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.type.includes('document') || droppedFile.type.startsWith('image/')) {
        setFile(droppedFile);
        if (!title) {
          setTitle(droppedFile.name.replace(/\.[^/.]+$/, ''));
        }
      } else {
        toast.error('Please upload a PDF, document, or image file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const fileToBase64 = (inputFile: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read file data'));
          return;
        }
        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Invalid file data'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(inputFile);
    });

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a document title');
      return;
    }

    setIsUploading(true);

    try {
      let fileUrl: string | null = null;
      let mimeType: string | undefined = file?.type;
      let fileSize: number | undefined = file?.size;

      // Upload/convert file if provided (all documents should end up as PDF)
      if (file) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error('File is larger than 20 MB. Please choose a smaller file.');
          setIsUploading(false);
          return;
        }

        const orgId = organization?.id
          || (typeof window !== 'undefined' ? window.localStorage.getItem('current_organization_id') : null);
        if (!orgId || !user?.id) {
          toast.error('You must be signed in to an organization to upload a document.');
          setIsUploading(false);
          return;
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';

        if (isPdf) {
          // Spec: {org_id}/{user_id}/{timestamp}-{sanitised-filename}
          const safeName = sanitiseFilename(file.name || 'document.pdf');
          const filePath = `${orgId}/${user.id}/${Date.now()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from('docsign-documents')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'application/pdf',
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast.error('Failed to upload file: ' + uploadError.message);
            setIsUploading(false);
            return;
          }

          // Bucket is private — mint a long-lived signed URL (1 year).
          const { data: signedData, error: signedErr } = await supabase.storage
            .from('docsign-documents')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

          if (signedErr || !signedData?.signedUrl) {
            console.error('Signed URL error:', signedErr);
            toast.error('Failed to generate document URL');
            setIsUploading(false);
            return;
          }

          fileUrl = signedData.signedUrl;
          mimeType = 'application/pdf';
        } else {
          toast.info('Converting document to PDF...');
          const base64 = await fileToBase64(file);

          const { data: converted, error: convertError } = await supabase.functions.invoke('file-convert', {
            body: {
              action: 'to-pdf',
              base64,
              fileName: file.name,
            },
          });

          if (convertError || !converted?.success || !converted?.downloadUrl) {
            const message = convertError?.message || converted?.message || 'Could not convert this file to PDF';
            toast.error(message);
            setIsUploading(false);
            return;
          }

          fileUrl = converted.downloadUrl as string;
          mimeType = 'application/pdf';
          fileSize = undefined;
        }
      }

      const newDoc = await createDocument.mutateAsync({
        title: title.trim(),
        document_type: documentType,
        file_url: fileUrl,
        file_size: fileSize,
        mime_type: mimeType,
      });

      setTitle('');
      setDocumentType('contract');
      setFile(null);
      onOpenChange(false);

      // Immediately open the signing workflow so the user can add signers and place fields
      if (newDoc?.id) {
        onCreated?.(newDoc.id);
      }
    } catch (error) {
      console.error('Create document error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to create document: ' + message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDocumentType('contract');
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Create New Document
          </DialogTitle>
          <DialogDescription>
            Upload a document and configure it for electronic signatures
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* File Upload */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 transition-colors min-h-[200px] flex items-center justify-center ${
              dragActive ? 'border-accent bg-accent/5' : 'border-muted-foreground/25'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <FileType className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm break-all" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8"
                  onClick={() => setFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Upload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium text-lg mb-2">Drop your document here</p>
                <p className="text-sm text-muted-foreground mb-3">
                  or click to browse (PDF, DOCX, Images → auto-converted to PDF)
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </div>
            )}
          </div>

          {/* Document Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title *</Label>
            <Input
              id="title"
              placeholder="Enter document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Document Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Document Type</Label>
            <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={typePopoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {DOCUMENT_TYPES.find((type) => type.value === documentType)?.label || "Select document type"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover" align="start">
                <Command>
                  <CommandInput placeholder="Search document types..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>No document type found.</CommandEmpty>
                    <CommandGroup>
                      {DOCUMENT_TYPES.map((type) => (
                        <CommandItem
                          key={type.value}
                          value={type.label}
                          onSelect={() => {
                            setDocumentType(type.value);
                            setTypePopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              documentType === type.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {type.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createDocument.isPending || isUploading || !title.trim()}
            className="bg-accent hover:bg-accent/90"
          >
            {(createDocument.isPending || isUploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isUploading ? 'Uploading...' : createDocument.isPending ? 'Creating...' : 'Create Document'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
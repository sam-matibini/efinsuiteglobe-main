import { useRef, useState } from 'react';
import { Paperclip, Upload, FileText, Image as ImageIcon, Trash2, Download, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useJournalAttachments,
  useUploadJournalAttachment,
  useDeleteJournalAttachment,
  getAttachmentSignedUrl,
  type JournalAttachment,
} from '@/hooks/useJournalAttachments';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  journalEntryId?: string | null;
  organizationId?: string | null;
  readOnly?: boolean;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv';
const MAX_BYTES = 20 * 1024 * 1024;

function formatBytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function iconFor(mime?: string | null) {
  if (mime?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function JournalAttachmentsSection({ journalEntryId, organizationId, readOnly }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { data: attachments = [], isLoading } = useJournalAttachments(journalEntryId);
  const upload = useUploadJournalAttachment();
  const del = useDeleteJournalAttachment();

  if (!journalEntryId) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <Paperclip className="inline h-4 w-4 mr-2" />
        Save the journal entry to attach supporting documents.
      </div>
    );
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || !organizationId) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} exceeds 20MB`);
        continue;
      }
      await upload.mutateAsync({ journalEntryId, organizationId, file });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const open = async (att: JournalAttachment) => {
    try {
      const url = await getAttachmentSignedUrl(att.file_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const download = async (att: JournalAttachment) => {
    try {
      const url = await getAttachmentSignedUrl(att.file_path);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.file_name;
      a.click();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-xs text-muted-foreground">({attachments.length})</span>
          )}
        </div>
      </div>

      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-sm">
            {upload.isPending ? 'Uploading…' : 'Drop receipts, invoices, PDFs, or images here — or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PDF, images, Word, Excel · up to 20MB each</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading attachments…
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
            >
              {iconFor(att.mime_type)}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{att.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(att.file_size)} · {format(new Date(att.created_at), 'MMM d, yyyy p')}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => open(att)} title="Preview">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => download(att)} title="Download">
                <Download className="h-4 w-4" />
              </Button>
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => del.mutate(att)}
                  disabled={del.isPending}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

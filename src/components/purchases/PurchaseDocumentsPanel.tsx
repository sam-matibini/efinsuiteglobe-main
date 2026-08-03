import { useRef, useState } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseAttachmentsSection } from './PurchaseAttachmentsSection';
import type { PurchaseEntityType } from '@/hooks/usePurchaseAttachments';
import {
  STAGED_ACCEPT,
  fileToBase64,
  type useStagedPurchaseAttachments,
} from '@/hooks/useStagedPurchaseAttachments';
import {
  normalizeExtraction,
  type InvoiceExtraction,
} from '@/lib/purchases/invoiceExtraction';

type Staging = ReturnType<typeof useStagedPurchaseAttachments>;

interface Props {
  entityType: PurchaseEntityType;
  entityId?: string | null;
  organizationId?: string | null;
  /** Staging controller from `useStagedPurchaseAttachments` (required for unsaved records). */
  staging?: Staging;
  readOnly?: boolean;
  /** When provided, an "Analyze invoice" button is shown. */
  onExtraction?: (extraction: InvoiceExtraction, summary: string) => void;
  draftContext?: {
    vendor?: string | null;
    reference?: string | null;
    date?: string | null;
    currency?: string | null;
    total?: number | null;
  };
  title?: string;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function PurchaseDocumentsPanel({
  entityType,
  entityId,
  organizationId,
  staging,
  readOnly,
  onExtraction,
  draftContext,
  title = 'Attachments',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const stagedFiles = staging?.staged ?? [];
  const canAnalyze = !!onExtraction && !readOnly && (stagedFiles.length > 0 || !!entityId);

  const analyze = async () => {
    if (!onExtraction) return;
    setAnalyzing(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const token = sessionRes.session?.access_token;
      if (!token) throw new Error('You must be signed in to analyze documents.');

      let payload: Record<string, unknown>;
      if (stagedFiles.length > 0) {
        const analyzable = stagedFiles.filter(
          (s) => s.file.type.startsWith('image/') || s.file.type === 'application/pdf',
        );
        if (analyzable.length === 0) {
          throw new Error('Attach a PDF or image invoice to analyze.');
        }
        if (!organizationId) throw new Error('No organization selected.');
        const files = await Promise.all(
          analyzable.slice(0, 5).map(async (s) => ({
            name: s.file.name,
            mime_type: s.file.type,
            data: await fileToBase64(s.file),
          })),
        );
        payload = {
          mode: 'draft',
          entity_type: entityType,
          organization_id: organizationId,
          draft_context: draftContext ?? {},
          files,
        };
      } else {
        payload = { entity_type: entityType, entity_id: entityId };
      }

      const { data, error } = await supabase.functions.invoke('analyze-purchase-attachments', {
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const extraction = normalizeExtraction((data as any)?.extraction);
      if (!extraction) {
        toast.error('The document could not be read. Try a clearer scan or fill the form manually.');
        return;
      }
      if ((data as any)?.warnings?.length) {
        toast.warning((data as any).warnings.join('; '));
      }
      onExtraction(extraction, (data as any)?.formatted ?? (data as any)?.summary ?? '');
    } catch (e: any) {
      toast.error(e?.message ?? 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-3">
      {entityId ? (
        <PurchaseAttachmentsSection
          entityType={entityType}
          entityId={entityId}
          organizationId={organizationId}
          readOnly={readOnly}
        />
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Paperclip className="h-4 w-4" />
            {title}
            {stagedFiles.length > 0 && (
              <span className="text-xs text-muted-foreground">({stagedFiles.length})</span>
            )}
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
                staging?.add(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={`rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={STAGED_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  staging?.add(e.target.files);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              />
              <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm">
                Drop the invoice, receipt, PDF or image here — or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, images, Word, Excel · up to 20MB each · uploaded when you save
              </p>
            </div>
          )}

          {stagedFiles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents attached yet.</p>
          ) : (
            <div className="space-y-1.5">
              {stagedFiles.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm"
                >
                  {s.file.type.startsWith('image/') ? (
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{s.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(s.file.size)} · pending upload
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => staging?.remove(s.id)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {canAnalyze && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={analyze}
          disabled={analyzing}
          className="w-full sm:w-auto"
        >
          {analyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing document…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" /> Analyze invoice &amp; auto-fill
            </>
          )}
        </Button>
      )}
    </div>
  );
}

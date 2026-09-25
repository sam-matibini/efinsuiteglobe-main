import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, PenTool, Library } from 'lucide-react';
import { SignaturePad } from '@/components/docsign/SignaturePad';
import { useUserSignatures, useSaveSignature } from '@/hooks/useUserSignatures';
import { getSignatureDisplayUrl } from '@/lib/docsign/signatureHelpers';
import {
  useSaveExecutiveSignature,
  type ExecStatementType,
  type ExecSignerRole,
} from '@/hooks/useExecutiveSignatures';
import { cn } from '@/lib/utils';

interface ExecutiveSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statementType: ExecStatementType;
  statementTitle: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  signerName: string;
  signerTitle: string;
  signerRole?: ExecSignerRole;
}

const DEFAULT_CERT =
  'I hereby certify that, to the best of my knowledge, these financial statements present fairly, in all material respects, the financial position and results of operations of the organization for the period indicated.';

export function ExecutiveSignatureDialog({
  open,
  onOpenChange,
  statementType,
  statementTitle,
  periodStart,
  periodEnd,
  periodLabel,
  signerName,
  signerTitle,
  signerRole = 'primary',
}: ExecutiveSignatureDialogProps) {
  const { data: savedSignatures = [] } = useUserSignatures();
  const saveUserSig = useSaveSignature();
  const saveExecSig = useSaveExecutiveSignature();

  const [tab, setTab] = useState<'saved' | 'sign'>(
    savedSignatures.length > 0 ? 'saved' : 'sign',
  );
  const [pickedId, setPickedId] = useState<string | null>(
    savedSignatures.find((s) => s.is_default)?.id ?? savedSignatures[0]?.id ?? null,
  );
  const [padOpen, setPadOpen] = useState(false);
  const [adHocImage, setAdHocImage] = useState<string | null>(null);
  const [adHocType, setAdHocType] = useState<'draw' | 'type' | 'upload'>('draw');
  const [saveAsMine, setSaveAsMine] = useState(true);
  const [editName, setEditName] = useState(signerName);
  const [editTitle, setEditTitle] = useState(signerTitle);
  const [cert, setCert] = useState(DEFAULT_CERT);

  const chosenSaved = savedSignatures.find((s) => s.id === pickedId) || null;
  const previewUrl =
    tab === 'saved' && chosenSaved
      ? getSignatureDisplayUrl(chosenSaved)
      : adHocImage;

  const handleSign = async () => {
    if (!previewUrl) return;
    let imageUrl = previewUrl;

    if (tab === 'sign' && saveAsMine && adHocImage) {
      try {
        const saved = await saveUserSig.mutateAsync({
          signatureData: adHocImage,
          signatureType: adHocType,
          setAsDefault: false,
        });
        // saved.storage_url preferred
        if ((saved as { storage_url?: string }).storage_url) {
          imageUrl = (saved as { storage_url: string }).storage_url;
        }
      } catch {
        /* fall back to inline image */
      }
    }

    await saveExecSig.mutateAsync({
      statementType,
      periodStart,
      periodEnd,
      signerRole,
      signerName: editName.trim() || signerName,
      signerTitle: editTitle.trim() || signerTitle,
      signatureImageUrl: imageUrl,
      certificationText: cert,
    });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-accent" />
              Sign as {signerTitle || 'CEO/President'}
            </DialogTitle>
            <DialogDescription>
              {statementTitle} — {periodLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exec-name">Signer name</Label>
              <Input
                id="exec-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full legal name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exec-title">Title</Label>
              <Input
                id="exec-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="CEO/President"
              />
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="saved" className="gap-2">
                <Library className="w-4 h-4" /> Saved signatures
              </TabsTrigger>
              <TabsTrigger value="sign" className="gap-2">
                <PenTool className="w-4 h-4" /> Sign now
              </TabsTrigger>
            </TabsList>

            <TabsContent value="saved">
              {savedSignatures.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No saved signatures yet. Use “Sign now” to create one.
                </p>
              ) : (
                <ScrollArea className="h-44">
                  <div className="grid grid-cols-2 gap-2 p-1">
                    {savedSignatures.map((sig) => {
                      const url = getSignatureDisplayUrl(sig);
                      return (
                        <button
                          key={sig.id}
                          type="button"
                          onClick={() => setPickedId(sig.id)}
                          className={cn(
                            'rounded border-2 p-2 bg-white flex items-center justify-center h-20 transition-all',
                            pickedId === sig.id
                              ? 'border-accent ring-2 ring-accent/30'
                              : 'border-muted hover:border-accent/50',
                          )}
                        >
                          <img
                            src={url}
                            alt="Signature"
                            className="max-h-full max-w-full object-contain"
                            style={{ mixBlendMode: 'multiply' }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="sign" className="space-y-3">
              <div className="border rounded-lg p-3 bg-white min-h-24 flex items-center justify-center">
                {adHocImage ? (
                  <img
                    src={adHocImage}
                    alt="Signature preview"
                    className="max-h-20 object-contain"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No signature captured yet
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" onClick={() => setPadOpen(true)}>
                  <PenTool className="w-4 h-4 mr-1" />
                  {adHocImage ? 'Re-capture' : 'Draw / type / upload'}
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={saveAsMine}
                    onCheckedChange={(v) => setSaveAsMine(!!v)}
                  />
                  Save to my signatures
                </label>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="exec-cert">Certification statement</Label>
            <Textarea
              id="exec-cert"
              value={cert}
              onChange={(e) => setCert(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSign}
              disabled={!previewUrl || saveExecSig.isPending}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              {saveExecSig.isPending ? 'Signing…' : 'Sign & archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignaturePad
        open={padOpen}
        onOpenChange={setPadOpen}
        signerName={editName}
        fieldType="signature"
        onSave={(data, type) => {
          setAdHocImage(data);
          setAdHocType(type);
        }}
      />
    </>
  );
}

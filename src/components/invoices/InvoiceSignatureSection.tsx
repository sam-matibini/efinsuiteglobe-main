import { useState, useRef, useEffect } from 'react';
import { PenLine, Trash2, Upload, Type, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDefaultSignature, useSaveSignature } from '@/hooks/useUserSignatures';
import { toast } from 'sonner';

interface InvoiceSignatureSectionProps {
  sellerSignature: string | null;
  buyerSignature: string | null;
  buyerName: string;
  onSellerSignatureChange: (sig: string | null) => void;
  onBuyerSignatureChange: (sig: string | null) => void;
  isEditable: boolean;
}

export function InvoiceSignatureSection({
  sellerSignature,
  buyerSignature,
  buyerName,
  onSellerSignatureChange,
  onBuyerSignatureChange,
  isEditable,
}: InvoiceSignatureSectionProps) {
  const { data: defaultSignature } = useDefaultSignature();
  const saveSignature = useSaveSignature();
  const [typedSignature, setTypedSignature] = useState('');
  const [sellerTypedSignature, setSellerTypedSignature] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sellerCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSellerDrawing, setIsSellerDrawing] = useState(false);
  const [showSellerSignatureEditor, setShowSellerSignatureEditor] = useState(false);

  // Auto-load seller's default signature
  useEffect(() => {
    if (defaultSignature && !sellerSignature) {
      onSellerSignatureChange(defaultSignature.signature_data);
    }
  }, [defaultSignature, sellerSignature, onSellerSignatureChange]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isEditable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onBuyerSignatureChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onBuyerSignatureChange(null);
  };

  const applyTypedSignature = () => {
    if (!typedSignature.trim()) return;

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = 'italic 32px "Dancing Script", cursive, serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);

    const dataUrl = canvas.toDataURL('image/png');
    onBuyerSignatureChange(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onBuyerSignatureChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Seller signature drawing functions
  const startSellerDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditable) return;
    const canvas = sellerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsSellerDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const drawSeller = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSellerDrawing || !isEditable) return;
    const canvas = sellerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopSellerDrawing = () => {
    if (!isSellerDrawing) return;
    setIsSellerDrawing(false);
  };

  const applySellerDrawnSignature = () => {
    const canvas = sellerCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onSellerSignatureChange(dataUrl);
      setShowSellerSignatureEditor(false);
    }
  };

  const clearSellerCanvas = () => {
    const canvas = sellerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const applySellerTypedSignature = () => {
    if (!sellerTypedSignature.trim()) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = 'italic 32px "Dancing Script", cursive, serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sellerTypedSignature, canvas.width / 2, canvas.height / 2);
    const dataUrl = canvas.toDataURL('image/png');
    onSellerSignatureChange(dataUrl);
    setShowSellerSignatureEditor(false);
  };

  const handleSellerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onSellerSignatureChange(dataUrl);
      setShowSellerSignatureEditor(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAsDefault = async () => {
    if (!sellerSignature) return;
    try {
      await saveSignature.mutateAsync({
        signatureData: sellerSignature,
        signatureType: 'draw',
        setAsDefault: true,
      });
      toast.success('Signature saved as default');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Seller Signature */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Seller Signature</Label>
          {sellerSignature && isEditable && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveAsDefault}
              disabled={saveSignature.isPending}
            >
              <Save className="w-4 h-4 mr-1" />
              Save as Default
            </Button>
          )}
        </div>
        {sellerSignature && !showSellerSignatureEditor ? (
          <div className="space-y-2">
            <div className="border rounded-lg p-4 bg-muted/30">
              <img 
                src={sellerSignature} 
                alt="Seller signature" 
                className="max-h-20 mx-auto"
              />
            </div>
            {isEditable && (
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowSellerSignatureEditor(true)}
                >
                  <PenLine className="w-4 h-4 mr-1" />
                  Change
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => onSellerSignatureChange(null)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        ) : isEditable ? (
          <Tabs defaultValue="draw" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="draw">
                <PenLine className="w-4 h-4 mr-1" />
                Draw
              </TabsTrigger>
              <TabsTrigger value="type">
                <Type className="w-4 h-4 mr-1" />
                Type
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="space-y-2">
              <div className="border rounded-lg bg-white">
                <canvas
                  ref={sellerCanvasRef}
                  width={400}
                  height={100}
                  className="w-full cursor-crosshair"
                  onMouseDown={startSellerDrawing}
                  onMouseMove={drawSeller}
                  onMouseUp={stopSellerDrawing}
                  onMouseLeave={stopSellerDrawing}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearSellerCanvas}>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
                <Button type="button" size="sm" onClick={applySellerDrawnSignature}>
                  Apply Signature
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="type" className="space-y-2">
              <Input
                value={sellerTypedSignature}
                onChange={(e) => setSellerTypedSignature(e.target.value)}
                placeholder="Type your signature..."
                className="italic text-xl"
                style={{ fontFamily: '"Dancing Script", cursive, serif' }}
              />
              <Button type="button" size="sm" onClick={applySellerTypedSignature}>
                Apply Signature
              </Button>
            </TabsContent>

            <TabsContent value="upload" className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleSellerFileUpload}
              />
              <p className="text-xs text-muted-foreground">Upload an image of your signature</p>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/10">
            <PenLine className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No seller signature set.</p>
            <p className="text-xs">Set your default signature in Settings → Signature.</p>
          </div>
        )}
      </Card>

      {/* Buyer Signature */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">
          Buyer Signature {buyerName && `(${buyerName})`}
        </Label>

        {buyerSignature ? (
          <div className="space-y-2">
            <div className="border rounded-lg p-4 bg-muted/30">
              <img 
                src={buyerSignature} 
                alt="Buyer signature" 
                className="max-h-20 mx-auto"
              />
            </div>
            {isEditable && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => onBuyerSignatureChange(null)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
        ) : isEditable ? (
          <Tabs defaultValue="draw" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="draw">
                <PenLine className="w-4 h-4 mr-1" />
                Draw
              </TabsTrigger>
              <TabsTrigger value="type">
                <Type className="w-4 h-4 mr-1" />
                Type
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-1" />
                Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="draw" className="space-y-2">
              <div className="border rounded-lg bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={100}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </TabsContent>

            <TabsContent value="type" className="space-y-2">
              <Input
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
                placeholder="Type your signature..."
                className="italic text-xl"
                style={{ fontFamily: '"Dancing Script", cursive, serif' }}
              />
              <Button type="button" variant="outline" size="sm" onClick={applyTypedSignature}>
                Apply Signature
              </Button>
            </TabsContent>

            <TabsContent value="upload" className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
              />
              <p className="text-xs text-muted-foreground">Upload an image of your signature</p>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/10">
            <PenLine className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No buyer signature provided.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

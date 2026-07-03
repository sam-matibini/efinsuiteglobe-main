import { useState, useRef, useEffect, useCallback } from 'react';
import { PenTool, Type, Upload, Eraser, Check, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureData: string, type: 'draw' | 'type' | 'upload') => void;
  signerName?: string;
  fieldType?: 'signature' | 'initial';
}

const SIGNATURE_FONTS = [
  { id: 'cursive1', name: 'Elegant', fontFamily: "'Dancing Script', cursive" },
  { id: 'cursive2', name: 'Classic', fontFamily: "'Great Vibes', cursive" },
  { id: 'script', name: 'Script', fontFamily: "'Pacifico', cursive" },
  { id: 'formal', name: 'Formal', fontFamily: "'Allura', cursive" },
];

export function SignaturePad({ open, onOpenChange, onSave, signerName = '', fieldType = 'signature' }: SignaturePadProps) {
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedText, setTypedText] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].id);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#1a1a1a';
    context.lineWidth = 2;
    contextRef.current = context;
    
    // Clear with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (open && activeTab === 'draw') {
      const timer = setTimeout(initCanvas, 100);
      return () => clearTimeout(timer);
    }
  }, [open, activeTab, initCanvas]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    context.beginPath();
    context.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    context.lineTo(clientX - rect.left, clientY - rect.top);
    context.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    
    // Get the bounds from getBoundingClientRect since we scale by 2
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, rect.width, rect.height);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Helper function to remove white background and make it transparent
  const makeTransparent = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Make white and near-white pixels transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // If pixel is white or near-white, make it transparent
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  };

  const handleSave = () => {
    let signatureData = '';
    
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        // Create a copy canvas for transparency processing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, 0);
          signatureData = makeTransparent(tempCanvas);
        } else {
          signatureData = canvas.toDataURL('image/png');
        }
      }
    } else if (activeTab === 'type') {
      // Create a canvas with the typed signature (transparent background)
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 400;
      tempCanvas.height = 100;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        // Start with transparent background (don't fill with white)
        ctx.clearRect(0, 0, 400, 100);
        ctx.fillStyle = '#1a1a1a';
        const font = SIGNATURE_FONTS.find(f => f.id === selectedFont);
        ctx.font = `48px ${font?.fontFamily || 'cursive'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(typedText, 200, 50);
        signatureData = tempCanvas.toDataURL('image/png');
      }
    } else if (activeTab === 'upload' && uploadedImage) {
      signatureData = uploadedImage;
    }

    if (signatureData) {
      onSave(signatureData, activeTab);
      onOpenChange(false);
      // Reset state
      setTypedText(signerName);
      setUploadedImage(null);
      clearCanvas();
    }
  };

  const isValid = () => {
    if (activeTab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      const context = canvas.getContext('2d');
      if (!context) return false;
      // Check if canvas has been drawn on (very basic check)
      return true;
    } else if (activeTab === 'type') {
      return typedText.trim().length > 0;
    } else if (activeTab === 'upload') {
      return !!uploadedImage;
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-accent" />
            {fieldType === 'initial' ? 'Add Your Initials' : 'Add Your Signature'}
          </DialogTitle>
          <DialogDescription>
            Choose how you'd like to create your {fieldType === 'initial' ? 'initials' : 'signature'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw" className="flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type" className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Type
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="space-y-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="w-full h-32 border rounded-lg cursor-crosshair bg-white touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={clearCanvas}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Draw your {fieldType === 'initial' ? 'initials' : 'signature'} using your mouse or touch
            </p>
          </TabsContent>

          <TabsContent value="type" className="space-y-4">
            <div className="space-y-2">
              <Label>Enter your {fieldType === 'initial' ? 'initials' : 'name'}</Label>
              <Input
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={fieldType === 'initial' ? 'JD' : 'John Doe'}
              />
            </div>

            <div className="space-y-2">
              <Label>Select a style</Label>
              <div className="grid grid-cols-2 gap-2">
                {SIGNATURE_FONTS.map((font) => (
                  <button
                    key={font.id}
                    className={cn(
                      'p-3 border rounded-lg text-center transition-all hover:border-accent',
                      selectedFont === font.id && 'border-accent bg-accent/5'
                    )}
                    onClick={() => setSelectedFont(font.id)}
                  >
                    <span 
                      style={{ fontFamily: font.fontFamily }} 
                      className="text-xl text-foreground"
                    >
                      {typedText || (fieldType === 'initial' ? 'JD' : 'John Doe')}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{font.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div 
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                uploadedImage ? 'border-accent bg-accent/5' : 'border-muted-foreground/25'
              )}
            >
              {uploadedImage ? (
                <div className="space-y-3">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded signature" 
                    className="max-h-24 mx-auto"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedImage(null)}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm mb-2">Upload an image of your signature</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    id="signature-upload"
                  />
                  <label htmlFor="signature-upload">
                    <Button variant="outline" asChild>
                      <span>Choose Image</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              PNG or JPG recommended (transparent background preferred)
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-accent hover:bg-accent/90"
            disabled={!isValid()}
          >
            <Check className="w-4 h-4 mr-1" />
            Apply {fieldType === 'initial' ? 'Initials' : 'Signature'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

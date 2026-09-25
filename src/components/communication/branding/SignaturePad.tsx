import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check, X, Undo2 } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPoint = useRef<Point | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Set canvas size based on container
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      
      // Save initial state
      const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialState]);
    }
  }, []);

  const getPoint = useCallback((e: React.TouchEvent | React.MouseEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, []);

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;

    setIsDrawing(true);
    lastPoint.current = point;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  }, [getPoint]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getPoint(e);
    if (!point) return;

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && lastPoint.current) {
      // Draw smooth line
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      
      lastPoint.current = point;
      setHasDrawn(true);
    }
  }, [isDrawing, getPoint]);

  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPoint.current = null;

      // Save to history for undo
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        const state = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory(prev => [...prev, state]);
      }
    }
  }, [isDrawing]);

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const newHistory = history.slice(0, -1);
    const prevState = newHistory[newHistory.length - 1];
    
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
      setHistory(newHistory);
      setHasDrawn(newHistory.length > 1);
    }
  }, [history]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    
    // Reset history
    const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialState]);
    setHasDrawn(false);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    // Create a temporary canvas to get the signature with transparent background
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Copy the canvas content
    tempCtx.drawImage(canvas, 0, 0);

    // Get image data and make white pixels transparent
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // If pixel is white or near-white, make it transparent
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    // Get the bounding box of the signature to crop
    let minX = tempCanvas.width;
    let minY = tempCanvas.height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < tempCanvas.height; y++) {
      for (let x = 0; x < tempCanvas.width; x++) {
        const idx = (y * tempCanvas.width + x) * 4;
        if (data[idx + 3] > 0) { // Non-transparent pixel
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add some padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(tempCanvas.width, maxX + padding);
    maxY = Math.min(tempCanvas.height, maxY + padding);

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) {
      return;
    }

    // Create final cropped canvas
    const finalCanvas = document.createElement('canvas');
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;

    finalCanvas.width = width;
    finalCanvas.height = height;
    finalCtx.drawImage(tempCanvas, minX, minY, width, height, 0, 0, width, height);

    const dataUrl = finalCanvas.toDataURL('image/png');
    onSave(dataUrl);
  }, [hasDrawn, onSave]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-2">
        Draw your signature below using your finger or stylus
      </div>
      
      <div 
        ref={containerRef}
        className="w-full h-48 border-2 border-dashed rounded-lg overflow-hidden touch-none"
        style={{
          backgroundImage: 'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#ffffff'
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={history.length <= 1}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={!hasDrawn}
          >
            <Eraser className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!hasDrawn}
            className="bg-accent hover:bg-accent/90"
          >
            <Check className="h-4 w-4 mr-1" />
            Use Signature
          </Button>
        </div>
      </div>
    </div>
  );
}

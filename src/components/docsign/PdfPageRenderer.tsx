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
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Store callbacks in refs to avoid re-running the render effect
  const onPageLoadRef = useRef(onPageLoad);
  const onTotalPagesRef = useRef(onTotalPages);
  useEffect(() => { onPageLoadRef.current = onPageLoad; }, [onPageLoad]);
  useEffect(() => { onTotalPagesRef.current = onTotalPages; }, [onTotalPages]);

  useEffect(() => {
    let isMounted = true;
    
    const loadAndRenderPdf = async () => {
      if (!fileUrl || !canvasRef.current) return;
      
      try {
        setLoading(true);
        setError(null);

        // Cancel any ongoing render
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        // Load PDF document (cache it)
        if (!pdfDocRef.current) {
          const loadingTask = pdfjsLib.getDocument({
            url: fileUrl,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
          });
          pdfDocRef.current = await loadingTask.promise;
          
          if (pdfDocRef.current) {
            onTotalPagesRef.current?.(pdfDocRef.current.numPages);
          }
        }

        const pdfDoc = pdfDocRef.current;
        if (!pdfDoc || !isMounted) return;

        // Get the page
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted) return;

        // Get the viewport at scale 1
        const unscaledViewport = page.getViewport({ scale: 1 });
        
        // Report PDF page dimensions
        onPageLoadRef.current?.(unscaledViewport.width, unscaledViewport.height);

        // IMPORTANT: The caller should size the container to the PDF page aspect ratio.
        // Use width-based scaling so the rendered page and overlay share the same origin/scale.
        const scale = width / unscaledViewport.width;
        
        const viewport = page.getViewport({ scale });

        // Set canvas dimensions
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Use device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        // Ensure a clean transform each render
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        // Render the page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException' && isMounted) {
          console.error('PDF render error:', err);
          setError(err.message || 'Failed to render PDF');
          setLoading(false);
        }
      }
    };

    loadAndRenderPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [fileUrl, pageNumber, width, height]);

  // Cleanup PDF document on unmount or URL change
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [fileUrl]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading page...</span>
          </div>
        </div>
      )}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0"
      />
    </>
  );
}

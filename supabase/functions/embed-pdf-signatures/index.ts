import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DocumentField {
  id: string;
  field_type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  page_number: number;
  filled_value: string | null;
  pdf_page_width_pt: number | null;
  pdf_page_height_pt: number | null;
}

interface RequestPayload {
  documentId: string;
  fields?: DocumentField[];
}

// Convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Fetch image from URL (storage or external) and return base64
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = encodeBase64(arrayBuffer);
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'image/png';
    const format = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' : 'png';
    
    return `data:image/${format};base64,${base64}`;
  } catch (error) {
    console.error('[fetchImageAsBase64] Error:', error);
    return null;
  }
}

// Get effective page dimensions accounting for rotation
// pdf-lib's getSize() returns unrotated dimensions, but pdfjs renders with rotation applied
// The UI uses pdfjs-rendered dimensions, so we must match that
function getEffectivePageSize(page: any): { width: number; height: number } {
  const { width, height } = page.getSize();
  const rotation = page.getRotation?.()?.angle ?? 0;
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

// Convert percentage coordinates to PDF points
// UI stores coordinates as percentages of the container (top-left origin)
// PDF uses points with bottom-left origin
function percentToPdfCoords(
  percentX: number,
  percentY: number,
  widthPercent: number,
  heightPercent: number,
  pageWidth: number,
  pageHeight: number,
  rotation: number = 0
) {
  // Convert percentages to the visual coordinate space
  const visualX = (percentX / 100) * pageWidth;
  const visualWidth = (widthPercent / 100) * pageWidth;
  const visualHeight = (heightPercent / 100) * pageHeight;
  const visualTopFromTop = (percentY / 100) * pageHeight;

  // For unrotated pages, map directly: visual Y (top-down) -> PDF Y (bottom-up)
  // For rotated pages, we need to transform coordinates
  let x: number, y: number, width: number, height: number;

  if (rotation === 0 || rotation === 180) {
    x = visualX;
    width = visualWidth;
    height = visualHeight;
    y = pageHeight - visualTopFromTop - height;
  } else if (rotation === 90) {
    // Page is rotated 90° CW: visual width maps to unrotated height and vice versa
    // In the rotated view, the user sees (pageHeight x pageWidth) but pdf-lib uses (pageWidth x pageHeight)
    // Visual (x, y) in rotated space -> PDF (y_from_bottom, x_from_left) in unrotated space
    x = visualTopFromTop;
    y = visualX;
    width = visualHeight;
    height = visualWidth;
  } else if (rotation === 270) {
    x = pageWidth - visualTopFromTop - visualHeight;
    y = pageHeight - visualX - visualWidth;
    width = visualHeight;
    height = visualWidth;
  } else {
    // Fallback: treat as no rotation
    x = visualX;
    width = visualWidth;
    height = visualHeight;
    y = pageHeight - visualTopFromTop - height;
  }

  console.log(`[coord-debug] Input: (${percentX.toFixed(2)}%, ${percentY.toFixed(2)}%) size ${widthPercent.toFixed(2)}%x${heightPercent.toFixed(2)}%`);
  console.log(`[coord-debug] Page: ${pageWidth}x${pageHeight}pt, rotation: ${rotation}°`);
  console.log(`[coord-debug] Output: x=${x.toFixed(2)}, y=${y.toFixed(2)}, w=${width.toFixed(2)}, h=${height.toFixed(2)}`);

  return { x, y, width, height };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: RequestPayload = await req.json();
    const { documentId, fields: requestFields } = payload;

    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[embed-pdf-signatures] Processing document: ${documentId}`);

    // Fetch the document
    const { data: document, error: docErr } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .maybeSingle();

    if (docErr || !document) {
      console.error("Document lookup error:", docErr);
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const fileUrl = document.file_url;
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "Document has no file URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if it's a PDF
    const isPdf = (document.mime_type || "").toLowerCase().includes("pdf") ||
                  fileUrl.toLowerCase().endsWith(".pdf");
    
    if (!isPdf) {
      console.log("Document is not a PDF, returning original file URL");
      return new Response(JSON.stringify({ 
        success: true, 
        downloadUrl: fileUrl,
        message: "Non-PDF document - returning original file"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let fields: DocumentField[] = [];

    if (Array.isArray(requestFields) && requestFields.length > 0) {
      fields = requestFields
        .filter((f): f is DocumentField => !!f && typeof f === "object")
        .filter((f) => !!f.filled_value);
      console.log(`[embed-pdf-signatures] Using ${fields.length} filled fields from request payload`);
    } else {
      // Fetch all filled fields for this document
      const { data: dbFields, error: fieldsErr } = await supabase
        .from("document_fields")
        .select("*")
        .eq("document_id", documentId)
        .not("filled_value", "is", null);

      if (fieldsErr) {
        console.error("Fields lookup error:", fieldsErr);
        return new Response(JSON.stringify({ error: "Failed to fetch fields" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      fields = (dbFields || []) as DocumentField[];
      console.log(`[embed-pdf-signatures] Found ${fields.length} filled fields in database`);
    }

    // Fetch the PDF from storage (no CORS issues server-side)
    let pdfBytes: Uint8Array;
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBytes = new Uint8Array(arrayBuffer);
      console.log(`[embed-pdf-signatures] Fetched PDF, ${pdfBytes.length} bytes`);
    } catch (fetchError) {
      console.error("PDF fetch error:", fetchError);
      return new Response(JSON.stringify({ 
        error: "Failed to fetch PDF file",
        details: String(fetchError)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify it's actually a PDF
    const headerText = new TextDecoder().decode(pdfBytes.slice(0, 5));
    if (headerText !== "%PDF-") {
      console.error("File is not a valid PDF");
      return new Response(JSON.stringify({ 
        success: true,
        downloadUrl: fileUrl,
        message: "File is not a valid PDF - returning original"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    console.log(`[embed-pdf-signatures] PDF has ${pages.length} pages`);

    // Group fields by page
    const fieldsByPage = new Map<number, DocumentField[]>();
    for (const field of (fields || [])) {
      const pageNum = field.page_number || 1;
      const existing = fieldsByPage.get(pageNum) || [];
      existing.push(field as DocumentField);
      fieldsByPage.set(pageNum, existing);
    }

    // Embed each field
    for (const [pageNumber, pageFields] of fieldsByPage.entries()) {
      const pageIndex = pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn(`Page ${pageNumber} out of range, skipping`);
        continue;
      }

      const page = pages[pageIndex];
      const rawSize = page.getSize();
      const rotation = page.getRotation?.()?.angle ?? 0;
      const { width: pageWidth, height: pageHeight } = getEffectivePageSize(page);

      console.log(`[embed-pdf-signatures] Processing page ${pageNumber}: ${pageWidth}x${pageHeight}pt (raw: ${rawSize.width}x${rawSize.height}, rotation: ${rotation}°), ${pageFields.length} fields`);

      for (const field of pageFields) {
        try {
          // Use stored PDF page dimensions if available (from pdfjs renderer)
          // Fall back to effective page size from pdf-lib
          const refWidth = field.pdf_page_width_pt || pageWidth;
          const refHeight = field.pdf_page_height_pt || pageHeight;

          const coords = percentToPdfCoords(
            field.position_x,
            field.position_y,
            field.width,
            field.height,
            refWidth,
            refHeight,
            rotation
          );

          const { x, y, width: fieldWidth, height: fieldHeight } = coords;

          console.log(`[embed-pdf-signatures] Field ${field.field_type}: position (${field.position_x.toFixed(2)}%, ${field.position_y.toFixed(2)}%) -> PDF (${x.toFixed(2)}, ${y.toFixed(2)}) ${fieldWidth.toFixed(2)}x${fieldHeight.toFixed(2)}pt (ref: ${refWidth}x${refHeight})`);

          // Handle image-based fields (signature, initial, stamp)
          if (field.field_type === "signature" || field.field_type === "initial" || field.field_type === "stamp") {
            let imageData = field.filled_value || "";
            
            // Check if it's a storage URL (not base64) and fetch it
            if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
              console.log(`[embed-pdf-signatures] Fetching signature from storage URL for field ${field.id}`);
              const fetchedData = await fetchImageAsBase64(imageData);
              if (fetchedData) {
                imageData = fetchedData;
              } else {
                console.warn(`[embed-pdf-signatures] Failed to fetch signature from storage, skipping field ${field.id}`);
                continue;
              }
            }
            
            const base64Match = imageData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
            
            if (base64Match) {
              const [, format, base64Data] = base64Match;
              const imageBytes = base64ToUint8Array(base64Data);
              
              let image;
              try {
                if (format === "png") {
                  image = await pdfDoc.embedPng(imageBytes);
                } else {
                  image = await pdfDoc.embedJpg(imageBytes);
                }
              } catch (embedErr) {
                // Try the other format as fallback
                console.warn(`Failed to embed as ${format}, trying fallback:`, embedErr);
                try {
                  image = format === "png" 
                    ? await pdfDoc.embedJpg(imageBytes) 
                    : await pdfDoc.embedPng(imageBytes);
                } catch (fallbackErr) {
                  console.error(`Failed to embed image for field ${field.id}:`, fallbackErr);
                  continue;
                }
              }

              page.drawImage(image, {
                x,
                y,
                width: fieldWidth,
                height: fieldHeight,
              });
              console.log(`[embed-pdf-signatures] Embedded ${field.field_type} image`);
            } else {
              console.warn(`Invalid image data for ${field.field_type} field ${field.id}`);
            }
          }
          // Handle checkbox fields
          else if (field.field_type === "checkbox") {
            if (field.filled_value === "true") {
              const checkSize = Math.min(fieldWidth, fieldHeight) * 0.7;
              const centerX = x + fieldWidth / 2;
              const centerY = y + fieldHeight / 2;
              
              // Draw checkmark as two lines
              page.drawLine({
                start: { x: centerX - checkSize / 3, y: centerY },
                end: { x: centerX - checkSize / 8, y: centerY - checkSize / 3 },
                thickness: 2,
                color: rgb(0, 0.5, 0),
              });
              page.drawLine({
                start: { x: centerX - checkSize / 8, y: centerY - checkSize / 3 },
                end: { x: centerX + checkSize / 2.5, y: centerY + checkSize / 2.5 },
                thickness: 2,
                color: rgb(0, 0.5, 0),
              });
              console.log(`[embed-pdf-signatures] Embedded checkbox`);
            }
          }
          // Handle text-based fields
          else if (field.filled_value) {
            const fontSize = Math.max(8, Math.min(14, fieldHeight * 0.6));
            const textValue = String(field.filled_value);
            const textY = y + (fieldHeight - fontSize) / 2;
            
            page.drawText(textValue, {
              x: x + 4,
              y: textY,
              size: fontSize,
              font,
              color: rgb(0, 0, 0),
              maxWidth: fieldWidth - 8,
            });
            console.log(`[embed-pdf-signatures] Embedded text: "${textValue.substring(0, 20)}..."`);
          }
        } catch (fieldError) {
          console.error(`Error embedding field ${field.id}:`, fieldError);
        }
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    console.log(`[embed-pdf-signatures] Modified PDF: ${modifiedPdfBytes.length} bytes`);

    // Always include a base64 payload so the frontend can reliably download
    // even when storage URLs are private / blocked.
    const pdfArrayBuffer = modifiedPdfBytes.buffer.slice(
      modifiedPdfBytes.byteOffset,
      modifiedPdfBytes.byteOffset + modifiedPdfBytes.byteLength,
    ) as ArrayBuffer;
    const pdfBase64 = encodeBase64(pdfArrayBuffer);

    // Upload to storage with a unique name
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const signedFileName = `owner_signed_${documentId}_${timestamp}.pdf`;
    const storagePath = `signed/${signedFileName}`;

    // Try docsign-documents bucket first (primary), fallback to documents
    let uploadBucket = "docsign-documents";
    let uploadError: any = null;
    
    const { error: err1 } = await supabase.storage
      .from("docsign-documents")
      .upload(storagePath, modifiedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    
    if (err1) {
      console.warn("docsign-documents upload failed, trying documents bucket:", err1);
      uploadBucket = "documents";
      const { error: err2 } = await supabase.storage
        .from("documents")
        .upload(storagePath, modifiedPdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      uploadError = err2;
    }

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ 
        success: true,
        pdfBase64,
        fieldsEmbedded: fields?.length || 0,
        message: "PDF processed; storage upload failed, using base64 download."
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prefer a signed URL (works even for private buckets)
    const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
      .from(uploadBucket)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year for owner-signed docs

    if (signedUrlErr) {
      console.warn("Signed URL error (falling back to public URL):", signedUrlErr);
    }

    const { data: urlData } = supabase.storage.from(uploadBucket).getPublicUrl(storagePath);
    const downloadUrl = signedUrlData?.signedUrl || urlData.publicUrl;

    console.log(`[embed-pdf-signatures] Uploaded to: ${storagePath}`);

    // Audit log
    await supabase.from("document_audit_logs").insert({
      document_id: documentId,
      action: "document_downloaded_with_signatures",
      actor_type: "system",
      details: { 
        fields_embedded: fields?.length || 0,
        storage_path: storagePath
      },
    });

    return new Response(JSON.stringify({ 
      success: true,
      downloadUrl,
      pdfBase64,
      fieldsEmbedded: fields?.length || 0,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err) {
    console.error("embed-pdf-signatures error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

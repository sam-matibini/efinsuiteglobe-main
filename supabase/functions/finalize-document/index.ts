import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { encode as encodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";
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
}

interface RequestPayload {
  documentId: string;
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

// Get effective page dimensions accounting for rotation
function getEffectivePageSize(page: any): { width: number; height: number } {
  const { width, height } = page.getSize();
  const rotation = page.getRotation?.()?.angle ?? 0;
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width };
  }
  return { width, height };
}

// Convert percentage coordinates to PDF points
function percentToPdfCoords(
  percentX: number,
  percentY: number,
  widthPercent: number,
  heightPercent: number,
  pageWidth: number,
  pageHeight: number,
  rotation: number = 0
) {
  const visualX = (percentX / 100) * pageWidth;
  const visualWidth = (widthPercent / 100) * pageWidth;
  const visualHeight = (heightPercent / 100) * pageHeight;
  const visualTopFromTop = (percentY / 100) * pageHeight;

  let x: number, y: number, width: number, height: number;

  if (rotation === 0 || rotation === 180) {
    x = visualX;
    width = visualWidth;
    height = visualHeight;
    y = pageHeight - visualTopFromTop - height;
  } else if (rotation === 90) {
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
    x = visualX;
    width = visualWidth;
    height = visualHeight;
    y = pageHeight - visualTopFromTop - height;
  }

  return { x, y, width, height };
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { documentId }: RequestPayload = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[finalize-document] Processing document: ${documentId}`);

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

    // Check if all signers have signed
    const { data: signers, error: signersErr } = await supabase
      .from("document_signers")
      .select("id, status, email, name")
      .eq("document_id", documentId);

    if (signersErr) {
      console.error("Signers lookup error:", signersErr);
      return new Response(JSON.stringify({ error: "Failed to fetch signers" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const allSigned = (signers || []).every((s) => s.status === "signed");
    
    if (!allSigned) {
      const pendingSigners = (signers || []).filter((s) => s.status !== "signed");
      console.log(`[finalize-document] Not all signers have signed. Pending: ${pendingSigners.map(s => s.email).join(', ')}`);
      return new Response(JSON.stringify({ 
        error: "Not all signers have signed yet",
        pendingSigners: pendingSigners.map(s => ({ email: s.email, status: s.status }))
      }), {
        status: 400,
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
      console.log("[finalize-document] Document is not a PDF, marking as completed without flattening");
      await supabase
        .from("documents")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString() 
        })
        .eq("id", documentId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Non-PDF document marked as completed"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch all fields for this document (including unfilled for locking)
    const { data: fields, error: fieldsErr } = await supabase
      .from("document_fields")
      .select("*")
      .eq("document_id", documentId);

    if (fieldsErr) {
      console.error("Fields lookup error:", fieldsErr);
      return new Response(JSON.stringify({ error: "Failed to fetch fields" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const filledFields = (fields || []).filter(f => f.filled_value);
    console.log(`[finalize-document] Total fields: ${(fields || []).length}, filled: ${filledFields.length}`);
    for (const f of filledFields) {
      const valPreview = (f.filled_value || '').substring(0, 80);
      console.log(`[finalize-document] Field ${f.id}: type=${f.field_type}, signer=${f.assigned_signer_id}, valueLen=${(f.filled_value||'').length}, preview=${valPreview}`);
    }

    // Fetch the PDF
    let pdfBytes: Uint8Array;
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBytes = new Uint8Array(arrayBuffer);
      console.log(`[finalize-document] Fetched PDF, ${pdfBytes.length} bytes`);
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

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    console.log(`[finalize-document] PDF has ${pages.length} pages`);

    // Group fields by page
    const fieldsByPage = new Map<number, DocumentField[]>();
    for (const field of filledFields) {
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

      console.log(`[finalize-document] Processing page ${pageNumber}: ${pageWidth}x${pageHeight}pt (rotation: ${rotation}°), ${pageFields.length} fields`);

      for (const field of pageFields) {
        try {
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

          // Handle image-based fields
          if (field.field_type === "signature" || field.field_type === "initial" || field.field_type === "stamp") {
            let imageData = field.filled_value || "";
            
            // Check if it's a storage URL (not base64)
            if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
              console.log(`[finalize-document] Fetching signature from storage URL`);
              const fetchedData = await fetchImageAsBase64(imageData);
              if (fetchedData) {
                imageData = fetchedData;
              } else {
                console.warn(`[finalize-document] Failed to fetch signature from storage, skipping field ${field.id}`);
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
              console.log(`[finalize-document] Embedded ${field.field_type} image`);
            }
          }
          // Handle checkbox fields
          else if (field.field_type === "checkbox") {
            if (field.filled_value === "true") {
              const checkSize = Math.min(fieldWidth, fieldHeight) * 0.7;
              const centerX = x + fieldWidth / 2;
              const centerY = y + fieldHeight / 2;
              
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
          }
        } catch (fieldError) {
          console.error(`Error embedding field ${field.id}:`, fieldError);
        }
      }
    }

    // Save the flattened PDF
    const flattenedPdfBytes = await pdfDoc.save();
    console.log(`[finalize-document] Flattened PDF: ${flattenedPdfBytes.length} bytes`);

    // Compute SHA-256 hash for legal integrity
    const hashBuffer = await crypto.subtle.digest('SHA-256', flattenedPdfBytes.buffer.slice(
      flattenedPdfBytes.byteOffset,
      flattenedPdfBytes.byteOffset + flattenedPdfBytes.byteLength
    ) as ArrayBuffer);
    const documentHash = new TextDecoder().decode(encodeHex(new Uint8Array(hashBuffer)));
    console.log(`[finalize-document] Document SHA-256: ${documentHash}`);

    // Upload flattened PDF to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const signedFileName = `finalized_${documentId}_${timestamp}.pdf`;
    const storagePath = `signed/${signedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("docsign-documents")
      .upload(storagePath, flattenedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      // Continue even if upload fails - we can still mark as completed
    }

    // Get signed URL for the flattened PDF
    let signedPdfUrl: string | null = null;
    if (!uploadError) {
      const { data: signedUrlData } = await supabase.storage
        .from("docsign-documents")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      signedPdfUrl = signedUrlData?.signedUrl || null;
      
      if (!signedPdfUrl) {
        const { data: publicUrlData } = supabase.storage.from("docsign-documents").getPublicUrl(storagePath);
        signedPdfUrl = publicUrlData.publicUrl;
      }
    }

    // Update document status to completed
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        signed_pdf_url: signedPdfUrl,
        document_hash: documentHash,
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Document update error:", updateError);
    }

    // Create audit log entry
    await supabase.from("document_audit_logs").insert({
      document_id: documentId,
      action: "document_finalized",
      actor_type: "system",
      details: {
        fields_embedded: filledFields.length,
        storage_path: storagePath,
        document_hash: documentHash,
        signers: (signers || []).map(s => ({ email: s.email, name: s.name })),
        finalized_at: new Date().toISOString(),
      },
    });

    // === Generate Certificate of Completion ===
    let certificateUrl: string | null = null;
    try {
      console.log(`[finalize-document] Generating Certificate of Completion`);
      const certDoc = await PDFDocument.create();
      const certPage = certDoc.addPage([612, 792]); // Letter size
      const certFont = await certDoc.embedFont(StandardFonts.Helvetica);
      const certFontBold = await certDoc.embedFont(StandardFonts.HelveticaBold);
      const black = rgb(0, 0, 0);
      const gray = rgb(0.4, 0.4, 0.4);
      const accent = rgb(0.12, 0.25, 0.69); // #1e40af

      let yPos = 720;

      // Title
      certPage.drawText("CERTIFICATE OF COMPLETION", {
        x: 50, y: yPos, size: 22, font: certFontBold, color: accent,
      });
      yPos -= 10;
      certPage.drawLine({
        start: { x: 50, y: yPos }, end: { x: 562, y: yPos },
        thickness: 2, color: accent,
      });
      yPos -= 30;

      // Document info
      const drawLabel = (label: string, value: string) => {
        certPage.drawText(label, { x: 50, y: yPos, size: 10, font: certFontBold, color: gray });
        certPage.drawText(value, { x: 180, y: yPos, size: 10, font: certFont, color: black });
        yPos -= 18;
      };

      drawLabel("Document Title:", document.title || "Untitled");
      drawLabel("Document ID:", documentId);
      drawLabel("Completed At:", new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" }));
      drawLabel("Fields Signed:", `${filledFields.length} of ${(fields || []).length}`);
      yPos -= 10;

      // Signers section
      certPage.drawText("SIGNERS", {
        x: 50, y: yPos, size: 14, font: certFontBold, color: accent,
      });
      yPos -= 8;
      certPage.drawLine({
        start: { x: 50, y: yPos }, end: { x: 562, y: yPos },
        thickness: 1, color: rgb(0.8, 0.8, 0.8),
      });
      yPos -= 20;

      // Table header
      certPage.drawText("Name / Email", { x: 50, y: yPos, size: 9, font: certFontBold, color: gray });
      certPage.drawText("Status", { x: 320, y: yPos, size: 9, font: certFontBold, color: gray });
      certPage.drawText("Signed At", { x: 400, y: yPos, size: 9, font: certFontBold, color: gray });
      yPos -= 16;

      // Fetch full signer details with timestamps
      const { data: fullSigners } = await supabase
        .from("document_signers")
        .select("name, email, status, signed_at")
        .eq("document_id", documentId)
        .order("signing_order", { ascending: true });

      for (const s of fullSigners || []) {
        const displayName = s.name ? `${s.name} (${s.email})` : s.email;
        certPage.drawText(displayName.substring(0, 45), { x: 50, y: yPos, size: 9, font: certFont, color: black });
        certPage.drawText(s.status || "unknown", { x: 320, y: yPos, size: 9, font: certFont, color: s.status === "signed" ? rgb(0, 0.5, 0) : gray });
        certPage.drawText(
          s.signed_at ? new Date(s.signed_at).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—",
          { x: 400, y: yPos, size: 9, font: certFont, color: black }
        );
        yPos -= 16;
      }

      yPos -= 20;

      // Integrity section
      certPage.drawText("DOCUMENT INTEGRITY", {
        x: 50, y: yPos, size: 14, font: certFontBold, color: accent,
      });
      yPos -= 8;
      certPage.drawLine({
        start: { x: 50, y: yPos }, end: { x: 562, y: yPos },
        thickness: 1, color: rgb(0.8, 0.8, 0.8),
      });
      yPos -= 20;

      certPage.drawText("SHA-256 Hash:", { x: 50, y: yPos, size: 9, font: certFontBold, color: gray });
      yPos -= 14;
      certPage.drawText(documentHash, { x: 50, y: yPos, size: 8, font: certFont, color: black });
      yPos -= 30;

      // Footer
      certPage.drawText("This certificate confirms that all parties listed above have electronically signed the document.", {
        x: 50, y: yPos, size: 9, font: certFont, color: gray,
      });
      yPos -= 14;
      certPage.drawText("The document's integrity can be verified using the SHA-256 hash above.", {
        x: 50, y: yPos, size: 9, font: certFont, color: gray,
      });
      yPos -= 24;
      certPage.drawText("Powered by eFinsuite Globe DocSign", {
        x: 50, y: yPos, size: 8, font: certFont, color: rgb(0.6, 0.6, 0.6),
      });

      const certBytes = await certDoc.save();

      // Upload certificate
      const certPath = `certificates/cert_${documentId}_${timestamp}.pdf`;
      const { error: certUploadErr } = await supabase.storage
        .from("documents")
        .upload(certPath, certBytes, { contentType: "application/pdf", upsert: true });

      if (!certUploadErr) {
        const { data: certUrlData } = supabase.storage.from("documents").getPublicUrl(certPath);
        certificateUrl = certUrlData.publicUrl;
        console.log(`[finalize-document] Certificate uploaded: ${certificateUrl}`);

        // Store certificate URL in document metadata
        const existingMeta = document.metadata || {};
        await supabase
          .from("documents")
          .update({
            metadata: { ...(typeof existingMeta === 'object' ? existingMeta : {}), certificateUrl },
          })
          .eq("id", documentId);
      } else {
        console.error("Certificate upload error:", certUploadErr);
      }
    } catch (certErr) {
      console.error("[finalize-document] Certificate generation error (non-blocking):", certErr);
    }

    console.log(`[finalize-document] Document finalized successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      signedPdfUrl,
      certificateUrl,
      documentHash,
      fieldsEmbedded: filledFields.length,
      message: "Document finalized and flattened successfully"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err) {
    console.error("finalize-document error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

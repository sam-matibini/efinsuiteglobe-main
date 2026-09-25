// bake-signed-pdf
// Overlays all filled field values (text, signatures, checkboxes) onto
// the original PDF and saves the result as documents.signed_pdf_url.
//
// Called internally by on-sign-complete when all signers have signed.
// Uses pdf-lib to draw on the PDF without any external service.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function b64ToUint8Array(b64: string): Uint8Array {
  const raw = b64.includes(',') ? b64.split(',')[1] : b64;
  return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const body = await req.json().catch(() => ({})) as { document_id?: string };
  if (!body.document_id) return json({ error: 'document_id required' }, 400);
  const documentId = body.document_id;

  // Load document
  const { data: doc } = await admin
    .from('documents')
    .select('id, title, organization_id, file_url')
    .eq('id', documentId)
    .single();
  if (!doc?.file_url) return json({ error: 'Document or file URL not found' }, 404);

  // Load all fields
  const { data: fields } = await admin
    .from('document_fields')
    .select('id, field_type, page_number, position_x, position_y, width, height, filled_value')
    .eq('document_id', documentId);

  // Load all signature images (keyed by field_id, null field_id = free signature)
  const { data: signatures } = await admin
    .from('document_signatures')
    .select('id, field_id, signer_id, image_base64')
    .eq('document_id', documentId);

  // Build field_id -> base64 map
  const sigByField = new Map<string | null, string>();
  for (const sig of signatures ?? []) {
    if (sig.image_base64) sigByField.set(sig.field_id, sig.image_base64);
  }

  // Fetch original PDF
  const pdfRes = await fetch(doc.file_url);
  if (!pdfRes.ok) return json({ error: `Could not fetch PDF: ${pdfRes.status}` }, 500);
  const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch (e) {
    return json({ error: `Could not parse PDF: ${e instanceof Error ? e.message : e}` }, 500);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageCount = pdfDoc.getPageCount();

  // ── Overlay each field that has a value ─────────────────────────────────────
  for (const field of fields ?? []) {
    const hasImage = sigByField.has(field.id);
    const hasText = !!field.filled_value;
    if (!hasImage && !hasText) continue;

    const pageIdx = (field.page_number ?? 1) - 1;
    if (pageIdx < 0 || pageIdx >= pageCount) continue;

    const page = pdfDoc.getPage(pageIdx);
    const { width: pw, height: ph } = page.getSize();

    const x = (field.position_x / 100) * pw;
    const fw = (field.width / 100) * pw;
    const fh = (field.height / 100) * ph;
    // PDF Y origin is bottom-left; our UI Y origin is top-left — flip it
    const y = ph - (field.position_y / 100) * ph - fh;

    const ft = field.field_type;

    if ((ft === 'signature' || ft === 'initial' || ft === 'stamp') && hasImage) {
      try {
        const imgBytes = b64ToUint8Array(sigByField.get(field.id)!);
        let img;
        try { img = await pdfDoc.embedPng(imgBytes); }
        catch { img = await pdfDoc.embedJpg(imgBytes); }
        page.drawImage(img, { x, y, width: fw, height: fh });
      } catch (e) {
        console.warn(`bake: could not embed image for field ${field.id}:`, e);
      }
    } else if (hasText && (ft === 'text' || ft === 'full_name' || ft === 'date')) {
      const fontSize = Math.max(6, Math.min(fh * 0.62, 13));
      try {
        page.drawText(field.filled_value!, {
          x: x + 2,
          y: y + (fh - fontSize) * 0.35,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: fw - 4,
        });
      } catch (e) {
        console.warn(`bake: could not draw text for field ${field.id}:`, e);
      }
    } else if (ft === 'checkbox' && field.filled_value === 'checked') {
      const sz = Math.min(fh, fw) * 0.7;
      try {
        page.drawText('X', {
          x: x + (fw - sz * 0.55) / 2,
          y: y + (fh - sz) / 2,
          size: sz,
          font,
          color: rgb(0, 0, 0),
        });
      } catch (e) {
        console.warn(`bake: could not draw checkbox for field ${field.id}:`, e);
      }
    }
  }

  // ── Free signatures (no assigned field) — placed at bottom of last page ─────
  const freeSigs = (signatures ?? []).filter(s => s.field_id === null && s.image_base64);
  if (freeSigs.length > 0) {
    const lastPage = pdfDoc.getPage(pageCount - 1);
    const { width: pw, height: ph } = lastPage.getSize();
    const sigW = pw * 0.28;
    const sigH = sigW * 0.28;
    const margin = 36;
    let xOff = margin;

    for (const sig of freeSigs) {
      try {
        const imgBytes = b64ToUint8Array(sig.image_base64);
        let img;
        try { img = await lastPage.doc.embedPng(imgBytes); }
        catch { img = await lastPage.doc.embedJpg(imgBytes); }

        lastPage.drawImage(img, { x: xOff, y: margin + 16, width: sigW, height: sigH });

        // Thin rule above signature
        lastPage.drawLine({
          start: { x: xOff, y: margin + 14 },
          end: { x: xOff + sigW, y: margin + 14 },
          thickness: 0.5,
          color: rgb(0.6, 0.6, 0.6),
        });

        lastPage.drawText('Electronically signed', {
          x: xOff,
          y: margin,
          size: 7,
          font,
          color: rgb(0.5, 0.5, 0.5),
          maxWidth: sigW,
        });

        xOff += sigW + margin;
        if (xOff + sigW > pw - margin) break; // don't overflow page
      } catch (e) {
        console.warn('bake: could not embed free signature:', e);
      }
    }
  }

  // ── Save and upload ──────────────────────────────────────────────────────────
  const bakedBytes = await pdfDoc.save();
  const storagePath = `${doc.organization_id}/${documentId}/signed.pdf`;

  const { error: uploadErr } = await admin.storage
    .from('docsign-documents')
    .upload(storagePath, bakedBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) return json({ error: `Storage upload failed: ${uploadErr.message}` }, 500);

  const { data: signedUrlData } = await admin.storage
    .from('docsign-documents')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  if (!signedUrlData?.signedUrl) return json({ error: 'Could not generate download URL' }, 500);

  await admin.from('documents')
    .update({ signed_pdf_url: signedUrlData.signedUrl })
    .eq('id', documentId);

  return json({ success: true, url: signedUrlData.signedUrl });
});

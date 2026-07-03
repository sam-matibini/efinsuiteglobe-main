import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, documentId } = await req.json();
    
    if (!fileUrl || !documentId) {
      return new Response(
        JSON.stringify({ error: 'Missing fileUrl or documentId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing PDF for document ${documentId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the original PDF
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const pdfBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

    // Compute SHA-256 hash of the original document for legal integrity
    const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer);
    const documentHash = new TextDecoder().decode(encodeHex(new Uint8Array(hashBuffer)));
    console.log(`Document SHA-256: ${documentHash}`);

    // Use pdf-lib to get page count only (FAST - no page splitting)
    const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
    
    let pageCount = 1;
    let hasXfa = false;
    
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
      hasXfa = false;
      
      console.log(`PDF has ${pageCount} pages`);
    } catch (pdfError) {
      console.error('PDF loading error:', pdfError);
      // Default to 1 page if loading fails
      pageCount = 1;
    }

    // Generate preview URLs using original PDF with page fragments
    // This is MUCH faster than splitting pages - modern PDF viewers handle #page=N
    const previewUrls: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      previewUrls.push(`${fileUrl}#page=${i}`);
    }

    // Update document with page info and hash
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        document_hash: documentHash,
        metadata: {
          pageCount,
          hasXfa,
          previewUrls,
          flattenedAt: new Date().toISOString(),
        }
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document metadata:', updateError);
    }

    console.log(`Successfully processed document with ${pageCount} pages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pageCount,
        hasXfa,
        previewUrls,
        message: `PDF processed successfully. ${pageCount} pages detected.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process PDF',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

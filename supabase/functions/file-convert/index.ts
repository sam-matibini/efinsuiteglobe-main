import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let fileData: Uint8Array;
    let fileName: string;
    let action: 'to-pdf' | 'from-pdf' | 'analyze';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      action = (formData.get('action') as string) as 'to-pdf' | 'from-pdf' | 'analyze' || 'analyze';
      
      if (!file) {
        return new Response(
          JSON.stringify({ error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      fileName = file.name;
      fileData = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json();
      action = body.action || 'analyze';
      
      if (body.fileUrl) {
        const response = await fetch(body.fileUrl);
        fileData = new Uint8Array(await response.arrayBuffer());
        fileName = body.fileName || 'file';
      } else if (body.base64) {
        fileData = Uint8Array.from(atob(body.base64), c => c.charCodeAt(0));
        fileName = body.fileName || 'file';
      } else {
        return new Response(
          JSON.stringify({ error: 'No file data provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
    const timestamp = Date.now();
    const baseName = fileName.replace(/\.[^/.]+$/, '');

    // Analyze file type
    const isPdf = fileExt === 'pdf';
    const isExcel = ['xlsx', 'xls'].includes(fileExt);
    const isCsv = fileExt === 'csv';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
    const isDoc = ['doc', 'docx'].includes(fileExt);
    const isText = ['txt', 'md', 'json', 'xml'].includes(fileExt);

    let result: {
      success: boolean;
      originalFile: string;
      convertedFile?: string;
      downloadUrl?: string;
      fileType: string;
      pageCount?: number;
      extractedText?: string;
      excelData?: Record<string, unknown>[];
      message: string;
    };

    if (action === 'analyze') {
      // Just analyze and return file info
      let extractedText = '';
      let excelData: Record<string, unknown>[] = [];
      let pageCount = 1;

      if (isPdf) {
        try {
          const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
          const pdfDoc = await PDFDocument.load(fileData, { ignoreEncryption: true });
          pageCount = pdfDoc.getPageCount();
        } catch (e) {
          console.error('PDF analysis failed:', e);
        }
      } else if (isExcel || isCsv) {
        try {
          // Use xlsx library for Excel/CSV parsing
          const XLSX = await import('https://esm.sh/xlsx@0.18.5');
          const workbook = XLSX.read(fileData, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          excelData = XLSX.utils.sheet_to_json(firstSheet) as Record<string, unknown>[];
          extractedText = `Spreadsheet with ${excelData.length} rows and ${Object.keys(excelData[0] || {}).length} columns`;
        } catch (e) {
          console.error('Excel/CSV analysis failed:', e);
        }
      } else if (isText) {
        extractedText = new TextDecoder().decode(fileData);
      }

      // Upload original file
      const originalPath = `ai-uploads/${timestamp}-${fileName}`;
      await supabase.storage.from('docsign-documents').upload(originalPath, fileData, {
        contentType: getContentType(fileExt),
        upsert: true,
      });

      const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(originalPath);

      result = {
        success: true,
        originalFile: fileName,
        downloadUrl: urlData.publicUrl,
        fileType: fileExt,
        pageCount: isPdf ? pageCount : undefined,
        extractedText: extractedText.slice(0, 5000),
        excelData: excelData.slice(0, 100),
        message: `File "${fileName}" uploaded and analyzed successfully`,
      };
    } else if (action === 'to-pdf') {
      // Convert file to PDF
      const { PDFDocument, rgb, StandardFonts } = await import('https://esm.sh/pdf-lib@1.17.1');

      const wrapText = (text: string, maxChars = 95): string[] => {
        const paragraphs = text.split(/\n+/);
        const wrapped: string[] = [];

        for (const paragraph of paragraphs) {
          const words = paragraph.trim().split(/\s+/).filter(Boolean);
          if (words.length === 0) {
            wrapped.push('');
            continue;
          }

          let currentLine = '';
          for (const word of words) {
            const candidate = currentLine ? `${currentLine} ${word}` : word;
            if (candidate.length <= maxChars) {
              currentLine = candidate;
            } else {
              if (currentLine) wrapped.push(currentLine);
              currentLine = word;
            }
          }
          if (currentLine) wrapped.push(currentLine);
        }

        return wrapped.length > 0 ? wrapped : [''];
      };

      if (isPdf) {
        // Already PDF, just upload
        const path = `ai-uploads/${timestamp}-${fileName}`;
        await supabase.storage.from('docsign-documents').upload(path, fileData, {
          contentType: 'application/pdf',
          upsert: true,
        });
        const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(path);

        result = {
          success: true,
          originalFile: fileName,
          convertedFile: fileName,
          downloadUrl: urlData.publicUrl,
          fileType: 'pdf',
          message: 'File is already a PDF',
        };
      } else if (isDoc) {
        if (fileExt !== 'docx') {
          result = {
            success: false,
            originalFile: fileName,
            fileType: fileExt,
            message: 'Legacy .doc files are not supported. Please upload .docx or PDF.',
          };
        } else {
          try {
            const JSZip = await import('https://esm.sh/jszip@3.10.1');
            const zip = await JSZip.default.loadAsync(fileData);
            const docXmlFile = zip.file('word/document.xml');

            if (!docXmlFile) {
              throw new Error('Could not read DOCX contents');
            }

            const docXml = await docXmlFile.async('text');
            const textContent = docXml
              .replace(/<w:p[^>]*>/g, '\n')
              .replace(/<w:tab\/>/g, '\t')
              .replace(/<w:br\/>/g, '\n')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\n{3,}/g, '\n\n')
              .trim();

            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const lines = wrapText(textContent || '[Empty Word document]');
            const linesPerPage = 46;
            const fontSize = 11;
            const lineHeight = 15;
            const margin = 50;

            for (let i = 0; i < lines.length; i += linesPerPage) {
              const page = pdfDoc.addPage([612, 792]);
              const pageLines = lines.slice(i, i + linesPerPage);
              let y = 792 - margin;

              for (const line of pageLines) {
                page.drawText(line.slice(0, 120), {
                  x: margin,
                  y,
                  size: fontSize,
                  font,
                  color: rgb(0, 0, 0),
                });
                y -= lineHeight;
              }
            }

            const pdfBytes = await pdfDoc.save();
            const pdfPath = `ai-uploads/${timestamp}-${baseName}.pdf`;

            await supabase.storage.from('docsign-documents').upload(pdfPath, pdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            });

            const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(pdfPath);

            result = {
              success: true,
              originalFile: fileName,
              convertedFile: `${baseName}.pdf`,
              downloadUrl: urlData.publicUrl,
              fileType: 'pdf',
              pageCount: pdfDoc.getPageCount(),
              message: 'Converted DOCX to PDF successfully',
            };
          } catch (docxError) {
            console.error('DOCX conversion failed:', docxError);
            result = {
              success: false,
              originalFile: fileName,
              fileType: fileExt,
              message: 'Failed to convert DOCX to PDF',
            };
          }
        }
      } else if (isText || isCsv) {
        // Convert text/CSV to PDF
        const textContent = new TextDecoder().decode(fileData);
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Courier);
        
        const lines = wrapText(textContent, 100);
        const linesPerPage = 50;
        const fontSize = 10;
        const margin = 50;

        for (let i = 0; i < lines.length; i += linesPerPage) {
          const page = pdfDoc.addPage([612, 792]); // Letter size
          const pageLines = lines.slice(i, i + linesPerPage);
          
          let y = 792 - margin;
          for (const line of pageLines) {
            page.drawText(line.slice(0, 120), { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
            y -= fontSize * 1.5;
          }
        }

        const pdfBytes = await pdfDoc.save();
        const pdfPath = `ai-uploads/${timestamp}-${baseName}.pdf`;
        
        await supabase.storage.from('docsign-documents').upload(pdfPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });
        
        const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(pdfPath);

        result = {
          success: true,
          originalFile: fileName,
          convertedFile: `${baseName}.pdf`,
          downloadUrl: urlData.publicUrl,
          fileType: 'pdf',
          pageCount: pdfDoc.getPageCount(),
          message: `Converted ${fileExt.toUpperCase()} to PDF successfully`,
        };
      } else if (isExcel) {
        // Convert Excel to PDF (table format)
        const XLSX = await import('https://esm.sh/xlsx@0.18.5');
        const workbook = XLSX.read(fileData, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
        
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const fontSize = 8;
        const margin = 40;
        const rowHeight = 15;
        const colWidth = 100;
        const rowsPerPage = 45;

        for (let pageStart = 0; pageStart < jsonData.length; pageStart += rowsPerPage) {
          const page = pdfDoc.addPage([792, 612]); // Landscape
          const pageRows = jsonData.slice(pageStart, pageStart + rowsPerPage);
          
          let y = 612 - margin;
          
          pageRows.forEach((row, rowIndex) => {
            let x = margin;
            row.forEach((cell, colIndex) => {
              if (colIndex < 7) { // Max 7 columns
                const isHeader = pageStart === 0 && rowIndex === 0;
                const cellText = String(cell || '').slice(0, 15);
                page.drawText(cellText, {
                  x,
                  y,
                  size: fontSize,
                  font: isHeader ? boldFont : font,
                  color: rgb(0, 0, 0),
                });
                x += colWidth;
              }
            });
            y -= rowHeight;
          });
        }

        const pdfBytes = await pdfDoc.save();
        const pdfPath = `ai-uploads/${timestamp}-${baseName}.pdf`;
        
        await supabase.storage.from('docsign-documents').upload(pdfPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });
        
        const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(pdfPath);

        result = {
          success: true,
          originalFile: fileName,
          convertedFile: `${baseName}.pdf`,
          downloadUrl: urlData.publicUrl,
          fileType: 'pdf',
          pageCount: pdfDoc.getPageCount(),
          message: `Converted Excel to PDF with ${jsonData.length} rows`,
        };
      } else if (isImage) {
        try {
          const pdfDoc = await PDFDocument.create();
          let image;

          if (fileExt === 'jpg' || fileExt === 'jpeg') {
            image = await pdfDoc.embedJpg(fileData);
          } else if (fileExt === 'png') {
            image = await pdfDoc.embedPng(fileData);
          } else {
            throw new Error('Unsupported image format for PDF conversion');
          }

          const page = pdfDoc.addPage([612, 792]);
          const maxWidth = 612 - 80;
          const maxHeight = 792 - 80;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          const drawX = (612 - drawWidth) / 2;
          const drawY = (792 - drawHeight) / 2;

          page.drawImage(image, { x: drawX, y: drawY, width: drawWidth, height: drawHeight });

          const pdfBytes = await pdfDoc.save();
          const pdfPath = `ai-uploads/${timestamp}-${baseName}.pdf`;

          await supabase.storage.from('docsign-documents').upload(pdfPath, pdfBytes, {
            contentType: 'application/pdf',
            upsert: true,
          });

          const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(pdfPath);

          result = {
            success: true,
            originalFile: fileName,
            convertedFile: `${baseName}.pdf`,
            downloadUrl: urlData.publicUrl,
            fileType: 'pdf',
            pageCount: 1,
            message: `Converted ${fileExt.toUpperCase()} image to PDF successfully`,
          };
        } catch (imageError) {
          console.error('Image conversion failed:', imageError);
          result = {
            success: false,
            originalFile: fileName,
            fileType: fileExt,
            message: `Cannot convert ${fileExt.toUpperCase()} to PDF. Supported image formats: JPG, JPEG, PNG`,
          };
        }
      } else {
        result = {
          success: false,
          originalFile: fileName,
          fileType: fileExt,
          message: `Cannot convert ${fileExt.toUpperCase()} to PDF. Supported: DOCX, TXT, CSV, XLSX, JPG, JPEG, PNG`,
        };
      }
    } else if (action === 'from-pdf') {
      // Extract from PDF to text/CSV
      if (!isPdf) {
        result = {
          success: false,
          originalFile: fileName,
          fileType: fileExt,
          message: 'File must be a PDF for this conversion',
        };
      } else {
        // Extract text from PDF (basic extraction)
        const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1');
        const pdfDoc = await PDFDocument.load(fileData, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();
        
        // Note: pdf-lib doesn't extract text - we'd need a different library
        // For now, provide the PDF info and suggest text might need manual extraction
        
        const txtContent = `PDF Document Analysis\n${'='.repeat(40)}\nFile: ${fileName}\nPages: ${pageCount}\n\nNote: Text extraction from PDF requires OCR or text-layer parsing.\nThis PDF has ${pageCount} page(s).`;
        
        const txtPath = `ai-uploads/${timestamp}-${baseName}.txt`;
        const encoder = new TextEncoder();
        
        await supabase.storage.from('docsign-documents').upload(txtPath, encoder.encode(txtContent), {
          contentType: 'text/plain',
          upsert: true,
        });
        
        const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(txtPath);

        result = {
          success: true,
          originalFile: fileName,
          convertedFile: `${baseName}.txt`,
          downloadUrl: urlData.publicUrl,
          fileType: 'txt',
          pageCount,
          message: `PDF info extracted. Full text extraction requires additional processing.`,
        };
      }
    } else {
      result = {
        success: false,
        originalFile: fileName,
        fileType: fileExt,
        message: 'Invalid action. Use: analyze, to-pdf, or from-pdf',
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('File conversion error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'File conversion failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[ext] || 'application/octet-stream';
}

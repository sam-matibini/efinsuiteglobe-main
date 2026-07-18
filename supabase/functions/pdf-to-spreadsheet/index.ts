import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe base64 encoder
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

type Cell = string | number | null;
interface ExtractedRow { [key: string]: Cell }
interface Sheet { name: string; columns: string[]; rows: ExtractedRow[] }

const MAX_PDF_SIZE_MB = 20;
const MAX_PDF_SIZE_BYTES = MAX_PDF_SIZE_MB * 1024 * 1024;
// Lovable AI Gateway enforces a ~75s upstream idle limit per request. We slice
// the PDF into small page batches and process a few batches in parallel so
// 20-page statements can complete inside the edge function wall-clock budget.
const PAGES_PER_BATCH = 3;
const MAX_PARALLEL_BATCHES = 3;
const EDGE_RESPONSE_BUDGET_MS = 220_000;
const AI_REQUEST_TIMEOUT_MS = 65_000;
const RESPONSE_BUFFER_MS = 10_000;
const MIN_AI_CALL_MS = 15_000;

type PdfBatch = { base64: string; from: number; to: number; totalPages: number };

type AiCallResult =
  | { ok: true; args: any; raw: string }
  | { ok: false; reason: 'timeout' | 'failed' | 'empty'; message?: string };

// Split a PDF into batches of N pages. Returns the base64 of each slice plus
// the (1-indexed) page range it represents.
async function sliceIntoBatches(
  pdfBytes: Uint8Array,
  pagesPerBatch: number,
): Promise<PdfBatch[]> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const totalPages = src.getPageCount();
  const batches: PdfBatch[] = [];
  for (let start = 0; start < totalPages; start += pagesPerBatch) {
    const end = Math.min(start + pagesPerBatch, totalPages);
    const out = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const copied = await out.copyPages(src, indices);
    for (const p of copied) out.addPage(p);
    const bytes = await out.save();
    batches.push({
      base64: bytesToBase64(bytes),
      from: start + 1,
      to: end,
      totalPages,
    });
  }
  return batches;
}

// Regex for summary rows that must never appear as transactions
const SUMMARY_ROW_PATTERNS = [
  /^\s*opening\s+balance/i,
  /^\s*closing\s+balance/i,
  /^\s*previous\s+balance/i,
  /^\s*new\s+balance/i,
  /^\s*beginning\s+balance/i,
  /^\s*ending\s+balance/i,
  /^\s*statement\s+(total|summary)/i,
  /^\s*period\s+total/i,
  /^\s*total\s+(deposits?|credits?|cheques?|debits?|withdrawals?|fees?|charges?|payments?|interest)/i,
  /^\s*(sub)?total\s+(for|of)\b/i,
  /^\s*account\s+summary/i,
];

function isSummaryRow(desc: unknown): boolean {
  if (typeof desc !== 'string') return false;
  return SUMMARY_ROW_PATTERNS.some((re) => re.test(desc));
}

function parseNum(v: unknown): number {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v !== 'string') return 0;
  let s = v.trim();
  if (!s) return 0;
  // (123.45) -> -123.45
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$£€¥,\s]/g, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return neg ? -n : n;
}

const STATEMENT_TOOL = {
  type: 'function',
  function: {
    name: 'submit_bank_statement_extraction',
    description: 'Submit fully validated bank or credit-card statement data extracted from the PDF.',
    parameters: {
      type: 'object',
      properties: {
        documentType: {
          type: 'string',
          enum: ['bank_statement', 'credit_card_statement'],
        },
        statementPeriodStart: { type: 'string', description: 'YYYY-MM-DD, period start as printed on the statement.' },
        statementPeriodEnd:   { type: 'string', description: 'YYYY-MM-DD, period end as printed on the statement.' },
        openingBalance:       { type: 'number' },
        closingBalance:       { type: 'number' },
        totalDebits:          { type: 'number', description: 'Printed "Total cheques & debits" / "Total withdrawals" — positive number.' },
        totalCredits:         { type: 'number', description: 'Printed "Total deposits & credits" — positive number.' },
        transactions: {
          type: 'array',
          description: 'ONE entry per posted transaction line. EXCLUDE opening balance, closing balance, and any "Total ..." summary row.',
          items: {
            type: 'object',
            properties: {
              date:        { type: 'string', description: 'YYYY-MM-DD' },
              description: { type: 'string' },
              payer_payee: { type: 'string', description: 'Cleaned counterparty name extracted from the description. For credits/deposits/payments this is the PAYER; for debits/charges this is the PAYEE. Strip trailing reference numbers, city/state, transaction IDs, POS codes, and card suffixes. Use the recognizable merchant/person/institution name only. Leave empty ("") ONLY for rows like INTEREST, BANK FEE, or truly unidentifiable entries.' },
              reference:   { type: 'string' },
              debit:       { type: 'number', description: 'Money OUT (cheques, debits, withdrawals, fees, CC charges). Always positive. 0 if not a debit.' },
              credit:      { type: 'number', description: 'Money IN (deposits, credits, CC payments). Always positive. 0 if not a credit.' },
              balance:     { type: 'number', description: 'Running balance as printed (omit/0 if blank).' },
            },
            required: ['date', 'description', 'debit', 'credit'],
            additionalProperties: false,
          },
        },
      },
      required: ['documentType', 'transactions'],
      additionalProperties: false,
    },
  },
} as const;

const GENERIC_TOOL = {
  type: 'function',
  function: {
    name: 'submit_generic_table_extraction',
    description: 'Submit extracted tables that are not bank/credit-card statements.',
    parameters: {
      type: 'object',
      properties: {
        sheets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:    { type: 'string' },
              columns: { type: 'array', items: { type: 'string' } },
              rows:    { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
            required: ['name', 'columns', 'rows'],
          },
        },
      },
      required: ['sheets'],
    },
  },
} as const;

const STATEMENT_PROMPT = `You are extracting transactions from a BANK or CREDIT CARD statement PDF.

Call the tool \`submit_bank_statement_extraction\` exactly once with the full result.

HARD RULES — read carefully:

1. FIRST, identify the amount-column layout of the statement:
   (a) TWO-COLUMN layout: separate "Debit/Withdrawals/Cheques" and "Credit/Deposits" columns. Position under the header is the ONLY truth — never infer side from sign, description, or guessing.
   (b) SINGLE-COLUMN layout (common on credit-card statements like RBC Avion Visa, Amex): one "AMOUNT ($)" column with SIGNED values. Negative amounts mean money IN (payments to the card, refunds, credits). Positive amounts mean money OUT (charges, fees, interest). In this layout, ALSO scan the description: rows containing "PAYMENT", "PAIEMENT", "THANK YOU", "MERCI", "AUTOPAY", "BILL PAYMENT", "TRANSFER TO CARD" are payments/credits regardless of the sign the model perceives.
2. Each transaction line maps to EXACTLY ONE of \`debit\` or \`credit\`. The other side MUST be 0. Both values must be POSITIVE numbers (no negatives, no parentheses). For credit-card statements: put payments/refunds/credit-memo rows in \`credit\`; put purchases/fees/interest in \`debit\`.
3. EXCLUDE every summary line: "Opening balance", "Closing balance", "Previous statement balance", "New balance", "Total deposits & credits", "Total cheques & debits", "Total fees", "Subtotal of monthly activity", "Period total", "Statement total". Put those into the top-level \`openingBalance\`, \`closingBalance\`, \`totalDebits\`, \`totalCredits\` fields instead. They must NOT appear inside \`transactions\`.
4. Multi-line descriptions belong to the SAME transaction — concatenate them with a single space.
5. Dates: use YYYY-MM-DD. Year comes from the statement period if the line omits it.
6. Do not invent transactions. Do not skip transactions. Every posted transaction row must appear.
7. Self-check before returning: sum of all \`debit\` values must equal printed \`totalDebits\` within 1 cent; sum of all \`credit\` values must equal printed \`totalCredits\` within 1 cent. If they don't match, re-read — you probably put a payment on the wrong side.
8. \`payer_payee\`: for EVERY transaction, extract the cleaned counterparty name from the description. This is the PAYER on credits/payments/deposits (e.g. "John Smith", "Employer Name", "Cardholder Payment", "Interac e-Transfer from Alice") and the PAYEE on debits/charges (e.g. "Starbucks", "Shell", "Amazon", "Hydro One"). Strip transaction reference numbers, POS ids, city/province, terminal codes, card-last-4 suffixes, and generic prefixes like "POS PURCHASE", "DEBIT MEMO", "PAYMENT -". Return just the recognizable name. Only leave it empty for rows like "INTEREST", "SERVICE CHARGE", "BANK FEE" where no counterparty exists.

Return the tool call only. No prose.`;

const GENERIC_PROMPT = `Extract every table from this PDF and submit via \`submit_generic_table_extraction\`. Numbers must be numeric (no $, commas), brackets mean negative. One sheet per logical table. Include every row.`;

async function callGemini(
  apiKey: string,
  pdfBase64: string,
  prompt: string,
  tool: typeof STATEMENT_TOOL | typeof GENERIC_TOOL,
  model: string,
  timeoutMs = AI_REQUEST_TIMEOUT_MS,
): Promise<AiCallResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 8000,
        tools: [tool],
        tool_choice: { type: 'function', function: { name: tool.function.name } },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ],
        }],
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    console.error(`AI ${model} request aborted/failed:`, (e as Error).message);
    return {
      ok: false,
      reason: ctrl.signal.aborted ? 'timeout' : 'failed',
      message: ctrl.signal.aborted ? `AI extraction exceeded ${Math.round(timeoutMs / 1000)}s` : (e as Error).message,
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text();
    console.error(`AI ${model} failed (${res.status}):`, text.slice(0, 500));
    if (res.status === 429 || res.status === 402) throw new Response(text, { status: res.status });
    return { ok: false, reason: 'failed', message: `AI extraction failed with status ${res.status}` };
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const call = msg?.tool_calls?.[0];
  if (call?.function?.arguments) {
    try { return { ok: true, args: JSON.parse(call.function.arguments), raw: call.function.arguments }; }
    catch (e) { console.error('Tool args JSON parse failed:', e); }
  }
  // Fallback: try parsing message content if model returned JSON inline
  const content = msg?.content || '';
  if (content) {
    const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    try { return { ok: true, args: JSON.parse(m[1].trim()), raw: m[1] }; } catch { /* ignore */ }
  }
  return { ok: false, reason: 'empty', message: 'AI returned no structured tool result' };
}

// Lightweight bank-statement detector based on filename + first request
function looksLikeStatement(name: string): boolean {
  return /statement|bank|rbc|td|bmo|cibc|scotia|amex|visa|mastercard|account.*activity/i.test(name);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'AI service not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const contentType = req.headers.get('content-type') || '';
    let fileData: Uint8Array;
    let fileName: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) return new Response(JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      fileName = file.name;
      fileData = new Uint8Array(await file.arrayBuffer());
    } else {
      const body = await req.json();
      if (body.fileUrl) {
        const response = await fetch(body.fileUrl);
        fileData = new Uint8Array(await response.arrayBuffer());
        fileName = body.fileName || 'document.pdf';
      } else if (body.base64) {
        fileData = Uint8Array.from(atob(body.base64), (c) => c.charCodeAt(0));
        fileName = body.fileName || 'document.pdf';
      } else {
        return new Response(JSON.stringify({ success: false, error: 'No file data provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (fileName.split('.').pop()?.toLowerCase() !== 'pdf') {
      return new Response(JSON.stringify({ success: false, error: 'Only PDF files are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (fileData.length > MAX_PDF_SIZE_BYTES) {
      return new Response(JSON.stringify({
        success: false,
        error: `PDF is too large (${(fileData.length / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_PDF_SIZE_MB} MB.`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Processing PDF: ${fileName}, size: ${(fileData.length / 1024).toFixed(0)}KB`);
    const pdfBase64 = bytesToBase64(fileData);

    // ---- Slice the PDF into small page batches so each Gemini call fits
    //      inside the AI Gateway's ~75s idle ceiling, then merge the results.
    const validationWarnings: string[] = [];
    let columns: string[] = [];
    let rows: ExtractedRow[] = [];
    let extractedSheets: Sheet[] = [];
    let documentType: string | undefined;
    let reconciled: boolean | undefined;
    let summary: Record<string, number | string | undefined> | undefined;
    let totalPages = 0;
    let processedPages = 0;
    const processedPageNumbers = new Set<number>();

    let extractionTimedOut = false;
    const remainingAiBudget = () => Math.max(
      MIN_AI_CALL_MS,
      Math.min(AI_REQUEST_TIMEOUT_MS, EDGE_RESPONSE_BUDGET_MS - (Date.now() - startTime) - RESPONSE_BUFFER_MS),
    );
    const hasBudgetForAnotherCall = () =>
      EDGE_RESPONSE_BUDGET_MS - (Date.now() - startTime) - RESPONSE_BUFFER_MS > MIN_AI_CALL_MS;
    const markBatchProcessed = (batch: PdfBatch) => {
      if (!batch.totalPages || !batch.to) return;
      for (let page = batch.from; page <= batch.to; page++) processedPageNumbers.add(page);
      processedPages = Math.max(processedPages, batch.to);
    };

    let batches: PdfBatch[];
    try {
      batches = await sliceIntoBatches(fileData, PAGES_PER_BATCH);
    } catch (e) {
      console.error('PDF slice failed, falling back to single-shot:', (e as Error).message);
      batches = [{ base64: pdfBase64, from: 1, to: 0, totalPages: 0 }];
    }
    totalPages = batches[0]?.totalPages ?? 0;
    const wantsStatement = looksLikeStatement(fileName);

    const tryStatementBatched = async (): Promise<boolean> => {
      const model = 'google/gemini-2.5-flash';
      const batchResults: Array<{ batch: PdfBatch; args: any }> = [];
      let firstArgs: any = null;
      let lastArgs: any = null;

      for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
        const group = batches.slice(i, i + MAX_PARALLEL_BATCHES);
        if (!hasBudgetForAnotherCall()) {
          validationWarnings.push(`Skipped pages ${group[0]?.from}-${batches[batches.length - 1]?.to}: edge time budget exhausted.`);
          extractionTimedOut = true;
          break;
        }

        const timeoutMs = remainingAiBudget();
        const results = await Promise.all(group.map(async (batch) => {
          const rangeLabel = batch.totalPages ? ` (pages ${batch.from}-${batch.to} of ${batch.totalPages})` : '';
          const prompt = STATEMENT_PROMPT + `\n\nThis input covers${rangeLabel}. Return every transaction visible on THESE pages only.`;
          const result = await callGemini(LOVABLE_API_KEY, batch.base64, prompt, STATEMENT_TOOL, model, timeoutMs);
          return { batch, result };
        }));

        for (const { batch, result } of results) {
          if (!result.ok) {
            extractionTimedOut ||= result.reason === 'timeout';
            validationWarnings.push(`Pages ${batch.from}-${batch.to}: ${result.message || 'no structured result'}.`);
            continue;
          }
          batchResults.push({ batch, args: result.args || {} });
          markBatchProcessed(batch);
        }

        if (results.some(({ result }) => result.ok) && processedPages >= totalPages) {
          break;
        }
      }

      if (batchResults.length === 0) return false;

      batchResults.sort((a, b) => a.batch.from - b.batch.from);
      firstArgs = batchResults[0]?.args || null;
      lastArgs = batchResults[batchResults.length - 1]?.args || null;

      const merged: ExtractedRow[] = [];
      for (const item of batchResults) {
        if (Array.isArray(item.args.transactions)) {
          for (const t of item.args.transactions) merged.push(t as ExtractedRow);
        }
      }

      documentType = (firstArgs?.documentType || lastArgs?.documentType || 'bank_statement') as string;
      const isCC = documentType === 'credit_card_statement';

      // Deduplicate rows across batch overlaps (date|desc|debit|credit).
      const seen = new Set<string>();
      const cleaned: ExtractedRow[] = [];
      for (const t of merged) {
        const desc = String((t as any).description ?? '').trim();
        if (!desc || isSummaryRow(desc)) {
          if (desc) validationWarnings.push(`Dropped summary row: "${desc}"`);
          continue;
        }
        let debit = Math.abs(parseNum((t as any).debit));
        let credit = Math.abs(parseNum((t as any).credit));
        if (debit > 0 && credit > 0) {
          validationWarnings.push(`Row "${desc.slice(0, 40)}" had both debit & credit; kept larger.`);
          if (debit >= credit) credit = 0; else debit = 0;
        }
        if (debit === 0 && credit === 0) continue;
        const key = `${String((t as any).date ?? '')}|${desc}|${debit.toFixed(2)}|${credit.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push({
          Date: String((t as any).date ?? ''),
          Description: desc,
          'Payer/Payee': (t as any).payer_payee ? String((t as any).payer_payee).trim() : '',
          Reference: (t as any).reference ? String((t as any).reference) : '',
          Debit: debit || 0,
          Credit: credit || 0,
          Balance: parseNum((t as any).balance) || null,
        });
      }

      // Description-based side correction for single-signed-column CC statements.
      const PAYMENT_KW = /(payment|paiement|thank\s*you|merci|autopay|bill\s*payment|transfer\s*to\s*card|\bpmt\b)/i;
      const REFUND_KW = /(refund|return\b|returned|credit\s*memo|reversal|chargeback|merchant\s*credit)/i;
      let swapped = 0;
      for (const r of cleaned) {
        const desc = String(r.Description ?? '');
        const isPmtLike = PAYMENT_KW.test(desc) || REFUND_KW.test(desc);
        if (isPmtLike && (r.Debit as number) > 0 && (r.Credit as number) === 0) {
          r.Credit = r.Debit;
          r.Debit = 0;
          swapped++;
        }
      }
      if (swapped > 0) {
        validationWarnings.push(`Reclassified ${swapped} payment/refund row(s) from debit to credit based on description.`);
      }

      // Reconcile against printed totals from the latest successful batch with totals
      // (statement totals usually live on the summary page, but page batches can return
      // partial metadata if a late page fails).
      const sumDebit = cleaned.reduce((s, r) => s + (r.Debit as number), 0);
      const sumCredit = cleaned.reduce((s, r) => s + (r.Credit as number), 0);
      const totalsArgs = [...batchResults].reverse().find(({ args }) =>
        parseNum(args?.totalDebits) > 0 || parseNum(args?.totalCredits) > 0 ||
        parseNum(args?.closingBalance) !== 0
      )?.args || lastArgs || firstArgs;
      const printedDebit = parseNum(totalsArgs?.totalDebits ?? firstArgs?.totalDebits);
      const printedCredit = parseNum(totalsArgs?.totalCredits ?? firstArgs?.totalCredits);
      const tol = 0.02;

      let needsSwap = false;
      if (printedDebit > 0 && printedCredit > 0) {
        const matchDirect = Math.abs(sumDebit - printedDebit) <= tol && Math.abs(sumCredit - printedCredit) <= tol;
        const matchSwapped = Math.abs(sumDebit - printedCredit) <= tol && Math.abs(sumCredit - printedDebit) <= tol;
        if (!matchDirect && matchSwapped) {
          needsSwap = true;
          validationWarnings.push('Debit/Credit columns appear swapped — auto-corrected.');
        }
        reconciled = matchDirect || matchSwapped;
        if (!reconciled) {
          validationWarnings.push(
            `Totals don't reconcile: extracted debits ${sumDebit.toFixed(2)} vs printed ${printedDebit.toFixed(2)}; ` +
            `credits ${sumCredit.toFixed(2)} vs printed ${printedCredit.toFixed(2)}.`,
          );
        }
      }

      if (needsSwap) {
        for (const r of cleaned) {
          const d = r.Debit; r.Debit = r.Credit; r.Credit = d;
        }
      }

      summary = {
        openingBalance: parseNum(firstArgs?.openingBalance) || undefined,
        closingBalance: parseNum(totalsArgs?.closingBalance ?? lastArgs?.closingBalance ?? firstArgs?.closingBalance) || undefined,
        totalDebits: printedDebit || undefined,
        totalCredits: printedCredit || undefined,
        periodStart: firstArgs?.statementPeriodStart ?? lastArgs?.statementPeriodStart,
        periodEnd: totalsArgs?.statementPeriodEnd ?? lastArgs?.statementPeriodEnd ?? firstArgs?.statementPeriodEnd,
      };

      columns = isCC
        ? ['Date', 'Description', 'Payer/Payee', 'Reference', 'Charge', 'Payment', 'Balance']
        : ['Date', 'Description', 'Payer/Payee', 'Reference', 'Debit', 'Credit', 'Balance'];

      rows = isCC
        ? cleaned.map((r) => ({
            Date: r.Date, Description: r.Description, 'Payer/Payee': r['Payer/Payee'], Reference: r.Reference,
            Charge: r.Debit, Payment: r.Credit, Balance: r.Balance,
          }))
        : cleaned;

      extractedSheets = [{ name: isCC ? 'CC Transactions' : 'Bank Transactions', columns, rows }];
      return cleaned.length > 0;
    };

    const tryGenericBatched = async (): Promise<boolean> => {
      const model = 'google/gemini-2.5-flash';
      const allSheets: Sheet[] = [];
      let anyOk = false;
      for (const batch of batches) {
        if (!hasBudgetForAnotherCall()) {
          validationWarnings.push(`Skipped pages ${batch.from}-${batch.to}: edge time budget exhausted.`);
          extractionTimedOut = true;
          break;
        }
        const result = await callGemini(LOVABLE_API_KEY, batch.base64, GENERIC_PROMPT, GENERIC_TOOL, model, remainingAiBudget());
        if (!result.ok) {
          extractionTimedOut ||= result.reason === 'timeout';
          validationWarnings.push(`Pages ${batch.from}-${batch.to}: ${result.message || 'no structured result'}.`);
          continue;
        }
        anyOk = true;
        markBatchProcessed(batch);
        const sheets = (result.args?.sheets as Sheet[]) || [];
        for (const s of sheets) allSheets.push(s);
      }
      if (!anyOk || allSheets.length === 0) return false;
      extractedSheets = allSheets;
      columns = allSheets[0].columns || [];
      rows = allSheets.flatMap((s) => s.rows || []);
      documentType = 'generic_table';
      return true;
    };

    try {
      if (wantsStatement) {
        if (!(await tryStatementBatched()) && !extractionTimedOut && hasBudgetForAnotherCall()) {
          await tryGenericBatched();
        }
      } else {
        if (!(await tryGenericBatched()) && !extractionTimedOut && hasBudgetForAnotherCall()) {
          await tryStatementBatched();
        }
      }
    } catch (e) {
      if (e instanceof Response) {
        const status = e.status;
        const errMsg = status === 429
          ? 'Rate limit reached. Please try again in a moment.'
          : 'AI credits exhausted. Please add credits to your workspace.';
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw e;
    }


    if (extractionTimedOut && columns.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'PDF extraction took too long. Try a smaller statement, fewer pages, or upload CSV/XLSX exported from the bank.',
        message: 'PDF extraction timed out before the backend idle limit.',
        validationWarnings: validationWarnings.length ? validationWarnings : undefined,
        processingTimeMs: Date.now() - startTime,
      }), { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (columns.length === 0) {
      columns = ['Content'];
      rows = [{ Content: 'No structured data could be extracted from this PDF.' }];
      extractedSheets = [{ name: 'Extracted Data', columns, rows }];
    }

    // Build workbook
    const timestamp = Date.now();
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');
    const wb = XLSX.utils.book_new();
    for (const sheet of extractedSheets) {
      const ws = XLSX.utils.json_to_sheet(sheet.rows);
      const safe = (sheet.name || 'Sheet').slice(0, 31).replace(/[\\/*?[\]]/g, '');
      XLSX.utils.book_append_sheet(wb, ws, safe);
    }
    const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const xlsxPath = `ai-sheets/${timestamp}-${baseName}.xlsx`;
    await supabase.storage.from('docsign-documents').upload(xlsxPath, xlsxBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    });
    const { data: urlData } = supabase.storage.from('docsign-documents').getPublicUrl(xlsxPath);

    const result = {
      success: true,
      fileName,
      totalPages,
      processedPages: processedPageNumbers.size || processedPages || totalPages,
      columns,
      rows,
      sheets: extractedSheets.length > 1 ? extractedSheets : undefined,
      documentType,
      summary,
      reconciled,
      validationWarnings: validationWarnings.length ? validationWarnings : undefined,
      downloadUrl: urlData.publicUrl,
      message: `Extracted ${rows.length} rows`,
      processingTimeMs: Date.now() - startTime,
    };

    console.log(`Completed: ${rows.length} rows, type=${documentType}, reconciled=${reconciled}, warnings=${validationWarnings.length}`);

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('PDF to spreadsheet error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed',
      processingTimeMs: Date.now() - startTime,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Send, Loader2, Minimize2, Maximize2, Paperclip, Download, FileText, FileSpreadsheet, File, Table, Building2, CreditCard, Sparkles, FileUp, RefreshCw, FolderCog, Volume2, Pause, Play, RotateCcw, Square, Share2, Mail, MessageSquare, MessageCircle, Copy, FileDown, FileType, Sheet, FileType2, Calculator } from 'lucide-react';
import aliceAvatar from '@/assets/alice-avatar.png';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
// Badge unused but kept for future use
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useFileConvert } from '@/hooks/useFileConvert';
import { usePdfToSpreadsheet } from '@/hooks/usePdfToSpreadsheet';
import { useBankTransactions } from '@/hooks/useBankTransactions';
import { useCreditCardTransactions, useCreditCards } from '@/hooks/useCreditCards';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useAliceTTS } from '@/hooks/useAliceTTS';
import { useAliceShare } from '@/hooks/useAliceShare';
import { AISheets } from './AISheets';
import { AIFinancialToolkit } from './AIFinancialToolkit';
import { StatementExtractionDialog } from '@/components/banking/StatementExtractionDialog';
import { TemplateManagementPanel } from '@/components/banking/TemplateManagementPanel';
import { toast } from 'sonner';

type MessageAttachment = {
  fileName: string;
  fileType: string;
  downloadUrl?: string;
  extractedText?: string;
  excelData?: Record<string, unknown>[];
  pageCount?: number;
  spreadsheetData?: {
    columns: string[];
    rows: Record<string, unknown>[];
  };
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accounting-assistant`;

async function streamChat({
  messages,
  taskHint,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  taskHint?: string;
  onDelta: (deltaText: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      onError("You must be logged in to use Alice.");
      return;
    }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, taskHint }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({ error: "Request failed" }));
      onError(errorData.error || "Failed to get response");
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Connection error");
  }
}

function AttachmentBadge({ attachment, onOpenInSheets }: { attachment: MessageAttachment; onOpenInSheets?: () => void }) {
  const getIcon = () => {
    if (attachment.fileType === 'pdf') return <FileText className="h-3 w-3" />;
    if (['xlsx', 'xls', 'csv'].includes(attachment.fileType)) return <FileSpreadsheet className="h-3 w-3" />;
    return <File className="h-3 w-3" />;
  };

  const hasSpreadsheetData = attachment.spreadsheetData && attachment.spreadsheetData.rows.length > 0;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded text-xs">
      {getIcon()}
      <span className="max-w-[100px] truncate">{attachment.fileName}</span>
      {hasSpreadsheetData && onOpenInSheets && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenInSheets(); }}
          className="hover:text-primary"
          title="Open in AI Sheets"
        >
          <Table className="h-3 w-3" />
        </button>
      )}
      {attachment.downloadUrl && (
        <a
          href={attachment.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

interface AIAccountingAssistantProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImportToBank?: (data: Record<string, unknown>[]) => void;
  onImportToCreditCard?: (data: Record<string, unknown>[]) => void;
}

export function AIAccountingAssistant({ 
  isOpen, 
  onOpenChange,
  onImportToBank,
  onImportToCreditCard,
}: AIAccountingAssistantProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [aiSheetsOpen, setAiSheetsOpen] = useState(false);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const [toolkitInitialTab, setToolkitInitialTab] = useState<string | undefined>();
  const [extractionType, setExtractionType] = useState<'bank' | 'creditcard'>('bank');
  const [sheetsData, setSheetsData] = useState<{ columns: string[]; rows: Record<string, unknown>[]; sourceFile?: string }>({ columns: [], rows: [] });
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [pendingShareContent, setPendingShareContent] = useState('');
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { convertFile, isConverting } = useFileConvert();
  const { convertPdfToSpreadsheet, isConverting: isPdfConverting, progress, error: pdfError } = usePdfToSpreadsheet();
  const { speak, pause, resume, stop, replay, isSpeaking, isPaused, isLoading: isTTSLoading } = useAliceTTS();
  const { 
    shareViaEmail, 
    shareViaSMS, 
    shareViaWhatsApp, 
    shareViaGoogleChat,
    downloadAsPDF,
    downloadAsExcel,
    downloadAsWord,
    downloadAsText,
    copyToClipboard,
  } = useAliceShare();
  
  // Import hooks for direct database operations when callbacks aren't provided
  const { accounts: bankAccounts } = useBankAccounts();
  const { creditCards } = useCreditCards();
  
  // Use selected account or fall back to first account
  const effectiveBankAccount = bankAccounts.find(a => a.id === selectedBankAccountId) || bankAccounts[0];
  const effectiveBankAccountId = effectiveBankAccount?.id;
  const effectiveBankGlAccountId = effectiveBankAccount?.gl_account_id;
  const effectiveCreditCard = creditCards.find(c => c.id === selectedCreditCardId) || creditCards[0];
  const effectiveCreditCardId = effectiveCreditCard?.id;
  const effectiveCreditCardGlAccountId = effectiveCreditCard?.gl_account_id;
  
  const { importTransactions: importBankTx } = useBankTransactions(effectiveBankAccountId);
  const { importTransactions: importCcTx } = useCreditCardTransactions(effectiveCreditCardId);

  const handleOpenExtraction = (type: 'bank' | 'creditcard') => {
    setExtractionType(type);
    setExtractionDialogOpen(true);
  };

  const handleExtractionComplete = (transactions: Record<string, unknown>[]) => {
    // Use provided callbacks first, then fall back to direct import
    if (extractionType === 'bank') {
      if (onImportToBank) {
        onImportToBank(transactions);
      } else if (effectiveBankAccountId) {
        // Direct import using hook - include GL account from selected bank account
        const mappedTransactions = transactions.map(tx => {
          const rawAmount = Number(tx.amount ?? 0);
          const amount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;
          const transactionDate = String(tx.transaction_date || tx.date || new Date().toISOString().split('T')[0]);
          const payeePayor = tx.payee_payor ?? tx.merchant_name ?? tx.merchant ?? tx.payee ?? tx.payor ?? null;
          const isDeposit = rawAmount >= 0;

          return {
            bank_account_id: effectiveBankAccountId,
            gl_account_id: effectiveBankGlAccountId || null,
            transaction_date: transactionDate,
            description: String(tx.description || ''),
            amount,
            transaction_type: (isDeposit ? 'deposit' : 'withdrawal') as 'deposit' | 'withdrawal',
            payee_payor: payeePayor ? String(payeePayor) : null,
            reference: tx.reference ? String(tx.reference) : null,
            category: tx.category ? String(tx.category) : null,
            memo: tx.memo ? String(tx.memo) : null,
          };
        });
        importBankTx.mutate(mappedTransactions);
      } else {
        toast.error('No bank account found. Please create a bank account first.');
        return;
      }
    } else if (extractionType === 'creditcard') {
      if (onImportToCreditCard) {
        onImportToCreditCard(transactions);
      } else if (effectiveCreditCardId) {
        // Direct import using hook - include GL account from selected credit card
        const mappedTransactions = transactions.map(tx => {
          const rawAmount = Number(tx.amount ?? 0);
          const amount = Number.isFinite(rawAmount) ? Math.abs(rawAmount) : 0;
          const transactionType = rawAmount >= 0 ? 'charge' : 'payment';
          const transactionDate = String(tx.transaction_date || tx.date || new Date().toISOString().split('T')[0]);
          const payeePayor = tx.payee_payor ?? tx.merchant_name ?? tx.merchant ?? tx.payee ?? tx.payor ?? null;
          const postedDate = String(tx.posted_date ?? tx.posting_date ?? '') || null;

          return {
            credit_card_id: effectiveCreditCardId,
            transaction_date: transactionDate,
            posted_date: postedDate,
            description: String(tx.description || ''),
            amount,
            transaction_type: transactionType,
            payee_payor: payeePayor ? String(payeePayor) : null,
            reference: tx.reference ? String(tx.reference) : null,
            category: tx.category ? String(tx.category) : null,
            merchant_category_code: null,
            memo: tx.memo ? String(tx.memo) : null,
            is_cleared: false,
            cleared_at: null,
            gl_account_id: effectiveCreditCardGlAccountId || null,
            journal_entry_id: null,
            status: 'pending' as const,
            imported_at: new Date().toISOString(),
          };
        });
        importCcTx.mutate(mappedTransactions);
      } else {
        toast.error('No credit card found. Please add a credit card first.');
        return;
      }
    }
    setExtractionDialogOpen(false);
    toast.success(`Successfully imported ${transactions.length} transactions`);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setPendingFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async (files: File[]): Promise<MessageAttachment[]> => {
    // Cap at 10 files
    const filesToProcess = files.slice(0, 10);
    if (files.length > 10) {
      toast.warning('Maximum 10 files per batch. Only the first 10 will be processed.');
    }

    const results = await Promise.allSettled(filesToProcess.map(async (file) => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const attachment: MessageAttachment = {
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'unknown',
      };

      // Run text analysis
      const analyzeResult = await convertFile(file, 'analyze');
      if (analyzeResult?.success) {
        attachment.downloadUrl = analyzeResult.downloadUrl;
        attachment.extractedText = analyzeResult.extractedText;
        attachment.excelData = analyzeResult.excelData;
        attachment.pageCount = analyzeResult.pageCount;
      }

      // For PDFs, also extract structured spreadsheet data in parallel
      if (isPdf) {
        try {
          const spreadsheetResult = await convertPdfToSpreadsheet(file, { maxPages: 500, useAI: true });
          if (spreadsheetResult?.success && spreadsheetResult.rows.length > 0) {
            attachment.spreadsheetData = {
              columns: spreadsheetResult.columns,
              rows: spreadsheetResult.rows,
            };
          }
        } catch (err) {
          console.warn(`PDF spreadsheet extraction failed for ${file.name}:`, err);
        }
      }

      return attachment;
    }));

    return results
      .filter((r): r is PromiseFulfilledResult<MessageAttachment> => r.status === 'fulfilled')
      .map(r => r.value);
  };

  const handleConvertToPdf = async () => {
    if (pendingFiles.length === 0) {
      toast.error('Please attach a file first');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of pendingFiles) {
        const result = await convertFile(file, 'to-pdf');
        if (result?.success && result.downloadUrl) {
          const attachment: MessageAttachment = {
            fileName: result.convertedFile || result.originalFile,
            fileType: 'pdf',
            downloadUrl: result.downloadUrl,
            pageCount: result.pageCount,
          };
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ **Converted to PDF:** ${result.message}`,
            attachments: [attachment],
          }]);
          toast.success(`Converted ${file.name} to PDF`);
        } else {
          toast.error(result?.message || 'Conversion failed');
        }
      }
      setPendingFiles([]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConvertToSpreadsheet = async () => {
    if (pendingFiles.length === 0) {
      toast.error('Please attach a PDF file first');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of pendingFiles) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          toast.error(`${file.name} is not a PDF file`);
          continue;
        }

        const result = await convertPdfToSpreadsheet(file, { maxPages: 500, useAI: true });
        
        if (result?.success) {
          const attachment: MessageAttachment = {
            fileName: `${file.name.replace(/\.pdf$/i, '')}.xlsx`,
            fileType: 'xlsx',
            downloadUrl: result.downloadUrl,
            pageCount: result.totalPages,
            spreadsheetData: {
              columns: result.columns,
              rows: result.rows,
            },
          };
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ **Converted to Spreadsheet:** Extracted ${result.rows.length} rows from ${result.processedPages}/${result.totalPages} pages in ${(result.processingTimeMs / 1000).toFixed(1)}s\n\nClick the table icon to open in AI Sheets for editing and direct import to banking.`,
            attachments: [attachment],
          }]);
          
          // Auto-open in AI Sheets
          setSheetsData({
            columns: result.columns,
            rows: result.rows,
            sourceFile: file.name,
          });
          
          toast.success(`Extracted ${result.rows.length} rows from ${file.name}`);
        } else {
          const errorMsg = result?.error || result?.message || pdfError || 'Conversion failed';
          toast.error(errorMsg);
          console.error('PDF conversion failed:', errorMsg);
        }
      }
      setPendingFiles([]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenAISheets = (attachment: MessageAttachment) => {
    if (attachment.spreadsheetData) {
      setSheetsData({
        columns: attachment.spreadsheetData.columns,
        rows: attachment.spreadsheetData.rows,
        sourceFile: attachment.fileName,
      });
      setAiSheetsOpen(true);
    } else if (attachment.excelData && attachment.excelData.length > 0) {
      const columns = Object.keys(attachment.excelData[0] || {});
      setSheetsData({
        columns,
        rows: attachment.excelData,
        sourceFile: attachment.fileName,
      });
      setAiSheetsOpen(true);
    }
  };

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && pendingFiles.length === 0) || isLoading) return;

    setIsUploading(true);
    let attachments: MessageAttachment[] = [];
    
    if (pendingFiles.length > 0) {
      attachments = await processFiles(pendingFiles);
      setPendingFiles([]);
    }
    
    setIsUploading(false);

    // Build user message content including file context
    let userContent = input.trim();
    if (attachments.length > 0) {
      const fileContext = attachments.map(a => {
        let ctx = `[File: ${a.fileName}]`;
        if (a.extractedText) ctx += `\nContent preview: ${a.extractedText.slice(0, 3000)}`;
        if (a.spreadsheetData && a.spreadsheetData.rows.length > 0) {
          const header = a.spreadsheetData.columns.join(' | ');
          const rowsText = a.spreadsheetData.rows.slice(0, 20).map(r =>
            a.spreadsheetData!.columns.map(c => String((r as Record<string, unknown>)[c] ?? '')).join(' | ')
          ).join('\n');
          ctx += `\nStructured data (${a.spreadsheetData.rows.length} rows):\n${header}\n${rowsText}`;
        }
        if (a.excelData && a.excelData.length > 0) {
          ctx += `\nSpreadsheet data (first 10 rows): ${JSON.stringify(a.excelData.slice(0, 10), null, 2)}`;
        }
        return ctx;
      }).join('\n\n');
      
      userContent = userContent 
        ? `${userContent}\n\n${fileContext}`
        : `Please analyze these files:\n\n${fileContext}`;
    }

    const userMsg: Message = { 
      role: 'user', 
      content: input.trim() || 'Analyzing uploaded files...',
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    // Prepare messages for API (flatten content)
    const apiMessages = [...messages, { role: 'user', content: userContent }].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Check for financial toolkit conversational triggers
    const lowerInput = userContent.toLowerCase();
    const toolkitTriggers: Record<string, string> = {
      'loan': 'loan', 'amortization': 'loan', 'mortgage': 'loan',
      'valuation': 'valuation', 'business value': 'valuation', 'dcf': 'valuation',
      'break-even': 'breakeven', 'breakeven': 'breakeven', 'break even': 'breakeven',
      'cash flow forecast': 'cashflow', 'cashflow forecast': 'cashflow',
      'roi calculator': 'roi', 'return on investment': 'roi',
      'npv calculator': 'npv', 'net present value': 'npv',
      'irr calculator': 'irr', 'internal rate of return': 'irr',
      'future value': 'fv', 'compound interest': 'fv',
    };
    for (const [trigger, tab] of Object.entries(toolkitTriggers)) {
      if (lowerInput.includes(trigger) && (lowerInput.includes('calculate') || lowerInput.includes('calculator') || lowerInput.includes('compute') || lowerInput.includes('tool'))) {
        setToolkitInitialTab(tab);
        setToolkitOpen(true);
        break;
      }
    }

    // Determine taskHint based on context
    const hasAttachments = attachments.length > 0;
    const taskHint = hasAttachments ? 'document-analysis' : undefined;

    await streamChat({
      messages: apiMessages,
      taskHint,
      onDelta: (chunk) => upsertAssistant(chunk),
      onDone: () => setIsLoading(false),
      onError: (error) => {
        setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${error}` }]);
        setIsLoading(false);
      },
    });
  }, [input, isLoading, messages, pendingFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "What's the difference between IFRS and ASPE?",
    "How do I record depreciation for fixed assets?",
    "Explain the employee termination process in Kenya",
    "What are the key marketing KPIs to track?",
    "How do I register a company in Zambia?",
    "Explain risk management frameworks",
  ];

  // Handle speaking a message
  const handleSpeak = useCallback((content: string, index: number) => {
    if (speakingMessageIndex === index && isSpeaking && !isPaused) {
      // Currently playing this message - pause it
      pause();
    } else if (speakingMessageIndex === index && isPaused) {
      // Currently paused on this message - resume it
      resume();
    } else if (speakingMessageIndex === index && !isSpeaking) {
      // Audio ended for this message - replay it
      replay();
    } else {
      // Different message or no audio - start fresh
      setSpeakingMessageIndex(index);
      speak(content).then(() => {
        // Keep the message index so replay works
      });
    }
  }, [speakingMessageIndex, isSpeaking, isPaused, speak, pause, resume, replay]);

  // Handle stop completely
  const handleStop = useCallback(() => {
    stop();
    setSpeakingMessageIndex(null);
  }, [stop]);

  // Handle replay
  const handleReplay = useCallback(() => {
    replay();
  }, [replay]);

  // Handle email share
  const handleEmailShare = async () => {
    if (!emailRecipient.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    await shareViaEmail(emailRecipient, pendingShareContent, emailSubject || 'Alice Business Advisor Report');
    setEmailDialogOpen(false);
    setEmailRecipient('');
    setEmailSubject('');
    setPendingShareContent('');
  };

  const openEmailDialog = (content: string) => {
    setPendingShareContent(content);
    setEmailDialogOpen(true);
  };

  if (!isOpen) {
    return null;
  }

  const hasPendingPdfs = pendingFiles.some(f => f.name.toLowerCase().endsWith('.pdf'));
  const hasNonPdfFiles = pendingFiles.some(f => !f.name.toLowerCase().endsWith('.pdf'));

  return (
    <>
      <div
        className={cn(
          "fixed z-50 rounded-2xl flex flex-col transition-all duration-300",
          "bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900",
          "shadow-[0_20px_60px_-15px_rgba(37,99,235,0.5),0_10px_30px_-10px_rgba(30,64,175,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
          "before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-b before:from-white/10 before:to-transparent before:pointer-events-none",
          isExpanded 
            ? "bottom-4 right-4 left-4 top-4 md:left-auto md:w-[600px] md:h-[80vh]" 
            : "bottom-6 right-6 w-[400px] h-[560px]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white/10 backdrop-blur-sm rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/30 shadow-lg">
              <img src={aliceAvatar} alt="Alice" className="w-full h-full object-cover object-top" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Alice</h3>
              <p className="text-xs text-blue-100/80">Your AI Business Advisor</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {sheetsData.rows.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                onClick={() => setAiSheetsOpen(true)}
                title="Open AI Sheets"
              >
                <Table className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => { setToolkitInitialTab(undefined); setToolkitOpen(true); }}
              title="Financial Toolkit"
            >
              <Calculator className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => {
                setMessages([]);
                setPendingFiles([]);
                setSheetsData({ columns: [], rows: [], sourceFile: '' });
                toast.success('Conversation cleared');
              }}
              title="New Conversation"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress Bar for PDF Conversion */}
        {(isPdfConverting && progress) && (
          <div className="px-4 py-2 bg-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-blue-200 animate-pulse" />
              <span className="text-xs font-medium text-white">Extracting data with AI...</span>
            </div>
            <Progress value={progress.current} className="h-1.5 bg-white/20" />
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 bg-white/5" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden ring-4 ring-white/20 shadow-xl mb-3">
                  <img src={aliceAvatar} alt="Alice" className="w-full h-full object-cover object-top" />
                </div>
                <h4 className="font-medium mb-1 text-white">Hello! I'm Alice, your AI Business Advisor</h4>
                <p className="text-sm text-blue-100/70">
                  Expert in accounting, finance, marketing, legal, HR, taxation, strategy, operations, and more across Canada, USA, Zambia, Kenya & Burundi.
                </p>
              </div>

              {/* AI Sheets Feature Highlight */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Table className="h-5 w-5 text-blue-200" />
                    <span className="font-medium text-sm text-white">AI Sheets</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setAiSheetsOpen(true)}
                    className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Open
                  </Button>
                </div>
                <ul className="text-xs text-blue-100/80 space-y-1">
                  <li>• Convert PDF statements to editable spreadsheets</li>
                  <li>• Process up to 500 pages with AI extraction</li>
                  <li>• Column mapping for bank & credit card import</li>
                  <li>• Edit, preview, and export to Excel/CSV</li>
                </ul>
              </div>

              {/* AI Financial Toolkit Feature Card */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-green-300" />
                    <span className="font-medium text-sm text-white">AI Financial Toolkit</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => { setToolkitInitialTab(undefined); setToolkitOpen(true); }}
                    className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <Calculator className="h-3 w-3 mr-1" />
                    Open
                  </Button>
                </div>
                <ul className="text-xs text-blue-100/80 space-y-1">
                  <li>• Loan & Amortization calculator</li>
                  <li>• Business Valuation (Multiple & DCF)</li>
                  <li>• Break-even, ROI, NPV, IRR & Future Value</li>
                  <li>• Cash Flow Forecasting with AI insights</li>
                  <li>• Export to Excel & PDF</li>
                </ul>
              </div>

              {/* Advanced Statement Extraction */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileUp className="h-5 w-5 text-amber-300" />
                  <span className="font-medium text-sm text-white">Statement Extraction Engine</span>
                </div>
                <p className="text-xs text-blue-100/70 mb-3">
                  Enterprise-grade AI extraction for bank & credit card statements. Up to 500 pages with dynamic column mapping.
                </p>
                
                {/* Account Selection */}
                <div className="space-y-3 mb-3">
                  <div>
                    <Label className="text-xs text-blue-100/80 mb-1 block">Target Bank Account</Label>
                    <Select
                      value={selectedBankAccountId || effectiveBankAccountId || ''}
                      onValueChange={(val) => setSelectedBankAccountId(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select bank account..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        {bankAccounts.map(account => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{account.name}</span>
                              {account.account_number && (
                                <span className="text-muted-foreground text-xs">
                                  ···{account.account_number.slice(-4)}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-blue-100/80 mb-1 block">Target Credit Card</Label>
                    <Select
                      value={selectedCreditCardId || effectiveCreditCardId || ''}
                      onValueChange={(val) => setSelectedCreditCardId(val)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select credit card..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border z-50">
                        {creditCards.map(card => (
                          <SelectItem key={card.id} value={card.id}>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-3 w-3 text-muted-foreground" />
                              <span>{card.name}</span>
                              {card.card_number && (
                                <span className="text-muted-foreground text-xs">
                                  ···{card.card_number.slice(-4)}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleOpenExtraction('bank')}
                    className="h-7 text-xs flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    disabled={!effectiveBankAccountId}
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    Bank Statement
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleOpenExtraction('creditcard')}
                    className="h-7 text-xs flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                    disabled={!effectiveCreditCardId}
                  >
                    <CreditCard className="h-3 w-3 mr-1" />
                    Credit Card
                  </Button>
                </div>
              </div>

              {/* Template Management Panel */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FolderCog className="h-5 w-5 text-blue-200" />
                  <span className="font-medium text-sm text-white">Import Template Manager</span>
                </div>
                <p className="text-xs text-blue-100/70 mb-3">
                  Manage your saved column mapping templates. Edit names, set defaults, or delete unused templates.
                </p>
                <TemplateManagementPanel />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-blue-100/60">Try asking:</p>
                {suggestedQuestions.map((question, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(question)}
                    className="w-full text-left text-sm p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-blue-100/90 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-1",
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  )}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {msg.attachments.map((att, j) => (
                        <AttachmentBadge 
                          key={j} 
                          attachment={att}
                          onOpenInSheets={
                            (att.spreadsheetData || att.excelData) 
                              ? () => handleOpenAISheets(att) 
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-md",
                      msg.role === 'user'
                        ? 'bg-white text-blue-900'
                        : 'bg-white/20 text-white backdrop-blur-sm'
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    
                    {/* Voice and Share controls for assistant messages */}
                    {msg.role === 'assistant' && msg.content && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/10">
                        {/* Play/Pause button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                          onClick={() => handleSpeak(msg.content, i)}
                          disabled={isTTSLoading && speakingMessageIndex === i}
                          title={
                            (isTTSLoading && speakingMessageIndex === i) ? 'Loading...' :
                            (isPaused && speakingMessageIndex === i) ? 'Resume' :
                            (isSpeaking && speakingMessageIndex === i) ? 'Pause' : 'Listen'
                          }
                        >
                          {(isTTSLoading && speakingMessageIndex === i) ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (isPaused && speakingMessageIndex === i) ? (
                            <Play className="h-3 w-3 mr-1" />
                          ) : (isSpeaking && speakingMessageIndex === i) ? (
                            <Pause className="h-3 w-3 mr-1" />
                          ) : (
                            <Volume2 className="h-3 w-3 mr-1" />
                          )}
                          {(isTTSLoading && speakingMessageIndex === i) ? 'Loading' :
                           (isPaused && speakingMessageIndex === i) ? 'Resume' :
                           (isSpeaking && speakingMessageIndex === i) ? 'Pause' : 'Listen'}
                        </Button>

                        {/* Stop button - only show when playing or paused */}
                        {(isSpeaking || isPaused) && speakingMessageIndex === i && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                            onClick={handleStop}
                            title="Stop"
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Stop
                          </Button>
                        )}

                        {/* Replay button - show when audio finished for this message */}
                        {!isSpeaking && !isPaused && speakingMessageIndex === i && !isTTSLoading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                            onClick={handleReplay}
                            title="Replay"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Replay
                          </Button>
                        )}

                        {/* Share dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                            >
                              <Share2 className="h-3 w-3 mr-1" />
                              Share
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuItem onClick={() => openEmailDialog(msg.content)}>
                              <Mail className="h-4 w-4 mr-2" />
                              Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareViaSMS(msg.content)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              SMS
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareViaWhatsApp(msg.content)}>
                              <MessageCircle className="h-4 w-4 mr-2" />
                              WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareViaGoogleChat(msg.content)}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Google Chat
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => copyToClipboard(msg.content)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy to Clipboard
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <FileDown className="h-4 w-4 mr-2" />
                                Download Report
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => downloadAsPDF(msg.content)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadAsExcel(msg.content)}>
                                  <Sheet className="h-4 w-4 mr-2" />
                                  Excel
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadAsWord(msg.content)}>
                                  <FileType2 className="h-4 w-4 mr-2" />
                                  Word
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadAsText(msg.content)}>
                                  <FileType className="h-4 w-4 mr-2" />
                                  Text
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-200" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Pending Files */}
        {pendingFiles.length > 0 && (
          <div className="px-3 py-2 bg-white/10 backdrop-blur-sm">
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-lg text-xs text-white">
                  {file.name.toLowerCase().endsWith('.pdf') ? (
                    <FileText className="h-3 w-3 text-red-300" />
                  ) : (
                    <FileSpreadsheet className="h-3 w-3 text-green-300" />
                  )}
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button onClick={() => removePendingFile(i)} className="hover:text-red-300">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {hasPendingPdfs && (
                <Button
                  size="sm"
                  onClick={handleConvertToSpreadsheet}
                  disabled={isConverting || isUploading || isPdfConverting}
                  className="text-xs bg-white text-blue-700 hover:bg-blue-50"
                >
                  {isPdfConverting ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Table className="h-3 w-3 mr-1" />
                  )}
                  PDF to AI Sheets
                </Button>
              )}
              {hasNonPdfFiles && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleConvertToPdf}
                  disabled={isConverting || isUploading}
                  className="text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  {isConverting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Convert to PDF
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-b-2xl">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.txt,.md,.json,.xml,.doc,.docx"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading || isPdfConverting}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question or attach a PDF for AI Sheets..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm bg-white/10 border-white/20 text-white placeholder:text-blue-200/60 focus:ring-white/30"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={(!input.trim() && pendingFiles.length === 0) || isLoading || isUploading || isPdfConverting}
              size="icon"
              className="h-11 w-11 shrink-0 bg-white text-blue-700 hover:bg-blue-50 shadow-lg"
            >
              {isLoading || isUploading || isPdfConverting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-blue-100/60 text-center mt-2">
            📄 Attach PDFs for AI Sheets extraction • Up to 500 pages supported
          </p>
        </div>
      </div>

      {/* AI Sheets Modal */}
      <AISheets
        isOpen={aiSheetsOpen}
        onOpenChange={setAiSheetsOpen}
        initialData={sheetsData.rows}
        initialColumns={sheetsData.columns}
        sourceFile={sheetsData.sourceFile}
        onImportToBank={onImportToBank}
        onImportToCreditCard={onImportToCreditCard}
      />

      {/* Statement Extraction Dialog */}
      <StatementExtractionDialog
        open={extractionDialogOpen}
        onOpenChange={setExtractionDialogOpen}
        statementType={extractionType}
        onImport={handleExtractionComplete}
      />

      {/* AI Financial Toolkit */}
      <AIFinancialToolkit
        isOpen={toolkitOpen}
        onOpenChange={setToolkitOpen}
        initialTab={toolkitInitialTab}
      />

      {/* Email Share Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="recipient@example.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input
                id="subject"
                placeholder="Alice Business Advisor Report"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEmailShare}>
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

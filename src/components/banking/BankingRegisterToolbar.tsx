import { Download, FileSpreadsheet, History, RefreshCw, Settings, Sparkles, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const actionClass = 'h-8 gap-1.5 px-2.5 text-xs font-medium';

interface BankingRegisterToolbarProps {
  title: string;
  isReadOnly?: boolean;
  unmatchedCount: number;
  activeRuleCount: number;
  isApplyingRules?: boolean;
  onAiCategorize: () => void;
  onApplyRules: () => void;
  onOpenRules: () => void;
  onQuickImport: () => void;
  onAiExtraction: () => void;
  onPdfExtract: () => void;
  onImportHistory: () => void;
  onExport: () => void;
}

/** Short title and small actions, so the transaction register keeps the screen. */
export function BankingRegisterToolbar({
  title,
  isReadOnly = false,
  unmatchedCount,
  activeRuleCount,
  isApplyingRules = false,
  onAiCategorize,
  onApplyRules,
  onOpenRules,
  onQuickImport,
  onAiExtraction,
  onPdfExtract,
  onImportHistory,
  onExport,
}: BankingRegisterToolbarProps) {
  return (
    <div data-testid="banking-register-header" className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-lg font-semibold leading-tight text-foreground">{title}</h1>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {!isReadOnly && unmatchedCount > 0 && (
          <Button variant="outline" size="sm" className={actionClass} onClick={onAiCategorize}>
            <Sparkles className="h-3.5 w-3.5" />
            AI Categorize ({unmatchedCount})
          </Button>
        )}
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyRules}
            disabled={isApplyingRules || activeRuleCount === 0}
            className={actionClass}
          >
            {isApplyingRules ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            Apply Rules
            {activeRuleCount > 0 && (
              <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
                {activeRuleCount}
              </span>
            )}
          </Button>
        )}
        {!isReadOnly && (
          <Button variant="outline" size="sm" className={actionClass} onClick={onOpenRules}>
            <Settings className="h-3.5 w-3.5" />
            AI Rules
          </Button>
        )}
        {!isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={actionClass}>
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onQuickImport}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Quick Import (CSV/Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAiExtraction}>
                <Sparkles className="mr-2 h-4 w-4" />
                AI Extraction Engine
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPdfExtract}>
                <Sparkles className="mr-2 h-4 w-4" />
                Extract from PDF (Gemini)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onImportHistory}>
                <History className="mr-2 h-4 w-4" />
                Import History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="outline" size="sm" className={actionClass} onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>
    </div>
  );
}

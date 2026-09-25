import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export type SheetRow = { [key: string]: string | number | boolean | null | undefined | unknown };

export interface SheetContext {
  activeSheetName: string;
  columns: string[];
  rowCount: number;
  sampleRows: SheetRow[];
}

export type SheetActionType =
  | "sort"
  | "filter"
  | "add_row"
  | "add_column"
  | "summarize"
  | "rename_column"
  | "fill_formula"
  | "set_rows"
  | "create_sheet"
  | "reply_only";

export interface SheetAction {
  action: SheetActionType;
  params?: {
    // sort
    column?: string;
    direction?: "asc" | "desc";
    // filter
    operator?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
    value?: string | number;
    // add_row
    values?: Record<string, string | number>;
    // add_column / fill_formula
    name?: string;
    target_column?: string;
    expression?: string;
    formula_column?: string;
    operation?: string;
    // summarize
    group_by?: string;
    aggregate_column?: string;
    // rename_column
    from?: string;
    to?: string;
    // set_rows / create_sheet (bulk insert)
    rows?: SheetRow[];
    columns?: string[];
    sheet_name?: string;
  };
  message: string;
}

export interface AliceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: SheetAction;
  timestamp: Date;
}

interface UseAliceSheetsChat {
  messages: AliceMessage[];
  isLoading: boolean;
  sessionId: string | null;
  sendMessage: (text: string, sheetContext: SheetContext, attachmentContext?: string | null) => Promise<SheetAction | null>;
  clearMessages: () => void;
  undoStack: SheetRow[][];
  pushUndo: (rows: SheetRow[]) => void;
  popUndo: () => SheetRow[] | null;
}

export function useAliceSheetsChat(): UseAliceSheetsChat {
  const { currentOrganization } = useOrganizationContext();
  const organizationId = currentOrganization?.id;
  const [messages, setMessages] = useState<AliceMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm **Alice**, your AI spreadsheet assistant 🧮\n\nI can help you sort, filter, summarize, and transform your data using plain English. Try asking me:\n- *\"Sort by amount descending\"*\n- *\"Add a totals row\"*\n- *\"Summarize by category\"*\n- *\"Filter rows where amount > 1000\"*",
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SheetRow[][]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushUndo = useCallback((rows: SheetRow[]) => {
    setUndoStack((prev) => [...prev.slice(-9), [...rows]]);
  }, []);

  const popUndo = useCallback((): SheetRow[] | null => {
    let result: SheetRow[] | null = null;
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      result = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return result;
  }, []);

  const saveConversation = useCallback(
    async (msgs: AliceMessage[], currentSessionId: string | null, sheetName: string) => {
      if (!organizationId) return;
      // Cast to any to avoid complex Json type constraints — data is always valid JSON
      const serialized = msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        action: m.action ? (m.action as unknown as Record<string, unknown>) : null,
        timestamp: m.timestamp.toISOString(),
      })) as unknown as import("@/integrations/supabase/types").Json;

      if (currentSessionId) {
        await supabase
          .from("ai_sheets_conversations")
          .update({ messages: serialized, sheet_name: sheetName, updated_at: new Date().toISOString() })
          .eq("session_id", currentSessionId);
      } else {
        const { data } = await supabase
          .from("ai_sheets_conversations")
          .insert([{ organization_id: organizationId, messages: serialized, sheet_name: sheetName }])
          .select("session_id")
          .single();
        if (data?.session_id) {
          setSessionId(data.session_id);
        }
      }
    },
    [organizationId]
  );

  const debouncedSave = useCallback(
    (msgs: AliceMessage[], sid: string | null, sheetName: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveConversation(msgs, sid, sheetName);
      }, 2000);
    },
    [saveConversation]
  );

  const sendMessage = useCallback(
    async (text: string, sheetContext: SheetContext, attachmentContext?: string | null): Promise<SheetAction | null> => {
      // Build user message — if a file was attached, prepend its content
      const fullContent = attachmentContext
        ? `${attachmentContext}\n\n---\nUser request: ${text}`
        : text;
      const userMessage: AliceMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text, // show only the user text in chat
        timestamp: new Date(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        // Build conversation history; inject attachment context into the last user message
        const historyMessages = newMessages
          .filter((m) => m.id !== "welcome")
          .slice(0, -1)
          .map((m) => ({ role: m.role, content: m.content }));

        const apiMessages = [
          ...historyMessages,
          { role: "user" as const, content: fullContent },
        ];

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          toast.error("You must be signed in to use Alice.");
          setIsLoading(false);
          return null;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alice-sheets-assistant`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              messages: apiMessages,
              sheetContext: {
                ...sheetContext,
                sampleRows: sheetContext.sampleRows.slice(0, 50),
              },
              hasAttachment: !!attachmentContext,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            toast.error("Rate limit reached — please wait a moment and try again.");
          } else if (response.status === 402) {
            toast.error("AI credits exhausted. Please add credits to your workspace.");
          } else {
            toast.error(errorData.error || "Alice encountered an error. Please try again.");
          }
          setIsLoading(false);
          return null;
        }

        const data = await response.json();
        const actionResult: SheetAction = data.result;

        const assistantMessage: AliceMessage = {
          id: `alice-${Date.now()}`,
          role: "assistant",
          content: actionResult.message,
          action: actionResult.action !== "reply_only" ? actionResult : undefined,
          timestamp: new Date(),
        };

        const finalMessages = [...newMessages, assistantMessage];
        setMessages(finalMessages);
        debouncedSave(finalMessages, sessionId, sheetContext.activeSheetName);

        return actionResult.action !== "reply_only" ? actionResult : null;
      } catch (err) {
        console.error("useAliceSheetsChat error:", err);
        toast.error("Failed to reach Alice. Please check your connection.");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, sessionId, debouncedSave]
  );

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi! I'm **Alice**, your AI spreadsheet assistant 🧮\n\nI can help you sort, filter, summarize, and transform your data using plain English. Try asking me:\n- *\"Sort by amount descending\"*\n- *\"Add a totals row\"*\n- *\"Summarize by category\"*\n- *\"Filter rows where amount > 1000\"*",
        timestamp: new Date(),
      },
    ]);
    setSessionId(null);
    setUndoStack([]);
  }, []);

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    clearMessages,
    undoStack,
    pushUndo,
    popUndo,
  };
}

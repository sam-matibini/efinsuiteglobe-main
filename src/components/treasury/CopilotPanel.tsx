import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Send, Bot, User, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useTreasuryCopilot, type CopilotMessage } from '@/hooks/useTreasuryCopilot';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';

interface TraceEntry { name: string; args: unknown; ms: number; rows: number; }
interface UiMessage extends CopilotMessage { trace?: TraceEntry[]; }

const SUGGESTIONS = [
  'Which periods are at risk of late filing?',
  'How many open anomalies do we have?',
  'Show me failed scheduled jobs in the last 24h.',
  'List my most recent NACHA/EFTPS submissions.',
];

export function CopilotPanel({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const { messages, createConversation } = useTreasuryCopilot(conversationId);
  const { currentOrganization } = useOrganizationContext();
  const [draft, setDraft] = useState('');
  const [localMsgs, setLocalMsgs] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !conversationId) {
      createConversation
        .mutateAsync(`Treasury chat — ${new Date().toLocaleDateString()}`)
        .then((c) => setConversationId(c.id))
        .catch(() => {});
    }
  }, [open, conversationId, createConversation]);

  useEffect(() => {
    if (messages.length) setLocalMsgs(messages as UiMessage[]);
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [localMsgs, streaming]);

  async function submit(text?: string) {
    const content = (text ?? draft).trim();
    if (!content || streaming || !currentOrganization?.id) return;
    const history = localMsgs.map((m) => ({ role: m.role, content: m.content }));
    setLocalMsgs((prev) => [...prev, { role: 'user', content }]);
    setDraft('');
    setStreaming(true);

    // Insert empty assistant placeholder we'll mutate as deltas stream in.
    setLocalMsgs((prev) => [...prev, { role: 'assistant', content: '', trace: [] }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `https://boskmqywofwekszhgryb.supabase.co/functions/v1/treasury-copilot`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvc2ttcXl3b2Z3ZWtzemhncnliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg1NDk0NiwiZXhwIjoyMDk4NDMwOTQ2fQ.a8XRlOigPcu3k3BMTQSkIHqeUpqW9IdZe7Okc9BJ43g',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          organization_id: currentOrganization.id,
          conversation_id: conversationId,
          messages: [...history, { role: 'user', content }],
          stream: true,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text();
        throw new Error(errText || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const block of parts) {
          const lines = block.split('\n');
          const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
          const data = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
          if (!event || !data) continue;
          try {
            const payload = JSON.parse(data);
            if (event === 'delta') {
              setLocalMsgs((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') last.content += payload.content;
                return copy;
              });
            } else if (event === 'tool') {
              setLocalMsgs((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') last.trace = [...(last.trace ?? []), payload];
                return copy;
              });
            } else if (event === 'error') {
              setLocalMsgs((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') last.content = `Error: ${payload.error}`;
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setLocalMsgs((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && !last.content) last.content = `Error: ${e instanceof Error ? e.message : 'stream failed'}`;
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" />Ask Copilot</Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Treasury Copilot</SheetTitle>
        </SheetHeader>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {localMsgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Ask anything about your remittances, filings, anomalies, jobs and alerts.</p>
              <div className="grid grid-cols-1 gap-2">
                {SUGGESTIONS.map((s) => (
                  <Card key={s} className="cursor-pointer hover:bg-accent" onClick={() => submit(s)}>
                    <CardContent className="p-3 text-sm">{s}</CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {localMsgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary/10' : 'bg-accent'}`}>
                {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {m.role === 'assistant' ? (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{m.content || (streaming && i === localMsgs.length - 1 ? '…' : '')}</ReactMarkdown>
                    </div>
                    {m.trace && m.trace.length > 0 && (
                      <Collapsible className="mt-2">
                        <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                          <ChevronDown className="h-3 w-3" />Trace ({m.trace.length})
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-1">
                          {m.trace.map((t, idx) => (
                            <div key={idx} className="text-xs bg-background/60 rounded px-2 py-1 font-mono">
                              <span className="font-semibold">{t.name}</span> · {t.rows} row{t.rows === 1 ? '' : 's'} · {t.ms}ms
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t p-3 space-y-2">
          <Textarea
            placeholder="Ask the copilot…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="min-h-[60px] resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => submit()} disabled={!draft.trim() || streaming}>
              <Send className="mr-2 h-4 w-4" />Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

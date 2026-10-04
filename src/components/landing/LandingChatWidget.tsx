import { useRef, useState } from 'react';
import { Calendar, Clock, Mail, MessageSquare, Phone, Send, UserPlus, Volume2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAliceTTS } from '@/hooks/useAliceTTS';
import {
  createLandingReceptionist,
  followUpHref,
  isLandingReceptionRequest,
  LANDING_DESK_EMAIL,
  LANDING_DESK_PHONE,
  LANDING_DESK_PHONE_LABEL,
  landingVisitLines,
  replyToLandingVisitor,
  visitorIntroduction,
  type LandingVisitor,
} from '@/lib/landing/landingReception';
import type { ReceptionOrg } from '@/lib/receptionist/types';
import aliceAvatar from '@/assets/alice-avatar.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isComplex?: boolean;
}

const GREETING_MESSAGE = `Hi there! 👋 I'm Alice, the AI receptionist for EFinSuite Globe.

I can help you with:
• Accounting, payroll, tax, and invoices
• Booking an appointment or leaving a message
• GST/HST, corporation tax, payroll, and T4 dates
• Email, SMS, or WhatsApp follow-up to the desk

Ask a question, or use the buttons below.`;

const COMPLEX_KEYWORDS = [
  'demo', 'trial', 'pricing', 'quote', 'enterprise', 'custom',
  'integration', 'api', 'migration', 'support', 'contract',
  'partnership', 'reseller', 'white-label', 'bulk', 'discount',
];

const QUICK_REQUESTS = [
  { label: 'Book', text: 'I would like to book an appointment.' },
  { label: 'Message', text: 'Please take a message.' },
  { label: 'Tax dates', text: 'When are the GST/HST and corporation tax filing dates?' },
  { label: 'Hours', text: 'When are you open?' },
] as const;

const EMPTY_VISITOR: LandingVisitor = { name: '', phone: '', email: '' };

interface LandingChatWidgetProps {
  today?: Date;
}

export const LandingChatWidget = ({ today }: LandingChatWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: GREETING_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [org, setOrg] = useState<ReceptionOrg>(() => createLandingReceptionist());
  const [visitor, setVisitor] = useState<LandingVisitor>(EMPTY_VISITOR);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactError, setContactError] = useState('');
  const [lastNote, setLastNote] = useState('Hello from the EFinSuite Globe website.');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const orgRef = useRef(org);
  const { speak, isSpeaking, isLoading: voiceLoading } = useAliceTTS();

  const note = lastNote.trim() || 'Hello from the EFinSuite Globe website.';
  const visitLines = landingVisitLines(org);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const append = (next: Message[]) => {
    setMessages((prev) => [...prev, ...next]);
    scrollToEnd();
  };

  const answerOnDesk = (text: string) => {
    const result = replyToLandingVisitor(orgRef.current, text, today);
    orgRef.current = result.org;
    setOrg(result.org);
    setLastNote(text);
    return result.reply;
  };

  const isComplexQuery = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return COMPLEX_KEYWORDS.some((keyword) => lowerText.includes(keyword));
  };

  const handleSendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || isLoading) return;

    const stamp = Date.now();
    setInput('');
    append([{ id: `${stamp}-user`, role: 'user', content: text }]);

    if (isLandingReceptionRequest(text)) {
      append([{ id: `${stamp}-assistant`, role: 'assistant', content: answerOnDesk(text) }]);
      return;
    }

    setIsLoading(true);
    try {
      const isComplex = isComplexQuery(text);
      const systemContext = `You are Alice, the AI receptionist for EFinSuite Globe - a professional accounting and business management platform. You're helping a visitor on the landing page.

Keep responses concise (2-3 sentences max) and helpful. Focus on:
- Explaining features briefly
- Highlighting benefits
- Answering common questions about accounting software

Reception requests (appointments, messages, tax dates, invoices) are handled separately. If the question seems complex, requires personalized pricing, demo scheduling, or detailed enterprise discussions, suggest they contact ${LANDING_DESK_EMAIL}.

Countries supported: Canada, USA, Zambia, Kenya, Burundi, Uganda.`;

      const history = messages.filter((item) => item.id !== '1').map((item) => ({ role: item.role, content: item.content }));
      const { data, error } = await supabase.functions.invoke('accounting-assistant', {
        body: {
          messages: [
            { role: 'system', content: systemContext },
            ...history,
            { role: 'user', content: text },
          ],
        },
      });

      if (error) throw error;

      let assistantContent = '';
      if (data && typeof data === 'object' && 'body' in data && data.body?.getReader) {
        const reader = data.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) assistantContent += content;
              } catch {
                // Skip invalid stream lines.
              }
            }
          }
        }
      } else if (typeof data === 'string') {
        assistantContent = data;
      } else if (data && typeof data === 'object' && typeof data.response === 'string') {
        assistantContent = data.response;
      }

      if (isComplex && !assistantContent.includes(LANDING_DESK_EMAIL)) {
        assistantContent += `\n\n📧 For personalized assistance, please reach out to **${LANDING_DESK_EMAIL}** - our team will be happy to help!`;
      }

      append([{
        id: `${stamp}-assistant`,
        role: 'assistant',
        content: assistantContent || "I'd be happy to help! Could you tell me more about what you're looking for?",
        isComplex,
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      append([{
        id: `${stamp}-assistant`,
        role: 'assistant',
        content: `I'm having trouble connecting right now. Please email us at **${LANDING_DESK_EMAIL}** and we'll get back to you promptly!`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveContact = () => {
    if (!visitor.name.trim() || (!visitor.phone.trim() && !visitor.email.trim())) {
      setContactError('Add a name and a phone or email.');
      return;
    }
    setContactError('');
    const intro = visitorIntroduction(visitor);
    const stamp = Date.now();
    append([
      { id: `${stamp}-user`, role: 'user', content: intro },
      { id: `${stamp}-assistant`, role: 'assistant', content: answerOnDesk(intro) },
    ]);
    setContactOpen(false);
  };

  const speakLatest = () => {
    const latest = [...messages].reverse().find((item) => item.role === 'assistant');
    void speak(latest?.content || GREETING_MESSAGE);
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-accent shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group ${isOpen ? 'scale-0' : 'scale-100'}`}
        aria-label="Chat with Alice"
      >
        <div className="relative">
          <img src={aliceAvatar} alt="Alice" className="w-12 h-12 rounded-full border-2 border-white/20" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </div>
      </button>

      <div
        className={`fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-1.5rem)] flex-col h-[min(680px,calc(100vh-1.5rem))] bg-card border border-border rounded-2xl shadow-2xl transition-all duration-300 origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 p-4 border-b border-border bg-accent/5 rounded-t-2xl shrink-0">
          <div className="relative">
            <img src={aliceAvatar} alt="" className="w-10 h-10 rounded-full border border-accent/30" />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Alice</h3>
            <p className="text-xs text-muted-foreground">AI Receptionist • ElevenLabs</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8" aria-label="Close chat">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <img src={aliceAvatar} alt="" className="w-8 h-8 rounded-full border border-accent/30 flex-shrink-0" />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-accent text-accent-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  {message.content.split('**').map((part, i) => (
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <img src={aliceAvatar} alt="" className="w-8 h-8 rounded-full border border-accent/30 flex-shrink-0" />
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-h-[46%] overflow-y-auto border-t border-border px-3 py-2 space-y-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REQUESTS.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isLoading}
                onClick={() => void handleSendText(item.text)}
              >
                {item.label === 'Book' && <Calendar className="w-3 h-3" />}
                {item.label === 'Message' && <MessageSquare className="w-3 h-3" />}
                {item.label === 'Tax dates' && <Calendar className="w-3 h-3" />}
                {item.label === 'Hours' && <Clock className="w-3 h-3" />}
                {item.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={speakLatest}
              disabled={voiceLoading}
              aria-label="Speak"
            >
              <Volume2 className="w-3 h-3" />
              {isSpeaking || voiceLoading ? 'Speaking…' : 'Speak'}
            </Button>
          </div>

          {visitLines.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-0.5" aria-label="This visit">
              {visitLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-accent inline-flex items-center gap-1"
            onClick={() => setContactOpen((open) => !open)}
          >
            <UserPlus className="w-3 h-3" />
            Add your contact
          </button>
          {contactOpen && (
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="landing-visitor-name">Name</label>
              <Input id="landing-visitor-name" value={visitor.name} onChange={(event) => setVisitor((current) => ({ ...current, name: event.target.value }))} className="h-8 text-sm" />
              <label className="text-xs text-muted-foreground" htmlFor="landing-visitor-phone">Cell / phone</label>
              <Input id="landing-visitor-phone" value={visitor.phone} onChange={(event) => setVisitor((current) => ({ ...current, phone: event.target.value }))} className="h-8 text-sm" />
              <label className="text-xs text-muted-foreground" htmlFor="landing-visitor-email">Email</label>
              <Input id="landing-visitor-email" type="email" value={visitor.email} onChange={(event) => setVisitor((current) => ({ ...current, email: event.target.value }))} className="h-8 text-sm" />
              {contactError && <p className="text-xs text-destructive" role="alert">{contactError}</p>}
              <Button type="button" size="sm" className="h-8" onClick={saveContact}>Save contact</Button>
            </div>
          )}

          <p className="text-[11px] leading-snug text-muted-foreground">
            Follow-up opens on your device to the eFinTax desk at {LANDING_DESK_EMAIL}.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={followUpHref('email', note, visitor)} aria-label="Email the desk"><Mail className="w-3 h-3" />Email</a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={followUpHref('sms', note, visitor)} aria-label="Text the desk"><MessageSquare className="w-3 h-3" />SMS</a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
              <a href={followUpHref('whatsapp', note, visitor)} aria-label="WhatsApp the desk"><MessageSquare className="w-3 h-3" />WhatsApp</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <a href={`tel:${LANDING_DESK_PHONE}`} aria-label="Call the desk"><Phone className="w-3 h-3" />{LANDING_DESK_PHONE_LABEL}</a>
            </Button>
          </div>
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSendText(input);
                }
              }}
              placeholder="Type your question..."
              aria-label="Type your question"
              className="flex-1 rounded-full bg-muted/50"
              disabled={isLoading}
            />
            <Button size="icon" onClick={() => void handleSendText(input)} disabled={!input.trim() || isLoading} className="rounded-full" aria-label="Send">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

import { useState, useRef, useEffect } from 'react';
import { X, Send, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import aliceAvatar from '@/assets/alice-avatar.png';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isComplex?: boolean;
}

const GREETING_MESSAGE = `Hi there! 👋 I'm Alice, your AI assistant for EFinSuite Globe.

I can help you with:
• Understanding our accounting & bookkeeping features
• Learning about multi-currency and multi-jurisdiction support
• Exploring our AI-powered insights
• Pricing and plans information

What brings you here today?`;

const COMPLEX_KEYWORDS = [
  'demo', 'trial', 'pricing', 'quote', 'enterprise', 'custom', 
  'integration', 'api', 'migration', 'support', 'contract',
  'partnership', 'reseller', 'white-label', 'bulk', 'discount'
];

export const LandingChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: GREETING_MESSAGE }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const isComplexQuery = (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return COMPLEX_KEYWORDS.some(keyword => lowerText.includes(keyword));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Check if it's a complex query that should be routed to email
      const isComplex = isComplexQuery(userMessage.content);

      const systemContext = `You are Alice, the AI assistant for EFinSuite Globe - a professional accounting and business management platform. You're helping a visitor on the landing page understand the product.

Keep responses concise (2-3 sentences max) and helpful. Focus on:
- Explaining features briefly
- Highlighting benefits
- Answering common questions about accounting software

If the question seems complex, requires personalized pricing, demo scheduling, or detailed enterprise discussions, suggest they contact info@efintax.biz for personalized assistance.

Countries supported: Canada, USA, Zambia, Kenya, Burundi, Uganda.`;

      const { data, error } = await supabase.functions.invoke('accounting-assistant', {
        body: {
          messages: [
            { role: 'system', content: systemContext },
            ...messages.filter(m => m.id !== '1').map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage.content }
          ]
        }
      });

      if (error) throw error;

      // Handle streaming response
      let assistantContent = '';
      
      if (data && typeof data === 'object' && 'body' in data) {
        const reader = data.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const json = JSON.parse(line.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  assistantContent += content;
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } else if (typeof data === 'string') {
        assistantContent = data;
      }

      // Add complex query suggestion if needed
      if (isComplex && !assistantContent.includes('info@efintax.biz')) {
        assistantContent += '\n\n📧 For personalized assistance, please reach out to **info@efintax.biz** - our team will be happy to help!';
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent || "I'd be happy to help! Could you tell me more about what you're looking for?",
        isComplex
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please email us at **info@efintax.biz** and we'll get back to you promptly!"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmailClick = () => {
    window.location.href = 'mailto:info@efintax.biz?subject=Enquiry from EFinSuite Globe Website';
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-accent shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group ${isOpen ? 'scale-0' : 'scale-100'}`}
        aria-label="Chat with Alice"
      >
        <div className="relative">
          <img 
            src={aliceAvatar} 
            alt="Alice" 
            className="w-12 h-12 rounded-full border-2 border-white/20"
          />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
        </div>
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-card border border-border rounded-2xl shadow-2xl transition-all duration-300 origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border bg-accent/5 rounded-t-2xl">
          <div className="relative">
            <img 
              src={aliceAvatar} 
              alt="Alice" 
              className="w-10 h-10 rounded-full border border-accent/30"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Alice</h3>
            <p className="text-xs text-muted-foreground">AI Assistant • Online</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="h-[350px] p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <img 
                    src={aliceAvatar} 
                    alt="Alice" 
                    className="w-8 h-8 rounded-full border border-accent/30 flex-shrink-0"
                  />
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-accent text-accent-foreground rounded-br-md'
                      : 'bg-muted text-foreground rounded-bl-md'
                  }`}
                >
                  {message.content.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <img 
                  src={aliceAvatar} 
                  alt="Alice" 
                  className="w-8 h-8 rounded-full border border-accent/30 flex-shrink-0"
                />
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              className="flex-1 rounded-full bg-muted/50"
              disabled={isLoading}
            />
            <Button 
              size="icon" 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="rounded-full"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <button
            onClick={handleEmailClick}
            className="w-full mt-2 text-xs text-muted-foreground hover:text-accent flex items-center justify-center gap-1.5 py-1.5 transition-colors"
          >
            <Mail className="w-3 h-3" />
            Prefer email? Contact info@efintax.biz
          </button>
        </div>
      </div>
    </>
  );
};

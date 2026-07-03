import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sparkles,
  Send,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { BudgetMaster, BudgetLineItem } from '@/types/budget';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';

interface AIBudgetAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetMaster;
  lineItems: BudgetLineItem[];
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: AISuggestion[];
}

interface AISuggestion {
  type: 'add' | 'modify' | 'alert' | 'insight';
  title: string;
  description: string;
  action?: string;
}

export function AIBudgetAssistant({
  open,
  onOpenChange,
  budget,
  lineItems,
}: AIBudgetAssistantProps) {
  const { formatCurrency } = useLocalizedCurrency();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: `I'm your AI Budget Assistant for "${budget.name}". I can help you with:\n\n• Analyzing your budget and suggesting optimizations\n• Generating budget line items based on historical data\n• Identifying potential risks and opportunities\n• Answering questions about budgeting best practices\n\nWhat would you like help with?`,
      suggestions: [
        {
          type: 'add',
          title: 'Generate Line Items',
          description: 'Automatically create budget lines based on historical patterns',
          action: 'generate_lines',
        },
        {
          type: 'insight',
          title: 'Analyze Current Budget',
          description: 'Get insights on spending patterns and optimization opportunities',
          action: 'analyze',
        },
        {
          type: 'alert',
          title: 'Risk Assessment',
          description: 'Identify potential budget risks and mitigation strategies',
          action: 'risk_assessment',
        },
      ],
    },
  ]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: AIMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: AIMessage = {
        role: 'assistant',
        content: generateMockResponse(input, budget, lineItems),
        suggestions: generateMockSuggestions(input),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleSuggestionClick = (suggestion: AISuggestion) => {
    setInput(suggestion.title);
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'add':
        return <Sparkles className="h-4 w-4 text-purple-500" />;
      case 'modify':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case 'alert':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'insight':
        return <Lightbulb className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:max-w-[500px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Budget Assistant
          </SheetTitle>
          <SheetDescription>
            Get AI-powered insights and suggestions for your budget
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4">
          {/* Budget Context */}
          <Card className="mb-4">
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Budget:</span>
                <span className="font-medium">{budget.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-medium">
                  {formatCurrency(lineItems.reduce((sum, item) => sum + (item.annual_total || 0), 0))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Line Items:</span>
                <span className="font-medium">{lineItems.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Messages */}
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{message.content}</p>
                    
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.suggestions.map((suggestion, sIndex) => (
                          <div
                            key={sIndex}
                            className="flex items-start gap-2 p-2 bg-background rounded-md cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {getSuggestionIcon(suggestion.type)}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{suggestion.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {suggestion.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="mt-4 flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me about your budget..."
              className="min-h-[60px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Mock response generator
function generateMockResponse(input: string, budget: BudgetMaster, lineItems: BudgetLineItem[]): string {
  const total = lineItems.reduce((sum, item) => sum + (item.annual_total || 0), 0);
  const inputLower = input.toLowerCase();

  if (inputLower.includes('generate') || inputLower.includes('create')) {
    return `Based on typical ${budget.budget_type.replace('_', ' ')} patterns, I recommend the following budget structure:\n\n1. **Personnel Costs** (40-50% of budget)\n   - Salaries and wages\n   - Benefits and insurance\n   - Training and development\n\n2. **Operating Expenses** (30-35%)\n   - Rent and utilities\n   - Office supplies\n   - Technology and software\n\n3. **Marketing & Sales** (10-15%)\n   - Advertising\n   - Promotional materials\n   - Events\n\n4. **Reserve/Contingency** (5-10%)\n\nWould you like me to create these line items with suggested amounts?`;
  }

  if (inputLower.includes('analyze') || inputLower.includes('insight')) {
    return `Here's my analysis of your current budget:\n\n📊 **Budget Overview**\n• Total Budget: ${total.toLocaleString()} ${budget.currency}\n• Number of Line Items: ${lineItems.length}\n\n💡 **Insights**\n${lineItems.length === 0 
      ? '• Your budget has no line items yet. Consider starting with major expense categories.'
      : `• Your budget has ${lineItems.length} line items\n• Average monthly spend: ${(total / 12).toLocaleString()} ${budget.currency}`
    }\n\n⚠️ **Recommendations**\n• Consider adding a contingency reserve (5-10% of total)\n• Review line items quarterly for variance analysis\n• Link line items to GL accounts for better tracking`;
  }

  if (inputLower.includes('risk')) {
    return `🔍 **Risk Assessment for ${budget.name}**\n\n**High Priority Risks:**\n1. **Inflation Impact** - Consider 3-5% buffer for cost increases\n2. **Revenue Dependency** - Diversify income sources if possible\n\n**Medium Priority:**\n3. **FX Exposure** - Monitor if dealing with multi-currency\n4. **Seasonal Variations** - Plan for cash flow fluctuations\n\n**Mitigation Strategies:**\n• Build rolling forecasts for early warning\n• Establish approval thresholds for overruns\n• Create scenario versions for contingency planning`;
  }

  return `I understand you're asking about "${input}". Here's what I can tell you:\n\nFor your ${budget.budget_type.replace('_', ' ')} budget, I recommend:\n\n1. Regularly reviewing actuals vs. budget\n2. Setting up variance alerts for key line items\n3. Using driver-based budgeting for production costs\n\nWould you like me to elaborate on any of these points?`;
}

function generateMockSuggestions(input: string): AISuggestion[] {
  const inputLower = input.toLowerCase();

  if (inputLower.includes('generate') || inputLower.includes('create')) {
    return [
      { type: 'add', title: 'Create Standard Template', description: 'Generate common expense categories' },
      { type: 'add', title: 'Import from History', description: 'Use last year\'s budget as baseline' },
    ];
  }

  if (inputLower.includes('analyze')) {
    return [
      { type: 'insight', title: 'Deep Dive Analysis', description: 'Get detailed breakdown by category' },
      { type: 'alert', title: 'Find Anomalies', description: 'Identify unusual spending patterns' },
    ];
  }

  return [];
}

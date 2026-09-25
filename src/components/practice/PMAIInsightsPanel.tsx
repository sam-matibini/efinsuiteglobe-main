import { Lightbulb, X, AlertTriangle, TrendingDown, Clock, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PMAIInsight } from '@/types/practiceManagement';

interface PMAIInsightsPanelProps {
  insights: PMAIInsight[];
  onDismiss: (id: string) => void;
}

export function PMAIInsightsPanel({ insights, onDismiss }: PMAIInsightsPanelProps) {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'late_filing_risk': return AlertTriangle;
      case 'low_margin_client': return TrendingDown;
      case 'underbilling': return Clock;
      case 'staff_reallocation': return Users;
      default: return Lightbulb;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-destructive bg-destructive/5';
      case 'medium': return 'border-orange-500 bg-orange-50 dark:bg-orange-950/20';
      default: return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  if (insights.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Insights</span>
          <Badge variant="secondary">{insights.length} new</Badge>
        </div>
        <div className="space-y-2">
          {insights.slice(0, 3).map((insight) => {
            const Icon = getInsightIcon(insight.insight_type);
            return (
              <div
                key={insight.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(insight.severity)}`}
              >
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{insight.title}</p>
                    <Badge variant={getSeverityBadge(insight.severity) as 'destructive' | 'default' | 'secondary'}>
                      {insight.severity}
                    </Badge>
                  </div>
                  {insight.description && (
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                  )}
                  {insight.recommended_action && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">Recommended:</span> {insight.recommended_action}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => onDismiss(insight.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {insights.length > 3 && (
            <Button variant="link" className="w-full">
              View all {insights.length} insights
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

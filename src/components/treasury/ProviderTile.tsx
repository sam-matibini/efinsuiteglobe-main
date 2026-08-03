import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Props {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  title: string;
  description: string;
  /** True when the provider has usable configuration (accounts, recipients...). */
  configured?: boolean;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  stat?: string;
  children?: ReactNode;
}

export function ProviderTile({
  icon: Icon,
  iconClassName,
  title,
  description,
  configured,
  enabled,
  onToggle,
  stat,
  children,
}: Props) {
  const status = !enabled ? 'Off' : configured ? 'Active' : 'Not configured';
  return (
    <Card className={cn('transition-opacity', !enabled && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className={cn('h-5 w-5 text-muted-foreground', iconClassName)} />
              <span className="truncate">{title}</span>
              <Badge variant={enabled && configured ? 'default' : 'secondary'}>{status}</Badge>
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Enable ${title}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stat && <div className="text-sm text-muted-foreground">{stat}</div>}
        <div className={cn(!enabled && 'pointer-events-none opacity-50')}>{children}</div>
      </CardContent>
    </Card>
  );
}

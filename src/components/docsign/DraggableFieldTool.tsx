import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableFieldToolProps {
  id: string;
  label: string;
  icon: LucideIcon;
  color?: string;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent, toolId: string) => void;
  onDragEnd?: () => void;
}

export function DraggableFieldTool({
  id,
  label,
  icon: Icon,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
}: DraggableFieldToolProps) {
  return (
    <button
      draggable
      onDragStart={(e) => onDragStart(e, id)}
      onDragEnd={() => onDragEnd?.()}
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-all',
        'hover:bg-muted/60 cursor-pointer active:cursor-grabbing',
        'border-b border-border/30 last:border-b-0',
        isSelected && 'bg-accent/10 text-accent'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent' : 'text-muted-foreground')} />
      <span className={cn('font-medium', isSelected ? 'text-accent' : 'text-foreground')}>{label}</span>
    </button>
  );
}

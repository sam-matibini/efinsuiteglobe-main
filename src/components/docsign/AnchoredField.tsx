import { useRef, useState, useCallback, useEffect } from 'react';
import {
  PenTool,
  User,
  Type,
  Calendar,
  CheckSquare,
  Stamp,
  Mail,
  Building2,
  Briefcase,
  UserCircle,
  Trash2,
  UserCheck,
  GripHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type FieldToolType = 
  | 'signature' 
  | 'initial' 
  | 'full_name' 
  | 'first_name' 
  | 'last_name' 
  | 'email' 
  | 'company' 
  | 'title' 
  | 'date' 
  | 'checkbox' 
  | 'text' 
  | 'stamp';

interface AnchoredFieldProps {
  id: string;
  type: FieldToolType;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  isRequired: boolean;
  isSelected: boolean;
  isSenderField: boolean;
  canInteract: boolean;
  signerColor: string;
  mode: 'edit' | 'sign' | 'view';
  onSelect: () => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  onPositionChange: (x: number, y: number) => void;
  onSizeChange: (width: number, height: number, x?: number, y?: number) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const FIELD_ICONS: Record<FieldToolType, React.ComponentType<{ className?: string }>> = {
  signature: PenTool,
  initial: Type,
  full_name: User,
  first_name: UserCircle,
  last_name: UserCircle,
  email: Mail,
  company: Building2,
  title: Briefcase,
  date: Calendar,
  checkbox: CheckSquare,
  text: Type,
  stamp: Stamp,
};

const FIELD_LABELS: Record<FieldToolType, string> = {
  signature: 'Signature',
  initial: 'Initials',
  full_name: 'Full Name',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  company: 'Company',
  title: 'Title',
  date: 'Date',
  checkbox: 'Checkbox',
  text: 'Text',
  stamp: 'Stamp',
};

export function AnchoredField({
  id,
  type,
  x,
  y,
  width,
  height,
  value,
  isRequired,
  isSelected,
  isSenderField,
  canInteract,
  signerColor,
  mode,
  onSelect,
  onDoubleClick,
  onDelete,
  onPositionChange,
  onSizeChange,
  containerRef,
}: AnchoredFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x, y, width, height });

  const Icon = FIELD_ICONS[type];
  const isSignatureLike = type === 'signature' || type === 'initial';
  const isTextLike = ['full_name', 'first_name', 'last_name', 'email', 'company', 'title', 'text', 'date'].includes(type);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode !== 'edit') return;

    onSelect();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartPos({ x, y, width, height });
  }, [mode, onSelect, x, y, width, height]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    if (mode !== 'edit') return;

    onSelect();
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartPos({ x, y, width, height });
  }, [mode, onSelect, x, y, width, height]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - dragStart.x) / rect.width) * 100;
      const deltaYPercent = ((e.clientY - dragStart.y) / rect.height) * 100;

      if (isDragging) {
        const newX = Math.max(0, Math.min(100 - startPos.width, startPos.x + deltaXPercent));
        const newY = Math.max(0, Math.min(100 - startPos.height, startPos.y + deltaYPercent));
        onPositionChange(newX, newY);
      }

      if (isResizing && resizeHandle) {
        let newX = startPos.x;
        let newY = startPos.y;
        let newWidth = startPos.width;
        let newHeight = startPos.height;

        // Horizontal resizing
        if (resizeHandle.includes('e')) {
          newWidth = Math.max(3, startPos.width + deltaXPercent);
        }
        if (resizeHandle.includes('w')) {
          const widthDelta = Math.min(deltaXPercent, startPos.width - 3);
          newX = startPos.x + widthDelta;
          newWidth = startPos.width - widthDelta;
        }

        // Vertical resizing
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(2, startPos.height + deltaYPercent);
        }
        if (resizeHandle.includes('n')) {
          const heightDelta = Math.min(deltaYPercent, startPos.height - 2);
          newY = startPos.y + heightDelta;
          newHeight = startPos.height - heightDelta;
        }

        // Clamp to container bounds
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        newWidth = Math.min(100 - newX, newWidth);
        newHeight = Math.min(100 - newY, newHeight);

        onSizeChange(newWidth, newHeight, newX, newY);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeHandle, dragStart, startPos, containerRef, onPositionChange, onSizeChange]);

  const renderContent = () => {
    // Signature/Initial with value
    if (value && isSignatureLike) {
      return (
         <img
          src={value}
          alt={type === 'initial' ? 'Initials' : 'Signature'}
          className="absolute inset-0 w-full h-full object-contain p-1"
          style={{ mixBlendMode: 'multiply' }}
          draggable={false}
        />
      );
    }

    // Stamp with value
    if (value && type === 'stamp') {
      return (
         <img
          src={value}
          alt="Stamp"
          className="absolute inset-0 w-full h-full object-contain p-1"
          style={{ mixBlendMode: 'multiply' }}
          draggable={false}
        />
      );
    }

    // Checkbox with value
    if (type === 'checkbox') {
      if (value === 'true') {
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-accent" />
          </div>
        );
      }
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-muted-foreground/50 rounded-sm" />
        </div>
      );
    }

    // Text-like fields with value
    if (value && isTextLike) {
      return (
        <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
          <span className="text-xs font-medium text-foreground truncate">{value}</span>
        </div>
      );
    }

    // Empty field placeholder
    const placeholderText = isSignatureLike
      ? canInteract
        ? 'Double-click to sign'
        : 'Assigned to another'
      : FIELD_LABELS[type];

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1 overflow-hidden bg-white/80">
        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-[9px] text-muted-foreground/70 truncate max-w-full leading-none text-center">
          {placeholderText}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={fieldRef}
      data-field="true"
      data-field-id={id}
      className={cn(
        'absolute rounded transition-shadow pointer-events-auto group',
        value ? 'border-0' : 'border-2 border-foreground/60',
        !value && signerColor,
        isSelected && !value && 'ring-2 ring-accent ring-offset-1 shadow-lg',
        mode === 'edit' && 'cursor-move hover:shadow-md',
        isSignatureLike && !value && canInteract && 'cursor-pointer',
        isDragging && 'opacity-80 shadow-xl',
        isResizing && 'opacity-90'
      )}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
        minWidth: '30px',
        minHeight: '20px',
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (canInteract) onDoubleClick();
      }}
    >
      {/* Drag handle for better UX - only when no value */}
      {mode === 'edit' && isSelected && !value && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-accent text-white px-2 py-0.5 rounded-t text-[10px] font-medium flex items-center gap-1 whitespace-nowrap">
          <GripHorizontal className="w-3 h-3" />
          {FIELD_LABELS[type]}
        </div>
      )}

      {/* Delete button - available for all fields in edit mode */}
      {mode === 'edit' && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-destructive/90 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete field"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Required indicator */}
      {isRequired && !value && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full z-20" />
      )}

      {/* Sender indicator - only when no value */}
      {isSenderField && !isSelected && !value && (
        <span className="absolute -top-1 -left-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center z-20 shadow-sm">
          <UserCheck className="w-2.5 h-2.5 text-white" />
        </span>
      )}

      {/* Field content */}
      {renderContent()}

      {/* Resize handles - DocuSign/Adobe style */}
      {isSelected && mode === 'edit' && !value && (
        <>
          {/* Corner handles */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-accent border-2 border-white rounded-sm cursor-nw-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
          <div
            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-accent border-2 border-white rounded-sm cursor-ne-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div
            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-accent border-2 border-white rounded-sm cursor-sw-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div
            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-accent border-2 border-white rounded-sm cursor-se-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />
          {/* Edge handles */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-accent border-2 border-white rounded-sm cursor-n-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
          />
          <div
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2 bg-accent border-2 border-white rounded-sm cursor-s-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
          />
          <div
            className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-4 bg-accent border-2 border-white rounded-sm cursor-w-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
          />
          <div
            className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-4 bg-accent border-2 border-white rounded-sm cursor-e-resize z-30 shadow-sm hover:bg-accent/80"
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
          />
        </>
      )}
    </div>
  );
}

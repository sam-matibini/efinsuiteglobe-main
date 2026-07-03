import { useState, useEffect, ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleReportSectionProps {
  title: string;
  total?: string | ReactNode;
  comparativeTotals?: (string | ReactNode)[];
  children: ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  level?: 'section' | 'subsection';
  className?: string;
  totalClassName?: string;
  titleClassName?: string;
  showTotalRow?: boolean;
  totalLabel?: string;
  isGrandTotal?: boolean;
}

/**
 * CollapsibleReportSection - Reusable expandable/collapsible section for financial statements
 * 
 * Features:
 * - Supports controlled and uncontrolled modes
 * - Animated expand/collapse with smooth transitions
 * - Configurable styling for different hierarchy levels
 * - Shows section total when collapsed
 * - Maintains GAAP-compliant formatting
 */
export function CollapsibleReportSection({
  title,
  total,
  comparativeTotals = [],
  children,
  defaultExpanded = true,
  isExpanded: controlledExpanded,
  onToggle,
  level = 'section',
  className,
  totalClassName,
  titleClassName,
  showTotalRow = true,
  totalLabel,
  isGrandTotal = false,
}: CollapsibleReportSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  
  // Support both controlled and uncontrolled modes
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  
  // Sync with external expanded state
  useEffect(() => {
    if (controlledExpanded !== undefined) {
      setInternalExpanded(controlledExpanded);
    }
  }, [controlledExpanded]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setInternalExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  const sectionStyles = {
    section: {
      header: 'bg-muted/50 border-t border-border font-semibold',
      title: 'text-foreground',
      icon: 'h-4 w-4',
    },
    subsection: {
      header: 'bg-muted/20',
      title: 'text-foreground/80',
      icon: 'h-3.5 w-3.5',
    },
  };

  const styles = sectionStyles[level];

  return (
    <>
      {/* Section Header Row - Always visible */}
      <tr 
        className={cn(
          'cursor-pointer hover:bg-muted/60 transition-colors select-none',
          styles.header,
          className
        )}
        onClick={handleToggle}
      >
        <td className={cn('py-3 px-4', titleClassName)}>
          <div className="flex items-center gap-2">
            <span className="transition-transform duration-200">
              {isExpanded ? (
                <ChevronDown className={cn(styles.icon, 'text-muted-foreground')} />
              ) : (
                <ChevronRight className={cn(styles.icon, 'text-muted-foreground')} />
              )}
            </span>
            <span className={styles.title}>{title}</span>
          </div>
        </td>
        {/* Show total when collapsed */}
        {!isExpanded && total !== undefined && (
          <>
            <td className={cn('py-3 px-4 text-right font-mono font-semibold', totalClassName)}>
              {total}
            </td>
            {comparativeTotals.map((compTotal, idx) => (
              <td key={idx} className="py-3 px-4 text-right font-mono">
                {compTotal}
              </td>
            ))}
          </>
        )}
        {/* Empty cells when expanded or no total */}
        {(isExpanded || total === undefined) && (
          <>
            <td className="py-3 px-4"></td>
            {comparativeTotals.map((_, idx) => (
              <td key={idx} className="py-3 px-4"></td>
            ))}
          </>
        )}
      </tr>

      {/* Children - Only shown when expanded */}
      {isExpanded && children}

      {/* Total Row - Shown when expanded and showTotalRow is true */}
      {isExpanded && showTotalRow && total !== undefined && (
        <tr className={cn(
          'border-t border-border',
          isGrandTotal ? 'bg-primary/5 font-bold border-t-2' : 'bg-muted/30 font-semibold'
        )}>
          <td className="py-2.5 px-4 pl-8">
            {totalLabel || `Total for ${title}`}
          </td>
          <td className={cn(
            'py-2.5 px-4 text-right font-mono',
            isGrandTotal && 'border-t-2 border-b-4 border-double border-foreground/20',
            totalClassName
          )}>
            {total}
          </td>
          {comparativeTotals.map((compTotal, idx) => (
            <td key={idx} className={cn(
              'py-2.5 px-4 text-right font-mono',
              isGrandTotal && 'border-t-2 border-b-4 border-double border-foreground/20'
            )}>
              {compTotal}
            </td>
          ))}
        </tr>
      )}
    </>
  );
}

/**
 * Hook to manage multiple collapsible sections with expand/collapse all functionality
 */
export function useCollapsibleSections(sectionIds: string[], defaultExpanded = true) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sectionIds.map(id => [id, defaultExpanded]))
  );

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    setExpandedSections(Object.fromEntries(sectionIds.map(id => [id, true])));
  };

  const collapseAll = () => {
    setExpandedSections(Object.fromEntries(sectionIds.map(id => [id, false])));
  };

  const isExpanded = (id: string) => expandedSections[id] ?? defaultExpanded;

  const allExpanded = Object.values(expandedSections).every(v => v);
  const allCollapsed = Object.values(expandedSections).every(v => !v);

  return {
    expandedSections,
    toggleSection,
    expandAll,
    collapseAll,
    isExpanded,
    allExpanded,
    allCollapsed,
  };
}

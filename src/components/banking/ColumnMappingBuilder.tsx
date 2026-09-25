import { useState, useMemo } from 'react';
import { Plus, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: 'none' | 'abs' | 'negate' | 'trim' | 'uppercase' | 'lowercase' | 'date';
  defaultValue?: string;
}

interface ColumnMappingBuilderProps {
  availableColumns: string[];
  targetFields: {
    id: string;
    label: string;
    required?: boolean;
    type?: 'string' | 'number' | 'date';
  }[];
  mappings: ColumnMapping[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  className?: string;
}

export function ColumnMappingBuilder({
  availableColumns,
  targetFields,
  mappings,
  onMappingsChange,
  className,
}: ColumnMappingBuilderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const addMapping = (targetField: string) => {
    if (mappings.some(m => m.targetField === targetField)) return;
    onMappingsChange([
      ...mappings,
      { sourceColumn: '', targetField, transform: 'none' },
    ]);
  };

  const updateMapping = (index: number, updates: Partial<ColumnMapping>) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onMappingsChange(newMappings);
  };

  const removeMapping = (index: number) => {
    onMappingsChange(mappings.filter((_, i) => i !== index));
  };

  const unmappedFields = targetFields.filter(
    f => !mappings.some(m => m.targetField === f.id)
  );

  const getFieldLabel = (fieldId: string) => {
    return targetFields.find(f => f.id === fieldId)?.label || fieldId;
  };

  const isRequired = (fieldId: string) => {
    return targetFields.find(f => f.id === fieldId)?.required;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Column Mappings</Label>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-advanced"
            checked={showAdvanced}
            onCheckedChange={(checked) => setShowAdvanced(!!checked)}
          />
          <label htmlFor="show-advanced" className="text-xs text-muted-foreground cursor-pointer">
            Show transforms
          </label>
        </div>
      </div>

      {/* Current Mappings */}
      <div className="space-y-2">
        {mappings.map((mapping, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border"
          >
            <div className="flex-1 grid grid-cols-2 gap-2">
              {/* Target Field */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Field {isRequired(mapping.targetField) && <span className="text-destructive">*</span>}
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {getFieldLabel(mapping.targetField)}
                  </Badge>
                </div>
              </div>

              {/* Source Column */}
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Source Column
                </span>
                <Select
                  value={mapping.sourceColumn}
                  onValueChange={(value) => updateMapping(index, { sourceColumn: value })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map(col => (
                      <SelectItem key={col} value={col} className="text-xs">
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Transform (Advanced) */}
            {showAdvanced && (
              <div className="w-24">
                <Select
                  value={mapping.transform || 'none'}
                  onValueChange={(value) => updateMapping(index, { transform: value as ColumnMapping['transform'] })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">None</SelectItem>
                    <SelectItem value="trim" className="text-xs">Trim</SelectItem>
                    <SelectItem value="abs" className="text-xs">Absolute</SelectItem>
                    <SelectItem value="negate" className="text-xs">Negate</SelectItem>
                    <SelectItem value="uppercase" className="text-xs">Uppercase</SelectItem>
                    <SelectItem value="lowercase" className="text-xs">Lowercase</SelectItem>
                    <SelectItem value="date" className="text-xs">Parse Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Default Value (Advanced) */}
            {showAdvanced && (
              <Input
                placeholder="Default"
                value={mapping.defaultValue || ''}
                onChange={(e) => updateMapping(index, { defaultValue: e.target.value })}
                className="w-20 h-8 text-xs"
              />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeMapping(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Mapping Button */}
      {unmappedFields.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Plus className="h-3 w-3 mr-1" />
              Add Column Mapping
              <ChevronDown className="h-3 w-3 ml-auto" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {unmappedFields.map(field => (
                <button
                  key={field.id}
                  onClick={() => addMapping(field.id)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center justify-between"
                >
                  {field.label}
                  {field.required && (
                    <span className="text-destructive text-xs">Required</span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Missing Required Fields Warning */}
      {targetFields.filter(f => f.required && !mappings.some(m => m.targetField === f.id)).length > 0 && (
        <p className="text-xs text-destructive">
          Missing required fields: {targetFields
            .filter(f => f.required && !mappings.some(m => m.targetField === f.id))
            .map(f => f.label)
            .join(', ')}
        </p>
      )}
    </div>
  );
}

// Helper function to apply transforms
export function applyTransform(
  value: unknown,
  transform: ColumnMapping['transform'],
  defaultValue?: string
): unknown {
  if (value === null || value === undefined || value === '') {
    return defaultValue ?? value;
  }

  const strValue = String(value);

  switch (transform) {
    case 'trim':
      return strValue.trim();
    case 'uppercase':
      return strValue.toUpperCase();
    case 'lowercase':
      return strValue.toLowerCase();
    case 'abs':
      const num = parseFloat(strValue.replace(/[$,]/g, ''));
      return isNaN(num) ? 0 : Math.abs(num);
    case 'negate':
      const negNum = parseFloat(strValue.replace(/[$,]/g, ''));
      return isNaN(negNum) ? 0 : -Math.abs(negNum);
    case 'date':
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? strValue : date.toISOString().split('T')[0];
    default:
      return value;
  }
}

// Helper to apply all mappings to a row
export function applyMappings(
  row: Record<string, unknown>,
  mappings: ColumnMapping[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    if (mapping.sourceColumn) {
      const rawValue = row[mapping.sourceColumn];
      result[mapping.targetField] = applyTransform(
        rawValue,
        mapping.transform,
        mapping.defaultValue
      );
    } else if (mapping.defaultValue) {
      result[mapping.targetField] = mapping.defaultValue;
    }
  }

  return result;
}

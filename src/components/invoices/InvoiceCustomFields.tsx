import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CustomField {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'date';
}

interface InvoiceCustomFieldsProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  isEditable: boolean;
}

// Preset field templates for Bill of Sale
const PRESET_TEMPLATES = [
  { label: 'Vehicle Make', type: 'text' as const },
  { label: 'Vehicle Model', type: 'text' as const },
  { label: 'Vehicle Year', type: 'number' as const },
  { label: 'VIN Number', type: 'text' as const },
  { label: 'License Plate', type: 'text' as const },
  { label: 'Odometer Reading', type: 'number' as const },
  { label: 'Color', type: 'text' as const },
  { label: 'Condition', type: 'text' as const },
  { label: 'Sale Date', type: 'date' as const },
  { label: 'Warranty Terms', type: 'text' as const },
  { label: 'Serial Number', type: 'text' as const },
  { label: 'Asset Tag', type: 'text' as const },
];

export function InvoiceCustomFields({ fields, onChange, isEditable }: InvoiceCustomFieldsProps) {
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');

  const addField = () => {
    if (!newFieldLabel.trim()) return;

    const newField: CustomField = {
      id: crypto.randomUUID(),
      label: newFieldLabel.trim(),
      value: '',
      type: newFieldType,
    };

    onChange([...fields, newField]);
    setNewFieldLabel('');
    setNewFieldType('text');
  };

  const addPresetField = (preset: typeof PRESET_TEMPLATES[0]) => {
    // Check if field already exists
    if (fields.some(f => f.label.toLowerCase() === preset.label.toLowerCase())) {
      return;
    }

    const newField: CustomField = {
      id: crypto.randomUUID(),
      label: preset.label,
      value: '',
      type: preset.type,
    };

    onChange([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<CustomField>) => {
    onChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Preset Fields */}
      {isEditable && (
        <Card className="p-4">
          <Label className="text-base font-semibold mb-3 block">Quick Add Fields</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Click to add common fields for Bill of Sale and other documents
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map((preset) => {
              const isAdded = fields.some(f => f.label.toLowerCase() === preset.label.toLowerCase());
              return (
                <Button
                  key={preset.label}
                  type="button"
                  variant={isAdded ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => addPresetField(preset)}
                  disabled={isAdded}
                  className="text-xs"
                >
                  {preset.label}
                  {isAdded && ' ✓'}
                </Button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Current Custom Fields */}
      <Card className="p-4">
        <Label className="text-base font-semibold mb-3 block">Custom Fields</Label>
        
        {fields.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/10">
            <p className="text-sm">No custom fields added yet.</p>
            {isEditable && <p className="text-xs mt-1">Use the presets above or add a custom field below.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                    <Input
                      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                      value={field.value}
                      onChange={(e) => updateField(field.id, { value: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      disabled={!isEditable}
                      className="mt-1"
                    />
                  </div>
                </div>
                {isEditable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8"
                    onClick={() => removeField(field.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Custom Field */}
      {isEditable && (
        <Card className="p-4">
          <Label className="text-base font-semibold mb-3 block">Add Custom Field</Label>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs">Field Label</Label>
              <Input
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="e.g., Registration Number"
                className="mt-1"
              />
            </div>
            <div className="w-32">
              <Label className="text-xs">Type</Label>
              <Select value={newFieldType} onValueChange={(v) => setNewFieldType(v as typeof newFieldType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addField}
              disabled={!newFieldLabel.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

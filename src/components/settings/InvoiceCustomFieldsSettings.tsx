import { useState } from 'react';
import { Plus, Trash2, GripVertical, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInvoiceCustomFieldTemplates, InvoiceCustomFieldTemplate, DocumentType } from '@/hooks/useInvoiceCustomFieldTemplates';
import { useConfirmDelete } from '@/hooks/useConfirmDelete';

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'all', label: 'All Documents' },
  { value: 'invoice', label: 'Invoice Only' },
  { value: 'bill_of_sale', label: 'Bill of Sale Only' },
  { value: 'receipt', label: 'Receipt Only' },
  { value: 'quote', label: 'Quote Only' },
];

// Preset field templates for common use cases
const PRESET_TEMPLATES = [
  { label: 'Vehicle Make', type: 'text' as const },
  { label: 'Vehicle Model', type: 'text' as const },
  { label: 'Vehicle Year', type: 'number' as const },
  { label: 'VIN Number', type: 'text' as const },
  { label: 'License Plate', type: 'text' as const },
  { label: 'Odometer Reading', type: 'number' as const },
  { label: 'Color', type: 'text' as const },
  { label: 'Condition', type: 'text' as const },
  { label: 'Serial Number', type: 'text' as const },
  { label: 'Asset Tag', type: 'text' as const },
  { label: 'Warranty Terms', type: 'text' as const },
  { label: 'Registration Number', type: 'text' as const },
];

export function InvoiceCustomFieldsSettings() {
  const confirmDelete = useConfirmDelete();
  const { 
    templates, 
    isLoading, 
    createTemplate, 
    deleteTemplate,
    updateTemplate,
  } = useInvoiceCustomFieldTemplates();

  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date'>('text');
  const [newFieldDefault, setNewFieldDefault] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldDocType, setNewFieldDocType] = useState<DocumentType>('all');

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;

    createTemplate.mutate({
      label: newFieldLabel.trim(),
      field_type: newFieldType,
      default_value: newFieldDefault || undefined,
      is_required: newFieldRequired,
      document_type: newFieldDocType,
    });

    // Reset form
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldDefault('');
    setNewFieldRequired(false);
    setNewFieldDocType('all');
  };

  const handleAddPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    // Check if field already exists
    if (templates.some(t => t.label.toLowerCase() === preset.label.toLowerCase())) {
      return;
    }

    createTemplate.mutate({
      label: preset.label,
      field_type: preset.type,
      document_type: 'bill_of_sale', // Preset fields are typically for Bill of Sale
    });
  };

  const handleToggleRequired = (template: InvoiceCustomFieldTemplate) => {
    updateTemplate.mutate({
      id: template.id,
      is_required: !template.is_required,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Custom Fields for Bill of Sale
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Define custom fields that will appear on all new invoices and bill of sale documents.
        </p>
      </div>

      {/* Quick Add Presets */}
      <Card className="p-4">
        <Label className="text-sm font-medium mb-3 block">Quick Add Common Fields</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((preset) => {
            const isAdded = templates.some(t => t.label.toLowerCase() === preset.label.toLowerCase());
            return (
              <Button
                key={preset.label}
                type="button"
                variant={isAdded ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleAddPreset(preset)}
                disabled={isAdded || createTemplate.isPending}
                className="text-xs"
              >
                {preset.label}
                {isAdded && ' ✓'}
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Current Templates */}
      <Card className="p-4">
        <Label className="text-sm font-medium mb-3 block">Saved Custom Fields</Label>
        
        {templates.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/10">
            <p className="text-sm">No custom fields configured yet.</p>
            <p className="text-xs mt-1">Add fields above to include them on all new invoices.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div 
                key={template.id} 
                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{template.label}</span>
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {template.field_type}
                    </span>
                    <span className="text-xs text-primary/80 px-1.5 py-0.5 bg-primary/10 rounded">
                      {DOCUMENT_TYPE_OPTIONS.find(d => d.value === template.document_type)?.label || 'All'}
                    </span>
                    {template.is_required && (
                      <span className="text-xs text-destructive px-1.5 py-0.5 bg-destructive/10 rounded">
                        Required
                      </span>
                    )}
                  </div>
                  {template.default_value && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Default: {template.default_value}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs text-muted-foreground">Required</Label>
                    <Switch
                      checked={template.is_required}
                      onCheckedChange={() => handleToggleRequired(template)}
                      disabled={updateTemplate.isPending}
                    />
                  </div>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive h-8 w-8 hover:bg-destructive/10"
                    onClick={() => confirmDelete(() => deleteTemplate.mutate(template.id), { title: 'Delete template?' })}
                    disabled={deleteTemplate.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Custom Field */}
      <Card className="p-4">
        <Label className="text-sm font-medium mb-3 block">Add Custom Field</Label>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Field Label</Label>
            <Input
              value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              placeholder="e.g., Engine Number"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label className="text-xs text-muted-foreground">Type</Label>
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

          <div>
            <Label className="text-xs text-muted-foreground">Applies To</Label>
            <Select value={newFieldDocType} onValueChange={(v) => setNewFieldDocType(v as DocumentType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Default Value</Label>
            <Input
              value={newFieldDefault}
              onChange={(e) => setNewFieldDefault(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>

          <Button
            type="button"
            onClick={handleAddField}
            disabled={!newFieldLabel.trim() || createTemplate.isPending}
            className="w-full md:w-auto"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        
        <div className="flex items-center gap-2 mt-3">
          <Switch
            id="newFieldRequired"
            checked={newFieldRequired}
            onCheckedChange={setNewFieldRequired}
          />
          <Label htmlFor="newFieldRequired" className="text-sm text-muted-foreground">
            Make this field required
          </Label>
        </div>
      </Card>
    </div>
  );
}

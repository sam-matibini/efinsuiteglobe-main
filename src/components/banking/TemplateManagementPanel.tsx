import { useState } from 'react';
import { Settings, Trash2, Edit3, Save, X, FileText, Building2, CreditCard, MoreVertical, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMappingTemplates, MappingTemplate } from '@/hooks/useMappingTemplates';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TemplateManagementPanelProps {
  className?: string;
}

export function TemplateManagementPanel({ className }: TemplateManagementPanelProps) {
  const { templates, isLoading, deleteTemplate, updateTemplate } = useMappingTemplates();
  const [editingTemplate, setEditingTemplate] = useState<MappingTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBankName, setEditBankName] = useState('');
  const [editAccountName, setEditAccountName] = useState('');

  const handleStartEdit = (template: MappingTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditBankName(template.bank_name || '');
    setEditAccountName(template.account_name || '');
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setEditName('');
    setEditBankName('');
    setEditAccountName('');
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    
    if (!editName.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        name: editName.trim(),
        bank_name: editBankName.trim() || null,
        account_name: editAccountName.trim() || null,
      });
      handleCancelEdit();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleToggleDefault = async (template: MappingTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        is_default: !template.is_default,
      });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-sm text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No Saved Templates</p>
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-[250px]">
          Templates are saved when you import statements using the Statement Extraction Engine.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Saved Import Templates ({templates.length})</span>
      </div>
      
      <ScrollArea className="max-h-[300px]">
        <div className="space-y-2 pr-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className={cn(
                "group relative border rounded-lg p-3 transition-colors",
                editingTemplate?.id === template.id 
                  ? "border-primary bg-primary/5" 
                  : "hover:border-muted-foreground/30 hover:bg-muted/30"
              )}
            >
              {editingTemplate?.id === template.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Template Name *</Label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Template name"
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Bank/Institution</Label>
                      <Input
                        value={editBankName}
                        onChange={(e) => setEditBankName(e.target.value)}
                        placeholder="Optional"
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Account Name</Label>
                      <Input
                        value={editAccountName}
                        onChange={(e) => setEditAccountName(e.target.value)}
                        placeholder="Optional"
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={updateTemplate.isPending}
                      className="h-7 text-xs"
                    >
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {template.statement_type === 'bank' ? (
                        <Building2 className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-purple-500 shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">{template.name}</span>
                      {template.is_default && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {template.bank_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {template.bank_name}
                        </Badge>
                      )}
                      {template.account_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {template.account_name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal capitalize">
                        {template.statement_type}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {template.mappings?.length || 0} column mappings • 
                      Date: {template.date_format} • 
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleStartEdit(template)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleDefault(template)}>
                        <Settings className="h-4 w-4 mr-2" />
                        {template.is_default ? 'Remove Default' : 'Set as Default'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeleteConfirmId(template.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Import Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
              The template will no longer be available for future imports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

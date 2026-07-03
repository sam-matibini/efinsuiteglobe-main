import { useState } from 'react';
import { FileText, Trash2, Edit3, Plus, MoreVertical, Star, Mail, MessageSquare, MessagesSquare, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useCommunicationTemplates, TemplateChannel, CommunicationTemplate } from '@/hooks/useCommunicationTemplates';
import { TemplateFormDialog } from './TemplateFormDialog';
import { cn } from '@/lib/utils';

interface TemplateManagementPanelProps {
  className?: string;
}

const channelIcons: Record<TemplateChannel, React.ReactNode> = {
  email: <Mail className="h-4 w-4 text-hub-contacts" />,
  sms: <MessageSquare className="h-4 w-4 text-hub-voice" />,
  whatsapp: <MessagesSquare className="h-4 w-4 text-hub-messages" />,
  all: <FileText className="h-4 w-4 text-muted-foreground" />,
};

const channelLabels: Record<TemplateChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  all: 'All',
};

export function TemplateManagementPanel({ className }: TemplateManagementPanelProps) {
  const { templates, isLoading, deleteTemplate, updateTemplate } = useCommunicationTemplates();
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch {
      // Error handled in hook
    }
  };

  const handleToggleDefault = async (template: CommunicationTemplate) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        is_default: !template.is_default,
      });
    } catch {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-sm text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Message Templates ({templates.length})</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/20">
          <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No Templates Yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 max-w-[250px]">
            Create reusable message templates for quick communication.
          </p>
          <Button 
            variant="link" 
            size="sm" 
            className="mt-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Create first template
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="group relative border rounded-lg p-3 hover:border-muted-foreground/30 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {channelIcons[template.channel]}
                      <span className="font-medium text-sm truncate">{template.name}</span>
                      {template.is_default && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    {template.subject && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Subject: {template.subject}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.body}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {channelLabels[template.channel]}
                      </Badge>
                      {template.category && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {template.category}
                        </Badge>
                      )}
                      {template.variables && template.variables.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {template.variables.length} variables
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        Used {template.use_count}x
                      </span>
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
                      <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleDefault(template)}>
                        <Star className="h-4 w-4 mr-2" />
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
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create/Edit Dialog */}
      <TemplateFormDialog
        open={showCreateDialog || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingTemplate(null);
          }
        }}
        editTemplate={editingTemplate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
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

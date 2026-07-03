import { useState } from 'react';
import { Plus, User, Star, Pencil, Trash2, Phone, Mail, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useCommunicationSenders, CommunicationSender, CreateSenderInput } from '@/hooks/useCommunicationSenders';
import { cn } from '@/lib/utils';

const COMMON_TITLES = [
  'CEO',
  'CFO',
  'COO',
  'President',
  'Vice President',
  'Director',
  'Manager',
  'Account Manager',
  'Sales Representative',
  'Customer Success',
  'Support Specialist',
];

export function SenderManagement() {
  const { senders, isLoading, createSender, updateSender, deleteSender, setDefaultSender } = useCommunicationSenders();
  
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingSender, setEditingSender] = useState<CommunicationSender | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateSenderInput>({
    name: '',
    title: '',
    email: '',
    phone: '',
    is_default: false,
  });

  const openCreateDialog = () => {
    setEditingSender(null);
    setFormData({ name: '', title: '', email: '', phone: '', is_default: senders.length === 0 });
    setShowFormDialog(true);
  };

  const openEditDialog = (sender: CommunicationSender) => {
    setEditingSender(sender);
    setFormData({
      name: sender.name,
      title: sender.title || '',
      email: sender.email || '',
      phone: sender.phone || '',
      is_default: sender.is_default,
    });
    setShowFormDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    if (editingSender) {
      await updateSender.mutateAsync({ id: editingSender.id, ...formData });
    } else {
      await createSender.mutateAsync(formData);
    }
    setShowFormDialog(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteSender.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultSender.mutateAsync(id);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isSaving = createSender.isPending || updateSender.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-accent" />
                Sender Identities
              </CardTitle>
              <CardDescription>
                Manage people who send communications on behalf of your organization
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog} className="bg-accent hover:bg-accent/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Sender
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : senders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No senders configured</p>
              <p className="text-sm">Add team members who will send emails, SMS, or make calls</p>
              <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Sender
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {senders.map((sender) => (
                  <div
                    key={sender.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border transition-colors",
                      sender.is_default && "border-accent/50 bg-accent/5"
                    )}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={sender.avatar_url || undefined} />
                      <AvatarFallback className="bg-accent/10 text-accent">
                        {getInitials(sender.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{sender.name}</span>
                        {sender.is_default && (
                          <Badge variant="secondary" className="bg-accent/10 text-accent text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {sender.title && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {sender.title}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {sender.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {sender.email}
                          </span>
                        )}
                        {sender.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {sender.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!sender.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetDefault(sender.id)}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(sender)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(sender.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSender ? 'Edit Sender' : 'Add Sender'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Smith"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title / Role</Label>
              <Input
                id="title"
                placeholder="e.g., CEO, Account Manager"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                list="title-suggestions"
              />
              <datalist id="title-suggestions">
                {COMMON_TITLES.map(title => (
                  <option key={title} value={title} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                This will appear in signatures and caller ID
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@company.com"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || isSaving}
              className="bg-accent hover:bg-accent/90"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {editingSender ? 'Save Changes' : 'Add Sender'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Sender?</AlertDialogTitle>
            <AlertDialogDescription>
              This sender will no longer appear in the selection list. This action can be undone by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

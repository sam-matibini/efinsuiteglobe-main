import { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  MoreVertical, 
  Copy, 
  Trash2, 
  Edit, 
  FileSignature,
  FolderOpen,
  Star,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: number;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

interface TemplateManagerProps {
  onUseTemplate: (templateId: string) => void;
  onCreateDocument: () => void;
}

const MOCK_TEMPLATES: Template[] = [
  {
    id: '1',
    name: 'Employment Agreement',
    description: 'Standard employment contract with confidentiality and non-compete clauses',
    category: 'HR',
    fields: 8,
    useCount: 45,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-06-20T14:30:00Z',
    isFavorite: true,
  },
  {
    id: '2',
    name: 'NDA - Mutual',
    description: 'Mutual non-disclosure agreement for business partnerships',
    category: 'Legal',
    fields: 5,
    useCount: 123,
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-07-15T11:00:00Z',
    isFavorite: true,
  },
  {
    id: '3',
    name: 'Sales Contract',
    description: 'Product or service sales agreement template',
    category: 'Sales',
    fields: 12,
    useCount: 67,
    createdAt: '2024-03-10T16:00:00Z',
    updatedAt: '2024-08-01T09:15:00Z',
    isFavorite: false,
  },
  {
    id: '4',
    name: 'Lease Agreement',
    description: 'Commercial or residential lease agreement',
    category: 'Real Estate',
    fields: 15,
    useCount: 34,
    createdAt: '2024-04-05T08:00:00Z',
    updatedAt: '2024-08-10T10:00:00Z',
    isFavorite: false,
  },
  {
    id: '5',
    name: 'W-9 Form',
    description: 'IRS Request for Taxpayer Identification Number',
    category: 'Tax',
    fields: 10,
    useCount: 89,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-05-01T12:00:00Z',
    isFavorite: true,
  },
];

const CATEGORIES = ['All', 'HR', 'Legal', 'Sales', 'Real Estate', 'Tax', 'Finance', 'Other'];

export function TemplateManager({ onUseTemplate, onCreateDocument }: TemplateManagerProps) {
  const [templates] = useState<Template[]>(MOCK_TEMPLATES);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', category: 'Other' });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const favoriteTemplates = filteredTemplates.filter(t => t.isFavorite);
  const recentTemplates = [...filteredTemplates]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  const handleCreateTemplate = () => {
    // Would create template in backend
    setCreateDialogOpen(false);
    setNewTemplate({ name: '', description: '', category: 'Other' });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'HR': 'bg-blue-100 text-blue-700',
      'Legal': 'bg-purple-100 text-purple-700',
      'Sales': 'bg-green-100 text-green-700',
      'Real Estate': 'bg-orange-100 text-orange-700',
      'Tax': 'bg-red-100 text-red-700',
      'Finance': 'bg-cyan-100 text-cyan-700',
      'Other': 'bg-gray-100 text-gray-700',
    };
    return colors[category] || colors['Other'];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <FolderOpen className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Favorites Section */}
      {favoriteTemplates.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            Favorites
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favoriteTemplates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onUse={() => onUseTemplate(template.id)}
                getCategoryColor={getCategoryColor}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Section */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-muted-foreground" />
          Recently Used
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentTemplates.map(template => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onUse={() => onUseTemplate(template.id)}
              getCategoryColor={getCategoryColor}
              compact
            />
          ))}
        </div>
      </div>

      {/* All Templates */}
      <div>
        <h3 className="text-lg font-semibold mb-3">All Templates ({filteredTemplates.length})</h3>
        {filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Create your first template to get started'}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onUse={() => onUseTemplate(template.id)}
                getCategoryColor={getCategoryColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a reusable template with predefined fields for faster document preparation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Employment Agreement"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of this template's purpose..."
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                value={newTemplate.category} 
                onValueChange={(v) => setNewTemplate(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              disabled={!newTemplate.name.trim()}
              className="bg-accent hover:bg-accent/90"
            >
              Create & Edit Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onUse: () => void;
  getCategoryColor: (category: string) => string;
  compact?: boolean;
}

function TemplateCard({ template, onUse, getCategoryColor, compact }: TemplateCardProps) {
  return (
    <Card className="hover:border-accent/50 transition-colors group">
      <CardContent className={compact ? 'py-4' : 'pt-6'}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-accent" />
            </div>
            {!compact && template.isFavorite && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onUse}>
                <FileText className="w-4 h-4 mr-2" />
                Use Template
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit Template
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h4 className="font-medium mb-1 line-clamp-1">{template.name}</h4>
        {!compact && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {template.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={getCategoryColor(template.category)}>
            {template.category}
          </Badge>
          {!compact && (
            <span className="text-xs text-muted-foreground">
              {template.fields} fields • Used {template.useCount}x
            </span>
          )}
        </div>

        {!compact && (
          <Button 
            className="w-full mt-4 bg-accent hover:bg-accent/90"
            onClick={onUse}
          >
            Use Template
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

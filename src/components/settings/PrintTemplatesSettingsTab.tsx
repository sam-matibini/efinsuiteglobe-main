/**
 * Print Templates Settings Tab
 * Manage print templates with hierarchy display
 */

import { useState, useEffect } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Globe, Building2, Layers, Eye, Edit, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { DOCUMENT_TYPE_LABELS, type PrintDocumentType } from '@/lib/print/types';

interface PrintTemplate {
  id: string;
  code: string;
  name: string;
  document_type: string;
  country_id: string | null;
  organization_id: string | null;
  version: number;
  status: string;
  effective_date: string;
  paper_size: string;
  orientation: string;
  default_language: string;
  countries?: { name: string } | null;
}

type HierarchyLevel = 'all' | 'base' | 'country' | 'organization';

export function PrintTemplatesSettingsTab() {
  const { organization } = useCurrentOrganization();
  const [templates, setTemplates] = useState<PrintTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyLevel>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (organization?.id) {
      loadTemplates();
    }
  }, [organization?.id]);

  const loadTemplates = async () => {
    if (!organization?.id) return;
    
    setIsLoading(true);
    try {
      // Query templates visible to this organization
      const { data, error } = await supabase
        .from('print_templates')
        .select(`
          id,
          code,
          name,
          document_type,
          country_id,
          organization_id,
          version,
          status,
          effective_date,
          paper_size,
          orientation,
          default_language,
          countries(name)
        `)
        .or(`organization_id.eq.${organization.id},organization_id.is.null`)
        .order('document_type')
        .order('code');

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const getHierarchyLevel = (template: PrintTemplate): HierarchyLevel => {
    if (template.organization_id) return 'organization';
    if (template.country_id) return 'country';
    return 'base';
  };

  const getHierarchyBadge = (level: HierarchyLevel) => {
    switch (level) {
      case 'base':
        return <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Base</Badge>;
      case 'country':
        return <Badge variant="secondary" className="gap-1"><Layers className="h-3 w-3" /> Country</Badge>;
      case 'organization':
        return <Badge className="gap-1"><Building2 className="h-3 w-3" /> Custom</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">Active</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTemplates = templates.filter(t => {
    const level = getHierarchyLevel(t);
    if (hierarchyFilter !== 'all' && level !== hierarchyFilter) return false;
    if (documentTypeFilter !== 'all' && t.document_type !== documentTypeFilter) return false;
    return true;
  });

  const documentTypes = [...new Set(templates.map(t => t.document_type))];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Print Templates
              </CardTitle>
              <CardDescription>
                Manage document templates with Base → Country → Organization hierarchy
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadTemplates}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Level:</span>
              <Select value={hierarchyFilter} onValueChange={(v) => setHierarchyFilter(v as HierarchyLevel)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="base">Base Only</SelectItem>
                  <SelectItem value="country">Country</SelectItem>
                  <SelectItem value="organization">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {documentTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {DOCUMENT_TYPE_LABELS[type as PrintDocumentType] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </div>
          </div>

          <Separator className="mb-4" />

          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Paper</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No templates found. Create a custom template to override defaults.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map(template => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {DOCUMENT_TYPE_LABELS[template.document_type as PrintDocumentType] || template.document_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getHierarchyBadge(getHierarchyLevel(template))}
                          {template.countries?.name && (
                            <span className="text-xs text-muted-foreground">{template.countries.name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">
                          {template.paper_size} / {template.orientation}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">v{template.version}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(template.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Preview">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Edit"
                            disabled={getHierarchyLevel(template) !== 'organization'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Template Hierarchy Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Base Templates</p>
                <p className="text-muted-foreground">Default templates applied globally. Cannot be edited.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Layers className="h-4 w-4 mt-0.5 text-primary/70" />
              <div>
                <p className="font-medium">Country Templates</p>
                <p className="text-muted-foreground">Override base templates for specific countries/jurisdictions.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 mt-0.5 text-primary" />
              <div>
                <p className="font-medium">Custom Templates</p>
                <p className="text-muted-foreground">Your organization's custom templates. Full control.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

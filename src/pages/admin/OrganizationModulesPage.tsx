import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Shield, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useModules, useOrganizationModules, useBulkUpdateModuleAccess } from '@/hooks/useModules';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
}

export default function OrganizationModulesPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [moduleStates, setModuleStates] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: modules, isLoading: modulesLoading } = useModules();
  const { data: orgModules, isLoading: orgModulesLoading } = useOrganizationModules(organizationId);
  const bulkUpdateMutation = useBulkUpdateModuleAccess();

  // Fetch organization details
  useEffect(() => {
    if (!organizationId) return;

    const fetchOrg = async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('id', organizationId)
        .single();

      if (error) {
        toast.error('Failed to load organization');
        navigate('/admin/organizations');
        return;
      }
      setOrganization(data);
    };

    fetchOrg();
  }, [organizationId, navigate]);

  // Initialize module states from database
  useEffect(() => {
    if (!modules || !orgModules) return;

    const states: Record<string, boolean> = {};
    modules.forEach(mod => {
      const orgMod = orgModules.find(om => om.module_id === mod.id);
      states[mod.id] = orgMod?.is_enabled ?? false;
    });
    setModuleStates(states);
    setHasChanges(false);
  }, [modules, orgModules]);

  const handleToggle = (moduleId: string, enabled: boolean) => {
    setModuleStates(prev => ({ ...prev, [moduleId]: enabled }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!organizationId || !modules) return;

    const updates = modules.map(mod => ({
      moduleId: mod.id,
      isEnabled: moduleStates[mod.id] ?? false,
    }));

    await bulkUpdateMutation.mutateAsync({
      organizationId,
      moduleUpdates: updates,
    });

    setHasChanges(false);
  };

  const handleEnableAll = () => {
    if (!modules) return;
    const newStates: Record<string, boolean> = {};
    modules.forEach(mod => {
      newStates[mod.id] = true;
    });
    setModuleStates(newStates);
    setHasChanges(true);
  };

  const handleDisableNonCore = () => {
    if (!modules) return;
    const newStates: Record<string, boolean> = {};
    modules.forEach(mod => {
      newStates[mod.id] = mod.is_core ?? false;
    });
    setModuleStates(newStates);
    setHasChanges(true);
  };

  const isLoading = modulesLoading || orgModulesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = Object.values(moduleStates).filter(Boolean).length;
  const totalCount = modules?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/organizations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Module Access Control</h1>
            <p className="text-muted-foreground">
              {organization?.name ?? 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDisableNonCore}>
            Core Only
          </Button>
          <Button variant="outline" onClick={handleEnableAll}>
            Enable All
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Access Summary</CardTitle>
            </div>
            <Badge variant={enabledCount === totalCount ? "default" : "secondary"}>
              {enabledCount} / {totalCount} Modules Enabled
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Modules Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules?.map(mod => {
          const isEnabled = moduleStates[mod.id] ?? false;
          
          return (
            <Card key={mod.id} className={isEnabled ? 'border-primary/50' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{mod.name}</CardTitle>
                      {mod.is_core && (
                        <Badge variant="outline" className="text-xs mt-1">
                          Core Module
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(mod.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {mod.description}
                </CardDescription>
                <Separator className="my-3" />
                <div className="flex items-center gap-2 text-sm">
                  {isEnabled ? (
                    <>
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-success">Enabled</span>
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Disabled</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
          <span>You have unsaved changes</span>
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={handleSave}
            disabled={bulkUpdateMutation.isPending}
          >
            Save Now
          </Button>
        </div>
      )}
    </div>
  );
}

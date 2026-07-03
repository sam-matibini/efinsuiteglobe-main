import { useState } from 'react';
import { Building2, Globe, Plus, Users, FileText, ArrowRightLeft, Settings2, ChevronRight, Trash2, Flag } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsolidationGroups, useConsolidationGroupMembers, useConsolidationReports, useCreateConsolidationGroup, useAddGroupMember, useRemoveGroupMember, ConsolidationGroup } from '@/hooks/useConsolidation';
import { parseLocalDate } from '@/lib/utils';
import { useUserOrganizations } from '@/hooks/useOrganization';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { format } from 'date-fns';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { GenerateConsolidatedReportDialog } from '@/components/consolidation/GenerateConsolidatedReportDialog';
import { ConsolidatedReportViewer } from '@/components/consolidation/ConsolidatedReportViewer';

// Country flag emoji helper
const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length < 2) return '🏳️';
  const codePoints = countryCode
    .toUpperCase()
    .slice(0, 2)
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const getCountryCode = (country: string | null): string => {
  if (!country) return 'US';
  const upperCountry = country.toUpperCase().trim();
  const countryMap: Record<string, string> = {
    'CANADA': 'CA', 'CA': 'CA', 'CAN': 'CA',
    'UNITED STATES': 'US', 'USA': 'US', 'US': 'US',
    'ZAMBIA': 'ZM', 'ZM': 'ZM', 'ZMB': 'ZM',
    'KENYA': 'KE', 'KE': 'KE', 'KEN': 'KE',
    'BURUNDI': 'BI', 'BI': 'BI', 'BDI': 'BI',
  };
  return countryMap[upperCountry] || upperCountry.slice(0, 2);
};

export default function ConsolidatedStatements() {
  const [selectedGroup, setSelectedGroup] = useState<ConsolidationGroup | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  
  // Form state for new group
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupType, setNewGroupType] = useState<'domestic' | 'international'>('domestic');
  const [newGroupCurrency, setNewGroupCurrency] = useState('USD');
  
  // Form state for adding member
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [ownershipPercentage, setOwnershipPercentage] = useState('100');
  const [consolidationMethod, setConsolidationMethod] = useState<'full' | 'proportional' | 'equity'>('full');
  const [isParent, setIsParent] = useState(false);

  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { data: groups = [], isLoading: groupsLoading } = useConsolidationGroups();
  const { data: members = [], isLoading: membersLoading } = useConsolidationGroupMembers(selectedGroup?.id || null);
  const { data: reports = [], isLoading: reportsLoading } = useConsolidationReports(selectedGroup?.id || null);
  const { data: allOrgs = [] } = useUserOrganizations();
  
  const createGroup = useCreateConsolidationGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  // Show org creation dialog if no organization
  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Consolidated Financial Statements</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start consolidating financial statements.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (groupsLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    await createGroup.mutateAsync({
      name: newGroupName,
      description: newGroupDescription || undefined,
      consolidation_type: newGroupType,
      base_currency: newGroupCurrency,
    });
    
    setShowCreateDialog(false);
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupType('domestic');
    setNewGroupCurrency('USD');
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedOrgId) return;
    
    const selectedOrg = allOrgs.find(o => o.id === selectedOrgId);
    const countryCode = getCountryCode(selectedOrg?.country || null);
    const localization = getCountryLocalization(countryCode);
    
    await addMember.mutateAsync({
      group_id: selectedGroup.id,
      organization_id: selectedOrgId,
      ownership_percentage: parseFloat(ownershipPercentage),
      consolidation_method: consolidationMethod,
      functional_currency: selectedOrg?.currency || localization.currency,
      is_parent: isParent,
    });
    
    setShowAddMemberDialog(false);
    setSelectedOrgId('');
    setOwnershipPercentage('100');
    setConsolidationMethod('full');
    setIsParent(false);
  };

  const availableOrgsForGroup = allOrgs.filter(
    org => !members.some(m => m.organization_id === org.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Consolidated Financial Statements</h1>
          <p className="text-muted-foreground">
            Consolidate financial data across multiple entities
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Consolidation Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Consolidation Group</DialogTitle>
              <DialogDescription>
                Define a group of organizations to consolidate together.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., North America Holdings"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consolidation Type</Label>
                  <Select value={newGroupType} onValueChange={(v) => setNewGroupType(v as 'domestic' | 'international')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domestic">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          Domestic
                        </div>
                      </SelectItem>
                      <SelectItem value="international">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          International
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Currency</Label>
                  <Select value={newGroupCurrency} onValueChange={setNewGroupCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="ZMW">ZMW - Zambian Kwacha</SelectItem>
                      <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                      <SelectItem value="BIF">BIF - Burundian Franc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || createGroup.isPending}>
                {createGroup.isPending ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Consolidation Groups
          </h3>
          
          {groups.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  No consolidation groups yet
                </p>
                <Button variant="link" size="sm" onClick={() => setShowCreateDialog(true)}>
                  Create your first group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <Card 
                  key={group.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedGroup?.id === group.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {group.consolidation_type === 'international' ? (
                            <Globe className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Building2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                          <h4 className="font-medium text-sm truncate">{group.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {group.base_currency}
                          </Badge>
                          <Badge variant={group.consolidation_type === 'international' ? 'default' : 'secondary'} className="text-xs">
                            {group.consolidation_type}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Group Details */}
        <div className="lg:col-span-3">
          {selectedGroup ? (
            <Tabs defaultValue="entities" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedGroup.name}</h2>
                  {selectedGroup.description && (
                    <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
                  )}
                </div>
                <TabsList>
                  <TabsTrigger value="entities">
                    <Users className="w-4 h-4 mr-2" />
                    Entities
                  </TabsTrigger>
                  <TabsTrigger value="reports">
                    <FileText className="w-4 h-4 mr-2" />
                    Reports
                  </TabsTrigger>
                  <TabsTrigger value="fx-rates">
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    FX Rates
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Entities Tab */}
              <TabsContent value="entities" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Group Entities</h3>
                  <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={availableOrgsForGroup.length === 0}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Entity
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Entity to Group</DialogTitle>
                        <DialogDescription>
                          Select an organization to include in this consolidation group.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Organization</Label>
                          <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select organization..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableOrgsForGroup.map((org) => {
                                const code = getCountryCode(org.country);
                                return (
                                  <SelectItem key={org.id} value={org.id}>
                                    <div className="flex items-center gap-2">
                                      <span>{getFlagEmoji(code)}</span>
                                      <span>{org.name}</span>
                                      <span className="text-muted-foreground">({org.currency || 'USD'})</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Ownership %</Label>
                            <Input 
                              type="number"
                              min="0"
                              max="100"
                              value={ownershipPercentage}
                              onChange={(e) => setOwnershipPercentage(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Consolidation Method</Label>
                            <Select value={consolidationMethod} onValueChange={(v) => setConsolidationMethod(v as 'full' | 'proportional' | 'equity')}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full">Full Consolidation</SelectItem>
                                <SelectItem value="proportional">Proportional</SelectItem>
                                <SelectItem value="equity">Equity Method</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox"
                            id="is-parent"
                            checked={isParent}
                            onChange={(e) => setIsParent(e.target.checked)}
                            className="rounded border-input"
                          />
                          <Label htmlFor="is-parent" className="font-normal">
                            This is the parent company
                          </Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>Cancel</Button>
                        <Button onClick={handleAddMember} disabled={!selectedOrgId || addMember.isPending}>
                          {addMember.isPending ? 'Adding...' : 'Add Entity'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {membersLoading ? (
                  <Skeleton className="h-40" />
                ) : members.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                      <h4 className="font-medium mb-2">No entities in this group</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add organizations to consolidate their financial statements.
                      </p>
                      <Button size="sm" onClick={() => setShowAddMemberDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Entity
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entity</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead>Ownership</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {members.map((member) => {
                          const code = getCountryCode(member.organization?.country || null);
                          const localization = getCountryLocalization(code);
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{getFlagEmoji(code)}</span>
                                  <div>
                                    <div className="font-medium">{member.organization?.name}</div>
                                    {member.is_parent && (
                                      <Badge variant="default" className="text-xs">Parent</Badge>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{localization.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{member.functional_currency}</Badge>
                              </TableCell>
                              <TableCell>{member.ownership_percentage}%</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="capitalize">
                                  {member.consolidation_method}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => removeMember.mutate({ id: member.id, groupId: selectedGroup.id })}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </TabsContent>

              {/* Reports Tab */}
              <TabsContent value="reports" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Consolidated Reports</h3>
                  <Button size="sm" onClick={() => setShowGenerateDialog(true)} disabled={members.length === 0}>
                    <Plus className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </div>

                {reportsLoading ? (
                  <Skeleton className="h-40" />
                ) : reports.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                      <h4 className="font-medium mb-2">No reports generated</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate consolidated financial statements for this group.
                      </p>
                      <Button size="sm" onClick={() => setShowGenerateDialog(true)} disabled={members.length === 0}>
                        <Plus className="w-4 h-4 mr-2" />
                        Generate First Report
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {reports.map((report) => (
                      <Card 
                        key={report.id} 
                        className="cursor-pointer hover:border-primary/50 transition-all"
                        onClick={() => setSelectedReport(report.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-medium capitalize">
                                  {report.report_type.replace('_', ' ')}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseLocalDate(report.period_start), 'MMM d, yyyy')} - {format(parseLocalDate(report.period_end), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={report.status === 'final' ? 'default' : 'secondary'}>
                                {report.status}
                              </Badge>
                              <Badge variant="outline">{report.base_currency}</Badge>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* FX Rates Tab */}
              <TabsContent value="fx-rates" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Exchange Rates</CardTitle>
                    <CardDescription>
                      Manage currency translation rates for international consolidation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedGroup.consolidation_type === 'domestic' ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <ArrowRightLeft className="w-10 h-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">
                          Exchange rates are only needed for international consolidations.
                        </p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-center py-8">
                        Exchange rate management coming soon.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Group Settings</CardTitle>
                    <CardDescription>
                      Configure consolidation parameters and intercompany eliminations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Consolidation Type</Label>
                        <p className="font-medium capitalize">{selectedGroup.consolidation_type}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Base Currency</Label>
                        <p className="font-medium">{selectedGroup.base_currency}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Fiscal Year End</Label>
                        <p className="font-medium">Month {selectedGroup.fiscal_year_end_month || 12}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <Badge variant={selectedGroup.is_active ? 'default' : 'secondary'}>
                          {selectedGroup.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center">
                <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Consolidation Group</h3>
                <p className="text-muted-foreground max-w-md">
                  Choose a group from the list to view entities, generate reports, and manage settings.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Generate Report Dialog */}
      {selectedGroup && (
        <GenerateConsolidatedReportDialog 
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          group={selectedGroup}
          members={members}
        />
      )}

      {/* Report Viewer */}
      {selectedReport && (
        <ConsolidatedReportViewer 
          reportId={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

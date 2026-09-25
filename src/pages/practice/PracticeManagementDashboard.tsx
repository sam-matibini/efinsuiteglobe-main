import { useState } from 'react';
import { 
  Users, 
  Briefcase, 
  CheckSquare, 
  Clock, 
  Calendar,
  TrendingUp,
  Plus,
  DollarSign,
  UserPlus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  usePMDashboardKPIs, 
  usePMClients, 
  usePMEngagements, 
  usePMTasks, 
  usePMTimeEntries,
  usePMComplianceDeadlines,
  usePMAIInsights,
  useDismissPMAIInsight,
} from '@/hooks/usePracticeManagement';
import { useAuth } from '@/hooks/useAuth';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { format, isBefore, addDays, parseISO } from 'date-fns';
import { AddPMClientDialog } from '@/components/practice/AddPMClientDialog';
import { AddPMEngagementDialog } from '@/components/practice/AddPMEngagementDialog';
import { AddPMTaskDialog } from '@/components/practice/AddPMTaskDialog';
import { AddPMTimeEntryDialog } from '@/components/practice/AddPMTimeEntryDialog';
import { PMClientsTab } from '@/components/practice/PMClientsTab';
import { PMEngagementsTab } from '@/components/practice/PMEngagementsTab';
import { PMTasksTab } from '@/components/practice/PMTasksTab';
import { PMTimeTrackingTab } from '@/components/practice/PMTimeTrackingTab';
import { PMComplianceTab } from '@/components/practice/PMComplianceTab';
import { PMAIInsightsPanel } from '@/components/practice/PMAIInsightsPanel';
import { PMBillingTab } from '@/components/practice/PMBillingTab';
import { CreatePMInvoiceDialog } from '@/components/practice/CreatePMInvoiceDialog';
import { PMEngagementStaffTab } from '@/components/practice/PMEngagementStaffTab';

export default function PracticeManagementDashboard() {
  const { user } = useAuth();
  const { formatWithSymbol } = useCurrencyFormatter();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [engagementDialogOpen, setEngagementDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  
  const { data: kpis, isLoading: kpisLoading } = usePMDashboardKPIs();
  const { data: clients } = usePMClients();
  const { data: engagements } = usePMEngagements();
  const { data: tasks } = usePMTasks();
  const { data: timeEntries } = usePMTimeEntries(undefined, user?.id);
  const { data: deadlines } = usePMComplianceDeadlines();
  const { data: aiInsights } = usePMAIInsights();
  const dismissInsight = useDismissPMAIInsight();

  const today = new Date();
  const upcomingTasks = tasks?.filter(t => 
    t.due_date && 
    t.status !== 'completed' &&
    isBefore(parseISO(t.due_date), addDays(today, 7))
  ).slice(0, 5) || [];

  const upcomingDeadlines = deadlines?.filter(d =>
    d.status === 'pending' &&
    isBefore(parseISO(d.due_date), addDays(today, 30))
  ).slice(0, 5) || [];

  const recentTimeEntries = timeEntries?.slice(0, 5) || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice Management</h1>
          <p className="text-muted-foreground">
            Manage clients, engagements, tasks, and billing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTimeEntryDialogOpen(true)}>
            <Clock className="mr-2 h-4 w-4" />
            Log Time
          </Button>
          <Button variant="outline" onClick={() => setInvoiceDialogOpen(true)}>
            <DollarSign className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
          <Button variant="outline" onClick={() => setTaskDialogOpen(true)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            New Task
          </Button>
          <Button onClick={() => setClientDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </div>
      </div>

      {/* AI Insights Panel */}
      {aiInsights && aiInsights.length > 0 && (
        <PMAIInsightsPanel insights={aiInsights} onDismiss={(id) => dismissInsight.mutate(id)} />
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.totalClients || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {kpis?.clientsAtRisk || 0} at risk
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Engagements</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.activeEngagements || 0}</div>
                <p className="text-xs text-muted-foreground">
                  In progress
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.openTasks || 0}</div>
                <p className="text-xs text-destructive">
                  {kpis?.overdueTasks || 0} overdue
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unbilled Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.unbilledHours?.toFixed(1) || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {formatWithSymbol(kpis?.unbilledAmount || 0)} value
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.staffUtilization || 0}%</div>
                <Progress value={kpis?.staffUtilization || 0} className="mt-2" />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="engagements">Engagements</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="time">Time Tracking</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Upcoming Tasks */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckSquare className="h-5 w-5" />
                  Upcoming Tasks
                </CardTitle>
                <CardDescription>Tasks due in the next 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  {upcomingTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming tasks</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingTasks.map((task) => (
                        <div key={task.id} className="flex items-start justify-between gap-2 p-2 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {task.engagement?.client?.legal_name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={getPriorityColor(task.priority)} variant="secondary">
                              {task.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {task.due_date ? format(parseISO(task.due_date), 'MMM d') : 'No date'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Compliance Deadlines */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Compliance Deadlines
                </CardTitle>
                <CardDescription>Upcoming filing deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  {upcomingDeadlines.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingDeadlines.map((deadline) => (
                        <div key={deadline.id} className="flex items-start justify-between gap-2 p-2 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{deadline.filing_type}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {deadline.client?.legal_name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline">{deadline.country}</Badge>
                            <span className="text-xs font-medium">
                              {format(parseISO(deadline.due_date), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Time Entries */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Time Entries
                </CardTitle>
                <CardDescription>Your recent time logs</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  {recentTimeEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent entries</p>
                  ) : (
                    <div className="space-y-3">
                      {recentTimeEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between gap-2 p-2 rounded-lg border">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {entry.engagement?.client?.legal_name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.description || entry.engagement?.name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-bold">{entry.hours}h</span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(entry.entry_date), 'MMM d')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <Button variant="outline" className="h-auto py-4" onClick={() => setClientDialogOpen(true)}>
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-6 w-6" />
                    <span>Add Client</span>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto py-4" onClick={() => setEngagementDialogOpen(true)}>
                  <div className="flex flex-col items-center gap-2">
                    <Briefcase className="h-6 w-6" />
                    <span>New Engagement</span>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto py-4" onClick={() => setTaskDialogOpen(true)}>
                  <div className="flex flex-col items-center gap-2">
                    <CheckSquare className="h-6 w-6" />
                    <span>Create Task</span>
                  </div>
                </Button>
                <Button variant="outline" className="h-auto py-4" onClick={() => setTimeEntryDialogOpen(true)}>
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-6 w-6" />
                    <span>Log Time</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <PMClientsTab onAddClient={() => setClientDialogOpen(true)} />
        </TabsContent>

        <TabsContent value="engagements">
          <PMEngagementsTab onAddEngagement={() => setEngagementDialogOpen(true)} />
        </TabsContent>

        <TabsContent value="team">
          <PMEngagementStaffTab engagements={engagements || []} />
        </TabsContent>

        <TabsContent value="tasks">
          <PMTasksTab onAddTask={() => setTaskDialogOpen(true)} />
        </TabsContent>

        <TabsContent value="time">
          <PMTimeTrackingTab onAddTimeEntry={() => setTimeEntryDialogOpen(true)} />
        </TabsContent>

        <TabsContent value="billing">
          <PMBillingTab onAddInvoice={() => setInvoiceDialogOpen(true)} />
        </TabsContent>

        <TabsContent value="compliance">
          <PMComplianceTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddPMClientDialog 
        open={clientDialogOpen} 
        onOpenChange={setClientDialogOpen} 
      />
      <AddPMEngagementDialog 
        open={engagementDialogOpen} 
        onOpenChange={setEngagementDialogOpen}
        clients={clients || []}
      />
      <AddPMTaskDialog 
        open={taskDialogOpen} 
        onOpenChange={setTaskDialogOpen}
        engagements={engagements || []}
      />
      <AddPMTimeEntryDialog 
        open={timeEntryDialogOpen} 
        onOpenChange={setTimeEntryDialogOpen}
        engagements={engagements || []}
        tasks={tasks || []}
      />
      <CreatePMInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />
    </div>
  );
}

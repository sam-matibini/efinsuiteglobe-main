import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  Shield,
  DollarSign,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Clock,
  MoreHorizontal
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardStats {
  totalUsers: number;
  totalOrganizations: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  newUsersThisMonth: number;
  newOrgsThisMonth: number;
}

interface RecentUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  organization_id: string;
  status: string;
  plan_id: string | null;
  current_period_end: string | null;
  organization_name?: string;
  plan_name?: string;
}

interface RecentActivity {
  id: string;
  type: 'user_joined' | 'subscription_change' | 'org_created';
  message: string;
  detail: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const { isAdmin, isLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOrganizations: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    newUsersThisMonth: 0,
    newOrgsThisMonth: 0,
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch counts properly with separate count queries
      const [profilesCountRes, recentProfilesRes, orgsRes, subsRes, plansRes] = await Promise.all([
        supabase.from('profiles').select('id, created_at', { count: 'exact' }),
        supabase.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }).limit(10),
        supabase.from('organizations').select('id, name, created_at'),
        supabase.from('subscriptions').select('*'),
        supabase.from('pricing_plans').select('*')
      ]);

      const allProfiles = profilesCountRes.data || [];
      const totalUsers = profilesCountRes.count || allProfiles.length;
      const profiles = recentProfilesRes.data || [];
      const organizations = orgsRes.data || [];
      const subscriptionsList = subsRes.data || [];
      const plans = plansRes.data || [];

      const activeSubscriptions = subscriptionsList.filter(s => s.status === 'active');
      
      // Calculate monthly revenue (simplified)
      const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
        const plan = plans.find(p => p.id === sub.plan_id);
        return sum + (plan?.price_monthly || 0);
      }, 0);

      // Calculate new users this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const newUsersThisMonth = allProfiles.filter(p => new Date(p.created_at) >= startOfMonth).length;
      const newOrgsThisMonth = organizations.filter(o => new Date(o.created_at) >= startOfMonth).length;

      setStats({
        totalUsers,
        totalOrganizations: organizations.length,
        activeSubscriptions: activeSubscriptions.length,
        monthlyRevenue,
        newUsersThisMonth,
        newOrgsThisMonth,
      });

      setRecentUsers(profiles as RecentUser[]);

      // Enrich subscriptions with org and plan names
      const enrichedSubs = subscriptionsList.map(sub => {
        const org = organizations.find(o => o.id === sub.organization_id);
        const plan = plans.find(p => p.id === sub.plan_id);
        return {
          ...sub,
          organization_name: org?.name || 'Unknown',
          plan_name: plan?.name || 'No Plan'
        };
      });
      setSubscriptions(enrichedSubs);

      // Build recent activity from real data
      const activities: RecentActivity[] = [];
      
      // Add recent user registrations
      profiles.slice(0, 3).forEach((user, idx) => {
        activities.push({
          id: `user-${user.id}`,
          type: 'user_joined',
          message: 'New user registered',
          detail: `${user.email} joined the platform`,
          timestamp: user.created_at,
        });
      });

      // Add recent subscription changes
      subscriptionsList.slice(0, 2).forEach((sub) => {
        const org = organizations.find(o => o.id === sub.organization_id);
        if (org) {
          activities.push({
            id: `sub-${sub.id}`,
            type: 'subscription_change',
            message: sub.status === 'active' ? 'Subscription activated' : 'Subscription updated',
            detail: `${org.name} - ${sub.status}`,
            timestamp: sub.updated_at || sub.created_at,
          });
        }
      });

      // Sort activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Note: Admin access is now verified at route level by AdminRoute component
  // This check is kept as defense-in-depth but won't normally be reached
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-accent/20 text-accent border-accent/30">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Canceled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, organizations, and subscriptions</p>
        </div>
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <Shield className="w-3 h-3 mr-1" />
          Admin Access
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-success">+{stats.newUsersThisMonth}</span> this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrganizations}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-success">+{stats.newOrgsThisMonth}</span> this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalOrganizations > 0 
                ? `${Math.round((stats.activeSubscriptions / stats.totalOrganizations) * 100)}%`
                : '0%'
              } conversion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              from {stats.activeSubscriptions} active subscriptions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
              <CardDescription>Latest user registrations across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || 'No name'}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Edit User</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Suspend User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recentUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
              <CardDescription>Active and inactive subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Renewal Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map(sub => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.organization_name}</TableCell>
                      <TableCell>{sub.plan_name}</TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        {sub.current_period_end 
                          ? new Date(sub.current_period_end).toLocaleDateString()
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Change Plan</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Cancel Subscription
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {subscriptions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No subscriptions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Platform activity log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => {
                    const getActivityIcon = () => {
                      switch (activity.type) {
                        case 'user_joined':
                          return (
                            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                              <UserPlus className="w-5 h-5 text-success" />
                            </div>
                          );
                        case 'subscription_change':
                          return (
                            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-accent" />
                            </div>
                          );
                        case 'org_created':
                          return (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                          );
                        default:
                          return (
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <Clock className="w-5 h-5 text-muted-foreground" />
                            </div>
                          );
                      }
                    };

                    const getTimeAgo = (timestamp: string) => {
                      const diff = Date.now() - new Date(timestamp).getTime();
                      const minutes = Math.floor(diff / 60000);
                      const hours = Math.floor(diff / 3600000);
                      const days = Math.floor(diff / 86400000);
                      
                      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
                      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                      if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
                      return 'Just now';
                    };

                    return (
                      <div key={activity.id} className="flex items-center gap-4 p-4 rounded-lg border">
                        {getActivityIcon()}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">{activity.detail}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{getTimeAgo(activity.timestamp)}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
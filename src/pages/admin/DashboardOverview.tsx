import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import Card from '../../components/ui/Card';
import { Users, Star, DollarSign, Clock, BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalUsers: number;
  totalAdvisors: number;
  totalEarnings: number;
  sessionsToday: number;
  recentActivity: Array<{
    type: string;
    message: string;
    time: string;
  }>;
  revenue: {
    today: number;
    weekly: number;
    todayChange: number;
    weeklyChange: number;
  };
}

export default function DashboardOverview() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalAdvisors: 0,
    totalEarnings: 0,
    sessionsToday: 0,
    recentActivity: [],
    revenue: {
      today: 0,
      weekly: 0,
      todayChange: 0,
      weeklyChange: 0
    }
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);

      // Get total users (clients)
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('role', 'client');

      if (usersError) throw usersError;

      // Get total advisors
      const { count: totalAdvisors, error: advisorsError } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .eq('role', 'advisor');

      if (advisorsError) throw advisorsError;

      // Get total earnings (completed sessions)
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('amount')
        .eq('status', 'completed');

      if (sessionsError) throw sessionsError;

      const totalEarnings = sessions?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;

      // Get today's sessions
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: sessionsToday, error: todaySessionsError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact' })
        .gte('start_time', today.toISOString());

      if (todaySessionsError) throw todaySessionsError;

      // Get recent activity
      const recentActivity = [];

      // Get recent advisor registrations
      const { data: recentAdvisors, error: recentAdvisorsError } = await supabase
        .from('users')
        .select('created_at')
        .eq('role', 'advisor')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentAdvisorsError) throw recentAdvisorsError;

      recentAdvisors?.forEach(advisor => {
        recentActivity.push({
          type: 'advisor',
          message: 'New advisor registration',
          time: advisor.created_at
        });
      });

      // Get recent completed sessions
      const { data: recentSessions, error: recentSessionsError } = await supabase
        .from('sessions')
        .select('created_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentSessionsError) throw recentSessionsError;

      recentSessions?.forEach(session => {
        recentActivity.push({
          type: 'session',
          message: 'Session completed',
          time: session.created_at
        });
      });

      // Get recent support tickets
      const { data: recentTickets, error: recentTicketsError } = await supabase
        .from('support_tickets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentTicketsError) throw recentTicketsError;

      recentTickets?.forEach(ticket => {
        recentActivity.push({
          type: 'support',
          message: 'New support ticket',
          time: ticket.created_at
        });
      });

      // Sort activity by time
      recentActivity.sort((a, b) => 
        new Date(b.time).getTime() - new Date(a.time).getTime()
      );

      // Calculate revenue stats
      const yesterday = subDays(today, 1);
      const lastWeek = subDays(today, 7);

      const { data: todayRevenue } = await supabase
        .from('sessions')
        .select('amount')
        .eq('status', 'completed')
        .gte('start_time', today.toISOString());

      const { data: yesterdayRevenue } = await supabase
        .from('sessions')
        .select('amount')
        .eq('status', 'completed')
        .gte('start_time', yesterday.toISOString())
        .lt('start_time', today.toISOString());

      const { data: weeklyRevenue } = await supabase
        .from('sessions')
        .select('amount')
        .eq('status', 'completed')
        .gte('start_time', lastWeek.toISOString());

      const todayTotal = todayRevenue?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;
      const yesterdayTotal = yesterdayRevenue?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;
      const weeklyTotal = weeklyRevenue?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;

      const todayChange = yesterdayTotal ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100 : 0;
      const weeklyChange = 0; // Would need previous week's data for comparison

      setStats({
        totalUsers: totalUsers || 0,
        totalAdvisors: totalAdvisors || 0,
        totalEarnings,
        sessionsToday: sessionsToday || 0,
        recentActivity,
        revenue: {
          today: todayTotal,
          weekly: weeklyTotal,
          todayChange,
          weeklyChange
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading dashboard data...</span>
      </div>
    );
  }

  const dashboardStats = [
    { 
      title: 'Total Users', 
      value: stats.totalUsers, 
      icon: Users, 
      trend: '+12%', 
      color: 'blue' 
    },
    { 
      title: 'Total Advisors', 
      value: stats.totalAdvisors, 
      icon: Star, 
      trend: '+8%', 
      color: 'purple' 
    },
    { 
      title: 'Total Earnings', 
      value: `$${stats.totalEarnings.toFixed(2)}`, 
      icon: DollarSign, 
      trend: '+23%', 
      color: 'green' 
    },
    { 
      title: 'Sessions Today', 
      value: stats.sessionsToday, 
      icon: Clock, 
      trend: '+15%', 
      color: 'orange' 
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardStats.map((stat) => (
          <Card key={stat.title}>
            <div className="flex items-center">
              <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                <div className="flex items-baseline">
                  <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  <span className={`ml-2 text-sm font-medium text-${stat.color}-600`}>
                    {stat.trend}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            {stats.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center text-sm">
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  activity.type === 'advisor'
                    ? 'bg-green-500'
                    : activity.type === 'session'
                    ? 'bg-blue-500'
                    : 'bg-purple-500'
                }`} />
                <span className="text-slate-600">{activity.message}</span>
                <span className="ml-auto text-slate-500">
                  {format(new Date(activity.time), 'MMM d, h:mm a')}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Revenue Overview</h3>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">Today's Revenue</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${stats.revenue.today.toFixed(2)}
              </p>
              <p className={`text-sm ${stats.revenue.todayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.revenue.todayChange >= 0 ? '+' : ''}{stats.revenue.todayChange.toFixed(1)}% from yesterday
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Weekly Revenue</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${stats.revenue.weekly.toFixed(2)}
              </p>
              <p className="text-sm text-green-600">+23% from last week</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
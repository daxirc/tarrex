import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { DollarSign, Users, Star, Clock, Loader2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface RecentAdvisor {
  id: string;
  full_name: string;
  profile_picture: string | null;
  last_session: string;
  session_type: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, wallet, fetchUser, fetchWallet } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [recentAdvisors, setRecentAdvisors] = useState<RecentAdvisor[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch user and wallet data
      await Promise.all([fetchUser(), fetchWallet()]);

      const currentUser = useStore.getState().user;
      if (!currentUser?.id) {
        throw new Error('User not found');
      }

      // Fetch session count
      const { count: totalSessions, error: countError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', currentUser.id);

      if (countError) throw countError;
      setSessionCount(totalSessions || 0);

      // Fetch recent advisors
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          advisor:advisor_id (
            id,
            full_name,
            profile:advisor_profiles(profile_picture)
          ),
          type,
          start_time
        `)
        .eq('client_id', currentUser.id)
        .order('start_time', { ascending: false })
        .limit(2);

      if (sessionsError) throw sessionsError;

      const advisors = sessions?.map(session => ({
        id: session.advisor.id,
        full_name: session.advisor.full_name,
        profile_picture: session.advisor.profile?.profile_picture,
        last_session: session.start_time,
        session_type: session.type
      })) || [];

      setRecentAdvisors(advisors);

      // Fetch average rating and total reviews
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select('rating')
        .eq('client_id', currentUser.id);

      if (reviewsError) throw reviewsError;

      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
        setAverageRating(avgRating);
        setTotalReviews(reviews.length);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFunds = () => {
    navigate('/dashboard/wallet?action=add_funds');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading dashboard data...</span>
      </div>
    );
  }

  const stats = [
    { 
      title: 'Total Sessions', 
      value: sessionCount.toString(), 
      icon: Users, 
      trend: 'Current', 
      color: 'blue',
      action: null
    },
    { 
      title: 'Wallet Balance', 
      value: `$${wallet?.balance?.toFixed(2) || '0.00'}`, 
      icon: DollarSign, 
      trend: 'Available', 
      color: 'green',
      action: (
        <Button 
          onClick={handleAddFunds}
          className="w-full mt-4 flex items-center justify-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Funds
        </Button>
      )
    },
    { 
      title: 'Average Rating', 
      value: averageRating.toFixed(1), 
      icon: Star, 
      trend: `${totalReviews} reviews`, 
      color: 'yellow',
      action: null
    },
    { 
      title: 'Hours Online', 
      value: '24', 
      icon: Clock, 
      trend: 'This week', 
      color: 'purple',
      action: null
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.full_name || 'Client'}!
        </h1>
        <p className="text-slate-600">Here's your personal dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
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
            {stat.action}
          </Card>
        ))}
      </div>

      {/* Recently Connected Advisors */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Recently Connected Advisors</h2>
        {recentAdvisors.length === 0 ? (
          <p className="text-center text-slate-600 py-8">
            No recent sessions. Start by browsing our advisors!
          </p>
        ) : (
          <div className="space-y-4">
            {recentAdvisors.map((advisor) => (
              <div key={advisor.id} className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <Avatar
                    src={advisor.profile_picture}
                    alt={advisor.full_name}
                    size="md"
                  />
                  <div>
                    <h3 className="font-medium text-slate-900">{advisor.full_name}</h3>
                    <p className="text-sm text-slate-600">
                      Last session: {new Date(advisor.last_session).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    advisor.session_type === 'video'
                      ? 'bg-blue-100 text-blue-700'
                      : advisor.session_type === 'voice'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {advisor.session_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6">
          <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard/browse')}>
            Browse All Advisors
          </Button>
        </div>
      </Card>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { DollarSign, Users, Star, Clock, Loader2, Plus, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [isAvailable, setIsAvailable] = useState(user?.advisor_profiles?.[0]?.is_available || false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [activeSessionsCount, setActiveSessionsCount] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [pendingSessions, setPendingSessions] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
      
      // Set up real-time subscription for pending sessions
      const subscription = supabase
        .channel('pending_sessions')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: `advisor_id=eq.${user.id} AND status=eq.pending_advisor_approval`
        }, () => {
          console.log('🔔 New pending session detected');
          fetchPendingSessionsCount();
          toast.success('New chat request received!', {
            icon: '🔔',
            duration: 5000
          });
        })
        .subscribe();
        
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user?.id]);
  
  const fetchPendingSessionsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('advisor_id', user?.id)
        .eq('status', 'pending_advisor_approval');
        
      if (error) throw error;
      
      setPendingSessions(count || 0);
      
      if (count && count > 0) {
        console.log('📊 Found pending sessions:', count);
      }
    } catch (error) {
      console.error('Error fetching pending sessions count:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch total earnings
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('amount')
        .eq('advisor_id', user.id)
        .eq('status', 'completed');

      if (sessionsError) throw sessionsError;

      const total = sessions?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;
      setTotalEarnings(total * 0.8); // Assuming 80% commission

      // Fetch active sessions count
      const { count: activeSessions, error: activeSessionsError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact' })
        .eq('advisor_id', user.id)
        .eq('status', 'in_progress');

      if (activeSessionsError) throw activeSessionsError;
      setActiveSessionsCount(activeSessions || 0);
      
      // Fetch pending sessions count
      await fetchPendingSessionsCount();

      // Fetch recent reviews with client names
      const { data: reviews, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          client:client_id (
            full_name
          )
        `)
        .eq('advisor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (reviewsError) throw reviewsError;
      setRecentReviews(reviews || []);

      // Calculate average rating and total reviews
      if (reviews?.length) {
        const avgRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
        setAverageRating(avgRating);
        setTotalReviews(reviews.length);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvailabilityToggle = async () => {
    if (isUpdatingAvailability) return;

    try {
      setIsUpdatingAvailability(true);

      const { error } = await supabase
        .from('advisor_profiles')
        .update({ is_available: !isAvailable })
        .eq('user_id', user.id);

      if (error) throw error;

      setIsAvailable(!isAvailable);
      toast.success(`You are now ${!isAvailable ? 'available' : 'away'}`);
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };
  
  const handleViewPendingRequests = () => {
    navigate('/advisor-dashboard/sessions');
  };

  const getAvailabilityTooltip = () => {
    if (!user?.is_approved) {
      return 'Your profile is pending admin approval';
    }
    const profile = user?.advisor_profiles?.[0];
    if (!profile?.bio || !profile?.categories?.length || !profile?.payout_method) {
      return 'Please complete your profile first';
    }
    return '';
  };

  const isToggleDisabled = !user?.is_approved || 
    !user?.advisor_profiles?.[0]?.bio || 
    !user?.advisor_profiles?.[0]?.categories?.length || 
    !user?.advisor_profiles?.[0]?.payout_method;

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading user data...</span>
      </div>
    );
  }

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
      title: 'Total Earnings', 
      value: `$${totalEarnings.toFixed(2)}`, 
      icon: DollarSign, 
      trend: '+12%', 
      color: 'green' 
    },
    { 
      title: 'Active Sessions', 
      value: activeSessionsCount.toString(), 
      icon: Users, 
      trend: 'Current', 
      color: 'blue' 
    },
    { 
      title: 'Average Rating', 
      value: averageRating.toFixed(1), 
      icon: Star, 
      trend: `${totalReviews} reviews`, 
      color: 'yellow' 
    },
    { 
      title: 'Hours Online', 
      value: '24', 
      icon: Clock, 
      trend: 'This week', 
      color: 'purple' 
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user.full_name || 'Advisor'}!
          </h1>
          <p className="text-slate-600">Here's your dashboard overview</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`text-sm ${isAvailable ? 'text-green-600' : 'text-slate-600'}`}>
            {isAvailable ? 'Available' : 'Away'}
          </span>
          <div className="relative">
            <button
              onClick={handleAvailabilityToggle}
              disabled={isToggleDisabled || isUpdatingAvailability}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 ${
                isAvailable ? 'bg-green-500' : 'bg-slate-200'
              } ${(isToggleDisabled || isUpdatingAvailability) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={getAvailabilityTooltip()}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAvailable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            {isToggleDisabled && (
              <div className="absolute top-full mt-2 w-48 bg-slate-800 text-white text-xs rounded-md py-1 px-2">
                {getAvailabilityTooltip()}
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingSessions > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <Bell className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You have {pendingSessions} pending chat request{pendingSessions > 1 ? 's' : ''}
              </p>
              <div className="mt-2">
                <Button
                  size="sm"
                  onClick={handleViewPendingRequests}
                >
                  View Requests
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Reviews</h3>
        <div className="space-y-4">
          {recentReviews.length === 0 ? (
            <p className="text-slate-600 text-center py-4">No reviews yet</p>
          ) : (
            recentReviews.map((review) => (
              <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center mb-1">
                  <div className="flex text-yellow-400">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="ml-2 text-sm text-slate-600">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-600">{review.comment}</p>
                <p className="text-sm text-slate-500 mt-1">
                  - {review.client.full_name}
                </p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
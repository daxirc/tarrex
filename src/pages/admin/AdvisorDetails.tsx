import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ArrowLeft, Loader2, User, Mail, Calendar, Clock, Monitor, MapPin, DollarSign, Phone, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdvisorData {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  phone_number: string | null;
  country: string | null;
  created_at: string;
  role: string;
  profile: {
    bio: string | null;
    profile_picture: string | null;
    price_per_minute: number;
    average_rating: number;
    total_reviews: number;
  } | null;
}

interface Session {
  id: string;
  client: {
    full_name: string;
  };
  type: string;
  status: string;
  start_time: string;
  duration_minutes: number;
  amount: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
}

interface LoginSession {
  id: string;
  ip_address: string;
  city: string | null;
  country: string | null;
  device_info: {
    browser: {
      name: string;
      version: string;
    };
    os: {
      name: string;
      version: string;
    };
    device: {
      type?: string;
      vendor?: string;
      model?: string;
    };
  };
  login_time: string;
}

export default function AdvisorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [advisorData, setAdvisorData] = useState<AdvisorData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdvisorData();
  }, [id]);

  const fetchAdvisorData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch advisor data with profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          profile:advisor_profiles(
            bio,
            profile_picture,
            price_per_minute,
            average_rating,
            total_reviews
          )
        `)
        .eq('id', id)
        .eq('role', 'advisor')
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('Advisor not found');

      setAdvisorData(userData);

      // Fetch recent sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          id,
          client:client_id (
            full_name
          ),
          type,
          status,
          start_time,
          duration_minutes,
          amount
        `)
        .eq('advisor_id', id)
        .order('start_time', { ascending: false })
        .limit(5);

      if (sessionError) throw sessionError;
      setSessions(sessionData || []);

      // Fetch withdrawal requests
      const { data: withdrawalData, error: withdrawalError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('advisor_id', id)
        .order('requested_at', { ascending: false });

      if (withdrawalError) throw withdrawalError;
      setWithdrawals(withdrawalData || []);

      // Fetch login sessions
      const { data: loginSessionData, error: loginSessionError } = await supabase
        .from('login_sessions')
        .select('*')
        .eq('user_id', id)
        .order('login_time', { ascending: false })
        .limit(3);

      if (loginSessionError) throw loginSessionError;
      setLoginSessions(loginSessionData || []);

    } catch (error) {
      console.error('Error fetching advisor data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load advisor data');
      toast.error('Failed to load advisor data');
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceInfo = (deviceInfo: LoginSession['device_info']) => {
    const parts = [];
    
    if (deviceInfo.browser?.name) {
      parts.push(`${deviceInfo.browser.name} ${deviceInfo.browser.version || ''}`);
    }
    
    if (deviceInfo.os?.name) {
      parts.push(`${deviceInfo.os.name} ${deviceInfo.os.version || ''}`);
    }
    
    if (deviceInfo.device?.type) {
      parts.push(deviceInfo.device.type);
    }
    
    return parts.join(' • ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading advisor data...</span>
      </div>
    );
  }

  if (error || !advisorData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
        <p className="text-slate-600 mb-6">{error || 'Advisor not found'}</p>
        <Button onClick={() => navigate('/secure-portal/advisors')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Advisors
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate('/secure-portal/advisors')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Advisors
        </Button>
      </div>

      {/* Advisor Profile Card */}
      <Card>
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
            {advisorData.profile?.profile_picture ? (
              <img
                src={advisorData.profile.profile_picture}
                alt={advisorData.full_name || 'Advisor'}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <User className="w-8 h-8 text-purple-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {advisorData.full_name || 'Unnamed Advisor'}
            </h2>
            <div className="mt-2 space-y-2">
              <div className="flex items-center text-slate-600">
                <Mail className="w-4 h-4 mr-2" />
                {advisorData.email}
              </div>
              {advisorData.username && (
                <div className="flex items-center text-slate-600">
                  <User className="w-4 h-4 mr-2" />
                  @{advisorData.username}
                </div>
              )}
              <div className="flex items-center text-slate-600">
                <Calendar className="w-4 h-4 mr-2" />
                Joined {format(new Date(advisorData.created_at), 'MMMM d, yyyy')}
              </div>
              {advisorData.phone_number && (
                <div className="flex items-center text-slate-600">
                  <Phone className="w-4 h-4 mr-2" />
                  {advisorData.phone_number}
                </div>
              )}
              {advisorData.country && (
                <div className="flex items-center text-slate-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  {advisorData.country}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Price per minute</div>
            <div className="text-2xl font-bold text-slate-900">
              ${(advisorData.profile?.price_per_minute ?? 0).toFixed(2)}
            </div>
            {advisorData.profile?.average_rating !== undefined && advisorData.profile?.average_rating !== null && (
              <div className="mt-2">
                <div className="flex items-center justify-end text-yellow-400">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="ml-1 text-slate-900">{advisorData.profile.average_rating.toFixed(1)}</span>
                </div>
                <div className="text-sm text-slate-600">
                  {advisorData.profile.total_reviews} reviews
                </div>
              </div>
            )}
          </div>
        </div>
        {advisorData.profile?.bio && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-700">Bio</h3>
            <p className="mt-2 text-slate-600">{advisorData.profile.bio}</p>
          </div>
        )}
      </Card>

      {/* Recent Client Sessions */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Client Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-right py-3 px-4">Duration</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-600">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">{session.client.full_name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        session.type === 'video'
                          ? 'bg-blue-100 text-blue-700'
                          : session.type === 'voice'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {session.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {format(new Date(session.start_time), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {session.duration_minutes} min
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${session.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          session.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : session.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Withdrawal History */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Withdrawal History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-600">
                    No withdrawal requests found
                  </td>
                </tr>
              ) : (
                withdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      {format(new Date(withdrawal.requested_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${withdrawal.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          withdrawal.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : withdrawal.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : withdrawal.status === 'approved'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {withdrawal.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {withdrawal.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Login Sessions */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Login Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Date & Time</th>
                <th className="text-left py-3 px-4">Location</th>
                <th className="text-left py-3 px-4">IP Address</th>
                <th className="text-left py-3 px-4">Device Info</th>
              </tr>
            </thead>
            <tbody>
              {loginSessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-600">
                    No login history available
                  </td>
                </tr>
              ) : (
                loginSessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      {format(new Date(session.login_time), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                        {session.city && session.country 
                          ? `${session.city}, ${session.country}`
                          : session.country || 'Unknown location'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm">
                      {session.ip_address}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <Monitor className="w-4 h-4 mr-2 text-slate-400" />
                        {getDeviceInfo(session.device_info)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
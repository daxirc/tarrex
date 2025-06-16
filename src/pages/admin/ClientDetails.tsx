import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ArrowLeft, Loader2, User, Mail, Calendar, Clock, Monitor, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ClientData {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  created_at: string;
  role: string;
}

interface Session {
  id: string;
  advisor: {
    full_name: string;
  };
  type: string;
  status: string;
  start_time: string;
  duration_minutes: number;
  amount: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
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

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClientData();
  }, [id]);

  const fetchClientData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch client data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .eq('role', 'client')
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('Client not found');

      setClientData(userData);

      // Fetch sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          id,
          advisor:advisor_id (
            full_name
          ),
          type,
          status,
          start_time,
          duration_minutes,
          amount
        `)
        .eq('client_id', id)
        .order('start_time', { ascending: false });

      if (sessionError) throw sessionError;
      setSessions(sessionData || []);

      // Fetch transactions
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });

      if (transactionError) throw transactionError;
      setTransactions(transactionData || []);

      // Fetch login sessions
      const { data: loginSessionData, error: loginSessionError } = await supabase
        .from('login_sessions')
        .select('*')
        .eq('user_id', id)
        .order('login_time', { ascending: false });

      if (loginSessionError) throw loginSessionError;
      setLoginSessions(loginSessionData || []);

    } catch (error) {
      console.error('Error fetching client data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load client data');
      toast.error('Failed to load client data');
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
        <span className="ml-2 text-slate-600">Loading client data...</span>
      </div>
    );
  }

  if (error || !clientData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Error</h2>
        <p className="text-slate-600 mb-6">{error || 'Client not found'}</p>
        <Button onClick={() => navigate('/secure-portal/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
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
          onClick={() => navigate('/secure-portal/clients')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
      </div>

      {/* Client Profile Card */}
      <Card>
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
            <User className="w-8 h-8 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {clientData.full_name || 'Unnamed Client'}
            </h2>
            <div className="mt-2 space-y-2">
              <div className="flex items-center text-slate-600">
                <Mail className="w-4 h-4 mr-2" />
                {clientData.email}
              </div>
              {clientData.username && (
                <div className="flex items-center text-slate-600">
                  <User className="w-4 h-4 mr-2" />
                  @{clientData.username}
                </div>
              )}
              <div className="flex items-center text-slate-600">
                <Calendar className="w-4 h-4 mr-2" />
                Joined {format(new Date(clientData.created_at), 'MMMM d, yyyy')}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Login Sessions */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Login History</h3>
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

      {/* Session History */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Session History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Advisor</th>
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
                    <td className="py-3 px-4">{session.advisor.full_name}</td>
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

      {/* Transaction History */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Transaction History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-600">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.type === 'deposit'
                          ? 'bg-green-100 text-green-700'
                          : transaction.type === 'withdrawal'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={transaction.type === 'deposit' ? 'text-green-600' : ''}>
                        {transaction.type === 'deposit' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          transaction.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : transaction.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {transaction.status}
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
    </div>
  );
}
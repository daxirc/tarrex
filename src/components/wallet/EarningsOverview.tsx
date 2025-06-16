import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { DollarSign, TrendingUp, Clock, ArrowDownLeft, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface EarningsData {
  totalEarnings: number;
  thisMonthEarnings: number;
  pendingEarnings: number;
  availableForWithdrawal: number;
  totalSessions: number;
  averagePerSession: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requested_at: string;
}

interface WalletSettings {
  platform_commission_rate: number;
  minimum_withdrawal_amount: number;
}

export default function EarningsOverview() {
  const { user, wallet, fetchWallet } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
  const [earnings, setEarnings] = useState<EarningsData>({
    totalEarnings: 0,
    thisMonthEarnings: 0,
    pendingEarnings: 0,
    availableForWithdrawal: 0,
    totalSessions: 0,
    averagePerSession: 0
  });
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [platformCommissionRate, setPlatformCommissionRate] = useState(0.2); // Default 20%
  const [minimumWithdrawal, setMinimumWithdrawal] = useState(50); // Default $50

  useEffect(() => {
    if (user?.id && user.role === 'advisor') {
      loadEarningsData();
    }
  }, [user?.id, user?.role]);

  const loadEarningsData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        fetchWallet(),
        fetchEarningsData(),
        fetchWithdrawalRequests(),
        fetchWalletSettings()
      ]);
    } catch (error) {
      console.error('Error loading earnings data:', error);
      toast.error('Failed to load earnings data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWalletSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('wallet_settings')
        .select('platform_commission_rate, minimum_withdrawal_amount')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setPlatformCommissionRate(data[0].platform_commission_rate);
        setMinimumWithdrawal(data[0].minimum_withdrawal_amount);
        console.log('Fetched platform commission rate:', data[0].platform_commission_rate);
      }
    } catch (error) {
      console.error('Error fetching wallet settings:', error);
      // Continue with default values
    }
  };

  const fetchEarningsData = async () => {
    try {
      // Fetch completed sessions for earnings calculation
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('amount, start_time')
        .eq('advisor_id', user?.id)
        .eq('status', 'completed');

      if (sessionsError) throw sessionsError;

      // Fetch earnings transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, type, status, created_at')
        .eq('user_id', user?.id)
        .in('type', ['earning', 'session_payment']);

      if (transactionsError) throw transactionsError;

      const now = new Date();
      const startOfThisMonth = startOfMonth(now);
      const endOfThisMonth = endOfMonth(now);

      // Calculate earnings using the platform commission rate
      const totalSessionRevenue = sessions?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;
      const totalEarnings = totalSessionRevenue * (1 - platformCommissionRate); // Apply commission rate

      const thisMonthSessions = sessions?.filter(session => {
        const sessionDate = new Date(session.start_time);
        return sessionDate >= startOfThisMonth && sessionDate <= endOfThisMonth;
      }) || [];

      const thisMonthRevenue = thisMonthSessions.reduce((sum, session) => sum + (session.amount || 0), 0);
      const thisMonthEarnings = thisMonthRevenue * (1 - platformCommissionRate);

      const pendingEarnings = transactions?.filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      setEarnings({
        totalEarnings,
        thisMonthEarnings,
        pendingEarnings,
        availableForWithdrawal: wallet?.balance || 0,
        totalSessions: sessions?.length || 0,
        averagePerSession: sessions?.length ? totalEarnings / sessions.length : 0
      });
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    }
  };

  const fetchWithdrawalRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('advisor_id', user?.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setWithdrawalRequests(data || []);
      setHasPendingRequest(data?.some(request => request.status === 'pending') || false);
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (earnings.availableForWithdrawal < minimumWithdrawal) {
      toast.error(`Minimum withdrawal amount is $${minimumWithdrawal}`);
      return;
    }

    if (hasPendingRequest) {
      toast.error('You already have a pending withdrawal request');
      return;
    }

    try {
      setIsRequestingWithdrawal(true);

      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          advisor_id: user?.id,
          amount: earnings.availableForWithdrawal,
          status: 'pending',
          method: 'paypal', // Default method
          payment_details: {}, // This would be filled from user's payment settings
          requested_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Withdrawal request submitted successfully');
      await loadEarningsData();
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast.error('Failed to submit withdrawal request');
    } finally {
      setIsRequestingWithdrawal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading earnings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earnings Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Total Earnings</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earnings.totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">
                After {(platformCommissionRate * 100).toFixed(0)}% platform commission
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">This Month</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earnings.thisMonthEarnings.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-100">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Avg. per Session</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earnings.averagePerSession.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-yellow-100">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Available</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${earnings.availableForWithdrawal.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Withdrawal Section */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Withdrawal</h3>
            <p className="text-slate-600">Request payout of your earnings</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Available for withdrawal</p>
            <p className="text-2xl font-bold text-slate-900">
              ${earnings.availableForWithdrawal.toFixed(2)}
            </p>
          </div>
        </div>

        {earnings.availableForWithdrawal < minimumWithdrawal && (
          <div className="mb-4 p-3 bg-amber-50 rounded-lg flex items-start">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mr-2" />
            <p className="text-sm text-amber-700">
              Minimum withdrawal amount is ${minimumWithdrawal}. 
              You need ${(minimumWithdrawal - earnings.availableForWithdrawal).toFixed(2)} more to request a withdrawal.
            </p>
          </div>
        )}

        {hasPendingRequest && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-start">
            <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mr-2" />
            <p className="text-sm text-blue-700">
              You have a pending withdrawal request. Please wait for it to be processed before submitting a new one.
            </p>
          </div>
        )}

        <Button
          onClick={handleRequestWithdrawal}
          disabled={
            isRequestingWithdrawal || 
            earnings.availableForWithdrawal < minimumWithdrawal || 
            hasPendingRequest
          }
          className="w-full sm:w-auto"
        >
          {isRequestingWithdrawal ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Requesting...
            </>
          ) : (
            <>
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              Request Withdrawal
            </>
          )}
        </Button>
      </Card>

      {/* Recent Withdrawal Requests */}
      {withdrawalRequests.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Withdrawal Requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-center py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalRequests.slice(0, 5).map((request) => (
                  <tr key={request.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      {format(new Date(request.requested_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ${request.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          request.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : request.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : request.status === 'approved'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
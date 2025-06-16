import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { DollarSign, TrendingUp, Clock, Download, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MonthlyEarning {
  month: string;
  earnings: number;
  sessions: number;
  commission: number;
  netEarnings: number;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
}

interface WalletSettings {
  platform_commission_rate: number;
  minimum_withdrawal_amount: number;
}

export default function Earnings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isRequestingWithdrawal, setIsRequestingWithdrawal] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([]);
  const [avgPerSession, setAvgPerSession] = useState(0);
  const [payoutMethod, setPayoutMethod] = useState('');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()).toISOString());
  const [endDate, setEndDate] = useState(endOfMonth(new Date()).toISOString());
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [platformCommissionRate, setPlatformCommissionRate] = useState(0.2); // Default 20%
  const [minimumWithdrawal, setMinimumWithdrawal] = useState(50); // Default $50

  useEffect(() => {
    fetchWalletSettings();
    fetchEarningsData();
    fetchWithdrawalRequests();
  }, [startDate, endDate]);

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

  const fetchWithdrawalRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('advisor_id', user.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setWithdrawalRequests(data || []);
      setHasPendingRequest(data?.some(request => request.status === 'pending') || false);
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      toast.error('Failed to load withdrawal requests');
    }
  };

  const handleRequestWithdrawal = async () => {
    if (availableBalance < minimumWithdrawal) {
      toast.error(`Minimum withdrawal amount is $${minimumWithdrawal}`);
      return;
    }

    if (hasPendingRequest) {
      toast.error('You already have a pending withdrawal request');
      return;
    }

    if (!payoutMethod) {
      toast.error('Please select a payout method first');
      return;
    }

    try {
      setIsRequestingWithdrawal(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          advisor_id: user.id,
          amount: availableBalance,
          status: 'pending',
          method: payoutMethod,
          payment_details: {}, // This would be filled from user's payment settings
          requested_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Withdrawal request submitted successfully');
      fetchWithdrawalRequests();
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast.error('Failed to submit withdrawal request');
    } finally {
      setIsRequestingWithdrawal(false);
    }
  };

  const fetchEarningsData = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Fetch wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError) throw walletError;
      setAvailableBalance(wallet?.balance || 0);

      // Fetch sessions within date range
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('amount, start_time')
        .eq('advisor_id', user.id)
        .eq('status', 'completed')
        .gte('start_time', startDate)
        .lte('start_time', endDate);

      if (sessionsError) throw sessionsError;

      // Calculate earnings using the platform commission rate
      const totalRevenue = sessions?.reduce((sum, session) => sum + (session.amount || 0), 0) || 0;
      const netEarnings = totalRevenue * (1 - platformCommissionRate); // Apply commission rate
      setTotalEarnings(netEarnings);

      // Calculate average per session
      if (sessions?.length) {
        setAvgPerSession(netEarnings / sessions.length);
      }

      // Group by month
      const monthlyData = sessions?.reduce((acc: { [key: string]: MonthlyEarning }, session) => {
        const monthKey = format(parseISO(session.start_time), 'yyyy-MM');
        const monthName = format(parseISO(session.start_time), 'MMMM yyyy');
        
        if (!acc[monthKey]) {
          acc[monthKey] = {
            month: monthName,
            earnings: 0,
            sessions: 0,
            commission: 0,
            netEarnings: 0
          };
        }
        
        const sessionAmount = session.amount || 0;
        acc[monthKey].earnings += sessionAmount;
        acc[monthKey].sessions += 1;
        acc[monthKey].commission = acc[monthKey].earnings * platformCommissionRate;
        acc[monthKey].netEarnings = acc[monthKey].earnings * (1 - platformCommissionRate);
        
        return acc;
      }, {});

      setMonthlyEarnings(Object.values(monthlyData || {}).sort((a, b) => 
        new Date(b.month).getTime() - new Date(a.month).getTime()
      ));

      // Fetch payout method - Modified to handle multiple profiles
      const { data: profiles, error: profileError } = await supabase
        .from('advisor_profiles')
        .select('payout_method')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (profileError) throw profileError;
      setPayoutMethod(profiles?.[0]?.payout_method || '');

    } catch (error) {
      console.error('Error fetching earnings data:', error);
      toast.error('Failed to load earnings data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePaymentSettings = async () => {
    try {
      setIsSavingPayment(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Update the most recent profile
      const { data: profiles, error: fetchError } = await supabase
        .from('advisor_profiles')
        .select('id')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      if (!profiles || profiles.length === 0) {
        throw new Error('No advisor profile found');
      }

      const { error } = await supabase
        .from('advisor_profiles')
        .update({ payout_method: payoutMethod })
        .eq('id', profiles[0].id);

      if (error) throw error;

      toast.success('Payment settings updated successfully');
    } catch (error) {
      console.error('Error updating payment settings:', error);
      toast.error('Failed to update payment settings');
    } finally {
      setIsSavingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading earnings data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Earnings</h1>
        <p className="text-slate-600">Track your earnings and payment history</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">Available Balance</p>
              <p className="text-2xl font-semibold text-slate-900">${availableBalance.toFixed(2)}</p>
            </div>
          </div>
          {availableBalance >= minimumWithdrawal && !hasPendingRequest && (
            <Button 
              className="w-full mt-4"
              onClick={handleRequestWithdrawal}
              disabled={isRequestingWithdrawal || !payoutMethod}
            >
              {isRequestingWithdrawal ? 'Requesting...' : 'Request Withdrawal'}
            </Button>
          )}
          {availableBalance < minimumWithdrawal && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-start">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mr-2" />
              <p className="text-sm text-amber-700">
                Minimum withdrawal amount is ${minimumWithdrawal}
              </p>
            </div>
          )}
          {hasPendingRequest && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start">
              <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mr-2" />
              <p className="text-sm text-blue-700">
                You have a pending withdrawal request
              </p>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-slate-600">This Month</p>
              <p className="text-2xl font-semibold text-slate-900">
                ${(monthlyEarnings[0]?.netEarnings || 0).toFixed(2)}
              </p>
              <p className="text-xs text-slate-500">
                After {(platformCommissionRate * 100).toFixed(0)}% platform commission
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
              <p className="text-2xl font-semibold text-slate-900">${avgPerSession.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Withdrawal History</h2>
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
              {withdrawalRequests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-600">
                    No withdrawal requests yet
                  </td>
                </tr>
              ) : (
                withdrawalRequests.map((request) => (
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
                            : request.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {request.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Monthly Breakdown</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-4">
              <FormField
                type="date"
                value={startDate.split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value).toISOString())}
                className="w-40"
              />
              <span className="text-slate-500">to</span>
              <FormField
                type="date"
                value={endDate.split('T')[0]}
                onChange={(e) => setEndDate(new Date(e.target.value).toISOString())}
                className="w-40"
              />
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Month</th>
                <th className="text-right py-3 px-4">Sessions</th>
                <th className="text-right py-3 px-4">Gross Earnings</th>
                <th className="text-right py-3 px-4">Platform Fee ({(platformCommissionRate * 100).toFixed(0)}%)</th>
                <th className="text-right py-3 px-4">Net Earnings</th>
              </tr>
            </thead>
            <tbody>
              {monthlyEarnings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-600">
                    No earnings data for the selected period
                  </td>
                </tr>
              ) : (
                monthlyEarnings.map((month) => (
                  <tr key={month.month} className="border-b border-slate-100">
                    <td className="py-3 px-4">{month.month}</td>
                    <td className="py-3 px-4 text-right">{month.sessions}</td>
                    <td className="py-3 px-4 text-right">${month.earnings.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">${month.commission.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">${month.netEarnings.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Method
            </label>
            <select
              className="w-full rounded-lg border-slate-200"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
            >
              <option value="">Select a method</option>
              <option value="bank">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
          <Button
            onClick={handleSavePaymentSettings}
            disabled={isSavingPayment}
          >
            {isSavingPayment ? 'Saving...' : 'Update Payment Settings'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
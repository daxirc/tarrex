import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Wallet2, ArrowUpRight, ArrowDownLeft, TrendingUp, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface WalletData {
  balance: number;
  currency: string;
  lastUpdated: string;
}

interface QuickStats {
  thisMonthSpent: number;
  totalDeposits: number;
  pendingTransactions: number;
}

export default function WalletOverview() {
  const { user, wallet, fetchWallet } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [quickStats, setQuickStats] = useState<QuickStats>({
    thisMonthSpent: 0,
    totalDeposits: 0,
    pendingTransactions: 0
  });

  useEffect(() => {
    if (user?.id) {
      loadWalletData();
    }
  }, [user?.id]);

  const loadWalletData = async () => {
    try {
      setIsLoading(true);
      await fetchWallet();
      await fetchQuickStats();
    } catch (error) {
      console.error('Error loading wallet data:', error);
      toast.error('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQuickStats = async () => {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('type, amount, status, created_at')
        .eq('user_id', user?.id);

      if (error) throw error;

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats = transactions?.reduce((acc, transaction) => {
        const transactionDate = new Date(transaction.created_at);
        
        // This month spent
        if (transactionDate >= firstDayOfMonth && 
            (transaction.type === 'deduction' || transaction.type === 'session_payment')) {
          acc.thisMonthSpent += transaction.amount;
        }

        // Total deposits
        if (transaction.type === 'deposit' && transaction.status === 'completed') {
          acc.totalDeposits += transaction.amount;
        }

        // Pending transactions
        if (transaction.status === 'pending') {
          acc.pendingTransactions += transaction.amount;
        }

        return acc;
      }, {
        thisMonthSpent: 0,
        totalDeposits: 0,
        pendingTransactions: 0
      }) || {
        thisMonthSpent: 0,
        totalDeposits: 0,
        pendingTransactions: 0
      };

      setQuickStats(stats);
    } catch (error) {
      console.error('Error fetching quick stats:', error);
    }
  };

  const handleAddFunds = () => {
    toast.info('Payment integration coming soon!');
  };

  const handleWithdraw = () => {
    toast.info('Withdrawal feature coming soon!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading wallet...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Balance Card */}
      <Card className="lg:col-span-2">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-medium text-slate-600">Available Balance</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              ${wallet?.balance?.toFixed(2) || '0.00'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Last updated: {wallet?.last_updated_at ? 
                new Date(wallet.last_updated_at).toLocaleString() : 
                'Never'
              }
            </p>
          </div>
          <div className="p-3 bg-purple-100 rounded-lg">
            <Wallet2 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Button 
            className="flex items-center justify-center"
            onClick={handleAddFunds}
          >
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Add Funds
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center justify-center"
            onClick={handleWithdraw}
            disabled={user?.role !== 'advisor'}
          >
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            {user?.role === 'advisor' ? 'Withdraw' : 'Withdraw (Advisors Only)'}
          </Button>
        </div>
      </Card>

      {/* Quick Stats */}
      <Card>
        <h3 className="font-medium text-slate-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
          Quick Stats
        </h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600">This Month Spent</p>
            <p className="text-xl font-semibold text-slate-900">
              ${quickStats.thisMonthSpent.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Total Deposits</p>
            <p className="text-xl font-semibold text-slate-900">
              ${quickStats.totalDeposits.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Pending Transactions</p>
            <p className="text-xl font-semibold text-slate-900">
              ${quickStats.pendingTransactions.toFixed(2)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
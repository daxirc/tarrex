import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Wallet2, ArrowUpRight, ArrowDownLeft, History, Loader2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import TopUpModal from '../../components/wallet/TopUpModal';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method?: string;
  created_at: string;
}

interface QuickStats {
  thisMonthSpent: number;
  totalAdded: number;
  pendingWithdrawals: number;
}

export default function Transactions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, wallet, fetchWallet } = useStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingFunds, setIsAddingFunds] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickStats, setQuickStats] = useState<QuickStats>({
    thisMonthSpent: 0,
    totalAdded: 0,
    pendingWithdrawals: 0
  });
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
      fetchWallet();
    }
  }, [user, currentPage]);

  // Check URL parameters for actions
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    
    if (action === 'add_funds') {
      setShowTopUpModal(true);
      // Remove the query parameter to prevent modal from reopening on refresh
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (transactions.length > 0) {
      calculateQuickStats();
    }
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);

      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      if (countError) throw countError;

      if (count !== null) {
        setTotalPages(Math.ceil(count / itemsPerPage));
      }

      // Fetch transactions for current page
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateQuickStats = () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = transactions.reduce((acc, transaction) => {
      const transactionDate = new Date(transaction.created_at);
      
      // Calculate this month's spent
      if (transactionDate >= firstDayOfMonth && transaction.type === 'payment') {
        acc.thisMonthSpent += transaction.amount;
      }

      // Calculate total added
      if (transaction.type === 'deposit' && transaction.status === 'completed') {
        acc.totalAdded += transaction.amount;
      }

      // Calculate pending withdrawals
      if (transaction.type === 'withdrawal' && transaction.status === 'pending') {
        acc.pendingWithdrawals += transaction.amount;
      }

      return acc;
    }, {
      thisMonthSpent: 0,
      totalAdded: 0,
      pendingWithdrawals: 0
    });

    setQuickStats(stats);
  };

  const handleAddFunds = () => {
    setShowTopUpModal(true);
  };

  const handleTopUpSuccess = () => {
    setShowTopUpModal(false);
    fetchWallet();
    fetchTransactions();
    toast.success('Your wallet has been topped up successfully!');
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      // This would be replaced with actual withdrawal process
      toast.success('Withdrawal feature coming soon!');
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      toast.error('Failed to withdraw funds');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const getTransactionTypeStyle = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 text-green-700';
      case 'withdrawal':
        return 'bg-red-100 text-red-700';
      case 'payment':
        return 'bg-purple-100 text-purple-700';
      case 'refund':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading wallet data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wallet</h1>
        <p className="text-slate-600">Manage your balance and transactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Available Balance</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                ${wallet?.balance?.toFixed(2) || '0.00'}
              </p>
            </div>
            <Wallet2 className="w-8 h-8 text-purple-600" />
          </div>
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Button 
              className="flex items-center justify-center"
              onClick={handleAddFunds}
              disabled={isAddingFunds}
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              {isAddingFunds ? 'Processing...' : 'Add Funds'}
            </Button>
            <Button 
              variant="outline" 
              className="flex items-center justify-center"
              onClick={handleWithdraw}
              disabled={isWithdrawing}
            >
              <ArrowDownLeft className="w-4 h-4 mr-2" />
              {isWithdrawing ? 'Processing...' : 'Withdraw'}
            </Button>
          </div>
        </Card>

        {/* Quick Stats */}
        <Card>
          <h3 className="font-medium text-slate-900 mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600">This Month Spent</p>
              <p className="text-xl font-semibold text-slate-900">
                ${quickStats.thisMonthSpent.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Added</p>
              <p className="text-xl font-semibold text-slate-900">
                ${quickStats.totalAdded.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Pending Withdrawals</p>
              <p className="text-xl font-semibold text-slate-900">
                ${quickStats.pendingWithdrawals.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <History className="w-5 h-5 text-slate-600 mr-2" />
            <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
          </div>
          <Button variant="outline" size="sm">Export</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Method</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-right py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-600">
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
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeStyle(transaction.type)}`}>
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {transaction.payment_method || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={transaction.type === 'deposit' || transaction.type === 'refund' ? 'text-green-600' : ''}>
                        {transaction.type === 'deposit' || transaction.type === 'refund' ? '+' : '-'}
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : transaction.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* TopUp Modal */}
      {showTopUpModal && (
        <TopUpModal 
          onClose={() => setShowTopUpModal(false)} 
          onSuccess={handleTopUpSuccess} 
        />
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { History, Search, Download, Loader2, ArrowUpRight, ArrowDownLeft, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface Transaction {
  id: string;
  type: 'deposit' | 'deduction' | 'earning' | 'withdrawal' | 'admin_adjustment' | 'session_payment' | 'refund';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  created_at: string;
  payment_provider?: string;
}

export default function TransactionHistory() {
  const { user } = useStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const itemsPerPage = 10;

  useEffect(() => {
    if (user?.id) {
      fetchTransactions();
    }
  }, [user?.id, currentPage, typeFilter]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);

      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (typeFilter) {
        query = query.eq('type', typeFilter);
      }

      const { data, count, error } = await query
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;

      setTransactions(data || []);
      if (count !== null) {
        setTotalPages(Math.ceil(count / itemsPerPage));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowDownLeft className="w-4 h-4 text-red-600" />;
      case 'earning':
        return <DollarSign className="w-4 h-4 text-purple-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-slate-600" />;
    }
  };

  const getTransactionTypeStyle = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return 'bg-green-100 text-green-700';
      case 'withdrawal':
        return 'bg-red-100 text-red-700';
      case 'earning':
        return 'bg-purple-100 text-purple-700';
      case 'session_payment':
        return 'bg-blue-100 text-blue-700';
      case 'refund':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusStyle = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getAmountDisplay = (transaction: Transaction) => {
    const isPositive = ['deposit', 'earning', 'refund'].includes(transaction.type);
    const sign = isPositive ? '+' : '-';
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    
    return (
      <span className={colorClass}>
        {sign}${Math.abs(transaction.amount).toFixed(2)}
      </span>
    );
  };

  const handleExport = () => {
    toast.info('Export feature coming soon!');
  };

  const filteredTransactions = searchQuery
    ? transactions.filter(transaction =>
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading transactions...</span>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <History className="w-5 h-5 text-slate-600 mr-2" />
          <h2 className="text-lg font-semibold text-slate-900">Transaction History</h2>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          <option value="">All Types</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
          <option value="earning">Earnings</option>
          <option value="session_payment">Session Payments</option>
          <option value="refund">Refunds</option>
        </select>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Description</th>
              <th className="text-right py-3 px-4">Amount</th>
              <th className="text-center py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-600">
                  {searchQuery ? 'No transactions found matching your search' : 'No transactions yet'}
                </td>
              </tr>
            ) : (
              filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-slate-100">
                  <td className="py-3 px-4">
                    {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {getTransactionIcon(transaction.type)}
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeStyle(transaction.type)}`}>
                        {transaction.type.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-slate-900">{transaction.description}</p>
                      {transaction.payment_provider && (
                        <p className="text-xs text-slate-500">via {transaction.payment_provider}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {getAmountDisplay(transaction)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusStyle(transaction.status)}`}>
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

      {/* Pagination */}
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
  );
}
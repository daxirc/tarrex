import DashboardLayout from '../layouts/DashboardLayout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Wallet2, ArrowUpRight, ArrowDownLeft, History } from 'lucide-react';

export default function Wallet() {
  const transactions = [
    {
      id: 1,
      type: 'deposit',
      amount: 100,
      date: '2024-03-15',
      status: 'completed',
      description: 'Added funds'
    },
    {
      id: 2,
      type: 'payment',
      amount: 45.99,
      date: '2024-03-14',
      status: 'completed',
      description: 'Session with Sarah Mitchell'
    },
    {
      id: 3,
      type: 'deposit',
      amount: 50,
      date: '2024-03-10',
      status: 'completed',
      description: 'Added funds'
    }
  ];

  return (
    <DashboardLayout>
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
                <p className="text-3xl font-bold text-slate-900 mt-1">$104.01</p>
              </div>
              <Wallet2 className="w-8 h-8 text-purple-600" />
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button className="flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 mr-2" />
                Add Funds
              </Button>
              <Button variant="outline" className="flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <h3 className="font-medium text-slate-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">This Month Spent</p>
                <p className="text-xl font-semibold text-slate-900">$45.99</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Added</p>
                <p className="text-xl font-semibold text-slate-900">$150.00</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Pending Withdrawals</p>
                <p className="text-xl font-semibold text-slate-900">$0.00</p>
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
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Type</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {transaction.date}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900">
                      {transaction.description}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'deposit' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {transaction.type === 'deposit' ? 'Deposit' : 'Payment'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">
                      <span className={transaction.type === 'deposit' ? 'text-green-600' : 'text-slate-900'}>
                        {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {transaction.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
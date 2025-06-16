import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface WithdrawalRequest {
  id: string;
  advisor: {
    full_name: string;
    email: string;
  };
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
}

export default function WithdrawalRequests() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchWithdrawalRequests();
  }, []);

  const fetchWithdrawalRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select(`
          id,
          advisor:advisor_id (
            full_name,
            email
          ),
          amount,
          status,
          requested_at,
          completed_at,
          notes
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setRequests(data);
    } catch (error) {
      console.error('Error fetching withdrawal requests:', error);
      toast.error('Failed to load withdrawal requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      const { error } = await supabase
        .from('withdrawal_requests')
        .update({
          status: newStatus,
          completed_at: new Date().toISOString(),
          notes: notes.trim() || null
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success(`Withdrawal request ${newStatus}`);
      fetchWithdrawalRequests();
      setSelectedRequest(null);
      setNotes('');
    } catch (error) {
      console.error('Error updating withdrawal request:', error);
      toast.error('Failed to update withdrawal request');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading withdrawal requests...</span>
      </div>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Withdrawal Requests</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4">Advisor</th>
              <th className="text-right py-3 px-4">Amount</th>
              <th className="text-center py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Requested</th>
              <th className="text-left py-3 px-4">Notes</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-600">
                  No withdrawal requests found
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr key={request.id} className="border-b border-slate-100">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-slate-900">{request.advisor.full_name}</p>
                      <p className="text-sm text-slate-500">{request.advisor.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
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
                    {format(new Date(request.requested_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {request.notes || '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {request.status === 'pending' && (
                      selectedRequest === request.id ? (
                        <div className="space-y-4">
                          <FormField
                            label="Notes"
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes"
                          />
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(null);
                                setNotes('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleStatusUpdate(request.id, 'approved')}
                              disabled={isProcessing}
                            >
                              {isProcessing ? 'Processing...' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusUpdate(request.id, 'rejected')}
                              disabled={isProcessing}
                              className="border-red-300 text-red-600 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setSelectedRequest(request.id)}
                        >
                          Review
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
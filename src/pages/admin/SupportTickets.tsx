import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2, Search, MessageSquare, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SupportTicket {
  id: string;
  formatted_ticket_number: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  user: {
    full_name: string;
    email: string;
    role: string;
  };
  user_role: string;
}

export default function SupportTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'client' | 'advisor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchTickets();

    // Set up real-time subscription
    const subscription = supabase
      .channel('support_tickets_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets'
      }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentPage, userTypeFilter, statusFilter]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        setCurrentPage(1);
        fetchTickets();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);

      // Build the base query
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          user:user_id (
            full_name,
            email,
            role
          )
        `, { count: 'exact' });

      // Apply filters
      if (userTypeFilter !== 'all') {
        query = query.eq('user_role', userTypeFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,message.ilike.%${searchQuery}%`);
      }

      // Add pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setTickets(data || []);
      if (count) {
        setTotalPages(Math.ceil(count / itemsPerPage));
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (ticketId: string, newStatus: SupportTicket['status']) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      const { error } = await supabase
        .from('support_tickets')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      toast.success('Ticket status updated');
      fetchTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast.error('Failed to update ticket');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: SupportTicket['status']) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading tickets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
        <p className="text-slate-600">Manage and respond to user support requests</p>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <select
              value={userTypeFilter}
              onChange={(e) => {
                setUserTypeFilter(e.target.value as 'all' | 'client' | 'advisor');
                setCurrentPage(1);
              }}
              className="rounded-lg border-slate-200"
            >
              <option value="all">All Users</option>
              <option value="client">Clients Only</option>
              <option value="advisor">Advisors Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'open' | 'in_progress' | 'resolved' | 'closed');
                setCurrentPage(1);
              }}
              className="rounded-lg border-slate-200"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Ticket ID</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Subject</th>
                <th className="text-left py-3 px-4">Created</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-600">
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-mono text-sm">
                      {ticket.formatted_ticket_number}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-900">{ticket.user.full_name}</p>
                        <p className="text-sm text-slate-500">{ticket.user.email}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          ticket.user_role === 'advisor'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ticket.user_role}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-slate-900">{ticket.subject}</p>
                        <p className="text-sm text-slate-500 line-clamp-1">{ticket.message}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <select
                          value={ticket.status}
                          onChange={(e) => handleStatusUpdate(ticket.id, e.target.value as SupportTicket['status'])}
                          className={`px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(ticket.status)}`}
                          disabled={isProcessing}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/secure-portal/support/ticket/${ticket.id}`)}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        View
                      </Button>
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
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
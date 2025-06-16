import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import TextareaField from '../../components/ui/TextareaField';
import { ArrowLeft, Clock, Send, Loader2, RefreshCw, User, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TicketMessage {
  id: string;
  message: string;
  created_at: string;
  sender: {
    id: string;
    full_name: string;
    role: string;
  };
}

interface TicketData {
  id: string;
  formatted_ticket_number: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
}

export default function AdminTicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    if (ticketId) {
      fetchTicketData();
    }
  }, [ticketId]);

  const fetchTicketData = async () => {
    try {
      setIsLoading(true);

      // Fetch ticket data
      const { data: ticketData, error: ticketError } = await supabase
        .from('support_tickets')
        .select(`
          *,
          user:user_id (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;
      if (!ticketData) throw new Error('Ticket not found');

      setTicketData(ticketData);

      // Updated query to correctly join with users table
      const { data: messages, error: messagesError } = await supabase
        .from('support_ticket_messages')
        .select(`
          id,
          message,
          created_at,
          sender:users!sender_id (
            id,
            full_name,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messages || []);
    } catch (error) {
      console.error('Error fetching ticket data:', error);
      toast.error('Failed to load ticket data');
      navigate('/secure-portal/support');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await fetchTicketData();
      toast.success('Messages refreshed');
    } catch (error) {
      console.error('Error refreshing messages:', error);
      toast.error('Failed to refresh messages');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketData['status']) => {
    if (!ticketData || isUpdatingStatus) return;

    try {
      setIsUpdatingStatus(true);

      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticketData.id);

      if (error) throw error;

      setTicketData({ ...ticketData, status: newStatus });
      toast.success('Ticket status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketId || !newMessage.trim()) return;

    try {
      setIsSending(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
      await fetchTicketData();
      toast.success('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: TicketData['status']) => {
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
        <span className="ml-2 text-slate-600">Loading ticket...</span>
      </div>
    );
  }

  if (!ticketData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Ticket Not Found</h2>
        <p className="text-slate-600 mb-4">This ticket may have been deleted.</p>
        <Button onClick={() => navigate('/secure-portal/support')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Support
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/secure-portal/support')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Support
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {ticketData.formatted_ticket_number}
              </h1>
              <select
                value={ticketData.status}
                onChange={(e) => handleStatusChange(e.target.value as TicketData['status'])}
                className={`px-2 py-1 text-sm font-medium rounded-full ${getStatusColor(ticketData.status)}`}
                disabled={isUpdatingStatus}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <p className="text-lg text-slate-700">{ticketData.subject}</p>
            <div className="flex items-center mt-2 text-sm text-slate-500">
              <Clock className="w-4 h-4 mr-1" />
              {format(new Date(ticketData.created_at), 'MMM d, yyyy h:mm a')}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* User Info Card */}
        <Card className="bg-slate-50">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <User className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">{ticketData.user.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600">{ticketData.user.email}</span>
              </div>
              <span className={`mt-2 inline-block text-xs px-2 py-1 rounded-full ${
                ticketData.user.role === 'advisor'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {ticketData.user.role}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-6">
          {/* Message Thread */}
          <div className="space-y-6">
            {messages.length === 0 ? (
              <p className="text-center text-slate-600 py-8">No messages yet</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender.role === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${
                    message.sender.role === 'admin'
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-slate-100 text-slate-900'
                  } rounded-lg px-4 py-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {message.sender.full_name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        message.sender.role === 'admin'
                          ? 'bg-purple-200 text-purple-800'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {message.sender.role}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{message.message}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {format(new Date(message.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply Form */}
          {ticketData.status !== 'closed' && (
            <form onSubmit={handleSendMessage} className="pt-6 border-t border-slate-200">
              <TextareaField
                label="Reply"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                required
                disabled={isSending}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
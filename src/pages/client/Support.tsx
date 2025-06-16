import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import TextareaField from '../../components/ui/TextareaField';
import { MessageSquare, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface SupportTicket {
  id: string;
  formatted_ticket_number: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
}

export default function Support() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: ''
  });

  useEffect(() => {
    if (user?.id) {
      fetchTickets();

      // Set up real-time subscription
      const subscription = supabase
        .channel('user_tickets')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchTickets();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setIsSubmitting(true);

      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: formData.subject,
          message: formData.message,
          status: 'open'
        });

      if (error) throw error;

      toast.success('Support ticket submitted successfully');
      setFormData({ subject: '', message: '' });
      fetchTickets();
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast.error('Failed to submit support ticket');
    } finally {
      setIsSubmitting(false);
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
        <span className="ml-2 text-slate-600">Loading support tickets...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Support</h1>
        <p className="text-slate-600">Get help with your account or sessions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Ticket Form */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Create New Ticket</h2>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <FormField
                label="Subject"
                type="text"
                required
                placeholder="Brief description of your issue"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                disabled={isSubmitting}
              />

              <TextareaField
                label="Message"
                required
                rows={5}
                placeholder="Describe your issue in detail"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                disabled={isSubmitting}
              />

              <Button 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Ticket List */}
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-6">Recent Tickets</h2>
            <div className="space-y-4">
              {tickets.length === 0 ? (
                <p className="text-center text-slate-600 py-4">No tickets found</p>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-lg border border-slate-200 hover:border-purple-200 cursor-pointer transition-colors"
                    onClick={() => navigate(`/dashboard/support/ticket/${ticket.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-mono text-slate-600">
                            {ticket.formatted_ticket_number}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="font-medium text-slate-900">{ticket.subject}</h3>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {ticket.message}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center mt-3 text-sm text-slate-500">
                      <Clock className="w-4 h-4 mr-1" />
                      <time dateTime={ticket.created_at}>
                        {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                      </time>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8">
        <Card>
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Need Immediate Help?</h2>
              <p className="text-slate-600 mt-1">
                For urgent matters, please contact us directly at support@tarrex.com
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Loader2, Search, MessageSquare, Video, Phone, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSocket } from '../../contexts/SocketContext';
import { useStore } from '../../lib/store';
import { checkClientBalance } from '../../lib/billing';

interface Session {
  id: string;
  client: {
    full_name: string;
    id: string;
  };
  type: 'chat' | 'voice' | 'video';
  status: 'pending_advisor_approval' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  start_time: string;
  duration_minutes: number | null;
  amount: number | null;
}

export default function Sessions() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSessions();
    
    // Set up real-time subscription for session updates
    const subscription = supabase
      .channel('sessions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `advisor_id=eq.${(supabase.auth.getUser()).then(res => res.data.user?.id)}`
      }, () => {
        console.log('🔄 Sessions table changed, refreshing data...');
        fetchSessions();
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          client:client_id (
            id,
            full_name
          ),
          type,
          status,
          start_time,
          duration_minutes,
          amount
        `)
        .eq('advisor_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      
      console.log('📊 Fetched sessions:', data?.length || 0);
      
      // Check for pending sessions and show notification if there are any
      const pendingSessions = data?.filter(session => session.status === 'pending_advisor_approval') || [];
      if (pendingSessions.length > 0) {
        console.log('⚠️ Found pending sessions:', pendingSessions.length);
        pendingSessions.forEach(async session => {
          // Check if client has sufficient balance using Edge Function
          try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-client-balance`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                clientId: session.client.id,
                requiredAmount: 3
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const balanceData = await response.json();
            
            if (!balanceData.hasSufficientBalance) {
              console.log('⚠️ Client has insufficient balance, auto-rejecting chat request');
              
              // Update session status to cancelled
              await supabase
                .from('sessions')
                .update({ status: 'cancelled' })
                .eq('id', session.id);
                
              // Notify client if socket is connected
              if (socket && isConnected) {
                socket.emit('chat_response', { sessionId: session.id, accepted: false });
                socket.emit('chat_rejected', { sessionId: session.id, reason: 'insufficient_funds' });
              }
              
              return;
            }
          } catch (error) {
            console.error('❌ Error checking client balance:', error);
            // Continue anyway, we'll check balance again when accepting
          }
          
          // Emit a local event to trigger the notification system
          if (socket && isConnected) {
            console.log('🔔 Emitting chat_request for pending session:', session.id);
            socket.emit('local_pending_session', {
              sessionId: session.id,
              clientName: session.client.full_name,
              clientId: session.client.id,
              initialMessage: 'New chat request'
            });
          }
        });
      }
      
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      await fetchSessions();
      toast.success('Sessions refreshed');
    } catch (error) {
      console.error('Error refreshing sessions:', error);
      toast.error('Failed to refresh sessions');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAcceptSession = async (sessionId: string) => {
    if (isProcessing) return;

    try {
      setIsProcessing(sessionId);
      
      // Get session data to check client balance
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('client_id')
        .eq('id', sessionId)
        .single();
        
      if (sessionError) throw sessionError;
      
      // Check if client has sufficient balance using Edge Function
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-client-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            clientId: session.client_id,
            requiredAmount: 3
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const balanceData = await response.json();
        
        if (!balanceData.hasSufficientBalance) {
          toast.error('Client has insufficient balance. Session cannot be started.');
          
          // Update session status to cancelled
          await supabase
            .from('sessions')
            .update({ status: 'cancelled' })
            .eq('id', sessionId);
            
          // Notify client
          if (socket && isConnected) {
            socket.emit('chat_response', { sessionId, accepted: false });
            socket.emit('chat_rejected', { sessionId, reason: 'insufficient_funds' });
            socket.emit('insufficient_funds', { sessionId });
          }
          
          return;
        }
      } catch (error) {
        console.error('❌ Error checking client balance:', error);
        toast.error('Failed to verify client balance. Please try again.');
        return;
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ 
          status: 'in_progress',
          start_time: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      if (socket && isConnected) {
        socket.emit('chat_response', { sessionId, accepted: true });
        socket.emit('advisor_accepted_chat', { sessionId, advisorId: user?.id });
        
        // Start billing
        socket.emit('billing_start', {
          sessionId,
          advisorId: user?.id,
          clientId: session.client_id
        });
      } else {
        console.warn('⚠️ Socket not connected, cannot send acceptance');
      }

      toast.success('Session accepted');
      await fetchSessions();
      
      // Navigate to the session
      navigate(`/advisor-dashboard/live-session/${sessionId}`);
    } catch (error) {
      console.error('Error accepting session:', error);
      toast.error('Failed to accept session');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeclineSession = async (sessionId: string) => {
    if (isProcessing) return;

    try {
      setIsProcessing(sessionId);

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'cancelled' })
        .eq('id', sessionId);

      if (updateError) throw updateError;

      if (socket && isConnected) {
        socket.emit('chat_response', { sessionId, accepted: false });
        socket.emit('chat_rejected', { sessionId });
        socket.emit('advisor_declined_chat', { sessionId, advisorId: user?.id });
      } else {
        console.warn('⚠️ Socket not connected, cannot send rejection');
      }

      toast.success('Session declined');
      await fetchSessions();
    } catch (error) {
      console.error('Error declining session:', error);
      toast.error('Failed to decline session');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    navigate(`/advisor-dashboard/live-session/${sessionId}`);
  };

  const getSessionTypeIcon = (type: Session['type']) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'voice':
        return <Phone className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };
  
  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    return session.client.full_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading sessions...</span>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Session History</h2>
        <div className="flex space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-4">Client</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-right py-3 px-4">Duration</th>
              <th className="text-right py-3 px-4">Amount</th>
              <th className="text-center py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-600">
                  {searchQuery ? 'No sessions found matching your search' : 'No sessions found'}
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => (
                <tr key={session.id} className={`border-b border-slate-100 ${
                  session.status === 'pending_advisor_approval' ? 'bg-yellow-50' : ''
                }`}>
                  <td className="py-3 px-4">{session.client.full_name}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      session.type === 'video'
                        ? 'bg-blue-100 text-blue-700'
                        : session.type === 'voice'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {getSessionTypeIcon(session.type)}
                      <span className="ml-1">{session.type}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {format(new Date(session.start_time), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {session.duration_minutes ? `${session.duration_minutes} min` : '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {session.amount ? `$${session.amount.toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        session.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : session.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : session.status === 'pending_advisor_approval'
                          ? 'bg-yellow-100 text-yellow-700'
                          : session.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {session.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {session.status === 'pending_advisor_approval' ? (
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptSession(session.id)}
                          disabled={isProcessing === session.id}
                          className="flex items-center"
                        >
                          {isProcessing === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-1" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineSession(session.id)}
                          disabled={isProcessing === session.id}
                          className="flex items-center border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    ) : session.status === 'in_progress' ? (
                      <Button
                        size="sm"
                        onClick={() => handleJoinSession(session.id)}
                      >
                        Join Session
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                      >
                        View
                      </Button>
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
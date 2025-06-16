import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
  id: string;
  full_name: string;
  last_session: string;
  total_minutes: number;
  total_earnings: number;
  session_type: string;
}

export default function RecentClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRecentClients();
  }, []);

  const fetchRecentClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Fetch all completed sessions with client info
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select(`
          client_id,
          client:client_id (
            id,
            full_name
          ),
          start_time,
          duration_minutes,
          amount,
          type
        `)
        .eq('advisor_id', user.id)
        .eq('status', 'completed')
        .order('start_time', { ascending: false });

      if (error) throw error;

      // Process sessions to get unique clients with their latest session and totals
      const clientMap = new Map<string, Client>();
      
      sessions.forEach(session => {
        const clientId = session.client_id;
        const existingClient = clientMap.get(clientId);

        if (!existingClient) {
          clientMap.set(clientId, {
            id: session.client.id,
            full_name: session.client.full_name,
            last_session: session.start_time,
            total_minutes: session.duration_minutes || 0,
            total_earnings: (session.amount || 0) * 0.8, // 80% commission
            session_type: session.type
          });
        } else {
          existingClient.total_minutes += session.duration_minutes || 0;
          existingClient.total_earnings += (session.amount || 0) * 0.8;
        }
      });

      setClients(Array.from(clientMap.values()));
    } catch (error) {
      console.error('Error fetching recent clients:', error);
      toast.error('Failed to load recent clients');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading recent clients...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Recent Clients</h1>
        <p className="text-slate-600">Overview of your recent client interactions</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-left py-3 px-4">Last Session</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-right py-3 px-4">Total Minutes</th>
                <th className="text-right py-3 px-4">Total Earnings</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-600">
                    No clients yet
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <Avatar
                          alt={client.full_name}
                          size="sm"
                        />
                        <span className="ml-3">{client.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {format(new Date(client.last_session), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        client.session_type === 'video'
                          ? 'bg-blue-100 text-blue-700'
                          : client.session_type === 'voice'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {client.session_type.charAt(0).toUpperCase() + client.session_type.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{client.total_minutes}</td>
                    <td className="py-3 px-4 text-right">${client.total_earnings.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
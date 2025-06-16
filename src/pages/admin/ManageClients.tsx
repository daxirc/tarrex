import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Loader2, Search, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  created_at: string;
  is_approved: boolean;
}

export default function ManageClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!clients.length) return;

    const searchTerm = debouncedSearchQuery.toLowerCase();
    if (!searchTerm) {
      setFilteredClients(clients);
      return;
    }

    const filtered = clients.filter(client => {
      const fullName = (client.full_name || '').toLowerCase();
      const email = client.email.toLowerCase();
      const username = (client.username || '').toLowerCase();

      return fullName.includes(searchTerm) ||
             email.includes(searchTerm) ||
             username.includes(searchTerm);
    });

    setFilteredClients(filtered);
  }, [debouncedSearchQuery, clients]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovalToggle = async (clientId: string, currentStatus: boolean) => {
    try {
      setIsUpdating(clientId);

      const { error } = await supabase
        .from('users')
        .update({ is_approved: !currentStatus })
        .eq('id', clientId);

      if (error) throw error;

      const updatedClients = clients.map(client => 
        client.id === clientId 
          ? { ...client, is_approved: !currentStatus }
          : client
      );
      setClients(updatedClients);
      setFilteredClients(updatedClients);

      toast.success(`Client ${!currentStatus ? 'approved' : 'unapproved'}`);
    } catch (error) {
      console.error('Error updating client status:', error);
      toast.error('Failed to update client status');
    } finally {
      setIsUpdating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading clients...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, username, or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Full Name</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Joined Date</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-600">
                    {searchQuery ? 'No clients found matching your search' : 'No clients found'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">{client.full_name || 'N/A'}</td>
                    <td className="py-3 px-4">{client.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        client.is_approved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {client.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {format(new Date(client.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/secure-portal/client/${client.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant={client.is_approved ? 'outline' : 'primary'}
                        onClick={() => handleApprovalToggle(client.id, client.is_approved)}
                        disabled={isUpdating === client.id}
                      >
                        {isUpdating === client.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          client.is_approved ? 'Unapprove' : 'Approve'
                        )}
                      </Button>
                    </td>
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
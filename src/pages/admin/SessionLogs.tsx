import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2, Search, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Session {
  id: string;
  client: {
    full_name: string;
  };
  advisor: {
    full_name: string;
  };
  type: 'chat' | 'voice' | 'video';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  amount: number | null;
}

export default function SessionLogs() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    filterSessions();
  }, [sessions, startDate, endDate, statusFilter, searchQuery]);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          client:client_id (full_name),
          advisor:advisor_id (full_name),
          type,
          status,
          start_time,
          end_time,
          duration_minutes,
          amount
        `)
        .order('start_time', { ascending: false });

      if (error) throw error;

      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const filterSessions = () => {
    let filtered = [...sessions];

    // Apply date filters
    if (startDate) {
      filtered = filtered.filter(session => 
        new Date(session.start_time) >= new Date(startDate)
      );
    }
    if (endDate) {
      filtered = filtered.filter(session => 
        new Date(session.start_time) <= new Date(endDate)
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(session => 
        session.status === statusFilter
      );
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(session =>
        session.client.full_name.toLowerCase().includes(query) ||
        session.advisor.full_name.toLowerCase().includes(query)
      );
    }

    setFilteredSessions(filtered);
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('');
    setSearchQuery('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <FormField
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            icon={<Calendar className="w-5 h-5" />}
          />

          <FormField
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            icon={<Calendar className="w-5 h-5" />}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="mr-2"
          >
            Clear Filters
          </Button>
          <Button onClick={fetchSessions}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Sessions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Session ID</th>
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-left py-3 px-4">Advisor</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Date & Time</th>
                <th className="text-right py-3 px-4">Duration</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-center py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-600">
                    No sessions found
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-mono text-sm">
                      {session.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4">{session.client.full_name}</td>
                    <td className="py-3 px-4">{session.advisor.full_name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        session.type === 'video'
                          ? 'bg-blue-100 text-blue-700'
                          : session.type === 'voice'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {session.type}
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
                            : session.status === 'scheduled'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {session.status.replace('_', ' ')}
                        </span>
                      </div>
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
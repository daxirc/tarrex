import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Loader2, Search, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Advisor {
  id: string;
  full_name: string | null;
  email: string;
  is_approved: boolean;
  username: string | null;
  profile: {
    id: string;
    price_per_minute: number;
    video_enabled: boolean;
    voice_enabled: boolean;
  } | null;
}

export default function ManageAdvisors() {
  const navigate = useNavigate();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [filteredAdvisors, setFilteredAdvisors] = useState<Advisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    fetchAdvisors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!advisors.length) return;

    const searchTerm = debouncedSearchQuery.toLowerCase();
    if (!searchTerm) {
      setFilteredAdvisors(advisors);
      return;
    }

    const filtered = advisors.filter(advisor => {
      const fullName = (advisor.full_name || '').toLowerCase();
      const email = advisor.email.toLowerCase();
      const username = (advisor.username || '').toLowerCase();

      return fullName.includes(searchTerm) ||
             email.includes(searchTerm) ||
             username.includes(searchTerm);
    });

    setFilteredAdvisors(filtered);
  }, [debouncedSearchQuery, advisors]);

  const fetchAdvisors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          profile:advisor_profiles(
            id,
            price_per_minute,
            video_enabled,
            voice_enabled
          )
        `)
        .eq('role', 'advisor')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdvisors(data || []);
      setFilteredAdvisors(data || []);
    } catch (error) {
      console.error('Error fetching advisors:', error);
      toast.error('Failed to load advisors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprovalToggle = async (advisorId: string, currentStatus: boolean) => {
    try {
      setIsUpdating(advisorId);

      const { error } = await supabase
        .from('users')
        .update({ is_approved: !currentStatus })
        .eq('id', advisorId);

      if (error) throw error;

      const updatedAdvisors = advisors.map(advisor => 
        advisor.id === advisorId 
          ? { ...advisor, is_approved: !currentStatus }
          : advisor
      );
      setAdvisors(updatedAdvisors);
      setFilteredAdvisors(updatedAdvisors);

      toast.success(`Advisor ${!currentStatus ? 'approved' : 'unapproved'}`);
    } catch (error) {
      console.error('Error updating advisor status:', error);
      toast.error('Failed to update advisor status');
    } finally {
      setIsUpdating(null);
    }
  };

  const handlePermissionToggle = async (advisorId: string, permission: 'video_enabled' | 'voice_enabled', currentValue: boolean) => {
    try {
      setIsUpdating(advisorId);

      const advisor = advisors.find(a => a.id === advisorId);
      if (!advisor?.profile?.id) {
        throw new Error('Advisor profile not found');
      }

      const { error } = await supabase
        .from('advisor_profiles')
        .update({ [permission]: !currentValue })
        .eq('id', advisor.profile.id);

      if (error) throw error;

      const updatedAdvisors = advisors.map(advisor => 
        advisor.id === advisorId && advisor.profile
          ? {
              ...advisor,
              profile: {
                ...advisor.profile,
                [permission]: !currentValue
              }
            }
          : advisor
      );
      setAdvisors(updatedAdvisors);
      setFilteredAdvisors(updatedAdvisors);

      toast.success('Permission updated successfully');
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    } finally {
      setIsUpdating(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading advisors...</span>
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
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Price/min</th>
                <th className="text-center py-3 px-4">Video</th>
                <th className="text-center py-3 px-4">Voice</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdvisors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-600">
                    {searchQuery ? 'No advisors found matching your search' : 'No advisors found'}
                  </td>
                </tr>
              ) : (
                filteredAdvisors.map((advisor) => (
                  <tr key={advisor.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">{advisor.full_name || 'N/A'}</td>
                    <td className="py-3 px-4">{advisor.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        advisor.is_approved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {advisor.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      ${(advisor.profile?.price_per_minute ?? 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={advisor.profile?.video_enabled || false}
                        className="rounded text-purple-600"
                        onChange={() => handlePermissionToggle(advisor.id, 'video_enabled', advisor.profile?.video_enabled || false)}
                        disabled={isUpdating === advisor.id}
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={advisor.profile?.voice_enabled || false}
                        className="rounded text-purple-600"
                        onChange={() => handlePermissionToggle(advisor.id, 'voice_enabled', advisor.profile?.voice_enabled || false)}
                        disabled={isUpdating === advisor.id}
                      />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/secure-portal/advisor/${advisor.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant={advisor.is_approved ? 'outline' : 'primary'}
                        onClick={() => handleApprovalToggle(advisor.id, advisor.is_approved)}
                        disabled={isUpdating === advisor.id}
                      >
                        {isUpdating === advisor.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          advisor.is_approved ? 'Unapprove' : 'Approve'
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
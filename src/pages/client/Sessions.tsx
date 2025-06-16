import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Star, Loader2, Search, MessageSquare, Video, Phone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';
import ReviewModal from './ReviewModal';

interface Session {
  id: string;
  advisor: {
    id: string;
    full_name: string;
    profile: {
      profile_picture: string | null;
    };
  };
  type: 'chat' | 'voice' | 'video';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  start_time: string;
  duration_minutes: number | null;
  amount: number | null;
  review: {
    id: string;
    rating: number;
  } | null;
}

export default function Sessions() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'start_time' | 'amount'>('start_time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
  }, [user, currentPage, sortField, sortOrder]);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);

      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user?.id);

      if (countError) throw countError;

      if (count !== null) {
        setTotalPages(Math.ceil(count / itemsPerPage));
      }

      // Fetch sessions for current page
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          type,
          status,
          start_time,
          duration_minutes,
          amount,
          advisor:advisor_id (
            id,
            full_name,
            profile:advisor_profiles (
              profile_picture
            )
          ),
          review:reviews (
            id,
            rating
          )
        `)
        .eq('client_id', user?.id)
        .order(sortField, { ascending: sortOrder === 'asc' })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;

      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
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

  const getSessionTypeStyle = (type: Session['type']) => {
    switch (type) {
      case 'video':
        return 'bg-blue-100 text-blue-700';
      case 'voice':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-purple-100 text-purple-700';
    }
  };

  const getStatusStyle = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const handleLeaveReview = (session: Session) => {
    setSelectedSession(session);
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (rating: number, comment: string) => {
    if (!selectedSession || !user) return;
    
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          session_id: selectedSession.id,
          client_id: user.id,
          advisor_id: selectedSession.advisor.id,
          rating,
          comment
        });
        
      if (error) throw error;
      
      toast.success('Review submitted successfully');
      setShowReviewModal(false);
      fetchSessions(); // Refresh to show the new review
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    }
  };

  const handleJoinSession = (sessionId: string) => {
    navigate(`/dashboard/live-session/${sessionId}`);
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Session History</h1>
        <p className="text-slate-600">View all your past and upcoming sessions</p>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by advisor name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortField(field as 'start_time' | 'amount');
                setSortOrder(order as 'asc' | 'desc');
                setCurrentPage(1);
              }}
              className="rounded-lg border-slate-200"
            >
              <option value="start_time-desc">Latest First</option>
              <option value="start_time-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">Session ID</th>
                <th className="text-left py-3 px-4">Advisor</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">Date & Time</th>
                <th className="text-right py-3 px-4">Duration</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-center py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-600">
                    No sessions found
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100">
                    <td className="py-3 px-4 font-mono text-sm">
                      #{session.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4">{session.advisor.full_name}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSessionTypeStyle(session.type)}`}>
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
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusStyle(session.status)}`}>
                          {session.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {session.status === 'completed' && !session.review && (
                        <Button
                          size="sm"
                          onClick={() => handleLeaveReview(session)}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Leave Review
                        </Button>
                      )}
                      {session.review && (
                        <div className="flex justify-end text-yellow-400">
                          {[...Array(session.review.rating)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-current" />
                          ))}
                        </div>
                      )}
                      {session.status === 'in_progress' && (
                        <Button 
                          size="sm"
                          onClick={() => handleJoinSession(session.id)}
                        >
                          Join Session
                        </Button>
                      )}
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

      {/* Review Modal */}
      {showReviewModal && selectedSession && (
        <ReviewModal
          session={selectedSession}
          onClose={() => setShowReviewModal(false)}
          onSubmit={handleReviewSubmit}
        />
      )}
    </div>
  );
}
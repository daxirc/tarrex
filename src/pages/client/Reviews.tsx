import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { Star, Loader2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../lib/store';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  advisor: {
    id: string;
    full_name: string;
    profile: {
      profile_picture: string | null;
    };
  };
}

export default function Reviews() {
  const { user } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchReviews();
    }
  }, [user]);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          advisor:advisor_id (
            id,
            full_name,
            profile:advisor_profiles (
              profile_picture
            )
          )
        `)
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredReviews = searchQuery
    ? reviews.filter(review =>
        review.advisor.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.comment.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : reviews;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading reviews...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Reviews</h1>
        <p className="text-slate-600">Reviews you've left for advisors</p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search reviews..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Reviews Grid */}
      {reviews.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Star className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Reviews Yet</h3>
            <p className="text-slate-600">
              You haven't left any reviews for advisors yet.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReviews.map((review) => (
            <Card key={review.id}>
              <div className="flex items-start space-x-4">
                <Avatar
                  src={review.advisor.profile?.profile_picture}
                  alt={review.advisor.full_name}
                  size="lg"
                />
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">
                    {review.advisor.full_name}
                  </h3>
                  <div className="flex text-yellow-400 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < review.rating ? 'fill-current' : ''}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Posted on {format(new Date(review.created_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-slate-600 whitespace-pre-wrap">
                {review.comment}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
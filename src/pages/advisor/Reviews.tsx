import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import { Star, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Review {
  id: string;
  client: {
    full_name: string;
  };
  rating: number;
  comment: string;
  created_at: string;
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          client:client_id (
            full_name
          ),
          rating,
          comment,
          created_at
        `)
        .eq('advisor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviews(data);

      if (data.length > 0) {
        const avgRating = data.reduce((sum, review) => sum + review.rating, 0) / data.length;
        setAverageRating(avgRating);
        setTotalReviews(data.length);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

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
        <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
        <p className="text-slate-600">See what your clients are saying about you</p>
      </div>

      <Card>
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="text-4xl font-bold text-slate-900">{averageRating.toFixed(1)}</div>
            <div>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-5 h-5 ${i < Math.round(averageRating) ? 'fill-current' : ''}`}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-600">Based on {totalReviews} reviews</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {reviews.length === 0 ? (
            <p className="text-center text-slate-600 py-8">No reviews yet</p>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="border-b border-slate-100 last:border-0 pb-6 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="flex text-yellow-400">
                      {[...Array(review.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                    <span className="ml-2 text-sm font-medium text-slate-900">
                      {review.client.full_name}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {format(new Date(review.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-slate-600">{review.comment}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
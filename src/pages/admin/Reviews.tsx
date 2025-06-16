import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2, Search, Star, Trash2, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Review {
  id: string;
  client: {
    full_name: string;
  };
  advisor: {
    full_name: string;
  };
  rating: number;
  comment: string;
  created_at: string;
  is_hidden?: boolean;
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchReviews();
  }, [currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!reviews.length) return;

    const searchTerm = debouncedSearchQuery.toLowerCase();
    if (!searchTerm) {
      setFilteredReviews(reviews);
      return;
    }

    const filtered = reviews.filter(review => {
      const clientName = review.client.full_name.toLowerCase();
      const advisorName = review.advisor.full_name.toLowerCase();
      const comment = review.comment.toLowerCase();

      return clientName.includes(searchTerm) ||
             advisorName.includes(searchTerm) ||
             comment.includes(searchTerm);
    });

    setFilteredReviews(filtered);
  }, [debouncedSearchQuery, reviews]);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);

      // First, get total count for pagination
      const { count, error: countError } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      if (count !== null) {
        setTotalPages(Math.ceil(count / itemsPerPage));
      }

      // Then fetch the reviews for current page
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          client:client_id (full_name),
          advisor:advisor_id (full_name),
          rating,
          comment,
          created_at,
          is_hidden
        `)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;

      setReviews(data || []);
      setFilteredReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(reviewId);

      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;

      setReviews(reviews.filter(review => review.id !== reviewId));
      setFilteredReviews(filteredReviews.filter(review => review.id !== reviewId));
      toast.success('Review deleted successfully');
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error('Failed to delete review');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggleVisibility = async (reviewId: string, currentlyHidden: boolean) => {
    try {
      setIsDeleting(reviewId); // Reuse loading state

      const { error } = await supabase
        .from('reviews')
        .update({ is_hidden: !currentlyHidden })
        .eq('id', reviewId);

      if (error) throw error;

      const updatedReviews = reviews.map(review =>
        review.id === reviewId
          ? { ...review, is_hidden: !currentlyHidden }
          : review
      );
      setReviews(updatedReviews);
      setFilteredReviews(updatedReviews);

      toast.success(`Review ${currentlyHidden ? 'shown' : 'hidden'} successfully`);
    } catch (error) {
      console.error('Error updating review visibility:', error);
      toast.error('Failed to update review visibility');
    } finally {
      setIsDeleting(null);
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
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search reviews..."
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
                <th className="text-left py-3 px-4">Advisor</th>
                <th className="text-left py-3 px-4">Client</th>
                <th className="text-center py-3 px-4">Rating</th>
                <th className="text-left py-3 px-4">Review</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-600">
                    {searchQuery ? 'No reviews found matching your search' : 'No reviews found'}
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => (
                  <tr key={review.id} className={`border-b border-slate-100 ${
                    review.is_hidden ? 'bg-slate-50' : ''
                  }`}>
                    <td className="py-3 px-4">{review.advisor.full_name}</td>
                    <td className="py-3 px-4">{review.client.full_name}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center text-yellow-400">
                        {[...Array(review.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-current" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-600 line-clamp-2">{review.comment}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {format(new Date(review.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleVisibility(review.id, review.is_hidden || false)}
                        disabled={isDeleting === review.id}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {review.is_hidden ? 'Show' : 'Hide'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteReview(review.id)}
                        disabled={isDeleting === review.id}
                      >
                        {isDeleting === review.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
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
    </div>
  );
}
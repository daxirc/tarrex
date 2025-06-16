import { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import TextareaField from '../../components/ui/TextareaField';

interface Session {
  id: string;
  advisor: {
    id: string;
    full_name: string;
  };
}

interface ReviewModalProps {
  session: Session;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export default function ReviewModal({ session, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onSubmit(rating, comment);
    } catch (error) {
      console.error('Error submitting review:', error);
      setError('Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Rate Your Session</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <p className="text-slate-700 mb-2">How was your session with {session.advisor.full_name}?</p>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="text-yellow-400 p-1 focus:outline-none transition-transform hover:scale-110"
                  disabled={isSubmitting}
                >
                  <Star 
                    className={`w-8 h-8 ${
                      (hoveredRating ? star <= hoveredRating : star <= rating) 
                        ? 'fill-current' 
                        : ''
                    }`} 
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center mt-2 text-sm text-slate-600">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            )}
            {error && (
              <p className="text-center mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <TextareaField
            label="Your Review (Optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience with this advisor..."
            rows={4}
            disabled={isSubmitting}
          />
          
          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import TextareaField from '../components/ui/TextareaField';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';
import { Star, Clock, MessageSquare, Video, Phone, Loader2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ChatButton from '../components/chat/ChatButton';

interface AdvisorData {
  id: string;
  full_name: string;
  username: string;
  is_approved: boolean;
  profile: {
    bio: string | null;
    profile_picture: string | null;
    price_per_minute: number;
    average_rating: number;
    total_reviews: number;
    categories: string[];
    languages: string[];
    specialties: string[];
    experience_years: number;
    is_available: boolean;
    video_enabled: boolean;
    voice_enabled: boolean;
  } | null;
  reviews: {
    id: string;
    client: {
      full_name: string;
    };
    rating: number;
    comment: string;
    created_at: string;
  }[];
}

export default function AdvisorProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [advisor, setAdvisor] = useState<AdvisorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState('');

  useEffect(() => {
    fetchAdvisorData();
  }, [username]);

  const fetchAdvisorData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch advisor data with profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          username,
          is_approved,
          profile:advisor_profiles(
            bio,
            profile_picture,
            price_per_minute,
            average_rating,
            total_reviews,
            categories,
            languages,
            specialties,
            experience_years,
            is_available,
            video_enabled,
            voice_enabled
          )
        `)
        .eq('username', username)
        .eq('role', 'advisor')
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('Advisor not found');

      // Get the latest profile from advisor_profiles array
      const latestProfile = userData.profile?.[0] || null;

      // Ensure arrays are initialized even if null
      if (latestProfile) {
        latestProfile.languages = latestProfile.languages || [];
        latestProfile.specialties = latestProfile.specialties || [];
        latestProfile.categories = latestProfile.categories || [];
      }

      // Fetch reviews for this advisor
      const { data: reviewsData, error: reviewsError } = await supabase
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
        .eq('advisor_id', userData.id)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      // Combine advisor data with reviews and profile
      const advisorWithReviews: AdvisorData = {
        ...userData,
        profile: latestProfile,
        reviews: reviewsData || []
      };

      setAdvisor(advisorWithReviews);
    } catch (error) {
      console.error('Error fetching advisor data:', error);
      setError('Failed to load advisor profile');
      toast.error('Failed to load advisor profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading advisor profile...</span>
      </div>
    );
  }

  if (error || !advisor || !advisor.profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Advisor Not Found</h2>
          <p className="text-slate-600 mb-4">The advisor you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/dashboard/browse')}>Browse Advisors</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Profile Info */}
          <div className="lg:col-span-2">
            <Card className="mb-8">
              <div className="flex items-start space-x-6">
                <Avatar 
                  src={advisor.profile?.profile_picture ?? null} 
                  alt={advisor.full_name}
                  size="lg"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900">{advisor.full_name}</h1>
                      <p className="text-slate-600">@{advisor.username}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      advisor.profile?.is_available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {advisor.profile?.is_available ? '🟢 Online' : '⭘ Offline'}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center">
                    <Star className="w-5 h-5 text-yellow-400 fill-current" />
                    <span className="ml-1 font-medium text-slate-900">{(advisor.profile?.average_rating ?? 0).toFixed(1)}</span>
                    <span className="mx-1 text-slate-400">·</span>
                    <span className="text-slate-600">{advisor.profile?.total_reviews ?? 0} reviews</span>
                    <span className="mx-1 text-slate-400">·</span>
                    <span className="text-slate-600">{advisor.profile?.experience_years ?? 0} years experience</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(advisor.profile?.categories ?? []).map((category) => (
                      <span
                        key={category}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">About Me</h2>
                <p className="text-slate-600">
                  {advisor.profile?.bio?.trim() || 'No bio available'}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Languages</h3>
                  <div className="flex flex-wrap gap-2">
                    {advisor.profile?.languages?.length > 0 ? (
                      advisor.profile.languages.map((language) => (
                        <span
                          key={language}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm"
                        >
                          {language}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">No languages specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-2">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {advisor.profile?.specialties?.length > 0 ? (
                      advisor.profile.specialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm"
                        >
                          {specialty}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">No specialties specified</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Reviews Section */}
            <Card>
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Reviews</h2>
              <div className="space-y-6">
                {advisor.reviews.length === 0 ? (
                  <p className="text-center text-slate-600 py-8">No reviews yet</p>
                ) : (
                  advisor.reviews.map((review) => (
                    <div key={review.id} className="pb-6 border-b border-slate-200 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="font-medium text-slate-900">{review.client.full_name}</span>
                          <div className="flex items-center ml-2">
                            {[...Array(review.rating)].map((_, i) => (
                              <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                            ))}
                          </div>
                        </div>
                        <span className="text-sm text-slate-500">
                          {format(new Date(review.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-600">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Booking Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-slate-900">
                  ${(advisor.profile?.price_per_minute ?? 0).toFixed(2)}/min
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  (${((advisor.profile?.price_per_minute ?? 0) * 60).toFixed(2)} per hour)
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {advisor.profile?.is_available ? 'Available Now' : 'Currently Unavailable'}
                </p>
              </div>

              <div className="space-y-4">
                <TextareaField
                  label="Message"
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Type your message to start the chat..."
                  rows={3}
                  required
                />

                <ChatButton
                  advisorId={advisor.id}
                  isAdvisorAvailable={advisor.profile.is_available && advisor.is_approved}
                  initialMessage={initialMessage}
                />

                {advisor.profile?.voice_enabled && (
                  <Button className="w-full flex items-center justify-center\" variant="outline">
                    <Phone className="w-5 h-5 mr-2" />
                    Voice Call
                  </Button>
                )}

                {advisor.profile?.video_enabled && (
                  <Button className="w-full flex items-center justify-center" variant="outline">
                    <Video className="w-5 h-5 mr-2" />
                    Video Call
                  </Button>
                )}
              </div>

              <div className="mt-6 p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center text-purple-700">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="text-sm font-medium">Typical Response Time</span>
                </div>
                <p className="text-sm text-purple-600 mt-1">
                  Usually responds within 5 minutes
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import Avatar from '../../components/ui/Avatar';
import { Search, Star, Filter, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Advisor {
  id: string;
  full_name: string;
  username: string;
  profile: {
    profile_picture: string | null;
    bio: string;
    categories: string[];
    price_per_minute: number;
    average_rating: number;
    total_reviews: number;
    is_available: boolean;
  };
}

export default function Browse() {
  const navigate = useNavigate();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 500 });
  const [minRating, setMinRating] = useState<number | ''>('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'rating' | 'price_low' | 'price_high'>('rating');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchAdvisors();
  }, [page]);

  const fetchAdvisors = async (isLoadMore = false) => {
    try {
      setIsLoading(true);

      let query = supabase
        .from('users')
        .select(`
          id,
          full_name,
          username,
          profile:advisor_profiles (
            profile_picture,
            bio,
            categories,
            price_per_minute,
            average_rating,
            total_reviews,
            is_available
          )
        `)
        .eq('role', 'advisor')
        .eq('is_approved', true);

      // Apply filters
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`);
      }

      if (selectedCategories.length > 0) {
        query = query.contains('advisor_profiles.categories', selectedCategories);
      }

      if (priceRange.min > 0) {
        query = query.gte('advisor_profiles.price_per_minute', priceRange.min / 60);
      }

      if (priceRange.max < 500) {
        query = query.lte('advisor_profiles.price_per_minute', priceRange.max / 60);
      }

      if (minRating) {
        query = query.gte('advisor_profiles.average_rating', minRating);
      }

      if (showOnlineOnly) {
        query = query.eq('advisor_profiles.is_available', true);
      }

      // Apply sorting with correct foreign table syntax
      switch (sortBy) {
        case 'price_low':
          query = query.order('price_per_minute', { ascending: true, foreignTable: 'advisor_profiles' });
          break;
        case 'price_high':
          query = query.order('price_per_minute', { ascending: false, foreignTable: 'advisor_profiles' });
          break;
        default:
          query = query.order('average_rating', { ascending: false, foreignTable: 'advisor_profiles' });
      }

      // Add pagination
      query = query.range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      const { data, error } = await query;

      if (error) throw error;

      const filteredData = data.filter(advisor => advisor.profile !== null);

      if (isLoadMore) {
        setAdvisors(prev => [...prev, ...filteredData]);
      } else {
        setAdvisors(filteredData);
      }

      setHasMore(filteredData.length === itemsPerPage);
    } catch (error) {
      console.error('Error fetching advisors:', error);
      toast.error('Failed to load advisors');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(1);
    fetchAdvisors();
  };

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    fetchAdvisors(true);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setPriceRange({ min: 0, max: 500 });
    setMinRating('');
    setShowOnlineOnly(false);
    setSortBy('rating');
    setPage(1);
    fetchAdvisors();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Browse Advisors</h1>
        <p className="text-slate-600">Find the perfect advisor for your needs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <Card className="lg:col-span-1">
          <div className="space-y-6">
            <FormField
              label="Search"
              type="text"
              placeholder="Search advisors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-5 h-5" />}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Categories
              </label>
              <div className="space-y-2">
                {[
                  'Psychic Readings',
                  'Tarot',
                  'Astrology',
                  'Numerology',
                  'Dream Analysis',
                  'Spiritual Healing',
                  'Love & Relationships',
                  'Career & Finance'
                ].map((category) => (
                  <label key={category} className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded text-purple-600"
                      checked={selectedCategories.includes(category)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([...selectedCategories, category]);
                        } else {
                          setSelectedCategories(selectedCategories.filter(c => c !== category));
                        }
                      }}
                    />
                    <span className="ml-2 text-sm text-slate-600">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Price Range ($/hour)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border-slate-200"
                  min="0"
                  max={priceRange.max}
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 500 })}
                  className="w-full rounded-lg border-slate-200"
                  min={priceRange.min}
                  max="500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Rating
              </label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border-slate-200"
              >
                <option value="">All ratings</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded text-purple-600"
                  checked={showOnlineOnly}
                  onChange={(e) => setShowOnlineOnly(e.target.checked)}
                />
                <span className="ml-2 text-sm text-slate-600">Online now</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full rounded-lg border-slate-200"
              >
                <option value="rating">Highest Rated</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>

            <div className="space-y-2">
              <Button className="w-full" onClick={handleFilter}>
                <Filter className="w-4 h-4 mr-2" />
                Apply Filters
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </Card>

        {/* Advisor Grid */}
        <div className="lg:col-span-3">
          {isLoading && page === 1 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <span className="ml-2 text-slate-600">Loading advisors...</span>
            </div>
          ) : advisors.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-slate-900 mb-2">No advisors found</h3>
                <p className="text-slate-600">Try adjusting your filters</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {advisors.map((advisor) => (
                  <Card key={advisor.id} className="transform transition-all hover:scale-105">
                    <div className="relative">
                      {advisor.profile.is_available && (
                        <span className="absolute top-2 right-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          🟢 Online
                        </span>
                      )}

                      <div className="flex items-center space-x-4">
                        <Avatar
                          src={advisor.profile.profile_picture}
                          alt={advisor.full_name}
                          size="lg"
                        />
                        <div>
                          <h3 className="font-medium text-slate-900">{advisor.full_name}</h3>
                          <p className="text-sm text-slate-600">@{advisor.username}</p>
                          <div className="flex items-center mt-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="ml-1 text-sm text-slate-700">
                              {(advisor.profile.average_rating ?? 0).toFixed(1)}
                            </span>
                            <span className="ml-1 text-sm text-slate-500">
                              ({advisor.profile.total_reviews ?? 0} reviews)
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-4 text-sm text-slate-600 line-clamp-2">
                        {advisor.profile.bio}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {(advisor.profile.categories || []).slice(0, 3).map((category) => (
                          <span
                            key={category}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                          >
                            {category}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <span className="text-lg font-semibold text-slate-900">
                            ${((advisor.profile.price_per_minute ?? 0) * 60).toFixed(2)}
                          </span>
                          <span className="text-sm text-slate-500">/hour</span>
                        </div>
                        <Button
                          onClick={() => navigate(`/advisor/${advisor.username}`)}
                        >
                          View Profile
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {hasMore && (
                <div className="mt-8 text-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
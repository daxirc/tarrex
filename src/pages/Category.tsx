import { useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Navbar from '../components/ui/Navbar';
import Footer from '../components/ui/Footer';

const advisors = [
  {
    id: 1,
    name: 'Sarah Mitchell',
    username: 'celestialguide',
    image: 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg',
    price: 1.99,
    rating: 4.9,
    reviews: 286,
    categories: ['Love', 'Tarot', 'Spiritual'],
    status: 'online',
    experience: '8 years'
  },
  {
    id: 2,
    name: 'Michael Chen',
    username: 'mysticvisions',
    image: 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg',
    price: 2.49,
    rating: 4.8,
    reviews: 173,
    categories: ['Career', 'Life Path', 'Numerology'],
    status: 'offline',
    experience: '12 years'
  }
];

export default function Category() {
  const { categorySlug } = useParams();
  const categoryName = categorySlug?.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{categoryName}</h1>
          <p className="text-slate-600">Find the best {categoryName?.toLowerCase()} experts for your needs</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters */}
          <div className="lg:col-span-1">
            <Card>
              <h2 className="text-lg font-semibold mb-4">Filters</h2>
              
              <div className="space-y-4">
                <FormField
                  label="Search"
                  type="text"
                  placeholder="Search advisors..."
                  icon={<Search className="w-5 h-5" />}
                />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Price Range
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Min"
                      className="w-full rounded-lg border-slate-200 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      className="w-full rounded-lg border-slate-200 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Rating
                  </label>
                  <select className="w-full rounded-lg border-slate-200 text-sm">
                    <option>All ratings</option>
                    <option>4+ stars</option>
                    <option>3+ stars</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded text-purple-600" />
                      <span className="ml-2 text-sm text-slate-600">Online now</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded text-purple-600" />
                      <span className="ml-2 text-sm text-slate-600">Available today</span>
                    </label>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  Apply Filters
                </Button>
              </div>
            </Card>
          </div>

          {/* Advisor List */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {advisors.map((advisor) => (
                <Card key={advisor.id} className="relative">
                  <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-medium ${
                    advisor.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {advisor.status === 'online' ? '🟢 Online' : '⭘ Offline'}
                  </div>

                  <div className="flex items-start space-x-4">
                    <img
                      src={advisor.image}
                      alt={advisor.name}
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">{advisor.name}</h3>
                      <p className="text-sm text-slate-600">@{advisor.username}</p>
                      <div className="mt-1 flex items-center">
                        <span className="text-yellow-400">★</span>
                        <span className="ml-1 text-sm text-slate-700">{advisor.rating}</span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span className="text-sm text-slate-600">{advisor.reviews} reviews</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{advisor.experience} experience</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {advisor.categories.map((category) => (
                        <span
                          key={category}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                        >
                          {category}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-slate-900">
                        ${advisor.price}/min
                      </span>
                      <Button size="sm">View Profile</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
import { Star, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
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
    categories: ['Love', 'Tarot', 'Spiritual']
  },
  {
    id: 2,
    name: 'Michael Chen',
    username: 'mysticvisions',
    image: 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg',
    price: 2.49,
    rating: 4.8,
    reviews: 173,
    categories: ['Career', 'Life Path', 'Numerology']
  },
  {
    id: 3,
    name: 'Elena Rodriguez',
    username: 'soulhealer',
    image: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg',
    price: 2.99,
    rating: 4.9,
    reviews: 342,
    categories: ['Healing', 'Meditation', 'Energy']
  },
  {
    id: 4,
    name: 'David Thompson',
    username: 'astralguide',
    image: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg',
    price: 1.79,
    rating: 4.7,
    reviews: 156,
    categories: ['Astrology', 'Past Lives', 'Dreams']
  }
];

const features = [
  {
    title: 'Verified Advisors',
    description: 'Every advisor is thoroughly vetted and verified for authenticity',
    icon: '🔍'
  },
  {
    title: 'Private & Secure',
    description: 'Your sessions are completely private and encrypted end-to-end',
    icon: '🔒'
  },
  {
    title: '24/7 Availability',
    description: 'Connect with advisors around the clock, whenever you need guidance',
    icon: '⏰'
  }
];

const steps = [
  {
    title: 'Create Account',
    description: 'Sign up in seconds with just your email',
    icon: '👤'
  },
  {
    title: 'Choose Advisor',
    description: 'Browse profiles and reviews to find your perfect match',
    icon: '🔍'
  },
  {
    title: 'Start Session',
    description: 'Connect instantly via chat, call, or video',
    icon: '💫'
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-32 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight">
          Connect with Trusted Psychic Advisors Instantly
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto">
          Tarrex helps you chat, call, or video consult with experts in love, life, and destiny
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg">Browse Advisors</Button>
          <Button size="lg" variant="outline">How It Works</Button>
        </div>
      </section>

      {/* Featured Advisors Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
          Our Top-Rated Advisors
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {advisors.map((advisor) => (
            <Card key={advisor.id} className="transform transition-all hover:scale-105">
              <img
                src={advisor.image}
                alt={advisor.name}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="font-semibold text-lg text-slate-900">{advisor.name}</h3>
              <p className="text-slate-600">@{advisor.username}</p>
              <div className="flex items-center mt-2">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="ml-1 text-slate-700">{advisor.rating}</span>
                <span className="ml-1 text-slate-500">({advisor.reviews} reviews)</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {advisor.categories.map((category) => (
                  <span
                    key={category}
                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {category}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-lg font-semibold text-slate-900">
                  ${advisor.price}/min
                </span>
                <Button size="sm">View Profile</Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-white py-16" id="how-it-works">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Tarrex Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
          Why Choose Tarrex
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-purple-600 text-white py-16">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">
            Ready to discover what the universe has planned for you?
          </h2>
          <Button
            size="lg"
            className="bg-white text-purple-600 hover:bg-purple-50"
          >
            Sign Up Free
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
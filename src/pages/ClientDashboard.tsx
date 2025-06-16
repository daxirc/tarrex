import { useState, useEffect } from 'react';
import { Link, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard,
  Search,
  Clock,
  Wallet,
  MessageSquare,
  Star,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Mail,
  AlertTriangle,
  Loader2,
  Settings as SettingsIcon
} from 'lucide-react';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Dashboard from './client/Dashboard';
import Browse from './client/Browse';
import Sessions from './client/Sessions';
import Transactions from './client/Transactions';
import Support from './client/Support';
import Reviews from './client/Reviews';
import Profile from './client/Profile';
import Settings from './Settings';
import TicketDetail from './client/TicketDetail';
import LiveSession from './client/LiveSession';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';

export default function ClientDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [isVerificationBannerVisible, setIsVerificationBannerVisible] = useState(true);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const { user, wallet, fetchUser, fetchWallet } = useStore();

  useEffect(() => {
    loadUserData();
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      } else if (event === 'USER_UPDATED') {
        checkEmailVerification();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const loadUserData = async () => {
    try {
      await Promise.all([fetchUser(), fetchWallet()]);
      checkEmailVerification();
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load user data');
    }
  };

  const checkEmailVerification = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user) {
        setIsEmailVerified(!!session.user.email_confirmed_at);
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email
      });

      if (error) throw error;

      toast.success('Verification email sent! Please check your inbox.');
    } catch (error) {
      console.error('Error resending verification:', error);
      toast.error('Failed to send verification email. Please try again.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'Browse Advisors', icon: Search, path: '/dashboard/browse' },
    { name: 'Sessions', icon: Clock, path: '/dashboard/sessions' },
    { name: 'Wallet', icon: Wallet, path: '/dashboard/wallet' },
    { name: 'Support', icon: MessageSquare, path: '/dashboard/support' },
    { name: 'My Reviews', icon: Star, path: '/dashboard/reviews' },
    { name: 'Profile', icon: User, path: '/dashboard/profile' },
    { name: 'Settings', icon: SettingsIcon, path: '/dashboard/settings' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Email Verification Banner */}
      {!isEmailVerified && isVerificationBannerVisible && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
                <p className="text-amber-700 text-sm">
                  Your email is not verified yet. Please verify your email to access all features.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={isResendingVerification}
                  className="flex items-center"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  {isResendingVerification ? 'Sending...' : 'Resend Verification'}
                </Button>
                <button
                  onClick={() => setIsVerificationBannerVisible(false)}
                  className="text-amber-600 hover:text-amber-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 fixed w-full z-40">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              <h1 className="text-xl font-bold text-slate-900 ml-4 lg:ml-[60px]">Client Dashboard</h1>
            </div>

            {/* Profile Menu */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <Avatar
                    src={user?.profile_picture}
                    alt={user?.full_name || 'User'}
                    size="sm"
                  />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-slate-900">
                      {user?.full_name || 'Loading...'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Balance: ${wallet?.balance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                    <Link
                      to="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Your Profile
                    </Link>
                    <Link
                      to="/dashboard/settings"
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <div className="border-t border-slate-200 my-1" />
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" className="hidden sm:flex" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar Navigation */}
        <aside 
          className={`
            fixed inset-y-0 pt-16 lg:block
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
            bg-white border-r border-slate-200
            transform transition-all duration-200 ease-in-out
            z-30 w-64
          `}
        >
          {/* Logo and Toggle Button */}
          <div className="p-4 flex items-center justify-between border-b border-slate-200">
            <Link to="/" className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <Sparkles className="h-8 w-8 text-purple-600 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <span className="ml-2 text-xl font-bold text-slate-900">Tarrex</span>
              )}
            </Link>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:block p-1 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100"
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>

          <nav className="mt-5 px-2 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md
                  ${location.pathname === item.path
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                  ${isSidebarCollapsed ? 'justify-center' : ''}
                  transition-colors duration-200
                `}
                onClick={() => setIsMobileMenuOpen(false)}
                title={isSidebarCollapsed ? item.name : undefined}
              >
                <item.icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    location.pathname === item.path
                      ? 'text-purple-700'
                      : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                />
                {!isSidebarCollapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main 
          className={`
            flex-1 
            ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} 
            transition-all duration-200
            min-h-screen
          `}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/wallet" element={<Transactions />} />
              <Route path="/support" element={<Support />} />
              <Route path="/support/ticket/:ticketId" element={<TicketDetail />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/live-session/:sessionId" element={<LiveSession />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
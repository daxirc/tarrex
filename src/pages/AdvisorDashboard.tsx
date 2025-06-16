import { useState, useEffect } from 'react';
import { Link, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  LayoutDashboard,
  Users,
  Clock,
  Star,
  DollarSign,
  Settings as SettingsIcon,
  FileCheck,
  LogOut,
  ChevronDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Loader2
} from 'lucide-react';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Dashboard from './advisor/Dashboard';
import Sessions from './advisor/Sessions';
import Reviews from './advisor/Reviews';
import Earnings from './advisor/Earnings';
import RecentClients from './advisor/RecentClients';
import KycVerification from './advisor/KycVerification';
import ProfileSettings from './advisor/ProfileSettings';
import LiveSession from './client/LiveSession';
import IncomingChatRequestNotification from '../components/chat/IncomingChatRequestNotification';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { useSocket } from '../contexts/SocketContext';

export default function AdvisorDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, wallet, fetchUser, fetchWallet } = useStore();
  const { connect, isConnected } = useSocket();

  useEffect(() => {
    checkAdvisorAccess();
  }, []);

  // Set up socket connection for notifications
  useEffect(() => {
    if (user?.id && user.role === 'advisor') {
      console.log('🔗 Connecting advisor to notification socket...');
      // Use a global notification channel for the advisor
      connect('advisor_notifications', 'advisor');
    }
  }, [user?.id, user?.role, connect]);

  const checkAdvisorAccess = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        await handleAuthError();
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          advisor_profiles (*)
        `)
        .eq('id', session.user.id)
        .single();

      if (userError || userData?.role !== 'advisor') {
        toast.error('Unauthorized access');
        navigate('/');
        return;
      }

      await Promise.all([fetchUser(), fetchWallet()]);
      
      // Check for pending sessions and show initial notification
      const { data: pendingSessions } = await supabase
        .from('sessions')
        .select('id, client_id, client:client_id(full_name)')
        .eq('advisor_id', session.user.id)
        .eq('status', 'pending_advisor_approval');
        
      if (pendingSessions && pendingSessions.length > 0) {
        console.log('📊 Found pending sessions on load:', pendingSessions.length);
        toast.success(`You have ${pendingSessions.length} pending chat request(s)`, {
          duration: 5000,
          icon: '🔔'
        });
      }
    } catch (error) {
      console.error('Error checking advisor access:', error);
      await handleAuthError();
    }
  };

  const handleAuthError = async () => {
    await supabase.auth.signOut();
    toast.error('Please sign in again');
    navigate('/login');
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/advisor-dashboard' },
    { name: 'Recent Clients', icon: Users, path: '/advisor-dashboard/clients' },
    { name: 'Sessions', icon: Clock, path: '/advisor-dashboard/sessions' },
    { name: 'Reviews', icon: Star, path: '/advisor-dashboard/reviews' },
    { name: 'Earnings', icon: DollarSign, path: '/advisor-dashboard/earnings' },
    { name: 'KYC Verification', icon: FileCheck, path: '/advisor-dashboard/kyc' },
    { name: 'Profile Settings', icon: SettingsIcon, path: '/advisor-dashboard/settings' }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <IncomingChatRequestNotification />

      {/* Connection Status Indicator */}
      {user.role === 'advisor' && (
        <div className={`fixed top-4 right-4 z-50 px-3 py-1 rounded-full text-xs font-medium ${
          isConnected 
            ? 'bg-green-100 text-green-700' 
            : 'bg-red-100 text-red-700'
        }`}>
          {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      )}

      {/* Fixed Header */}
      <header className="bg-white border-b border-slate-200 fixed w-full z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              <div className="ml-4 flex items-center">
                <Sparkles className="h-8 w-8 text-purple-600" />
                <span className="ml-2 text-xl font-bold text-slate-900">Advisor Portal</span>
              </div>
            </div>

            <div className="flex items-center">
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-3 focus:outline-none"
                >
                  <Avatar
                    src={user.profile_picture}
                    alt={user.full_name || 'Advisor'}
                    size="sm"
                  />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                    <p className="text-xs text-slate-500">
                      Balance: ${wallet?.balance?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={handleSignOut} className="ml-4">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Mobile menu overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-16 bottom-0 left-0 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } z-20`}
        >
          <div className="h-full overflow-y-auto">
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`w-full group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    location.pathname === item.path
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      location.pathname === item.path
                        ? 'text-purple-700'
                        : 'text-slate-400 group-hover:text-slate-500'
                    }`}
                  />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<RecentClients />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/kyc" element={<KycVerification />} />
              <Route path="/settings" element={<ProfileSettings />} />
              <Route path="/live-session/:sessionId" element={<LiveSession />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
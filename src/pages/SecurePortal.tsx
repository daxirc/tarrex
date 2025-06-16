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
  LogOut,
  ChevronDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Mail,
  AlertTriangle,
  Wallet,
  FileCheck,
  UserCog,
  UserCheck,
  MessageSquare,
  BarChart3,
  Loader2,
  CreditCard
} from 'lucide-react';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import DashboardOverview from './admin/DashboardOverview';
import ManageClients from './admin/ManageClients';
import ManageAdvisors from './admin/ManageAdvisors';
import AdvisorDetails from './admin/AdvisorDetails';
import ManageAllUsers from './admin/ManageAllUsers';
import ClientDetails from './admin/ClientDetails';
import SessionLogs from './admin/SessionLogs';
import Reviews from './admin/Reviews';
import SupportTickets from './admin/SupportTickets';
import TicketDetail from './admin/TicketDetail';
import EarningsReports from './admin/EarningsReports';
import AdminSettings from './admin/AdminSettings';
import WithdrawalRequests from './admin/WithdrawalRequests';
import KycRequests from './admin/KycRequests';
import PaymentSettings from './admin/PaymentSettings';
import { supabase } from '../lib/supabase';

interface AdminData {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
}

export default function SecurePortal() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      if (!user) {
        navigate('/login');
        return;
      }

      // Get user data with role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      if (userData.role !== 'admin') {
        toast.error('Unauthorized access');
        navigate('/');
        return;
      }

      setAdminData(userData);
    } catch (error) {
      console.error('Error checking admin access:', error);
      toast.error('Failed to verify admin access');
      navigate('/');
    } finally {
      setIsLoading(false);
    }
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
    { name: 'Dashboard Overview', icon: LayoutDashboard, path: '/secure-portal' },
    { name: 'Manage All Users', icon: UserCog, path: '/secure-portal/all-users' },
    { name: 'Manage Clients', icon: Users, path: '/secure-portal/clients' },
    { name: 'Manage Advisors', icon: UserCheck, path: '/secure-portal/advisors' },
    { name: 'Withdrawal Requests', icon: Wallet, path: '/secure-portal/withdrawals' },
    { name: 'KYC Requests', icon: FileCheck, path: '/secure-portal/kyc' },
    { name: 'Session Logs', icon: Clock, path: '/secure-portal/sessions' },
    { name: 'Reviews', icon: Star, path: '/secure-portal/reviews' },
    { name: 'Support Tickets', icon: MessageSquare, path: '/secure-portal/support' },
    { name: 'Earnings Reports', icon: BarChart3, path: '/secure-portal/earnings' },
    { name: 'Payment Settings', icon: CreditCard, path: '/secure-portal/payment-settings' },
    { name: 'Settings', icon: SettingsIcon, path: '/secure-portal/settings' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <span className="ml-2 text-slate-600">Verifying access...</span>
        </div>
      </div>
    );
  }

  if (!adminData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-4">You don't have permission to access this area.</p>
          <Button onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 fixed w-full z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-slate-900">Tarrex Admin Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center space-x-2 focus:outline-none"
                >
                  <Avatar
                    alt={adminData.full_name || 'Admin'}
                    size="sm"
                  />
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-slate-900">
                      {adminData.full_name || 'Admin User'}
                    </p>
                    <p className="text-xs text-slate-500">{adminData.email}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${
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

              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar Navigation */}
        <aside className="w-64 fixed inset-y-0 pt-16 hidden lg:block">
          <div className="h-full bg-white border-r border-slate-200">
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
        <main className="flex-1 lg:pl-64">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/all-users" element={<ManageAllUsers />} />
              <Route path="/clients" element={<ManageClients />} />
              <Route path="/client/:id" element={<ClientDetails />} />
              <Route path="/advisors" element={<ManageAdvisors />} />
              <Route path="/advisor/:id" element={<AdvisorDetails />} />
              <Route path="/withdrawals" element={<WithdrawalRequests />} />
              <Route path="/kyc" element={<KycRequests />} />
              <Route path="/sessions" element={<SessionLogs />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/support" element={<SupportTickets />} />
              <Route path="/support/ticket/:ticketId" element={<TicketDetail />} />
              <Route path="/earnings" element={<EarningsReports />} />
              <Route path="/payment-settings" element={<PaymentSettings />} />
              <Route path="/settings" element={<AdminSettings />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SignupClient from './pages/SignupClient';
import SignupAdvisor from './pages/SignupAdvisor';
import Login from './pages/Login';
import Category from './pages/Category';
import AdvisorProfile from './pages/AdvisorProfile';
import Wallet from './pages/Wallet';
import Support from './pages/Support';
import Settings from './pages/Settings';
import ForgotPassword from './pages/ForgotPassword';
import SecurePortal from './pages/SecurePortal';
import AdvisorDashboard from './pages/AdvisorDashboard';
import ClientDashboard from './pages/ClientDashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup-client" element={<SignupClient />} />
      <Route path="/signup-advisor" element={<SignupAdvisor />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/category/:categorySlug" element={<Category />} />
      <Route path="/advisor/:username" element={<AdvisorProfile />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/support" element={<Support />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/secure-portal/*" element={<SecurePortal />} />
      <Route path="/advisor-dashboard/*" element={<AdvisorDashboard />} />
      <Route path="/dashboard/*" element={<ClientDashboard />} />
    </Routes>
  );
}
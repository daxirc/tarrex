import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { Mail, Lock, User, AtSign, Globe, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SignupAdvisor() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    phoneNumber: '',
    country: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username,
            role: 'advisor'
          }
        }
      });

      if (authError) throw authError;

      if (authData.session) {
        toast.success('Account created successfully! Please complete your profile.');
        navigate('/advisor-dashboard/profile-settings');
      } else {
        toast.success('Please check your email to confirm your account');
        navigate('/login');
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Become an Advisor"
      subtitle="Share your gifts with those seeking guidance"
    >
      <form 
        className="space-y-6 max-w-2xl w-full mx-auto" 
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Full Name"
            type="text"
            required
            placeholder="John Doe"
            icon={<User className="w-5 h-5" />}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            disabled={isLoading}
          />

          <FormField
            label="Username"
            type="text"
            required
            placeholder="mysticjohn"
            icon={<AtSign className="w-5 h-5" />}
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <FormField
          label="Email Address"
          type="email"
          required
          placeholder="john@example.com"
          icon={<Mail className="w-5 h-5" />}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          disabled={isLoading}
        />

        <FormField
          label="Password"
          type="password"
          required
          placeholder="••••••••"
          icon={<Lock className="w-5 h-5" />}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          disabled={isLoading}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Country"
            type="text"
            required
            placeholder="e.g., United States"
            icon={<Globe className="w-5 h-5" />}
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            disabled={isLoading}
          />

          <FormField
            label="Phone Number"
            type="tel"
            required
            placeholder="e.g., +15551234567"
            icon={<Phone className="w-5 h-5" />}
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <p className="text-sm text-purple-700">
            Note: Your application will be reviewed by our admin team before approval.
            We'll notify you by email once your account is activated.
          </p>
        </div>

        <div className="pt-2">
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Apply as Advisor'}
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already an advisor?{' '}
          <Link
            to="/login"
            className="font-medium text-purple-600 hover:text-purple-500"
          >
            Log in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { Mail, Lock, User, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SignupClient() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: ''
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
            role: 'client'
          }
        }
      });

      if (authError) throw authError;

      if (authData.session) {
        // User was automatically signed in
        toast.success('Account created successfully!');
        navigate('/dashboard');
      } else {
        // Email confirmation is required
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
      title="Create a Client Account"
      subtitle="Start your journey to spiritual guidance"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
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
          placeholder="johndoe"
          icon={<AtSign className="w-5 h-5" />}
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          disabled={isLoading}
          hint="This will be your public display name"
        />

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
          hint="Must be at least 8 characters long"
        />

        <div className="pt-2">
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
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
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { Mail, Lock, AlertCircle, ExternalLink, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { signInWithEmail, clearSupabaseData } from '../lib/auth';
import { supabase, testSupabaseConnection, validateEnvironmentSetup } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'testing' | 'success' | 'failed'>('unknown');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  // Clear any stale tokens on component mount
  useEffect(() => {
    // Clear Supabase data to prevent token issues
    clearSupabaseData();
  }, []);

  // Test connection on component mount
  useEffect(() => {
    const initialConnectionTest = async () => {
      setConnectionStatus('testing');
      
      // First validate environment
      const envValidation = validateEnvironmentSetup();
      if (!envValidation.isValid) {
        setConnectionError(`Configuration Error: ${envValidation.issues.join(', ')}`);
        setConnectionStatus('failed');
        return;
      }
      
      // Then test connection
      const result = await testSupabaseConnection();
      if (result.success) {
        setConnectionStatus('success');
        setConnectionError(null);
      } else {
        setConnectionStatus('failed');
        setConnectionError(result.error || 'Connection failed');
      }
    };

    initialConnectionTest();
  }, []);

  const testConnection = async () => {
    try {
      setIsLoading(true);
      setConnectionStatus('testing');
      setConnectionError(null);
      
      // Validate environment first
      const envValidation = validateEnvironmentSetup();
      if (!envValidation.isValid) {
        throw new Error(`Configuration Error: ${envValidation.issues.join(', ')}`);
      }
      
      // Test connection
      const result = await testSupabaseConnection();
      
      if (result.success) {
        setConnectionStatus('success');
        toast.success('Connection successful!');
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('failed');
      setConnectionError(error instanceof Error ? error.message : 'Connection test failed');
      toast.error('Connection test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setConnectionError(null);

    try {
      console.log('Starting login process...');
      
      // Clear any existing tokens before attempting to sign in
      clearSupabaseData();
      
      // Attempt to sign in
      const { data, error } = await signInWithEmail(formData.email, formData.password);
      
      if (error) {
        console.error('Authentication error:', error);
        
        // Check if it's a connection/configuration error
        if (error.message.includes('Configuration Error') || 
            error.message.includes('Network error') || 
            error.message.includes('Unable to connect')) {
          setConnectionError(error.message);
          setConnectionStatus('failed');
          toast.error('Connection failed. Please check the troubleshooting steps below.');
          return;
        }
        
        throw error;
      }

      if (!data?.user?.id) {
        console.error('No user data returned');
        throw new Error('Login failed - no user data');
      }

      console.log('Authentication successful, fetching user role...');

      // Get user role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (userError) {
        console.error('Error fetching user role:', userError);
        throw new Error(`Failed to fetch user information: ${userError.message}`);
      }

      if (!userData?.role) {
        console.error('No role found for user');
        throw new Error('User role not found. Please contact support.');
      }

      console.log('Login successful, redirecting based on role:', userData.role);

      toast.success('Logged in successfully!');

      // Redirect based on role
      switch (userData.role) {
        case 'client':
          navigate('/dashboard');
          break;
        case 'advisor':
          navigate('/advisor-dashboard');
          break;
        case 'admin':
          navigate('/secure-portal');
          break;
        default:
          throw new Error('Invalid user role');
      }
    } catch (error) {
      console.error('Login process failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to log in';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <RefreshCw className="w-4 h-4 text-gray-400" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'testing':
        return 'Testing connection...';
      case 'success':
        return 'Connected to Supabase';
      case 'failed':
        return 'Connection failed';
      default:
        return 'Connection status unknown';
    }
  };

  return (
    <AuthLayout 
      title="Welcome back"
      subtitle="Log in to your Tarrex account"
    >
      {/* Connection Status Indicator */}
      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getConnectionStatusIcon()}
            <span className="text-sm font-medium text-gray-700">
              {getConnectionStatusText()}
            </span>
          </div>
          <button
            onClick={testConnection}
            disabled={isLoading || connectionStatus === 'testing'}
            className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
          >
            Test Again
          </button>
        </div>
      </div>

      {connectionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-800 mb-2">Connection Error</p>
              <p className="text-red-700 mb-3 whitespace-pre-line">{connectionError}</p>
              <div className="text-red-700">
                <p className="font-medium mb-2">Troubleshooting steps:</p>
                <ul className="list-disc list-inside space-y-1 text-xs mb-3">
                  <li>Check that your <code className="bg-red-100 px-1 rounded">.env</code> file exists in the project root</li>
                  <li>Verify <code className="bg-red-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-red-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> are set correctly</li>
                  <li>Ensure your Supabase project is active and not paused</li>
                  <li>Restart the development server after updating .env file</li>
                  <li>Check your internet connection and firewall settings</li>
                  <li>Verify your Supabase project URL and API keys in the Supabase dashboard</li>
                </ul>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs">
                    <span>Need help setting up Supabase?</span>
                    <a 
                      href="https://supabase.com/docs/guides/getting-started" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-red-600 hover:text-red-800 underline"
                    >
                      View Documentation
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                  <button
                    onClick={testConnection}
                    disabled={isLoading}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded hover:bg-red-200 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Test Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
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

        <div className="flex items-center justify-between">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              disabled={isLoading}
            />
            <span className="ml-2 text-sm text-slate-600">Remember me</span>
          </label>
          
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-purple-600 hover:text-purple-500"
          >
            Forgot password?
          </Link>
        </div>

        <div className="pt-2">
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading || connectionStatus === 'failed'}
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </Button>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-slate-600">Don't have an account? </span>
          <div className="space-x-4 mt-2">
            <Link
              to="/signup-client"
              className="font-medium text-purple-600 hover:text-purple-500"
            >
              Sign up as Client
            </Link>
            <span className="text-slate-400">|</span>
            <Link
              to="/signup-advisor"
              className="font-medium text-purple-600 hover:text-purple-500"
            >
              Apply as Advisor
            </Link>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
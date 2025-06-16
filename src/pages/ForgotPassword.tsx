import { Link } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { Mail } from 'lucide-react';

export default function ForgotPassword() {
  return (
    <AuthLayout 
      title="Reset Password"
      subtitle="Enter your email to receive reset instructions"
    >
      <form className="space-y-6">
        <FormField
          label="Email Address"
          type="email"
          required
          placeholder="john@example.com"
          icon={<Mail className="w-5 h-5" />}
          hint="We'll send a password reset link to this email"
        />

        <div className="pt-2">
          <Button type="submit" className="w-full">
            Send Reset Link
          </Button>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          Remember your password?{' '}
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
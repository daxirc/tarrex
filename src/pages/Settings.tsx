import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import { User, Mail, Lock, Bell, Shield, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';

export default function Settings() {
  const navigate = useNavigate();
  const { user, fetchUser } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    emailNotifications: true,
    sessionReminders: true,
    marketingEmails: false,
    showOnlineStatus: true,
    showProfile: true
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.full_name || '',
        email: user.email || ''
      }));
      setIsLoading(false);
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setIsSavingProfile(true);

      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      await fetchUser();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      setIsChangingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);

      // Delete user data (RLS policies will handle cascading deletes)
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);

      if (error) throw error;

      // Sign out
      await supabase.auth.signOut();
      navigate('/');
      toast.success('Account deleted successfully');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-600">Manage your account preferences and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Profile Information</h2>
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                <User className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <Button variant="outline" size="sm" disabled>Change Photo</Button>
                <p className="mt-1 text-sm text-slate-500">Coming soon</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Full Name"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                icon={<User className="w-5 h-5" />}
                required
                disabled={isSavingProfile}
              />
              <FormField
                label="Email"
                type="email"
                value={formData.email}
                icon={<Mail className="w-5 h-5" />}
                disabled
              />
            </div>

            <Button type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>

        {/* Password Settings */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Security</h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <FormField
              label="Current Password"
              type="password"
              value={formData.currentPassword}
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              icon={<Lock className="w-5 h-5" />}
              required
              disabled={isChangingPassword}
            />
            <FormField
              label="New Password"
              type="password"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              icon={<Lock className="w-5 h-5" />}
              required
              disabled={isChangingPassword}
            />
            <FormField
              label="Confirm New Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              icon={<Lock className="w-5 h-5" />}
              required
              disabled={isChangingPassword}
            />
            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Card>

        {/* Notification Settings */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            <div className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Notification Preferences
            </div>
          </h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={formData.emailNotifications}
                onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
              />
              <span className="text-slate-700">Email notifications for new messages</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={formData.sessionReminders}
                onChange={(e) => setFormData({ ...formData, sessionReminders: e.target.checked })}
              />
              <span className="text-slate-700">Email notifications for session reminders</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={formData.marketingEmails}
                onChange={(e) => setFormData({ ...formData, marketingEmails: e.target.checked })}
              />
              <span className="text-slate-700">Marketing emails and promotions</span>
            </label>
          </div>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            <div className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Privacy
            </div>
          </h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={formData.showOnlineStatus}
                onChange={(e) => setFormData({ ...formData, showOnlineStatus: e.target.checked })}
              />
              <span className="text-slate-700">Show online status</span>
            </label>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                className="rounded text-purple-600"
                checked={formData.showProfile}
                onChange={(e) => setFormData({ ...formData, showProfile: e.target.checked })}
              />
              <span className="text-slate-700">Show profile to public</span>
            </label>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="lg:col-span-3 border-red-200">
          <h2 className="text-lg font-semibold text-red-600 mb-6">
            <div className="flex items-center">
              <Trash2 className="w-5 h-5 mr-2" />
              Danger Zone
            </div>
          </h2>
          <div className="space-y-4">
            <p className="text-slate-600">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
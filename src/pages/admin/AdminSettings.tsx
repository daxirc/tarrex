import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SystemSettings {
  id: string;
  withdrawal_threshold: number;
  default_commission_rate: number;
  advisor_kyc_required: boolean;
  auto_approve_advisors: boolean;
  default_video_enabled: boolean;
  default_voice_enabled: boolean;
  support_email: string;
}

export default function AdminSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings?.id) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('system_settings')
        .update({
          withdrawal_threshold: settings.withdrawal_threshold,
          default_commission_rate: settings.default_commission_rate,
          advisor_kyc_required: settings.advisor_kyc_required,
          auto_approve_advisors: settings.auto_approve_advisors,
          default_video_enabled: settings.default_video_enabled,
          default_voice_enabled: settings.default_voice_enabled,
          support_email: settings.support_email,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setIsSaving(false);
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

  if (!settings) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600">Failed to load settings</p>
        <Button onClick={fetchSettings} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <h3 className="text-lg font-semibold mb-4">Platform Settings</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Default Commission Rate (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={settings.default_commission_rate * 100}
                onChange={(e) => setSettings({
                  ...settings,
                  default_commission_rate: parseFloat(e.target.value) / 100
                })}
                required
              />

              <FormField
                label="Minimum Withdrawal Amount ($)"
                type="number"
                step="0.01"
                min="0"
                value={settings.withdrawal_threshold}
                onChange={(e) => setSettings({
                  ...settings,
                  withdrawal_threshold: parseFloat(e.target.value)
                })}
                required
              />
            </div>

            <div className="space-y-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="rounded text-purple-600"
                  checked={settings.advisor_kyc_required}
                  onChange={(e) => setSettings({
                    ...settings,
                    advisor_kyc_required: e.target.checked
                  })}
                />
                <span className="text-sm text-slate-700">Require KYC verification for advisors</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="rounded text-purple-600"
                  checked={settings.auto_approve_advisors}
                  onChange={(e) => setSettings({
                    ...settings,
                    auto_approve_advisors: e.target.checked
                  })}
                />
                <span className="text-sm text-slate-700">Auto-approve new advisors</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="rounded text-purple-600"
                  checked={settings.default_video_enabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    default_video_enabled: e.target.checked
                  })}
                />
                <span className="text-sm text-slate-700">Enable video calls by default</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="rounded text-purple-600"
                  checked={settings.default_voice_enabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    default_voice_enabled: e.target.checked
                  })}
                />
                <span className="text-sm text-slate-700">Enable voice calls by default</span>
              </label>
            </div>
          </div>
        </Card>

        <Card className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Email Settings</h3>
          <div className="space-y-4">
            <FormField
              label="Support Email"
              type="email"
              value={settings.support_email}
              onChange={(e) => setSettings({
                ...settings,
                support_email: e.target.value
              })}
              required
            />
          </div>
        </Card>

        <div className="mt-6">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </div>
  );
}
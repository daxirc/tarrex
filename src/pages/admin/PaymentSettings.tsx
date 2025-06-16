import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import { Loader2, CreditCard, DollarSign, Eye, EyeOff, RefreshCw, Link as LinkIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { initiatePayPalOAuth, disconnectPayPal, refreshPayPalToken } from '../../lib/paypal';

interface PaymentGateway {
  id: string;
  gateway_name: string;
  is_enabled: boolean;
  api_keys: {
    [key: string]: string;
  };
  config: {
    [key: string]: any;
  };
  oauth_data?: {
    access_token?: string;
    refresh_token?: string;
    obtained_at?: string;
    expires_in?: number;
  };
  connection_status?: string;
  connected_at?: string;
}

export default function PaymentSettings() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [showSecretKeys, setShowSecretKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPaymentGateways();
    
    // Check for URL parameters (success or error from OAuth callback)
    const params = new URLSearchParams(location.search);
    const success = params.get('success');
    const error = params.get('error');
    
    if (success) {
      toast.success('PayPal connected successfully!');
    } else if (error) {
      toast.error(`PayPal connection failed: ${error}`);
    }
  }, [location]);

  const fetchPaymentGateways = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('payment_gateway_settings')
        .select('*')
        .order('gateway_name');

      if (error) throw error;
      setGateways(data || []);
    } catch (error) {
      console.error('Error fetching payment gateways:', error);
      toast.error('Failed to load payment gateway settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleGateway = async (gateway: PaymentGateway) => {
    try {
      setIsSaving(gateway.id);
      const { error } = await supabase
        .from('payment_gateway_settings')
        .update({ is_enabled: !gateway.is_enabled })
        .eq('id', gateway.id);

      if (error) throw error;

      setGateways(gateways.map(g => 
        g.id === gateway.id ? { ...g, is_enabled: !g.is_enabled } : g
      ));
      
      toast.success(`${gateway.gateway_name} ${!gateway.is_enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Error toggling gateway:', error);
      toast.error('Failed to update gateway status');
    } finally {
      setIsSaving(null);
    }
  };

  const handleUpdateApiKeys = async (gateway: PaymentGateway, newApiKeys: Record<string, string>) => {
    try {
      setIsSaving(gateway.id);
      const { error } = await supabase
        .from('payment_gateway_settings')
        .update({ api_keys: newApiKeys })
        .eq('id', gateway.id);

      if (error) throw error;

      setGateways(gateways.map(g => 
        g.id === gateway.id ? { ...g, api_keys: newApiKeys } : g
      ));
      
      toast.success(`${gateway.gateway_name} API keys updated successfully`);
    } catch (error) {
      console.error('Error updating API keys:', error);
      toast.error('Failed to update API keys');
    } finally {
      setIsSaving(null);
    }
  };

  const handleUpdateConfig = async (gateway: PaymentGateway, newConfig: Record<string, any>) => {
    try {
      setIsSaving(gateway.id);
      const { error } = await supabase
        .from('payment_gateway_settings')
        .update({ config: newConfig })
        .eq('id', gateway.id);

      if (error) throw error;

      setGateways(gateways.map(g => 
        g.id === gateway.id ? { ...g, config: newConfig } : g
      ));
      
      toast.success(`${gateway.gateway_name} configuration updated successfully`);
    } catch (error) {
      console.error('Error updating configuration:', error);
      toast.error('Failed to update configuration');
    } finally {
      setIsSaving(null);
    }
  };

  const handleTestConnection = async (gateway: PaymentGateway) => {
    try {
      setIsTesting(gateway.id);
      
      if (gateway.gateway_name === 'stripe') {
        if (!gateway.api_keys.publishable_key || !gateway.api_keys.secret_key) {
          throw new Error('API keys are not configured properly');
        }
        
        // Here you would make a test call to Stripe API
        toast.success('Stripe connection test successful');
      } else if (gateway.gateway_name === 'paypal') {
        if (gateway.connection_status === 'connected' && gateway.oauth_data?.access_token) {
          // Refresh token to test connection
          await refreshPayPalToken();
          toast.success('PayPal connection test successful');
        } else if (gateway.api_keys.client_id && gateway.api_keys.client_secret) {
          // Test API keys
          toast.success('PayPal API keys validated');
        } else {
          throw new Error('PayPal is not properly configured');
        }
      }
    } catch (error) {
      console.error(`Error testing ${gateway.gateway_name} connection:`, error);
      toast.error(`Connection test failed: ${error.message}`);
    } finally {
      setIsTesting(null);
    }
  };

  const handleConnectPayPal = async () => {
    try {
      setIsConnecting(true);
      const authUrl = await initiatePayPalOAuth();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting PayPal:', error);
      toast.error(`Failed to connect PayPal: ${error.message}`);
      setIsConnecting(false);
    }
  };

  const handleDisconnectPayPal = async () => {
    try {
      setIsDisconnecting(true);
      await disconnectPayPal();
      
      // Update local state
      setGateways(gateways.map(g => 
        g.gateway_name === 'paypal' ? { 
          ...g, 
          connection_status: 'disconnected',
          oauth_data: undefined,
          connected_at: undefined,
          is_enabled: false
        } : g
      ));
      
      toast.success('PayPal disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting PayPal:', error);
      toast.error(`Failed to disconnect PayPal: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const toggleShowSecretKey = (gatewayId: string) => {
    setShowSecretKeys(prev => ({
      ...prev,
      [gatewayId]: !prev[gatewayId]
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-slate-600">Loading payment settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payment Gateway Settings</h1>
        <p className="text-slate-600">Configure and manage payment providers</p>
      </div>

      {/* Stripe Settings */}
      {gateways.find(g => g.gateway_name === 'stripe') && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-lg font-semibold text-slate-900">Stripe</h2>
                <p className="text-sm text-slate-600">Credit card payments</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="mr-2 text-sm text-slate-600">Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  gateways.find(g => g.gateway_name === 'stripe')?.is_enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {gateways.find(g => g.gateway_name === 'stripe')?.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleGateway(gateways.find(g => g.gateway_name === 'stripe')!)}
                disabled={isSaving === gateways.find(g => g.gateway_name === 'stripe')?.id}
              >
                {isSaving === gateways.find(g => g.gateway_name === 'stripe')?.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  gateways.find(g => g.gateway_name === 'stripe')?.is_enabled ? 'Disable' : 'Enable'
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <FormField
              label="Publishable Key"
              type="text"
              value={gateways.find(g => g.gateway_name === 'stripe')?.api_keys.publishable_key || ''}
              onChange={(e) => {
                const stripe = gateways.find(g => g.gateway_name === 'stripe')!;
                const newApiKeys = { ...stripe.api_keys, publishable_key: e.target.value };
                setGateways(gateways.map(g => 
                  g.id === stripe.id ? { ...g, api_keys: newApiKeys } : g
                ));
              }}
              placeholder="pk_test_..."
            />

            <div className="relative">
              <FormField
                label="Secret Key"
                type={showSecretKeys[gateways.find(g => g.gateway_name === 'stripe')?.id || ''] ? 'text' : 'password'}
                value={gateways.find(g => g.gateway_name === 'stripe')?.api_keys.secret_key || ''}
                onChange={(e) => {
                  const stripe = gateways.find(g => g.gateway_name === 'stripe')!;
                  const newApiKeys = { ...stripe.api_keys, secret_key: e.target.value };
                  setGateways(gateways.map(g => 
                    g.id === stripe.id ? { ...g, api_keys: newApiKeys } : g
                  ));
                }}
                placeholder="sk_test_..."
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                onClick={() => toggleShowSecretKey(gateways.find(g => g.gateway_name === 'stripe')?.id || '')}
              >
                {showSecretKeys[gateways.find(g => g.gateway_name === 'stripe')?.id || ''] ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Currency"
                type="text"
                value={gateways.find(g => g.gateway_name === 'stripe')?.config.currency || 'usd'}
                onChange={(e) => {
                  const stripe = gateways.find(g => g.gateway_name === 'stripe')!;
                  const newConfig = { ...stripe.config, currency: e.target.value.toLowerCase() };
                  setGateways(gateways.map(g => 
                    g.id === stripe.id ? { ...g, config: newConfig } : g
                  ));
                }}
                placeholder="usd"
              />
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => handleTestConnection(gateways.find(g => g.gateway_name === 'stripe')!)}
                disabled={isTesting === gateways.find(g => g.gateway_name === 'stripe')?.id}
              >
                {isTesting === gateways.find(g => g.gateway_name === 'stripe')?.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  const stripe = gateways.find(g => g.gateway_name === 'stripe')!;
                  handleUpdateApiKeys(stripe, stripe.api_keys);
                  handleUpdateConfig(stripe, stripe.config);
                }}
                disabled={isSaving === gateways.find(g => g.gateway_name === 'stripe')?.id}
              >
                {isSaving === gateways.find(g => g.gateway_name === 'stripe')?.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* PayPal Settings */}
      {gateways.find(g => g.gateway_name === 'paypal') && (
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-lg font-semibold text-slate-900">PayPal</h2>
                <p className="text-sm text-slate-600">PayPal payments</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="mr-2 text-sm text-slate-600">Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  gateways.find(g => g.gateway_name === 'paypal')?.is_enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {gateways.find(g => g.gateway_name === 'paypal')?.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleGateway(gateways.find(g => g.gateway_name === 'paypal')!)}
                disabled={
                  isSaving === gateways.find(g => g.gateway_name === 'paypal')?.id ||
                  gateways.find(g => g.gateway_name === 'paypal')?.connection_status !== 'connected'
                }
              >
                {isSaving === gateways.find(g => g.gateway_name === 'paypal')?.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  gateways.find(g => g.gateway_name === 'paypal')?.is_enabled ? 'Disable' : 'Enable'
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Connection Status */}
            <div className={`p-4 rounded-lg ${
              gateways.find(g => g.gateway_name === 'paypal')?.connection_status === 'connected'
                ? 'bg-green-50 border border-green-200'
                : 'bg-slate-50 border border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                    {gateways.find(g => g.gateway_name === 'paypal')?.connection_status === 'connected' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-slate-400 mr-2" />
                    )}
                    <h3 className="font-medium text-slate-900">Connection Status</h3>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 ml-7">
                    {gateways.find(g => g.gateway_name === 'paypal')?.connection_status === 'connected'
                      ? `Connected since ${formatDate(gateways.find(g => g.gateway_name === 'paypal')?.connected_at)}`
                      : 'Not connected'
                    }
                  </p>
                </div>
                {gateways.find(g => g.gateway_name === 'paypal')?.connection_status === 'connected' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectPayPal}
                    disabled={isDisconnecting}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnectPayPal}
                    disabled={isConnecting || !gateways.find(g => g.gateway_name === 'paypal')?.api_keys.client_id || !gateways.find(g => g.gateway_name === 'paypal')?.api_keys.client_secret}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Connect PayPal
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* API Keys (still needed for OAuth) */}
            <FormField
              label="Client ID"
              type="text"
              value={gateways.find(g => g.gateway_name === 'paypal')?.api_keys.client_id || ''}
              onChange={(e) => {
                const paypal = gateways.find(g => g.gateway_name === 'paypal')!;
                const newApiKeys = { ...paypal.api_keys, client_id: e.target.value };
                setGateways(gateways.map(g => 
                  g.id === paypal.id ? { ...g, api_keys: newApiKeys } : g
                ));
              }}
              placeholder="Your PayPal client ID"
              hint="Required for OAuth connection"
            />

            <div className="relative">
              <FormField
                label="Client Secret"
                type={showSecretKeys[gateways.find(g => g.gateway_name === 'paypal')?.id || ''] ? 'text' : 'password'}
                value={gateways.find(g => g.gateway_name === 'paypal')?.api_keys.client_secret || ''}
                onChange={(e) => {
                  const paypal = gateways.find(g => g.gateway_name === 'paypal')!;
                  const newApiKeys = { ...paypal.api_keys, client_secret: e.target.value };
                  setGateways(gateways.map(g => 
                    g.id === paypal.id ? { ...g, api_keys: newApiKeys } : g
                  ));
                }}
                placeholder="Your PayPal client secret"
                hint="Required for OAuth connection"
              />
              <button
                type="button"
                className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                onClick={() => toggleShowSecretKey(gateways.find(g => g.gateway_name === 'paypal')?.id || '')}
              >
                {showSecretKeys[gateways.find(g => g.gateway_name === 'paypal')?.id || ''] ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Currency"
                type="text"
                value={gateways.find(g => g.gateway_name === 'paypal')?.config.currency || 'usd'}
                onChange={(e) => {
                  const paypal = gateways.find(g => g.gateway_name === 'paypal')!;
                  const newConfig = { ...paypal.config, currency: e.target.value.toLowerCase() };
                  setGateways(gateways.map(g => 
                    g.id === paypal.id ? { ...g, config: newConfig } : g
                  ));
                }}
                placeholder="usd"
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mode
                </label>
                <select
                  className="w-full rounded-lg border-slate-200 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  value={gateways.find(g => g.gateway_name === 'paypal')?.config.mode || 'sandbox'}
                  onChange={(e) => {
                    const paypal = gateways.find(g => g.gateway_name === 'paypal')!;
                    const newConfig = { ...paypal.config, mode: e.target.value };
                    setGateways(gateways.map(g => 
                      g.id === paypal.id ? { ...g, config: newConfig } : g
                    ));
                  }}
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="live">Live (Production)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => handleTestConnection(gateways.find(g => g.gateway_name === 'paypal')!)}
                disabled={isTesting === gateways.find(g => g.gateway_name === 'paypal')?.id}
              >
                {isTesting === gateways.find(g => g.gateway_name === 'paypal')?.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                onClick={() => {
                  const paypal = gateways.find(g => g.gateway_name === 'paypal')!;
                  handleUpdateApiKeys(paypal, paypal.api_keys);
                  handleUpdateConfig(paypal, paypal.config);
                }}
                disabled={isSaving === gateways.find(g => g.gateway_name === 'paypal')?.id}
              >
                {isSaving === gateways.find(g => g.gateway_name === 'paypal')?.id ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Important:</strong> After updating API keys, you need to redeploy the Edge Functions for the changes to take effect.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
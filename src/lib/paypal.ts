import { supabase } from './supabase';

// Function to initiate PayPal OAuth flow
export const initiatePayPalOAuth = async (): Promise<string> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-oauth-initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.authUrl;
  } catch (error) {
    console.error('Error initiating PayPal OAuth:', error);
    throw error;
  }
};

// Function to disconnect PayPal
export const disconnectPayPal = async (): Promise<void> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await response.json();
  } catch (error) {
    console.error('Error disconnecting PayPal:', error);
    throw error;
  }
};

// Function to refresh PayPal token
export const refreshPayPalToken = async (): Promise<void> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-token-refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await response.json();
  } catch (error) {
    console.error('Error refreshing PayPal token:', error);
    throw error;
  }
};

// Function to create a PayPal order
export const createPayPalOrder = async (amount: number, userId: string): Promise<{ orderId: string; approvalUrl: string }> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        amount,
        userId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw error;
  }
};

// Function to check if a payment gateway is enabled
export const isPaymentGatewayEnabled = async (gatewayName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('is_payment_gateway_enabled', { p_gateway_name: gatewayName });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error(`Error checking if ${gatewayName} is enabled:`, error);
    return false;
  }
};

// Function to get PayPal connection status
export const getPayPalConnectionStatus = async (): Promise<{ isConnected: boolean; connectedAt?: string }> => {
  try {
    const { data, error } = await supabase
      .from('payment_gateway_settings')
      .select('connection_status, connected_at')
      .eq('gateway_name', 'paypal')
      .single();

    if (error) throw error;
    
    return {
      isConnected: data?.connection_status === 'connected',
      connectedAt: data?.connected_at
    };
  } catch (error) {
    console.error('Error getting PayPal connection status:', error);
    return { isConnected: false };
  }
};
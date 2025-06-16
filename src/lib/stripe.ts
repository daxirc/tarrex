import { loadStripe } from '@stripe/stripe-js';

// Load the Stripe publishable key from environment variables
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Validate that the key exists and is properly formatted
if (!stripePublishableKey) {
  console.error('Stripe publishable key is missing. Please add VITE_STRIPE_PUBLISHABLE_KEY to your .env file.');
} else if (!stripePublishableKey.startsWith('pk_')) {
  console.error('Invalid Stripe publishable key format. The key should start with "pk_test_" or "pk_live_".');
}

// Initialize Stripe only if we have a valid key
export const stripePromise = stripePublishableKey && stripePublishableKey.startsWith('pk_') 
  ? loadStripe(stripePublishableKey) 
  : null;

// Function to create a payment intent via Supabase Edge Function
export const createPaymentIntent = async (amount: number, currency: string = 'usd') => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        amount,
        currency
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// Function to handle successful payment
export const handlePaymentSuccess = async (paymentIntentId: string, userId: string, amount: number) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-payment-success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        paymentIntentId,
        userId,
        amount
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error handling payment success:', error);
    throw error;
  }
};
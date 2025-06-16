import { useState, useEffect, ReactNode } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

interface StripeProviderProps {
  children: ReactNode;
}

export default function StripeProvider({ children }: StripeProviderProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        
        if (!publishableKey) {
          console.warn('No Stripe publishable key found in environment variables');
          setError('Stripe configuration missing');
          setStripePromise(null);
        } else if (!publishableKey.startsWith('pk_')) {
          console.error('Invalid Stripe publishable key format. The key should start with "pk_test_" or "pk_live_".');
          setError('Invalid Stripe key format');
          setStripePromise(null);
        } else if (publishableKey === 'your-stripe-publishable-key' || publishableKey.includes('placeholder')) {
          console.warn('Stripe publishable key appears to be a placeholder. Please configure with your actual Stripe key.');
          setError('Stripe key not configured');
          setStripePromise(null);
        } else {
          console.log('Initializing Stripe with publishable key from environment variables');
          setStripePromise(loadStripe(publishableKey));
        }
      } catch (error) {
        console.error('Error initializing Stripe:', error);
        setError('Failed to initialize Stripe');
        setStripePromise(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeStripe();
  }, []);

  if (isLoading) {
    return <div>{children}</div>;
  }

  if (error || !stripePromise) {
    // Render children without Stripe Elements wrapper when Stripe is not available
    console.warn('Stripe is not available, payment features will be disabled');
    return <div>{children}</div>;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
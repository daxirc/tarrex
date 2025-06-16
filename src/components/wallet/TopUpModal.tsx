import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import { X, CreditCard, Loader2 } from 'lucide-react';
import { createPaymentIntent, handlePaymentSuccess } from '../../lib/stripe';
import { createPayPalOrder, isPaymentGatewayEnabled } from '../../lib/paypal';
import { useStore } from '../../lib/store';

interface TopUpModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// Custom PayPal icon since it's not in Lucide
const PaypalIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7 11.5V14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-2.5" />
      <path d="M16 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2.5" />
      <path d="M12 14v4" />
      <path d="M16 14v4" />
      <path d="M8 14v4" />
      <path d="M20 9H4" />
    </svg>
  );
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
};

const PRESET_AMOUNTS = [25, 50, 100, 200, 500];

export default function TopUpModal({ onClose, onSuccess }: TopUpModalProps) {
  const { user } = useStore();
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [paymentStep, setPaymentStep] = useState<'amount' | 'details'>('amount');
  const [stripeReady, setStripeReady] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<{
    stripe: boolean;
    paypal: boolean;
  }>({
    stripe: false,
    paypal: false
  });

  // Check available payment providers
  useEffect(() => {
    const checkProviders = async () => {
      try {
        const [stripeEnabled, paypalEnabled] = await Promise.all([
          isPaymentGatewayEnabled('stripe'),
          isPaymentGatewayEnabled('paypal')
        ]);
        
        setAvailableProviders({
          stripe: stripeEnabled,
          paypal: paypalEnabled
        });
        
        // Set default provider based on availability
        if (!stripeEnabled && paypalEnabled) {
          setProvider('paypal');
        } else if (stripeEnabled && !paypalEnabled) {
          setProvider('stripe');
        }
      } catch (error) {
        console.error('Error checking payment providers:', error);
      }
    };
    
    checkProviders();
  }, []);

  // Check if Stripe is ready
  useEffect(() => {
    if (stripe && elements) {
      setStripeReady(true);
    }
  }, [stripe, elements]);

  // Check if PayPal is ready
  useEffect(() => {
    setPaypalReady(true); // PayPal doesn't need client-side initialization
  }, []);

  const handleAmountSelect = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setAmount(numValue);
    }
  };

  const handleNextStep = () => {
    if (amount < 5) {
      toast.error('Minimum top-up amount is $5');
      return;
    }

    if (amount > 10000) {
      toast.error('Maximum top-up amount is $10,000');
      return;
    }

    setPaymentStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !user?.id) {
      console.error('Stripe not initialized or user not found');
      toast.error('Payment processing is not available');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      console.error('Card element not found');
      toast.error('Card information is required');
      return;
    }

    setIsProcessing(true);
    setCardError(null);

    try {
      // Create a payment intent
      const { clientSecret } = await createPaymentIntent(amount * 100); // amount in cents

      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: user.email,
            name: user.full_name || undefined,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Handle successful payment
        await handlePaymentSuccess(paymentIntent.id, user.id, amount);
        
        toast.success(`Successfully added $${amount.toFixed(2)} to your wallet`);
        onSuccess();
      } else {
        throw new Error('Payment failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setCardError(error.message || 'Payment failed. Please try again.');
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayPalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast.error('User not found');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create PayPal order
      const { approvalUrl } = await createPayPalOrder(amount, user.id);
      
      // Redirect to PayPal for payment
      window.location.href = approvalUrl;
    } catch (error: any) {
      console.error('PayPal error:', error);
      toast.error(error.message || 'Failed to create PayPal order');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Add Funds</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {paymentStep === 'amount' ? (
          <div className="p-6 space-y-6">
            {/* Amount Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Select Amount
              </label>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {PRESET_AMOUNTS.map((presetAmount) => (
                  <button
                    key={presetAmount}
                    type="button"
                    onClick={() => handleAmountSelect(presetAmount)}
                    className={`p-3 text-center rounded-lg border-2 transition-colors ${
                      amount === presetAmount && !customAmount
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    ${presetAmount}
                  </button>
                ))}
              </div>

              <FormField
                label="Custom Amount"
                type="number"
                placeholder="Enter custom amount"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                min="5"
                max="10000"
                step="0.01"
              />
            </div>

            {/* Payment Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('stripe')}
                  disabled={!availableProviders.stripe}
                  className={`p-4 rounded-lg border-2 transition-colors flex items-center justify-center ${
                    provider === 'stripe'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  } ${!availableProviders.stripe ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Card
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('paypal')}
                  disabled={!availableProviders.paypal}
                  className={`p-4 rounded-lg border-2 transition-colors flex items-center justify-center ${
                    provider === 'paypal'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  } ${!availableProviders.paypal ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <PaypalIcon className="w-5 h-5 mr-2" />
                  PayPal
                </button>
              </div>
              
              {!availableProviders.stripe && !availableProviders.paypal && (
                <p className="mt-2 text-sm text-red-600">
                  No payment methods are currently available. Please contact support.
                </p>
              )}
            </div>

            {/* Summary */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Amount to add:</span>
                <span className="text-xl font-semibold text-slate-900">
                  ${amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-slate-600">Payment method:</span>
                <span className="text-slate-900 capitalize">{provider}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleNextStep}
                disabled={amount < 5 || (!availableProviders.stripe && !availableProviders.paypal)}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {provider === 'stripe' ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Card Details
                  </label>
                  <div className="p-4 border border-slate-200 rounded-lg bg-white">
                    {!stripeReady ? (
                      <div className="flex items-center justify-center h-10">
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        <span className="ml-2 text-slate-500">Loading payment form...</span>
                      </div>
                    ) : (
                      <CardElement options={CARD_ELEMENT_OPTIONS} />
                    )}
                  </div>
                  {cardError && (
                    <p className="mt-2 text-sm text-red-600">{cardError}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Test mode: Use card number 4242 4242 4242 4242, any future date, any 3 digits for CVC, and any 5 digits for postal code.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total amount:</span>
                    <span className="text-xl font-semibold text-slate-900">
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPaymentStep('amount')}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isProcessing || !stripeReady}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Pay $${amount.toFixed(2)}`
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handlePayPalSubmit} className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <p className="text-blue-700 text-center">
                    You'll be redirected to PayPal to complete your payment of ${amount.toFixed(2)}.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPaymentStep('amount')}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                    disabled={isProcessing || !paypalReady}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Continue to PayPal`
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
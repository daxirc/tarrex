import { supabase, testSupabaseConnection, validateEnvironmentSetup } from './supabase';

export async function trackLoginSession(userId: string) {
  try {
    // Check if we're in development mode
    const isDevelopment = import.meta.env.DEV;
    
    // Skip tracking in development if the function endpoint is not available
    if (isDevelopment) {
      console.log('Skipping login session tracking in development mode');
      return;
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        userId,
        userAgent: navigator.userAgent
      }),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('Login session tracked successfully');
  } catch (error) {
    // Log the error but don't block the login flow
    console.warn('Login session tracking failed (non-critical):', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    console.log('Starting authentication process...');

    // First, validate environment setup
    const envValidation = validateEnvironmentSetup();
    if (!envValidation.isValid) {
      console.error('Environment validation failed:', envValidation.issues);
      return {
        data: null,
        error: new Error(`Configuration Error: ${envValidation.issues.join(', ')}. Please check your .env file and restart the development server.`)
      };
    }

    console.log('Environment validation passed, testing connection...');

    // Test the connection first with enhanced error reporting
    const connectionTest = await testSupabaseConnection();
    if (!connectionTest.success) {
      console.error('Connection test failed:', connectionTest.error);
      return {
        data: null,
        error: new Error(connectionTest.error || 'Unable to connect to authentication service')
      };
    }

    console.log('Connection test successful, proceeding with authentication...');

    // Add timeout to the authentication request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    clearTimeout(timeoutId);

    if (error) {
      console.error('Authentication error:', error);
      
      // Handle specific error types with user-friendly messages
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        return {
          data: null,
          error: new Error('Network error: Unable to connect to the authentication service. Please check your internet connection and verify that your Supabase project is active.')
        };
      }
      
      if (error.message.includes('Invalid login credentials')) {
        return {
          data: null,
          error: new Error('Invalid email or password. Please check your credentials and try again.')
        };
      }
      
      if (error.message.includes('Email not confirmed')) {
        return {
          data: null,
          error: new Error('Please check your email and click the confirmation link before signing in.')
        };
      }
      
      if (error.message.includes('Too many requests')) {
        return {
          data: null,
          error: new Error('Too many login attempts. Please wait a few minutes before trying again.')
        };
      }
      
      if (error.message.includes('Invalid API key')) {
        return {
          data: null,
          error: new Error('Configuration error: Invalid API key. Please check your Supabase configuration.')
        };
      }
      
      return {
        data: null,
        error: new Error(`Authentication failed: ${error.message}`)
      };
    }

    if (!data?.user) {
      console.error('No user data in response');
      return {
        data: null,
        error: new Error('Authentication failed - no user data received')
      };
    }

    console.log('Authentication successful');

    // Track login session in the background (non-blocking)
    trackLoginSession(data.user.id);

    return { data, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return { 
        data: null, 
        error: new Error('Request timeout: The authentication service is not responding. Please try again or check your connection.') 
      };
    }
    
    // Handle network errors specifically
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return { 
        data: null, 
        error: new Error('Network error: Unable to connect to the authentication service. Please check your internet connection and verify your Supabase project configuration.') 
      };
    }
    
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Authentication failed') 
    };
  }
}
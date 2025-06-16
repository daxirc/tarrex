import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced validation with more detailed error messages
if (!supabaseUrl) {
  console.error('Environment variables check:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl);
  console.error('Available env vars:', Object.keys(import.meta.env));
  throw new Error('VITE_SUPABASE_URL is not defined in environment variables. Please check your .env file and restart the development server.');
}

if (!supabaseAnonKey) {
  console.error('Environment variables check:');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'Missing');
  console.error('Available env vars:', Object.keys(import.meta.env));
  throw new Error('VITE_SUPABASE_ANON_KEY is not defined in environment variables. Please check your .env file and restart the development server.');
}

// Check for placeholder values
if (supabaseUrl.includes('your-project-id') || supabaseUrl === 'https://your-project-id.supabase.co') {
  throw new Error('VITE_SUPABASE_URL contains placeholder values. Please replace with your actual Supabase project URL.');
}

if (supabaseAnonKey.includes('your-anon-key') || supabaseAnonKey === 'your-anon-key-here') {
  throw new Error('VITE_SUPABASE_ANON_KEY contains placeholder values. Please replace with your actual Supabase anon key.');
}

// Validate URL format
try {
  const url = new URL(supabaseUrl);
  if (!url.hostname.includes('supabase.co')) {
    console.warn('URL does not appear to be a standard Supabase URL, but proceeding anyway');
  }
} catch (error) {
  throw new Error(`VITE_SUPABASE_URL is not a valid URL: ${supabaseUrl}. Expected format: https://your-project-id.supabase.co`);
}

// Validate anon key format (improved JWT validation)
const isValidJWT = (token: string): boolean => {
  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  // Each part should be base64url encoded
  try {
    // Check if the first part (header) can be decoded and contains expected JWT structure
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    return header.alg && header.typ === 'JWT';
  } catch {
    return false;
  }
};

if (!isValidJWT(supabaseAnonKey)) {
  console.warn('VITE_SUPABASE_ANON_KEY does not appear to be a valid JWT token, but proceeding anyway');
}

// Log configuration in development for debugging
if (import.meta.env.DEV) {
  console.log('Supabase Configuration:');
  console.log('URL:', supabaseUrl);
  console.log('Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Not provided');
  console.log('Environment mode:', import.meta.env.MODE);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
});

// Enhanced connection test with better error reporting
export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', supabaseUrl);
    console.log('Key present:', !!supabaseAnonKey);
    
    // Test with a timeout to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const { data, error } = await supabase.auth.getSession();
    clearTimeout(timeoutId);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      
      // Check for specific error types
      if (error.message.includes('fetch')) {
        return { 
          success: false, 
          error: 'Network connection failed - unable to reach Supabase servers. Check your internet connection and Supabase project status.',
          details: error.message
        };
      }
      
      if (error.message.includes('Invalid API key')) {
        return { 
          success: false, 
          error: 'Invalid Supabase API key. Please check your VITE_SUPABASE_ANON_KEY in the .env file.',
          details: error.message
        };
      }
      
      return { 
        success: false, 
        error: `Supabase connection failed: ${error.message}`,
        details: error.message
      };
    }
    
    console.log('Supabase connection test successful');
    return { success: true, data };
  } catch (error) {
    console.error('Supabase connection test error:', error);
    
    // Handle AbortError (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      return { 
        success: false, 
        error: 'Connection timeout - Supabase servers are not responding. Check your project status and internet connection.',
        details: 'Request timed out after 10 seconds'
      };
    }
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { 
        success: false, 
        error: 'Network connection failed - unable to reach Supabase servers. This could be due to:\n• Internet connection issues\n• Firewall blocking the request\n• Supabase project is paused or deleted\n• Incorrect Supabase URL',
        details: error.message
      };
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown connection error',
      details: error instanceof Error ? error.stack : 'No additional details'
    };
  }
}

// Function to validate environment setup
export function validateEnvironmentSetup() {
  const issues = [];
  
  if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    issues.push('VITE_SUPABASE_URL is missing or contains placeholder values');
  }
  
  if (!supabaseAnonKey || supabaseAnonKey.includes('your-anon-key')) {
    issues.push('VITE_SUPABASE_ANON_KEY is missing or contains placeholder values');
  }
  
  try {
    new URL(supabaseUrl);
  } catch {
    issues.push('VITE_SUPABASE_URL is not a valid URL');
  }
  
  if (!isValidJWT(supabaseAnonKey)) {
    issues.push('VITE_SUPABASE_ANON_KEY does not appear to be a valid JWT token');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
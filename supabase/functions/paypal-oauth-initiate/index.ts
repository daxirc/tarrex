import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get Supabase credentials from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials are not set in environment variables");
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get PayPal settings from database
    const { data: paypalSettings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("api_keys, config")
      .eq("gateway_name", "paypal")
      .single();

    if (settingsError) {
      throw new Error(`Error fetching PayPal settings: ${settingsError.message}`);
    }

    // Get client ID from settings
    const clientId = paypalSettings?.api_keys?.client_id;
    if (!clientId) {
      throw new Error("PayPal client ID is not configured");
    }

    // Get mode from config (sandbox or live)
    const mode = paypalSettings?.config?.mode || "sandbox";
    
    // Generate a secure state parameter to prevent CSRF
    const state = crypto.randomUUID();
    
    // Store state in database for verification during callback
    const { error: stateError } = await supabase
      .from("oauth_states")
      .insert({
        state,
        provider: "paypal",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes expiry
      });

    if (stateError) {
      throw new Error(`Error storing OAuth state: ${stateError.message}`);
    }

    // Determine the correct PayPal authorization URL based on mode
    const baseUrl = mode === "live" 
      ? "https://www.paypal.com/signin/authorize" 
      : "https://www.sandbox.paypal.com/signin/authorize";
    
    // Construct the redirect URL for the callback
    const redirectUri = `${Deno.env.get("PUBLIC_URL") || supabaseUrl}/functions/v1/paypal-oauth-callback`;
    
    // Construct the authorization URL with required parameters
    const authUrl = new URL(baseUrl);
    authUrl.searchParams.append("client_id", clientId);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("scope", "openid email https://uri.paypal.com/services/payments/payment");
    authUrl.searchParams.append("state", state);

    // Return the authorization URL to the frontend
    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        state
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error initiating PayPal OAuth:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
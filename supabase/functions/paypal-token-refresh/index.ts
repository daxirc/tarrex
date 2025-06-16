import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      .select("id, api_keys, config, oauth_data, last_token_refresh")
      .eq("gateway_name", "paypal")
      .single();

    if (settingsError) {
      throw new Error(`Error fetching PayPal settings: ${settingsError.message}`);
    }

    // Check if we have OAuth data
    if (!paypalSettings.oauth_data || !paypalSettings.oauth_data.refresh_token) {
      throw new Error("PayPal is not connected via OAuth");
    }

    // Check if token needs refresh (tokens typically last 8 hours)
    const lastRefresh = new Date(paypalSettings.last_token_refresh || 0);
    const tokenAge = Date.now() - lastRefresh.getTime();
    const refreshThreshold = 7 * 60 * 60 * 1000; // 7 hours in milliseconds

    // If token is still fresh, return success
    if (tokenAge < refreshThreshold) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Token is still valid", 
          expiresIn: refreshThreshold - tokenAge 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get client ID and secret from settings
    const clientId = paypalSettings?.api_keys?.client_id;
    const clientSecret = paypalSettings?.api_keys?.client_secret;
    
    if (!clientId || !clientSecret) {
      throw new Error("PayPal client ID or secret is not configured");
    }

    // Get mode from config (sandbox or live)
    const mode = paypalSettings?.config?.mode || "sandbox";
    
    // Determine the token endpoint based on mode
    const tokenUrl = mode === "live" 
      ? "https://api.paypal.com/v1/oauth2/token" 
      : "https://api.sandbox.paypal.com/v1/oauth2/token";
    
    // Refresh the access token
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: paypalSettings.oauth_data.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Error refreshing token:", errorData);
      
      // If refresh token is invalid, mark connection as disconnected
      if (errorData.error === "invalid_grant") {
        await supabase
          .from("payment_gateway_settings")
          .update({
            connection_status: "disconnected",
            oauth_data: null,
          })
          .eq("id", paypalSettings.id);
      }
      
      throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Update OAuth data in database
    const { error: updateError } = await supabase
      .from("payment_gateway_settings")
      .update({
        oauth_data: {
          ...paypalSettings.oauth_data,
          access_token: tokenData.access_token,
          expires_in: tokenData.expires_in,
          obtained_at: new Date().toISOString(),
        },
        last_token_refresh: new Date().toISOString(),
      })
      .eq("id", paypalSettings.id);

    if (updateError) {
      throw new Error(`Error updating PayPal settings: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Token refreshed successfully" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error refreshing PayPal token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
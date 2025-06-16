import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

serve(async (req) => {
  try {
    // Parse URL and get query parameters
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Get Supabase credentials from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminPanelUrl = Deno.env.get("ADMIN_PANEL_URL") || `${supabaseUrl.replace('.supabase.co', '.app')}/secure-portal/payment-settings`;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials are not set in environment variables");
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle error from PayPal
    if (error) {
      console.error("PayPal OAuth error:", error, errorDescription);
      return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent(errorDescription || error)}`);
    }

    // Validate required parameters
    if (!code || !state) {
      return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent("Missing required parameters")}`);
    }

    // Verify state parameter to prevent CSRF
    const { data: stateData, error: stateError } = await supabase
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", "paypal")
      .single();

    if (stateError || !stateData) {
      console.error("Invalid state parameter:", stateError);
      return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent("Invalid state parameter")}`);
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      console.error("State parameter expired");
      return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent("Authorization request expired")}`);
    }

    // Delete used state to prevent replay attacks
    await supabase
      .from("oauth_states")
      .delete()
      .eq("state", state);

    // Get PayPal settings from database
    const { data: paypalSettings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("id, api_keys, config")
      .eq("gateway_name", "paypal")
      .single();

    if (settingsError) {
      throw new Error(`Error fetching PayPal settings: ${settingsError.message}`);
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
    
    // Construct the redirect URI for the token request
    const redirectUri = `${Deno.env.get("PUBLIC_URL") || supabaseUrl}/functions/v1/paypal-oauth-callback`;
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Error exchanging code for token:", errorData);
      return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent("Failed to exchange authorization code for token")}`);
    }

    const tokenData = await tokenResponse.json();
    
    // Get current user from auth
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error("Error getting session:", authError);
    }
    
    // Store OAuth tokens in database
    const { error: updateError } = await supabase
      .from("payment_gateway_settings")
      .update({
        oauth_data: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
          obtained_at: new Date().toISOString(),
        },
        connection_status: "connected",
        connected_at: new Date().toISOString(),
        connected_by: session?.user?.id,
        is_enabled: true,
        last_token_refresh: new Date().toISOString(),
      })
      .eq("id", paypalSettings.id);

    if (updateError) {
      console.error("Error updating PayPal settings:", updateError);
      return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent("Failed to store PayPal connection details")}`);
    }

    // Redirect back to admin panel with success message
    return Response.redirect(`${adminPanelUrl}?success=true`);
  } catch (error) {
    console.error("Error in PayPal OAuth callback:", error);
    const adminPanelUrl = Deno.env.get("ADMIN_PANEL_URL") || `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.app')}/secure-portal/payment-settings`;
    return Response.redirect(`${adminPanelUrl}?error=${encodeURIComponent(error.message)}`);
  }
});
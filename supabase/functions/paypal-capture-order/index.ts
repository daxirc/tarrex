import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

serve(async (req) => {
  try {
    // Parse URL and get query parameters
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const payerId = url.searchParams.get("PayerID");

    // Get Supabase credentials from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientUrl = Deno.env.get("CLIENT_URL") || `${supabaseUrl.replace('.supabase.co', '.app')}/dashboard/wallet`;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials are not set in environment variables");
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate required parameters
    if (!token || !payerId) {
      return Response.redirect(`${clientUrl}?error=${encodeURIComponent("Missing required parameters")}`);
    }

    // Get PayPal settings from database
    const { data: paypalSettings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("api_keys, config, oauth_data")
      .eq("gateway_name", "paypal")
      .single();

    if (settingsError) {
      throw new Error(`Error fetching PayPal settings: ${settingsError.message}`);
    }

    // Check if PayPal is connected
    if (!paypalSettings.oauth_data?.access_token) {
      throw new Error("PayPal is not connected");
    }

    // Get mode from config
    const mode = paypalSettings?.config?.mode || "sandbox";
    
    // Determine the API endpoint based on mode
    const apiUrl = mode === "live" 
      ? `https://api.paypal.com/v2/checkout/orders/${token}/capture` 
      : `https://api.sandbox.paypal.com/v2/checkout/orders/${token}/capture`;
    
    // Capture the order
    const captureResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paypalSettings.oauth_data.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!captureResponse.ok) {
      const errorData = await captureResponse.json();
      console.error("Error capturing PayPal order:", errorData);
      return Response.redirect(`${clientUrl}?error=${encodeURIComponent("Failed to capture payment")}`);
    }

    const captureData = await captureResponse.json();
    
    // Get order details
    const orderId = captureData.id;
    const userId = captureData.purchase_units[0].custom_id;
    const amount = parseFloat(captureData.purchase_units[0].amount.value);
    
    // Get user's wallet
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (walletError) {
      console.error("Error fetching wallet:", walletError);
      return Response.redirect(`${clientUrl}?error=${encodeURIComponent("Failed to find user wallet")}`);
    }

    // Update wallet balance
    const { error: updateError } = await supabase
      .from("wallets")
      .update({ 
        balance: walletData.balance + amount,
        last_updated_at: new Date().toISOString()
      })
      .eq("id", walletData.id);

    if (updateError) {
      console.error("Error updating wallet:", updateError);
      return Response.redirect(`${clientUrl}?error=${encodeURIComponent("Failed to update wallet balance")}`);
    }

    // Create transaction record
    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        wallet_id: walletData.id,
        user_id: userId,
        type: "deposit",
        amount: amount,
        status: "completed",
        description: "Added funds via PayPal",
        payment_provider: "paypal",
        payment_id: orderId,
        processed_at: new Date().toISOString()
      });

    if (transactionError) {
      console.error("Error creating transaction:", transactionError);
      // Don't redirect with error since the payment was successful
    }

    // Redirect back to client with success message
    return Response.redirect(`${clientUrl}?success=true&amount=${amount}`);
  } catch (error) {
    console.error("Error in PayPal order capture:", error);
    const clientUrl = Deno.env.get("CLIENT_URL") || `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.app')}/dashboard/wallet`;
    return Response.redirect(`${clientUrl}?error=${encodeURIComponent(error.message)}`);
  }
});
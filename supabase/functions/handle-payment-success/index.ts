import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import Stripe from "npm:stripe@13.9.0";

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

    // Get Stripe settings from database
    const { data: stripeSettings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("is_enabled, api_keys")
      .eq("gateway_name", "stripe")
      .single();

    if (settingsError) {
      throw new Error(`Error fetching Stripe settings: ${settingsError.message}`);
    }

    // Check if Stripe is enabled
    if (!stripeSettings || !stripeSettings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "Stripe payments are currently disabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Stripe secret key from settings
    const stripeSecretKey = stripeSettings.api_keys.secret_key;
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key is not configured");
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Parse request body
    const { paymentIntentId, userId, amount } = await req.json();

    // Validate required fields
    if (!paymentIntentId || !userId || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment intent status is ${paymentIntent.status}, expected 'succeeded'`);
    }

    // Get user's wallet
    const { data: walletData, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (walletError) {
      throw new Error(`Error fetching wallet: ${walletError.message}`);
    }

    if (!walletData) {
      throw new Error("Wallet not found");
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
      throw new Error(`Error updating wallet: ${updateError.message}`);
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
        description: "Added funds via Stripe",
        payment_provider: "stripe",
        payment_id: paymentIntentId,
        processed_at: new Date().toISOString()
      });

    if (transactionError) {
      throw new Error(`Error creating transaction: ${transactionError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Payment processed successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error handling payment success:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
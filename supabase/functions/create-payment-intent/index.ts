import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@13.9.0";
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

    // Initialize Supabase client with service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Stripe settings from database
    const { data: stripeSettings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("is_enabled, api_keys, config")
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

    // Initialize Stripe with the secret key from database
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Parse request body
    const { amount, currency = "usd" } = await req.json();

    // Validate amount
    if (!amount || amount < 500) { // Minimum $5.00 (500 cents)
      return new Response(
        JSON.stringify({ error: "Amount must be at least $5.00" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get currency from config if available
    const configCurrency = stripeSettings.config?.currency || "usd";

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Ensure amount is an integer (cents)
      currency: configCurrency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        integration_check: "tarrex_stripe_payment_intent",
      },
    });

    // Return the client secret
    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
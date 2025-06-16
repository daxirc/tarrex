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

    // Parse request body
    const { amount, userId } = await req.json();

    // Validate required fields
    if (!amount || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get PayPal settings from database
    const { data: paypalSettings, error: settingsError } = await supabase
      .from("payment_gateway_settings")
      .select("api_keys, config, oauth_data, connection_status")
      .eq("gateway_name", "paypal")
      .single();

    if (settingsError) {
      throw new Error(`Error fetching PayPal settings: ${settingsError.message}`);
    }

    // Check if PayPal is connected
    if (paypalSettings.connection_status !== "connected" || !paypalSettings.oauth_data?.access_token) {
      throw new Error("PayPal is not connected");
    }

    // Get mode and currency from config
    const mode = paypalSettings?.config?.mode || "sandbox";
    const currency = paypalSettings?.config?.currency || "USD";
    
    // Determine the API endpoint based on mode
    const apiUrl = mode === "live" 
      ? "https://api.paypal.com/v2/checkout/orders" 
      : "https://api.sandbox.paypal.com/v2/checkout/orders";
    
    // Create order with PayPal
    const orderResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${paypalSettings.oauth_data.access_token}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency.toUpperCase(),
              value: amount.toFixed(2),
            },
            description: "Tarrex wallet top-up",
            custom_id: userId,
          },
        ],
        application_context: {
          return_url: `${Deno.env.get("PUBLIC_URL") || supabaseUrl}/functions/v1/paypal-capture-order`,
          cancel_url: `${Deno.env.get("PUBLIC_URL") || supabaseUrl}/functions/v1/paypal-cancel-order`,
          brand_name: "Tarrex",
          user_action: "PAY_NOW",
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error("Error creating PayPal order:", errorData);
      throw new Error(`Failed to create PayPal order: ${errorData.message || JSON.stringify(errorData)}`);
    }

    const orderData = await orderResponse.json();
    
    // Return the order ID and approval URL
    return new Response(
      JSON.stringify({
        orderId: orderData.id,
        approvalUrl: orderData.links.find((link: any) => link.rel === "approve").href,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
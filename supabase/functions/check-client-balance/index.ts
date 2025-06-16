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

    // Initialize Supabase client with service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { clientId, requiredAmount } = await req.json();

    // Validate required fields
    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Client ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔍 Checking balance for client ${clientId}, required amount: $${requiredAmount || 3}`);
    
    // Use maybeSingle() to handle cases where no wallet exists
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', clientId)
      .maybeSingle();

    if (error) {
      console.error(`❌ Error fetching wallet for client ${clientId}:`, error);
      throw error;
    }
    
    console.log(`💰 Client ${clientId} wallet data:`, wallet);
    
    if (!wallet) {
      console.log(`⚠️ No wallet found for client ${clientId}`);
      return new Response(
        JSON.stringify({ 
          hasSufficientBalance: false,
          balance: 0,
          message: "No wallet found for client"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const minRequired = requiredAmount || 3; // Default to $3 if not specified
    const hasSufficientBalance = wallet.balance >= minRequired;
    
    console.log(`✅ Balance check result for client ${clientId}: ${hasSufficientBalance ? 'SUFFICIENT' : 'INSUFFICIENT'} (Balance: $${wallet.balance}, Required: $${minRequired})`);
    
    return new Response(
      JSON.stringify({
        hasSufficientBalance,
        balance: wallet.balance,
        requiredAmount: minRequired
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error checking client balance:", error);
    return new Response(
      JSON.stringify({ error: error.message, hasSufficientBalance: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
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
    const { sessionId, clientId, advisorId, amount } = await req.json();

    // Validate required fields
    if (!sessionId || !clientId || !advisorId || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get commission rate from wallet settings
    const { data: settings, error: settingsError } = await supabase
      .from('wallet_settings')
      .select('platform_commission_rate')
      .order('created_at', { ascending: false })
      .limit(1);

    if (settingsError) {
      throw new Error(`Error fetching wallet settings: ${settingsError.message}`);
    }

    const commissionRate = settings?.[0]?.platform_commission_rate || 0.2; // Default to 20%
    console.log(`Using platform commission rate: ${commissionRate}`);

    // Calculate fees
    const platformFee = amount * commissionRate;
    const advisorEarning = amount - platformFee;

    console.log(`Processing payment: $${amount} total, $${platformFee} platform fee, $${advisorEarning} advisor earning`);

    // Get client wallet
    const { data: clientWallet, error: clientWalletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', clientId)
      .single();

    if (clientWalletError) {
      throw new Error(`Error fetching client wallet: ${clientWalletError.message}`);
    }

    if (clientWallet.balance < amount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Insufficient funds",
          currentBalance: clientWallet.balance,
          requiredAmount: amount
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get advisor wallet
    const { data: advisorWallet, error: advisorWalletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', advisorId)
      .single();

    if (advisorWalletError) {
      throw new Error(`Error fetching advisor wallet: ${advisorWalletError.message}`);
    }

    // Start a transaction
    // Note: We're using multiple operations since Supabase doesn't support true transactions in Edge Functions
    
    // 1. Deduct from client wallet
    const { error: clientUpdateError } = await supabase
      .from('wallets')
      .update({ 
        balance: clientWallet.balance - amount,
        last_updated_at: new Date().toISOString()
      })
      .eq('id', clientWallet.id);

    if (clientUpdateError) {
      throw new Error(`Error updating client wallet: ${clientUpdateError.message}`);
    }

    // 2. Add to advisor wallet
    const { error: advisorUpdateError } = await supabase
      .from('wallets')
      .update({ 
        balance: advisorWallet.balance + advisorEarning,
        last_updated_at: new Date().toISOString()
      })
      .eq('id', advisorWallet.id);

    if (advisorUpdateError) {
      // If this fails, we should try to revert the client wallet update
      // This is a simple compensation approach since we don't have true transactions
      await supabase
        .from('wallets')
        .update({ 
          balance: clientWallet.balance,
          last_updated_at: new Date().toISOString()
        })
        .eq('id', clientWallet.id);
        
      throw new Error(`Error updating advisor wallet: ${advisorUpdateError.message}`);
    }

    // 3. Create client transaction record
    const { error: clientTransactionError } = await supabase
      .from('transactions')
      .insert({
        wallet_id: clientWallet.id,
        user_id: clientId,
        type: 'session_payment',
        amount: amount,
        status: 'completed',
        description: `Payment for session with advisor`,
        reference_id: sessionId,
        processed_at: new Date().toISOString()
      });

    if (clientTransactionError) {
      console.error(`Error creating client transaction: ${clientTransactionError.message}`);
      // Continue anyway, the wallet updates are more important
    }

    // 4. Create advisor transaction record
    const { error: advisorTransactionError } = await supabase
      .from('transactions')
      .insert({
        wallet_id: advisorWallet.id,
        user_id: advisorId,
        type: 'earning',
        amount: advisorEarning,
        status: 'completed',
        description: `Earnings from session with client (${(1-commissionRate)*100}% of $${amount})`,
        reference_id: sessionId,
        processed_at: new Date().toISOString()
      });

    if (advisorTransactionError) {
      console.error(`Error creating advisor transaction: ${advisorTransactionError.message}`);
      // Continue anyway, the wallet updates are more important
    }

    // Get updated client balance
    const { data: updatedClientWallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('id', clientWallet.id)
      .single();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Payment processed successfully",
        clientBalance: updatedClientWallet?.balance || 0,
        advisorEarning: advisorEarning,
        platformFee: platformFee,
        commissionRate: commissionRate
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing session payment:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    // Get client URL from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const clientUrl = Deno.env.get("CLIENT_URL") || `${supabaseUrl.replace('.supabase.co', '.app')}/dashboard/wallet`;
    
    // Redirect back to client with cancelled status
    return Response.redirect(`${clientUrl}?cancelled=true`);
  } catch (error) {
    console.error("Error in PayPal order cancel:", error);
    const clientUrl = Deno.env.get("CLIENT_URL") || `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.app')}/dashboard/wallet`;
    return Response.redirect(`${clientUrl}?error=${encodeURIComponent(error.message)}`);
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Server } from "https://deno.land/x/socket_io@0.2.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

interface BillingSession {
  sessionId: string;
  advisorId: string;
  clientId: string;
  startTime: Date;
  ratePerMinute: number;
  currentDuration: number; // in seconds
  totalBilled: number;
  lastBillingTime: Date;
  isActive: boolean;
}

// Store active billing sessions in memory
const activeSessions = new Map<string, BillingSession>();

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create Socket.IO server
const io = new Server({
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Set up billing interval (every 60 seconds)
const BILLING_INTERVAL = 60 * 1000; // 60 seconds
setInterval(processBillingCycles, BILLING_INTERVAL);

// Process all active billing sessions
async function processBillingCycles() {
  console.log(`Processing ${activeSessions.size} active billing sessions`);
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (!session.isActive) continue;
    
    try {
      await processBillingCycle(sessionId);
    } catch (error) {
      console.error(`Error processing billing for session ${sessionId}:`, error);
    }
  }
}

// Process a single billing cycle
async function processBillingCycle(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.isActive) return;
  
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - session.lastBillingTime.getTime()) / 1000);
  
  // Only bill if at least 60 seconds have passed
  if (elapsedSeconds < 60) {
    // Update duration but don't bill yet
    session.currentDuration += elapsedSeconds;
    session.lastBillingTime = now;
    activeSessions.set(sessionId, session);
    
    return { 
      success: true, 
      duration: session.currentDuration,
      amountBilled: session.totalBilled
    };
  }
  
  // Calculate minutes to bill (always round up to nearest minute)
  const minutesToBill = Math.ceil(elapsedSeconds / 60);
  const amountToCharge = minutesToBill * session.ratePerMinute;
  
  console.log(`Billing session ${sessionId}: ${minutesToBill} minutes at $${session.ratePerMinute}/min = $${amountToCharge}`);
  
  // Check client balance
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('balance, id')
    .eq('user_id', session.clientId)
    .single();
  
  if (walletError) {
    console.error('Error fetching wallet:', walletError);
    return;
  }
  
  if (!wallet || wallet.balance < amountToCharge) {
    // End session due to insufficient funds
    await endBillingSession(sessionId, 'insufficient_funds');
    
    // Notify clients
    io.to(sessionId).emit('insufficient_funds', { sessionId });
    return {
      success: false, 
      insufficientFunds: true,
      currentBalance: wallet?.balance || 0
    };
  }
  
  // Process payment using the process_session_payment function
  // This function handles the platform commission calculation and wallet updates
  const { data: success, error: transactionError } = await supabase.rpc(
    'process_session_payment',
    {
      p_session_id: sessionId,
      p_client_id: session.clientId,
      p_advisor_id: session.advisorId,
      p_amount: amountToCharge
    }
  );

  if (transactionError) {
    console.error('Error processing payment:', transactionError);
    return;
  }

  if (!success) {
    console.error('Payment processing failed');
    return;
  }
  
  // Update session in memory
  session.currentDuration += elapsedSeconds;
  session.totalBilled += amountToCharge;
  session.lastBillingTime = now;
  activeSessions.set(sessionId, session);
  
  // Get updated balance
  const { data: updatedWallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('id', wallet.id)
    .single();
  
  // Emit billing update to clients
  io.to(sessionId).emit('billing_update', {
    sessionId,
    duration: session.currentDuration,
    amountBilled: session.totalBilled,
    currentBalance: updatedWallet?.balance || 0
  });
  
  console.log(`Billing complete for session ${sessionId}. Total billed: $${session.totalBilled}`);
  
  return {
    success: true,
    amountBilled: amountToCharge,
    duration: session.currentDuration,
    currentBalance: updatedWallet?.balance || 0
  };
}

// Start a billing session
async function startBillingSession(
  sessionId: string, 
  advisorId: string, 
  clientId: string,
  startTime?: string
): Promise<BillingSession | null> {
  try {
    // Check if session already exists
    if (activeSessions.has(sessionId)) {
      return activeSessions.get(sessionId) || null;
    }
    
    // Check if client has sufficient balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', clientId)
      .single();
    
    if (walletError) {
      console.error('Error fetching wallet:', walletError);
      return null;
    }
    
    if (!wallet || wallet.balance < 3) {
      console.error('Insufficient balance to start session');
      io.to(sessionId).emit('insufficient_funds', { sessionId });
      return null;
    }
    
    // Get advisor's rate
    const { data: advisorProfile, error: advisorError } = await supabase
      .from('advisor_profiles')
      .select('price_per_minute')
      .eq('user_id', advisorId)
      .single();
    
    if (advisorError) {
      console.error('Error fetching advisor profile:', advisorError);
      return null;
    }
    
    if (!advisorProfile) {
      console.error('Advisor profile not found');
      return null;
    }
    
    const now = new Date();
    const sessionStartTime = startTime ? new Date(startTime) : now;
    
    // Create billing session
    const billingSession: BillingSession = {
      sessionId,
      advisorId,
      clientId,
      startTime: sessionStartTime,
      ratePerMinute: advisorProfile.price_per_minute,
      currentDuration: 0,
      totalBilled: 0,
      lastBillingTime: now,
      isActive: true
    };
    
    // Store in memory
    activeSessions.set(sessionId, billingSession);
    
    // If no start time was provided, update session in database
    if (!startTime) {
      await supabase
        .from('sessions')
        .update({
          start_time: now.toISOString(),
          status: 'in_progress'
        })
        .eq('id', sessionId);
    }
    
    console.log(`Started billing session ${sessionId} at rate $${advisorProfile.price_per_minute}/min`);
    
    return billingSession;
  } catch (error) {
    console.error('Error starting billing session:', error);
    return null;
  }
}

// End a billing session
async function endBillingSession(
  sessionId: string, 
  reason: 'completed' | 'cancelled' | 'insufficient_funds' = 'completed'
): Promise<boolean> {
  try {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return false;
    }
    
    // Mark session as inactive
    session.isActive = false;
    activeSessions.set(sessionId, session);
    
    const now = new Date();
    const finalDurationSeconds = session.currentDuration + 
      Math.floor((now.getTime() - session.lastBillingTime.getTime()) / 1000);
    const finalDurationMinutes = Math.ceil(finalDurationSeconds / 60);
    
    // Update session in database
    await supabase
      .from('sessions')
      .update({
        status: reason === 'insufficient_funds' ? 'cancelled' : reason,
        end_time: now.toISOString(),
        duration_minutes: finalDurationMinutes,
        amount: session.totalBilled
      })
      .eq('id', sessionId);
    
    console.log(`Ended billing session ${sessionId}. Final duration: ${finalDurationMinutes} minutes, Total billed: $${session.totalBilled}`);
    
    // Remove from active sessions after a delay
    setTimeout(() => {
      activeSessions.delete(sessionId);
    }, 5000);
    
    return true;
  } catch (error) {
    console.error('Error ending billing session:', error);
    return false;
  }
}

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Join a room (session)
  socket.on("join_room", (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined room ${sessionId}`);
  });
  
  // Start billing for a session
  socket.on("billing_start", async (data) => {
    const { sessionId, advisorId, clientId, startTime } = data;
    console.log(`Received billing_start for session ${sessionId}`);
    
    const session = await startBillingSession(sessionId, advisorId, clientId, startTime);
    
    if (session) {
      // Emit initial billing status
      io.to(sessionId).emit('billing_update', {
        sessionId,
        duration: session.currentDuration,
        amountBilled: session.totalBilled,
        currentBalance: 0 // Will be updated in first billing cycle
      });
    }
  });
  
  // Stop billing for a session
  socket.on("billing_stop", async (data) => {
    const { sessionId } = data;
    console.log(`Received billing_stop for session ${sessionId}`);
    
    await endBillingSession(sessionId, 'completed');
  });
  
  // Session ended
  socket.on("session_ended", async (data) => {
    const { sessionId } = data;
    console.log(`Received session_ended for session ${sessionId}`);
    
    await endBillingSession(sessionId, 'completed');
    
    // Forward the event to all clients in the room
    socket.to(sessionId).emit('session_ended', data);
  });
  
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start the server
serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }
  
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  // Handle WebSocket connection
  socket.onopen = () => {
    console.log("WebSocket connection established");
  };
  
  socket.onmessage = (event) => {
    console.log("WebSocket message received:", event.data);
  };
  
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
  
  socket.onclose = () => {
    console.log("WebSocket connection closed");
  };
  
  return response;
});
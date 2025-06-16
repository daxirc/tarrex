import { supabase } from './supabase';

export interface BillingSession {
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

/**
 * Start a billing session when an advisor accepts a chat
 */
export async function startBillingSession(
  sessionId: string, 
  advisorId: string, 
  clientId: string
): Promise<BillingSession | null> {
  try {
    // Check if client has sufficient balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', clientId)
      .maybeSingle();

    if (walletError) throw walletError;
    
    if (!wallet || wallet.balance < 3) {
      console.error('Insufficient balance to start session');
      return null;
    }

    // Get advisor's rate
    const { data: advisorProfiles, error: advisorError } = await supabase
      .from('advisor_profiles')
      .select('price_per_minute')
      .eq('user_id', advisorId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (advisorError) throw advisorError;
    
    if (!advisorProfiles || advisorProfiles.length === 0) {
      console.error('Advisor profile not found');
      return null;
    }

    const advisorProfile = advisorProfiles[0];
    const now = new Date();
    
    // Create billing session
    const billingSession: BillingSession = {
      sessionId,
      advisorId,
      clientId,
      startTime: now,
      ratePerMinute: advisorProfile.price_per_minute,
      currentDuration: 0,
      totalBilled: 0,
      lastBillingTime: now,
      isActive: true
    };

    // Store in memory
    activeSessions.set(sessionId, billingSession);
    
    // Update session in database with start time
    await supabase
      .from('sessions')
      .update({
        start_time: now.toISOString(),
        status: 'in_progress'
      })
      .eq('id', sessionId);

    return billingSession;
  } catch (error) {
    console.error('Error starting billing session:', error);
    return null;
  }
}

/**
 * Process a billing cycle for a session
 */
export async function processBillingCycle(sessionId: string): Promise<{
  success: boolean;
  insufficientFunds?: boolean;
  currentBalance?: number;
  amountBilled?: number;
  duration?: number;
}> {
  try {
    const session = activeSessions.get(sessionId);
    if (!session || !session.isActive) {
      return { success: false };
    }

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

    // Check client balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance, id')
      .eq('user_id', session.clientId)
      .maybeSingle();

    if (walletError) throw walletError;
    
    if (!wallet || wallet.balance < amountToCharge) {
      // End session due to insufficient funds
      await endBillingSession(sessionId, 'insufficient_funds');
      
      return { 
        success: false, 
        insufficientFunds: true,
        currentBalance: wallet?.balance || 0
      };
    }

    // Process payment using the process_session_payment function
    const { data: success, error: transactionError } = await supabase.rpc(
      'process_session_payment',
      {
        p_session_id: sessionId,
        p_client_id: session.clientId,
        p_advisor_id: session.advisorId,
        p_amount: amountToCharge
      }
    );

    if (transactionError) throw transactionError;

    if (!success) {
      throw new Error('Failed to process payment');
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
      .maybeSingle();

    return {
      success: true,
      amountBilled: amountToCharge,
      duration: session.currentDuration,
      currentBalance: updatedWallet?.balance || 0
    };
  } catch (error) {
    console.error('Error processing billing cycle:', error);
    return { success: false };
  }
}

/**
 * End a billing session
 */
export async function endBillingSession(
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

/**
 * Get current billing status for a session
 */
export function getBillingStatus(sessionId: string): {
  isActive: boolean;
  duration?: number;
  totalBilled?: number;
  ratePerMinute?: number;
} {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return { isActive: false };
  }

  const now = new Date();
  const currentDuration = session.currentDuration + 
    Math.floor((now.getTime() - session.lastBillingTime.getTime()) / 1000);

  return {
    isActive: session.isActive,
    duration: currentDuration,
    totalBilled: session.totalBilled,
    ratePerMinute: session.ratePerMinute
  };
}

/**
 * Check if client has sufficient balance for the next billing cycle
 */
export async function checkClientBalance(clientId: string, requiredAmount: number = 3): Promise<boolean> {
  try {
    console.log(`🔍 Checking balance for client ${clientId}, required amount: $${requiredAmount}`);
    
    // Use maybeSingle() to handle cases where no wallet exists
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', clientId)
      .maybeSingle();

    if (error) {
      console.error(`❌ Error fetching wallet for client ${clientId}:`, error);
      return false;
    }
    
    console.log(`💰 Client ${clientId} wallet data:`, wallet);
    
    if (!wallet) {
      console.log(`⚠️ No wallet found for client ${clientId}`);
      return false;
    }
    
    const hasEnoughBalance = wallet.balance >= requiredAmount;
    console.log(`✅ Balance check result for client ${clientId}: ${hasEnoughBalance ? 'SUFFICIENT' : 'INSUFFICIENT'} (Balance: $${wallet.balance}, Required: $${requiredAmount})`);
    
    return hasEnoughBalance;
  } catch (error) {
    console.error(`❌ Unexpected error checking client ${clientId} balance:`, error);
    return false;
  }
}
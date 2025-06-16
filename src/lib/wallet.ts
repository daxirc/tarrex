import { supabase } from './supabase';
import { 
  Wallet, 
  Transaction, 
  WithdrawalRequest, 
  PaymentMethod, 
  WalletSettings,
  EarningsOverview,
  WalletStats,
  TransactionType,
  WithdrawalMethod
} from '../types/wallet';

export class WalletService {
  // Get user's wallet
  static async getWallet(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }

    return data;
  }

  // Get wallet transactions with pagination
  static async getTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      status?: string;
    } = {}
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const { page = 1, limit = 20, type, status } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return { transactions: [], total: 0 };
    }

    return { transactions: data || [], total: count || 0 };
  }

  // Create a deposit transaction
  static async createDeposit(
    userId: string,
    amount: number,
    paymentProvider: string,
    paymentId: string
  ): Promise<Transaction | null> {
    const { data, error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: 'deposit',
      p_description: `Deposit via ${paymentProvider}`
    });

    if (error) {
      console.error('Error creating deposit:', error);
      return null;
    }

    // Update transaction with payment details
    const { data: transaction, error: updateError } = await supabase
      .from('transactions')
      .update({
        payment_provider: paymentProvider,
        payment_id: paymentId,
        status: 'completed'
      })
      .eq('id', data)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating transaction:', updateError);
      return null;
    }

    return transaction;
  }

  // Process session payment
  static async processSessionPayment(
    sessionId: string,
    clientId: string,
    advisorId: string,
    amount: number
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('process_session_payment', {
      p_session_id: sessionId,
      p_client_id: clientId,
      p_advisor_id: advisorId,
      p_amount: amount
    });

    if (error) {
      console.error('Error processing session payment:', error);
      return false;
    }

    return data;
  }

  // Get earnings overview for advisors
  static async getEarningsOverview(advisorId: string): Promise<EarningsOverview> {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', advisorId)
      .eq('type', 'earning');

    if (error) {
      console.error('Error fetching earnings:', error);
      return {
        total_earnings: 0,
        available_balance: 0,
        pending_withdrawals: 0,
        this_month_earnings: 0,
        last_month_earnings: 0,
        total_sessions: 0,
        average_per_session: 0
      };
    }

    const wallet = await this.getWallet(advisorId);
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const totalEarnings = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const thisMonthEarnings = transactions?.filter(t => 
      new Date(t.created_at) >= thisMonth
    ).reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    const lastMonthEarnings = transactions?.filter(t => {
      const date = new Date(t.created_at);
      return date >= lastMonth && date < thisMonth;
    }).reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Get pending withdrawals
    const { data: withdrawals } = await supabase
      .from('withdrawal_requests')
      .select('amount')
      .eq('advisor_id', advisorId)
      .eq('status', 'pending');

    const pendingWithdrawals = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    return {
      total_earnings: totalEarnings,
      available_balance: wallet?.balance || 0,
      pending_withdrawals: pendingWithdrawals,
      this_month_earnings: thisMonthEarnings,
      last_month_earnings: lastMonthEarnings,
      total_sessions: transactions?.length || 0,
      average_per_session: transactions?.length ? totalEarnings / transactions.length : 0
    };
  }

  // Create withdrawal request
  static async createWithdrawalRequest(
    advisorId: string,
    amount: number,
    method: WithdrawalMethod,
    paymentDetails: Record<string, any>
  ): Promise<WithdrawalRequest | null> {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        advisor_id: advisorId,
        amount,
        method,
        payment_details: paymentDetails,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating withdrawal request:', error);
      return null;
    }

    return data;
  }

  // Get withdrawal requests
  static async getWithdrawalRequests(
    advisorId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ requests: WithdrawalRequest[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('withdrawal_requests')
      .select('*', { count: 'exact' })
      .eq('advisor_id', advisorId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching withdrawal requests:', error);
      return { requests: [], total: 0 };
    }

    return { requests: data || [], total: count || 0 };
  }

  // Get wallet statistics
  static async getWalletStats(userId: string): Promise<WalletStats> {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching wallet stats:', error);
      return {
        total_balance: 0,
        total_spent: 0,
        total_deposited: 0,
        pending_transactions: 0,
        this_month_spent: 0
      };
    }

    const wallet = await this.getWallet(userId);
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalDeposited = transactions?.filter(t => 
      ['deposit', 'earning', 'refund'].includes(t.type)
    ).reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const totalSpent = transactions?.filter(t => 
      ['deduction', 'session_payment', 'withdrawal'].includes(t.type)
    ).reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const thisMonthSpent = transactions?.filter(t => {
      const date = new Date(t.created_at);
      return date >= thisMonth && ['deduction', 'session_payment'].includes(t.type);
    }).reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Get pending transactions count
    const { count: pendingCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    const lastTransaction = transactions?.[0];

    return {
      total_balance: wallet?.balance || 0,
      total_spent: totalSpent,
      total_deposited: totalDeposited,
      pending_transactions: pendingCount || 0,
      this_month_spent: thisMonthSpent,
      last_transaction_date: lastTransaction?.created_at
    };
  }

  // Admin functions
  static async getAllWallets(options: {
    userType?: 'client' | 'advisor';
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ wallets: any[]; total: number }> {
    const { userType, search, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('wallets')
      .select(`
        *,
        user:users(id, full_name, email, role)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userType) {
      query = query.eq('users.role', userType);
    }

    if (search) {
      query = query.or(`users.full_name.ilike.%${search}%,users.email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching all wallets:', error);
      return { wallets: [], total: 0 };
    }

    return { wallets: data || [], total: count || 0 };
  }

  static async adminAdjustWallet(
    userId: string,
    amount: number,
    type: 'add' | 'deduct',
    notes: string,
    adminId: string
  ): Promise<boolean> {
    const transactionType = type === 'add' ? 'admin_adjustment' : 'deduction';
    const adjustedAmount = type === 'add' ? amount : -amount;

    const { data, error } = await supabase.rpc('update_wallet_balance', {
      p_user_id: userId,
      p_amount: Math.abs(amount),
      p_transaction_type: transactionType,
      p_description: `Admin adjustment: ${notes}`
    });

    if (error) {
      console.error('Error adjusting wallet:', error);
      return false;
    }

    // Log admin action
    await supabase
      .from('transactions')
      .update({
        metadata: { admin_id: adminId, notes }
      })
      .eq('id', data);

    return true;
  }

  static async processWithdrawalRequest(
    requestId: string,
    action: 'approve' | 'reject',
    adminId: string,
    notes?: string
  ): Promise<boolean> {
    const status = action === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('withdrawal_requests')
      .update({
        status,
        processed_at: new Date().toISOString(),
        processed_by: adminId,
        admin_notes: notes
      })
      .eq('id', requestId);

    if (error) {
      console.error('Error processing withdrawal request:', error);
      return false;
    }

    return true;
  }

  // Get wallet settings
  static async getWalletSettings(): Promise<WalletSettings | null> {
    const { data, error } = await supabase
      .from('wallet_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching wallet settings:', error);
      return null;
    }

    return data;
  }
}
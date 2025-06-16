export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  last_updated_at: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description: string;
  metadata: Record<string, any>;
  payment_provider?: string;
  payment_id?: string;
  reference_id?: string;
  created_at: string;
  updated_at: string;
  processed_at?: string;
}

export type TransactionType = 
  | 'deposit' 
  | 'deduction' 
  | 'earning' 
  | 'withdrawal' 
  | 'admin_adjustment' 
  | 'session_payment' 
  | 'refund';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface WithdrawalRequest {
  id: string;
  advisor_id: string;
  amount: number;
  status: WithdrawalStatus;
  method: WithdrawalMethod;
  payment_details: Record<string, any>;
  admin_notes?: string;
  requested_at: string;
  processed_at?: string;
  processed_by?: string;
  created_at: string;
  updated_at: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type WithdrawalMethod = 'paypal' | 'bank_transfer' | 'stripe';

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: PaymentMethodType;
  provider_id: string;
  details: Record<string, any>;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethodType = 'stripe_card' | 'paypal' | 'bank_account';

export interface WalletSettings {
  id: string;
  minimum_withdrawal_amount: number;
  maximum_withdrawal_amount: number;
  withdrawal_fee_percentage: number;
  withdrawal_fee_fixed: number;
  platform_commission_rate: number;
  auto_approve_withdrawals: boolean;
  created_at: string;
  updated_at: string;
}

export interface EarningsOverview {
  total_earnings: number;
  available_balance: number;
  pending_withdrawals: number;
  this_month_earnings: number;
  last_month_earnings: number;
  total_sessions: number;
  average_per_session: number;
}

export interface WalletStats {
  total_balance: number;
  total_spent: number;
  total_deposited: number;
  pending_transactions: number;
  this_month_spent: number;
  last_transaction_date?: string;
}
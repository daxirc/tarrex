/*
  # Enhanced Wallet System Implementation

  1. New Tables
    - Enhanced transactions table with better structure
    - Improved withdrawal_requests table
    - Added payment_methods table for user payment preferences
    
  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for different user roles
    - Add proper constraints and validations
    
  3. Features
    - Support for multiple currencies
    - Comprehensive transaction tracking
    - Payment provider integration support
    - Admin adjustment capabilities
*/

-- Drop existing transactions table to recreate with enhanced structure
DROP TABLE IF EXISTS public.transactions CASCADE;

-- Enhanced transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES public.wallets(id) NOT NULL,
    user_id UUID REFERENCES public.users(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'deduction', 'earning', 'withdrawal', 'admin_adjustment', 'session_payment', 'refund')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    payment_provider TEXT,
    payment_id TEXT,
    reference_id UUID, -- For linking to sessions, withdrawal requests, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Enhanced wallets table
ALTER TABLE public.wallets 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing wallets table constraint
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_balance_check,
ADD CONSTRAINT wallets_balance_check CHECK (balance >= 0);

-- Enhanced withdrawal_requests table
DROP TABLE IF EXISTS public.withdrawal_requests CASCADE;

CREATE TABLE public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advisor_id UUID REFERENCES public.users(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    method TEXT NOT NULL CHECK (method IN ('paypal', 'bank_transfer', 'stripe')),
    payment_details JSONB NOT NULL,
    admin_notes TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods table for storing user payment preferences
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('stripe_card', 'paypal', 'bank_account')),
    provider_id TEXT NOT NULL, -- Stripe customer ID, PayPal email, etc.
    details JSONB NOT NULL, -- Encrypted payment details
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System settings for wallet configuration
CREATE TABLE IF NOT EXISTS public.wallet_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    minimum_withdrawal_amount DECIMAL(12,2) DEFAULT 50.00,
    maximum_withdrawal_amount DECIMAL(12,2) DEFAULT 10000.00,
    withdrawal_fee_percentage DECIMAL(5,4) DEFAULT 0.0000,
    withdrawal_fee_fixed DECIMAL(12,2) DEFAULT 0.00,
    platform_commission_rate DECIMAL(5,4) DEFAULT 0.2000,
    auto_approve_withdrawals BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default wallet settings
INSERT INTO public.wallet_settings (
    minimum_withdrawal_amount,
    maximum_withdrawal_amount,
    platform_commission_rate
) VALUES (50.00, 10000.00, 0.2000)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_advisor_id ON public.withdrawal_requests(advisor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

-- Enable RLS on all tables
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transactions
CREATE POLICY "Users can read own transactions"
    ON public.transactions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
    ON public.transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all transactions"
    ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage all transactions"
    ON public.transactions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for withdrawal_requests
CREATE POLICY "Advisors can read own withdrawal requests"
    ON public.withdrawal_requests
    FOR SELECT
    TO authenticated
    USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can insert own withdrawal requests"
    ON public.withdrawal_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = advisor_id AND
        status = 'pending'
    );

CREATE POLICY "Admins can manage all withdrawal requests"
    ON public.withdrawal_requests
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for payment_methods
CREATE POLICY "Users can manage own payment methods"
    ON public.payment_methods
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for wallet_settings
CREATE POLICY "Admins can read wallet settings"
    ON public.wallet_settings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Admins can update wallet settings"
    ON public.wallet_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Functions for wallet operations
CREATE OR REPLACE FUNCTION update_wallet_balance(
    p_user_id UUID,
    p_amount DECIMAL(12,2),
    p_transaction_type TEXT,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_wallet_id UUID;
    v_transaction_id UUID;
    v_new_balance DECIMAL(12,2);
BEGIN
    -- Get wallet ID
    SELECT id INTO v_wallet_id
    FROM public.wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
    END IF;
    
    -- Calculate new balance
    IF p_transaction_type IN ('deposit', 'earning', 'refund') THEN
        UPDATE public.wallets
        SET balance = balance + p_amount,
            last_updated_at = NOW()
        WHERE id = v_wallet_id
        RETURNING balance INTO v_new_balance;
    ELSIF p_transaction_type IN ('deduction', 'withdrawal', 'session_payment') THEN
        UPDATE public.wallets
        SET balance = balance - p_amount,
            last_updated_at = NOW()
        WHERE id = v_wallet_id
        AND balance >= p_amount
        RETURNING balance INTO v_new_balance;
        
        IF v_new_balance IS NULL THEN
            RAISE EXCEPTION 'Insufficient balance for transaction';
        END IF;
    ELSE
        RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
    END IF;
    
    -- Create transaction record
    INSERT INTO public.transactions (
        wallet_id,
        user_id,
        type,
        amount,
        status,
        description,
        reference_id
    ) VALUES (
        v_wallet_id,
        p_user_id,
        p_transaction_type,
        p_amount,
        'completed',
        p_description,
        p_reference_id
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process session payments
CREATE OR REPLACE FUNCTION process_session_payment(
    p_session_id UUID,
    p_client_id UUID,
    p_advisor_id UUID,
    p_amount DECIMAL(12,2)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_commission_rate DECIMAL(5,4);
    v_platform_fee DECIMAL(12,2);
    v_advisor_earning DECIMAL(12,2);
BEGIN
    -- Get commission rate
    SELECT platform_commission_rate INTO v_commission_rate
    FROM public.wallet_settings
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_commission_rate IS NULL THEN
        v_commission_rate := 0.2000; -- Default 20%
    END IF;
    
    -- Calculate fees
    v_platform_fee := p_amount * v_commission_rate;
    v_advisor_earning := p_amount - v_platform_fee;
    
    -- Deduct from client
    PERFORM update_wallet_balance(
        p_client_id,
        p_amount,
        'session_payment',
        'Payment for session',
        p_session_id
    );
    
    -- Add to advisor
    PERFORM update_wallet_balance(
        p_advisor_id,
        v_advisor_earning,
        'earning',
        'Earning from session',
        p_session_id
    );
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawal_requests_updated_at
    BEFORE UPDATE ON public.withdrawal_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_settings_updated_at
    BEFORE UPDATE ON public.wallet_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
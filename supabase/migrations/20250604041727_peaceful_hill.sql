/*
  # Initial Database Schema for Tarrex Platform

  1. Tables Created
    - users: Core user data and authentication
    - wallets: User balance management
    - advisor_profiles: Extended profile for advisors
    - sessions: Video/voice/chat session records
    - reviews: Client reviews for advisors
    - transactions: Payment and withdrawal records
    - support_tickets: User support system

  2. Security
    - RLS enabled on all tables
    - Policies for data access control
    - Foreign key constraints with CASCADE delete

  3. Features
    - UUID primary keys
    - Timestamps for record tracking
    - Check constraints for enums
    - Default values for critical fields
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  username text UNIQUE,
  role text NOT NULL CHECK (role IN ('client', 'advisor', 'admin')),
  phone_number text,
  country text,
  is_approved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own data"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

  CREATE POLICY "Users can update own data"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "Users can insert own data"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Wallets table
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own wallet"
    ON public.wallets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can update own wallet"
    ON public.wallets
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can insert own wallet"
    ON public.wallets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Advisor Profiles table
CREATE TABLE public.advisor_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  bio text,
  profile_picture text,
  categories text[],
  price_per_minute numeric NOT NULL DEFAULT 1.99,
  is_available boolean DEFAULT false,
  experience_years integer,
  languages text[],
  specialties text[],
  average_rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  payout_method text CHECK (payout_method IN ('bank', 'paypal', 'stripe')),
  payout_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.advisor_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read advisor profiles"
    ON public.advisor_profiles
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "Advisors can update own profile"
    ON public.advisor_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Advisors can insert own profile"
    ON public.advisor_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Sessions table
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('chat', 'voice', 'video')),
  status text NOT NULL CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  duration_minutes integer,
  amount numeric,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read their own sessions"
    ON public.sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() IN (client_id, advisor_id));

  CREATE POLICY "Clients can insert sessions"
    ON public.sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = client_id);

  CREATE POLICY "Users can update their own sessions"
    ON public.sessions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (client_id, advisor_id))
    WITH CHECK (auth.uid() IN (client_id, advisor_id));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  advisor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can read reviews"
    ON public.reviews
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "Clients can insert reviews"
    ON public.reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = client_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund')),
  amount numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  payment_method text,
  payment_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
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
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Support Tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own tickets"
    ON public.support_tickets
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert own tickets"
    ON public.support_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update own tickets"
    ON public.support_tickets
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
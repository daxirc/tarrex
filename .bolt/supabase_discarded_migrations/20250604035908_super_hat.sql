/*
  # Fix User Tables Schema

  1. Changes
    - Drop and recreate users table with proper auth.users reference
    - Drop and recreate wallets table with proper user reference
    - Drop and recreate advisor_profiles table with proper user reference
    - Add RLS policies for proper access control
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- First drop dependent tables
DROP TABLE IF EXISTS advisor_profiles CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table with proper auth reference
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  password text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  is_approved boolean DEFAULT false,
  video_enabled boolean DEFAULT false,
  voice_enabled boolean DEFAULT false,
  commission_rate numeric DEFAULT 0.4,
  CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['client'::text, 'advisor'::text, 'admin'::text])))
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for users table
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

-- Recreate wallets table
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  balance numeric DEFAULT 0
);

-- Enable RLS on wallets table
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for wallets table
CREATE POLICY "Users can read own wallet" 
  ON public.wallets 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" 
  ON public.wallets 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Recreate advisor_profiles table
CREATE TABLE public.advisor_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bio text,
  profile_picture text,
  categories text[],
  price_per_minute numeric NOT NULL,
  is_available boolean DEFAULT false,
  payout_method text,
  payout_details json,
  CONSTRAINT advisor_profiles_payout_method_check CHECK ((payout_method = ANY (ARRAY['bank'::text, 'paypal'::text, 'payoneer'::text])))
);

-- Enable RLS on advisor_profiles table
ALTER TABLE public.advisor_profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for advisor_profiles table
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
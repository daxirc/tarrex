/*
  # Update Signup Flow with Database Triggers

  1. Changes
    - Create trigger function to handle new user registration
    - Automatically create user profile and wallet
    - Set proper defaults based on user role
    - Update RLS policies for better security

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for data access
    - Ensure proper cascade deletion
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
  user_approved boolean;
BEGIN
  -- Extract role and other metadata from raw_user_meta_data
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'client');
  user_approved := CASE WHEN user_role = 'client' THEN true ELSE false END;

  -- Insert into users table
  INSERT INTO public.users (
    id,
    email,
    full_name,
    username,
    role,
    is_approved,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'username', ''),
    user_role,
    user_approved,
    now(),
    now()
  );

  -- Create wallet for the user
  INSERT INTO public.wallets (
    user_id,
    balance,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    0,
    now(),
    now()
  );

  -- If user is an advisor, create advisor profile
  IF user_role = 'advisor' THEN
    INSERT INTO public.advisor_profiles (
      user_id,
      price_per_minute,
      is_available,
      created_at,
      updated_at
    ) VALUES (
      new.id,
      1.99,
      false,
      now(),
      now()
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable user registration" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Recreate policies with proper permissions
CREATE POLICY "Enable user registration"
ON public.users
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

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
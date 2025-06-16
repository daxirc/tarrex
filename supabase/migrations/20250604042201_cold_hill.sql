/*
  # Update Users Table RLS Policies

  1. Changes
    - Add new RLS policy to allow user registration
    - Modify existing policies for better security

  2. Security
    - Enable RLS on users table (already enabled)
    - Add policy for new user registration
    - Maintain existing policies for authenticated users
*/

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Enable user registration" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Recreate policies with proper permissions
CREATE POLICY "Enable user registration"
ON public.users
FOR INSERT
TO public
WITH CHECK (
  -- Allow registration only if the user is creating their own record
  -- and the role is one of the allowed values
  auth.uid() = id AND
  role IN ('client', 'advisor', 'admin')
);

CREATE POLICY "Users can read own data"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- Users can only read their own data
  auth.uid() = id
);

CREATE POLICY "Users can update own data"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
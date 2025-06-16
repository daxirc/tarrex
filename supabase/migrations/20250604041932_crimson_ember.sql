/*
  # Update RLS policies for user registration

  1. Changes
    - Add new RLS policy to allow user registration
    - Keep existing policies for user data access

  2. Security
    - Enables new users to create their profile during registration
    - Maintains existing security for authenticated users
*/

-- First, ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create policy for user registration
CREATE POLICY "Enable user registration"
ON users
FOR INSERT
TO public
WITH CHECK (
  -- Allow registration by matching auth.uid() with the user id
  auth.uid() = id
  -- Only allow valid roles
  AND role IN ('client', 'advisor', 'admin')
);

-- Recreate policies for authenticated users
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
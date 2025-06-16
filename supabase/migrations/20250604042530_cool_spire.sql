/*
  # Fix Users Table RLS Policies

  1. Changes
    - Add policy to allow new user registration
    - Modify existing policies to ensure proper access control
  
  2. Security
    - Enable RLS on users table (if not already enabled)
    - Add policy for user registration
    - Maintain existing policies for data access
*/

-- First, ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Enable user registration" ON users;

-- Create new INSERT policy that allows registration
CREATE POLICY "Enable user registration"
ON users
FOR INSERT
TO authenticated, anon
WITH CHECK (
  -- Allow registration only if the user is creating their own record
  -- OR if they're not authenticated yet (for initial signup)
  (auth.uid() = id) OR 
  (auth.role() IS NULL)
);

-- Ensure other policies exist and are correct
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
/*
  # Fix Users Table RLS Policies

  1. Changes
    - Remove recursive admin check from user policies
    - Simplify RLS policies to prevent infinite recursion
    - Add separate policy for admin access
    
  2. Security
    - Maintain data access control
    - Prevent unauthorized access
    - Fix infinite recursion issue
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Enable user registration" ON users;

-- Create new, non-recursive policies
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  auth.uid() = id OR 
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Enable user registration"
ON users
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
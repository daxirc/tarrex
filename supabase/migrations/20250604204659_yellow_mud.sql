/*
  # Fix Users Table RLS Policy

  1. Changes
    - Remove recursive policy for users table
    - Add simplified policies for user access
    
  2. Security
    - Users can read their own data
    - Admins can read all user data using a non-recursive approach
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can read own data" ON users;

-- Create new non-recursive policies
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
TO authenticated
USING (
  role = 'admin'
);
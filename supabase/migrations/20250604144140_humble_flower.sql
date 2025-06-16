/*
  # Fix Users RLS Policies

  1. Changes
    - Remove recursive policies that were causing infinite recursion
    - Implement proper RLS policies for users table
    - Ensure admin access without recursion
    - Maintain security while allowing necessary access patterns

  2. Security
    - Enable RLS on users table
    - Add policies for:
      - Admins can read all users
      - Users can read their own data
      - Users can update their own data
      - Allow registration
*/

-- First drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Enable user registration" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new, non-recursive policies
CREATE POLICY "Enable user registration"
ON users
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

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

CREATE POLICY "Admins can read all users"
ON users
FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin'
  OR
  auth.uid() = id
);

CREATE POLICY "Admins can update any user"
ON users
FOR UPDATE
TO authenticated
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');
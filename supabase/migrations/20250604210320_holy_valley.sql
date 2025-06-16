/*
  # Fix Users Table RLS Policies

  1. Changes
    - Drop existing problematic policies on users table
    - Create new, simplified policies that avoid recursion
    - Maintain security while allowing proper role checks

  2. Security
    - Enable RLS on users table
    - Add policies for:
      - Public email verification
      - Self data access
      - Admin access to all users
*/

-- First, drop existing policies to start fresh
DROP POLICY IF EXISTS "Admins can read all data" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Enable user registration" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new, simplified policies
CREATE POLICY "Enable public email verification"
  ON users
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can read and update own data"
  ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'admin'
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
  );
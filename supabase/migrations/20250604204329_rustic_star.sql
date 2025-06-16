/*
  # Fix Admin RLS Policies

  1. Changes
    - Drop existing RLS policies on users table
    - Create new policies that properly handle admin access
    - Ensure admins can view and manage all users
    - Maintain existing user access restrictions
    
  2. Security
    - Enable RLS on users table
    - Add policies for:
      - Admins can read all users
      - Admins can update any user
      - Users can read their own data
      - Users can update their own data
      - Allow registration
*/

-- First ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Enable user registration" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;

-- Create new policies

-- Allow user registration
CREATE POLICY "Enable user registration"
ON users
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow users to read their own data
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.role = 'admin'
  )
);

-- Allow users to update their own data
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.role = 'admin'
  )
)
WITH CHECK (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.role = 'admin'
  )
);

-- Create index for faster role checks
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
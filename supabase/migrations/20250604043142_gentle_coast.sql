/*
  # Fix RLS Policy for User Registration

  1. Changes
    - Drop existing RLS policies on users table
    - Create new RLS policy that allows initial user registration
    - Maintain policies for authenticated users
    - Remove role restriction during initial signup
    
  2. Security
    - Enable RLS on users table
    - Allow unauthenticated users to create initial records
    - Restrict authenticated users to only access their own data
*/

-- First, ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Enable user registration" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new INSERT policy that allows registration for both authenticated and anonymous users
CREATE POLICY "Enable user registration"
ON users
FOR INSERT
TO authenticated, anon
WITH CHECK (
  -- For authenticated users, ensure they can only insert their own record
  -- For anonymous users (initial signup), allow the insert
  (auth.uid() = id) OR (auth.role() IS NULL)
);

-- Policy for reading own data (authenticated users only)
CREATE POLICY "Users can read own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy for updating own data (authenticated users only)
CREATE POLICY "Users can update own data"
ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
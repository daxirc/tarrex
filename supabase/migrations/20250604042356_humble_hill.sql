/*
  # Fix users table RLS policies

  1. Changes
    - Update INSERT policy for users table to allow registration
    - Keep existing SELECT and UPDATE policies unchanged
  
  2. Security
    - Allow public role to insert during registration
    - Maintain user data protection with existing policies
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Enable user registration" ON public.users;

-- Create new INSERT policy that allows registration
CREATE POLICY "Enable user registration" ON public.users
FOR INSERT TO public
WITH CHECK (
  auth.role() = 'authenticated' AND
  auth.uid() = id AND
  role = ANY (ARRAY['client'::text, 'advisor'::text, 'admin'::text])
);
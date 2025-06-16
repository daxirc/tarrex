/*
  # Add Admin RLS Policies

  1. Changes
    - Add new RLS policies for admin users to read all data
    - Keep existing policies for regular users
    
  2. Security
    - Only users with admin role can read all data
    - Regular users still restricted to their own data
*/

-- Add policy for admins to read all users
CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add policy for admins to update any user
CREATE POLICY "Admins can update any user"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add policy for admins to read all advisor profiles
CREATE POLICY "Admins can read all advisor profiles"
  ON public.advisor_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add policy for admins to update any advisor profile
CREATE POLICY "Admins can update any advisor profile"
  ON public.advisor_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
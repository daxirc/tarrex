/*
  # Update Advisor Profiles RLS Policy for Public Access

  1. Changes
    - Drop existing SELECT policy for advisor_profiles
    - Create new policy allowing public read access
    - Maintain existing policies for data modification
    
  2. Security
    - Enable public read access to advisor profiles
    - Keep write/update restrictions for authenticated users only
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Anyone can read advisor profiles" ON advisor_profiles;

-- Create new policy allowing public access
CREATE POLICY "Anyone can read advisor profiles"
ON advisor_profiles
FOR SELECT
TO public
USING (true);

-- Ensure RLS is still enabled
ALTER TABLE advisor_profiles ENABLE ROW LEVEL SECURITY;
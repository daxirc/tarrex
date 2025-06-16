/*
  # Add Video and Voice Capabilities to Advisor Profiles

  1. Changes
    - Add video_enabled column to advisor_profiles
    - Add voice_enabled column to advisor_profiles
    - Update RLS policies for admin access

  2. Security
    - Maintain existing RLS policies
    - Add new columns with proper defaults
*/

-- Add new columns to advisor_profiles
ALTER TABLE advisor_profiles
ADD COLUMN IF NOT EXISTS video_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voice_enabled boolean DEFAULT false;

-- Ensure RLS policies are up to date
DROP POLICY IF EXISTS "Admins can update any advisor profile" ON advisor_profiles;

CREATE POLICY "Admins can update any advisor profile"
ON advisor_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
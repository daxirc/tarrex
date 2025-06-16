/*
  # Update Support Tickets RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Add new policies for:
      - Users can read own tickets
      - Users can update own tickets
      - Users can insert own tickets
      - Admins can read all tickets
      - Admins can update all tickets
    
  2. Security
    - Enable RLS on support_tickets table
    - Maintain data access control
    - Add admin access policies
*/

-- First ensure RLS is enabled
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can insert own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;

-- Create new policies
CREATE POLICY "Users can read own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update own tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create index for faster role checks
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
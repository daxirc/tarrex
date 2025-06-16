/*
  # Add PayPal OAuth Support

  1. Changes
    - Update payment_gateway_settings table to support OAuth tokens
    - Add oauth_states table for CSRF protection
    - Add connection tracking fields
    
  2. Security
    - Enable RLS on oauth_states table
    - Add policies for admin access
*/

-- Update payment_gateway_settings table
ALTER TABLE payment_gateway_settings 
ADD COLUMN IF NOT EXISTS oauth_data jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS connected_at timestamptz,
ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS last_token_refresh timestamptz;

-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  state text NOT NULL UNIQUE,
  provider text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false
);

-- Enable RLS on oauth_states table
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policies for oauth_states table
CREATE POLICY "Admins can read oauth states"
  ON oauth_states
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create function to clean up expired oauth states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS trigger AS $$
BEGIN
  DELETE FROM oauth_states
  WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up expired oauth states
CREATE TRIGGER cleanup_expired_oauth_states_trigger
  AFTER INSERT ON oauth_states
  EXECUTE FUNCTION cleanup_expired_oauth_states();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_status 
ON payment_gateway_settings(connection_status);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state
ON oauth_states(state);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
ON oauth_states(expires_at);
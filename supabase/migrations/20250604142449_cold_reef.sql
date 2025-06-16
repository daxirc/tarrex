/*
  # System Settings Table

  1. New Table
    - `system_settings` table for storing global configuration
    - Fields for platform settings like commission rates, thresholds, etc.
    
  2. Security
    - Enable RLS
    - Add policies for admin access
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_threshold decimal NOT NULL DEFAULT 50.00,
  default_commission_rate decimal NOT NULL DEFAULT 0.20,
  advisor_kyc_required boolean NOT NULL DEFAULT true,
  auto_approve_advisors boolean NOT NULL DEFAULT false,
  default_video_enabled boolean NOT NULL DEFAULT false,
  default_voice_enabled boolean NOT NULL DEFAULT false,
  support_email text NOT NULL DEFAULT 'support@tarrex.com',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read system settings
CREATE POLICY "Admins can read system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Only admins can update system settings
CREATE POLICY "Admins can update system settings"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert default settings
INSERT INTO system_settings (
  withdrawal_threshold,
  default_commission_rate,
  advisor_kyc_required,
  auto_approve_advisors,
  default_video_enabled,
  default_voice_enabled,
  support_email
) VALUES (
  50.00,
  0.20,
  true,
  false,
  false,
  false,
  'support@tarrex.com'
);
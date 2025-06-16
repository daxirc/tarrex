/*
  # Fix Session and KYC Functionality

  1. Changes
    - Add trigger for session status changes
    - Add notification preferences column
    - Create indexes for faster lookups
    - Add storage bucket for KYC documents
    
  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Add notification preferences to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"sound": true, "desktop": true}'::jsonb;

-- Create storage bucket for KYC documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_advisor_id ON sessions(advisor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_user_id ON kyc_documents(user_id);

-- Add trigger for session status changes
CREATE OR REPLACE FUNCTION notify_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify about status change
  PERFORM pg_notify(
    'session_status_change',
    json_build_object(
      'session_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'advisor_id', NEW.advisor_id,
      'client_id', NEW.client_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session status changes
DROP TRIGGER IF EXISTS session_status_change_trigger ON sessions;
CREATE TRIGGER session_status_change_trigger
  AFTER UPDATE OF status ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_session_status_change();

-- Add storage policies for KYC documents
CREATE POLICY "Users can upload own KYC documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own KYC documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
);
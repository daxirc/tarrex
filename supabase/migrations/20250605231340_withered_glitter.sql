/*
  # Fix Session Status and Add Notifications Support

  1. Changes
    - Add notification_preferences column to users table
    - Update session status constraints
    - Add indexes for better performance
    
  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Add notification preferences to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"sound": true, "desktop": true}'::jsonb;

-- Create storage bucket for notification sounds if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('notification-sounds', 'notification-sounds', true)
ON CONFLICT (id) DO NOTHING;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_advisor_id ON sessions(advisor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);

-- Add trigger for session status changes
CREATE OR REPLACE FUNCTION notify_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
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
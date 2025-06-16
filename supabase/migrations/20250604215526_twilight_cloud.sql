/*
  # Login Sessions Tracking System

  1. New Tables
    - `login_sessions` table for tracking user login activity
      - Stores IP address, location, device info
      - Maintains history of recent logins
      - Enables security monitoring

  2. Security
    - Enable RLS on login_sessions table
    - Add policies for user access
    - Implement proper data retention
*/

-- Create login_sessions table
CREATE TABLE public.login_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    city TEXT,
    country TEXT,
    device_info JSONB,
    login_time TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX idx_login_sessions_login_time ON login_sessions(login_time);

-- Enable RLS
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own login sessions"
    ON login_sessions
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Create function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_old_login_sessions()
RETURNS trigger AS $$
BEGIN
    -- Keep only the last 10 sessions per user
    DELETE FROM login_sessions
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id
                       ORDER BY login_time DESC
                   ) as rn
            FROM login_sessions
            WHERE user_id = NEW.user_id
        ) ranked
        WHERE ranked.rn > 10
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for cleanup
CREATE TRIGGER cleanup_login_sessions_trigger
    AFTER INSERT ON login_sessions
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_old_login_sessions();
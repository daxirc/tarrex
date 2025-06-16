-- First, drop the existing check constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

-- Update the status check constraint with the new value
ALTER TABLE sessions
ADD CONSTRAINT sessions_status_check
CHECK (status IN ('pending_advisor_approval', 'scheduled', 'in_progress', 'completed', 'cancelled'));
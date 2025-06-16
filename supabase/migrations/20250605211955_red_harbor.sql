/*
  # Update Sessions Table Status Enum

  1. Changes
    - Add new status value for pending advisor approval
    - Update existing sessions table constraints
    
  2. Security
    - Maintain existing RLS policies
*/

-- First, drop the existing check constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

-- Update the status check constraint with the new value
ALTER TABLE sessions
ADD CONSTRAINT sessions_status_check
CHECK (status IN ('pending_advisor_approval', 'scheduled', 'in_progress', 'completed', 'cancelled'));
/*
  # Add foreign key constraint for support ticket messages

  1. Changes
    - Add foreign key constraint between support_ticket_messages.sender_id and auth.users.id
    - This enables proper joins between messages and user data

  2. Security
    - No changes to RLS policies
    - Existing table permissions remain unchanged
*/

-- Add foreign key constraint for sender_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'support_ticket_messages_sender_id_fkey'
  ) THEN
    ALTER TABLE support_ticket_messages
    ADD CONSTRAINT support_ticket_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;
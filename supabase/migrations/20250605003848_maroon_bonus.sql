/*
  # Add Trigger for Initial Support Ticket Messages

  1. Changes
    - Create trigger function to handle new support tickets
    - Automatically create initial message when ticket is created
    - Ensure first message appears in conversation thread
    
  2. Security
    - Maintain existing RLS policies
    - Use SECURITY DEFINER for proper permissions
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION create_initial_ticket_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the initial message into support_ticket_messages
  INSERT INTO public.support_ticket_messages (
    ticket_id,
    sender_id,
    message,
    created_at
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.message,
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS create_initial_ticket_message_trigger ON support_tickets;

CREATE TRIGGER create_initial_ticket_message_trigger
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_ticket_message();
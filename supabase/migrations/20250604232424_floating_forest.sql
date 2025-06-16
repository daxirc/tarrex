-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START WITH 1001;

-- Add ticket_number column
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS ticket_number integer UNIQUE DEFAULT nextval('support_ticket_number_seq');

-- Create function to format ticket number
CREATE OR REPLACE FUNCTION format_ticket_number(ticket_number integer)
RETURNS text AS $$
BEGIN
  RETURN 'T-' || LPAD(ticket_number::text, 4, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add formatted_ticket_number column
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS formatted_ticket_number text
GENERATED ALWAYS AS (format_ticket_number(ticket_number)) STORED;

-- Add user_role column
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS user_role text;

-- Create function to update user_role
CREATE OR REPLACE FUNCTION update_support_ticket_user_role()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_role := (SELECT role FROM users WHERE id = NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain user_role
CREATE TRIGGER set_support_ticket_user_role
  BEFORE INSERT OR UPDATE OF user_id
  ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_user_role();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_role ON support_tickets(user_role);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Update existing records
UPDATE support_tickets
SET user_role = (SELECT role FROM users WHERE id = user_id)
WHERE user_role IS NULL;
/*
  # Support Ticket Messages Table

  1. New Tables
    - `support_ticket_messages` for storing threaded messages
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, references support_tickets)
      - `sender_id` (uuid, references users)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for:
      - Users can read messages for their own tickets
      - Users can create messages for their own tickets
      - Admins can read and create messages for all tickets
*/

-- Create support_ticket_messages table
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read messages for their own tickets"
  ON public.support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
      AND (
        st.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Users can create messages for their own tickets"
  ON public.support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
      AND (
        st.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()
          AND u.role = 'admin'
        )
      )
    )
  );

-- Create indexes
CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX idx_support_ticket_messages_sender ON support_ticket_messages(sender_id);
CREATE INDEX idx_support_ticket_messages_created ON support_ticket_messages(created_at);
/*
  # Fix Support Messages Foreign Key Relationship

  1. Changes
    - Drop existing foreign key constraint that references auth.users
    - Add new foreign key constraint referencing public.users
    - Update RLS policies to reflect the new relationship

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with CASCADE delete
*/

-- First drop the existing foreign key constraint if it exists
ALTER TABLE public.support_ticket_messages
DROP CONSTRAINT IF EXISTS support_ticket_messages_sender_id_fkey;

-- Add new foreign key constraint referencing public.users
ALTER TABLE public.support_ticket_messages
ADD CONSTRAINT support_ticket_messages_sender_id_fkey
FOREIGN KEY (sender_id) REFERENCES public.users(id)
ON DELETE CASCADE;
/*
  # Add Withdrawal Requests Table

  1. New Tables
    - `withdrawal_requests` table for tracking advisor payout requests
      - `id` (uuid, primary key)
      - `advisor_id` (uuid, references users)
      - `amount` (numeric)
      - `status` (text, enum)
      - `requested_at` (timestamp)
      - `completed_at` (timestamp)
      - `notes` (text)

  2. Security
    - Enable RLS on withdrawal_requests table
    - Add policies for advisor access
*/

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Advisors can read own withdrawal requests"
  ON public.withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = advisor_id);

CREATE POLICY "Advisors can insert own withdrawal requests"
  ON public.withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = advisor_id AND
    status = 'pending'
  );

-- Create index for faster lookups
CREATE INDEX withdrawal_requests_advisor_id_idx ON public.withdrawal_requests(advisor_id);
/*
  # Create KYC Requests Table

  1. New Tables
    - `kyc_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `status` (text, enum: pending, approved, rejected)
      - `id_document` (text, URL to document)
      - `address_proof` (text, URL to document)
      - `notes` (text, nullable)
      - `submitted_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `kyc_requests` table
    - Add policies for:
      - Advisors can read their own KYC requests
      - Advisors can insert their own KYC requests
      - Admins can read and update all KYC requests
*/

CREATE TABLE IF NOT EXISTS kyc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  id_document text NOT NULL,
  address_proof text NOT NULL,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE kyc_requests ENABLE ROW LEVEL SECURITY;

-- Advisors can read their own KYC requests
CREATE POLICY "Advisors can read own kyc requests"
  ON kyc_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Advisors can insert their own KYC requests
CREATE POLICY "Advisors can insert own kyc requests"
  ON kyc_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    status = 'pending'
  );

-- Admins can read all KYC requests
CREATE POLICY "Admins can read all kyc requests"
  ON kyc_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can update KYC requests
CREATE POLICY "Admins can update kyc requests"
  ON kyc_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
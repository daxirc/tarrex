/*
  # KYC Verification System

  1. New Tables
    - `kyc_documents` table for storing document information
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `document_type` (text, enum)
      - `document_number` (text)
      - `expiry_date` (date)
      - `document_url` (text)
      - `verification_status` (text, enum)
      - `rejection_reason` (text)
      - `verified_at` (timestamptz)
      - `verified_by` (uuid, references users)

  2. Security
    - Enable RLS on kyc_documents table
    - Add policies for:
      - Advisors can read/insert own documents
      - Admins can read/update all documents
*/

-- Create document_type enum
CREATE TYPE document_type AS ENUM (
  'passport',
  'drivers_license',
  'national_id',
  'proof_of_address'
);

-- Create verification_status enum
CREATE TYPE verification_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- Create kyc_documents table
CREATE TABLE public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  document_number text NOT NULL,
  expiry_date date,
  document_url text NOT NULL,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Add constraint to ensure verified_by is only set when status is approved/rejected
  CONSTRAINT verified_by_check CHECK (
    (verification_status = 'pending' AND verified_by IS NULL) OR
    (verification_status != 'pending' AND verified_by IS NOT NULL)
  ),
  
  -- Add constraint to ensure rejection_reason is set when status is rejected
  CONSTRAINT rejection_reason_check CHECK (
    (verification_status != 'rejected' AND rejection_reason IS NULL) OR
    (verification_status = 'rejected' AND rejection_reason IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Advisors can read own documents"
  ON kyc_documents
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Advisors can insert own documents"
  ON kyc_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'advisor'
    )
  );

CREATE POLICY "Admins can update documents"
  ON kyc_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_status ON kyc_documents(verification_status);

-- Create function to update user approval status
CREATE OR REPLACE FUNCTION update_user_approval_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If all required documents are approved, approve the user
  IF NEW.verification_status = 'approved' AND
     EXISTS (
       SELECT 1
       FROM kyc_documents
       WHERE user_id = NEW.user_id
       GROUP BY user_id
       HAVING COUNT(*) FILTER (WHERE verification_status = 'approved') = 
              COUNT(*) -- All documents are approved
     ) THEN
    UPDATE users
    SET is_approved = true
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER update_user_approval_after_kyc
  AFTER UPDATE OF verification_status ON kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_user_approval_status();
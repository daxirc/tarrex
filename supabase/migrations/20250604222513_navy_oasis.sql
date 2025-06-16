-- Add is_hidden column to reviews table
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Update RLS policies for reviews table
DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;

-- Create new policy that excludes hidden reviews for regular users
CREATE POLICY "Users can read non-hidden reviews"
ON reviews
FOR SELECT
TO authenticated
USING (
  NOT is_hidden OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow admins to update reviews
CREATE POLICY "Admins can update reviews"
ON reviews
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Allow admins to delete reviews
CREATE POLICY "Admins can delete reviews"
ON reviews
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);
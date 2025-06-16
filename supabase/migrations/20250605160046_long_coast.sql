/*
  # Enhance Advisor Profiles with Real-time Sync Support

  1. Changes
    - Add updated_at trigger for advisor_profiles table
    - Add languages and specialties arrays with validation
    - Add check constraints for array limits
    
  2. Security
    - Maintain existing RLS policies
    - Add validation for array lengths
*/

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to advisor_profiles table
DROP TRIGGER IF EXISTS set_updated_at ON advisor_profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON advisor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Add check constraints for array lengths
ALTER TABLE advisor_profiles
ADD CONSTRAINT max_categories CHECK (array_length(categories, 1) <= 5),
ADD CONSTRAINT max_specialties CHECK (array_length(specialties, 1) <= 5),
ADD CONSTRAINT min_languages CHECK (array_length(languages, 1) >= 1);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_advisor_profiles_updated_at ON advisor_profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_advisor_profiles_categories ON advisor_profiles USING gin(categories);
CREATE INDEX IF NOT EXISTS idx_advisor_profiles_specialties ON advisor_profiles USING gin(specialties);
CREATE INDEX IF NOT EXISTS idx_advisor_profiles_languages ON advisor_profiles USING gin(languages);
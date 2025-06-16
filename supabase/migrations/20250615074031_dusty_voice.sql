/*
  # Add Unique Constraint to Wallets Table

  1. Changes
    - Add unique constraint on user_id column in wallets table
    - Ensures each user can only have one wallet
    - Fixes error in checkClientBalance function
    
  2. Security
    - Maintains existing RLS policies
    - Improves data integrity
*/

-- Add unique constraint to wallets table
ALTER TABLE public.wallets
ADD CONSTRAINT unique_user_id_on_wallets UNIQUE (user_id);

-- Create function to ensure each user has a wallet
CREATE OR REPLACE FUNCTION ensure_user_has_wallet()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a wallet
  IF NOT EXISTS (
    SELECT 1 FROM public.wallets
    WHERE user_id = NEW.id
  ) THEN
    -- Create a new wallet for the user
    INSERT INTO public.wallets (
      user_id,
      balance,
      currency,
      created_at,
      updated_at,
      last_updated_at
    ) VALUES (
      NEW.id,
      0,
      'USD',
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure each user has a wallet
DROP TRIGGER IF EXISTS ensure_user_wallet_trigger ON public.users;

CREATE TRIGGER ensure_user_wallet_trigger
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_has_wallet();

-- Create function to check if any users are missing wallets
CREATE OR REPLACE FUNCTION create_missing_wallets()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN
    SELECT id FROM public.users
    WHERE NOT EXISTS (
      SELECT 1 FROM public.wallets
      WHERE user_id = users.id
    )
  LOOP
    INSERT INTO public.wallets (
      user_id,
      balance,
      currency,
      created_at,
      updated_at,
      last_updated_at
    ) VALUES (
      user_record.id,
      0,
      'USD',
      NOW(),
      NOW(),
      NOW()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to create missing wallets
SELECT create_missing_wallets();
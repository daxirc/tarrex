/*
  # Payment Gateway Settings System

  1. New Tables
    - `payment_gateway_settings` table for storing payment gateway configurations
      - `id` (uuid, primary key)
      - `gateway_name` (text, unique) - e.g., 'stripe', 'paypal'
      - `is_enabled` (boolean) - whether the gateway is active
      - `api_keys` (jsonb) - securely store API keys
      - `config` (jsonb) - additional configuration options
      - `created_at`, `updated_at` (timestamptz)

  2. Security
    - Enable RLS on payment_gateway_settings table
    - Add policies for admin-only access
    - Insert initial data for Stripe and PayPal
*/

-- Create payment_gateway_settings table
CREATE TABLE public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  gateway_name text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  api_keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

-- Create update timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_payment_gateway_settings_updated_at
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create policies for admin-only access
CREATE POLICY "Admins can read payment gateway settings"
  ON public.payment_gateway_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update payment gateway settings"
  ON public.payment_gateway_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert payment gateway settings"
  ON public.payment_gateway_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete payment gateway settings"
  ON public.payment_gateway_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Insert initial data for Stripe and PayPal
INSERT INTO public.payment_gateway_settings (gateway_name, is_enabled, api_keys, config)
VALUES 
  ('stripe', false, '{"publishable_key": "", "secret_key": ""}'::jsonb, '{"currency": "usd", "payment_methods": ["card"]}'::jsonb),
  ('paypal', false, '{"client_id": "", "client_secret": ""}'::jsonb, '{"currency": "usd", "mode": "sandbox"}'::jsonb)
ON CONFLICT (gateway_name) DO NOTHING;

-- Create a public function to check if a payment gateway is enabled
-- This can be called from the client side without exposing API keys
CREATE OR REPLACE FUNCTION public.is_payment_gateway_enabled(p_gateway_name text)
RETURNS boolean AS $$
DECLARE
  v_is_enabled boolean;
BEGIN
  SELECT is_enabled INTO v_is_enabled
  FROM public.payment_gateway_settings
  WHERE gateway_name = p_gateway_name;
  
  RETURN COALESCE(v_is_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
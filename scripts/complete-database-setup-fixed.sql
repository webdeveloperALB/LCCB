-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS external_accounts CASCADE;
DROP TABLE IF EXISTS crypto_transactions CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS deposits CASCADE;
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS usd_balances CASCADE;
DROP TABLE IF EXISTS cad_balances CASCADE;
DROP TABLE IF EXISTS euro_balances CASCADE;
DROP TABLE IF EXISTS crypto_balances CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Create users profile table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  client_id VARCHAR(10) UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (id)
);

-- Create crypto balances table
CREATE TABLE crypto_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- Create euro balances table
CREATE TABLE euro_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- Create CAD balances table
CREATE TABLE cad_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- Create USD balances table
CREATE TABLE usd_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- Create transactions table
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  description TEXT,
  platform TEXT,
  status VARCHAR(20) DEFAULT 'Pending',
  reference_id VARCHAR(50),
  recipient_email TEXT,
  recipient_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create transfers table
CREATE TABLE transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_currency VARCHAR(10) NOT NULL,
  to_currency VARCHAR(10) NOT NULL,
  from_amount DECIMAL(20, 8) NOT NULL,
  to_amount DECIMAL(20, 8) NOT NULL,
  exchange_rate DECIMAL(10, 6) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create deposits table
CREATE TABLE deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  method VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  reference_id VARCHAR(100),
  bank_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create payments table
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  description TEXT,
  recipient TEXT,
  status VARCHAR(20) DEFAULT 'Pending',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create cards table
CREATE TABLE cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number VARCHAR(20) NOT NULL,
  card_holder_name TEXT NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  card_type VARCHAR(20) DEFAULT 'Virtual',
  status VARCHAR(20) DEFAULT 'Active',
  spending_limit DECIMAL(15, 2) DEFAULT 5000.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create crypto_transactions table
CREATE TABLE crypto_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  crypto_type VARCHAR(20) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  price_per_unit DECIMAL(15, 2) NOT NULL,
  total_value DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create accounts table for external bank accounts
CREATE TABLE external_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  routing_number VARCHAR(20),
  account_type VARCHAR(20) DEFAULT 'Checking',
  currency VARCHAR(10) DEFAULT 'USD',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE euro_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE usd_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables
CREATE POLICY "Users can manage own data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own crypto balance" ON crypto_balances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own euro balance" ON euro_balances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own cad balance" ON cad_balances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own usd balance" ON usd_balances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own transfers" ON transfers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own deposits" ON deposits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own payments" ON payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own cards" ON cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own crypto transactions" ON crypto_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own external accounts" ON external_accounts FOR ALL USING (auth.uid() = user_id);

-- Function to generate client ID
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS TEXT AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    new_id := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM profiles WHERE client_id = new_id) INTO id_exists;
    IF NOT id_exists THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate card number
CREATE OR REPLACE FUNCTION generate_card_number()
RETURNS TEXT AS $$
BEGIN
  RETURN '4532' || LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO profiles (id, client_id, full_name, email)
  VALUES (
    NEW.id,
    generate_client_id(),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1), 'User'),
    NEW.email
  );
  
  -- Initialize balances for all currencies
  INSERT INTO crypto_balances (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO euro_balances (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO cad_balances (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO usd_balances (user_id, balance) VALUES (NEW.id, 0);
  
  -- Create a default virtual card
  INSERT INTO cards (user_id, card_number, card_holder_name, expiry_month, expiry_year)
  VALUES (
    NEW.id,
    generate_card_number(),
    UPPER(COALESCE(NEW.raw_user_meta_data->>'full_name', 'CARD HOLDER')),
    12,
    EXTRACT(YEAR FROM NOW()) + 3
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

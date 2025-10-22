-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users profile table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  client_id VARCHAR(10) UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (id)
);

-- Create crypto balances table
CREATE TABLE IF NOT EXISTS crypto_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(20, 8) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Create euro balances table
CREATE TABLE IF NOT EXISTS euro_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Create CAD balances table
CREATE TABLE IF NOT EXISTS cad_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Create USD balances table
CREATE TABLE IF NOT EXISTS usd_balances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  description TEXT,
  platform TEXT,
  status VARCHAR(20) DEFAULT 'Successful',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE euro_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE usd_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own crypto balance" ON crypto_balances;
DROP POLICY IF EXISTS "Users can update own crypto balance" ON crypto_balances;
DROP POLICY IF EXISTS "Users can insert own crypto balance" ON crypto_balances;

DROP POLICY IF EXISTS "Users can view own euro balance" ON euro_balances;
DROP POLICY IF EXISTS "Users can update own euro balance" ON euro_balances;
DROP POLICY IF EXISTS "Users can insert own euro balance" ON euro_balances;

DROP POLICY IF EXISTS "Users can view own cad balance" ON cad_balances;
DROP POLICY IF EXISTS "Users can update own cad balance" ON cad_balances;
DROP POLICY IF EXISTS "Users can insert own cad balance" ON cad_balances;

DROP POLICY IF EXISTS "Users can view own usd balance" ON usd_balances;
DROP POLICY IF EXISTS "Users can update own usd balance" ON usd_balances;
DROP POLICY IF EXISTS "Users can insert own usd balance" ON usd_balances;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own crypto balance" ON crypto_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own crypto balance" ON crypto_balances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own crypto balance" ON crypto_balances FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own euro balance" ON euro_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own euro balance" ON euro_balances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own euro balance" ON euro_balances FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own cad balance" ON cad_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own cad balance" ON cad_balances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cad balance" ON cad_balances FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usd balance" ON usd_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usd balance" ON usd_balances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usd balance" ON usd_balances FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to generate client ID
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, client_id, full_name, email)
  VALUES (
    NEW.id,
    generate_client_id(),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  
  -- Initialize balances for all currencies
  INSERT INTO crypto_balances (user_id, balance) VALUES (NEW.id, 1);
  INSERT INTO euro_balances (user_id, balance) VALUES (NEW.id, 5223.33);
  INSERT INTO cad_balances (user_id, balance) VALUES (NEW.id, 91223.33);
  INSERT INTO usd_balances (user_id, balance) VALUES (NEW.id, 10000.00);
  
  -- Add some sample transactions
  INSERT INTO transactions (user_id, type, amount, currency, description, platform, status)
  VALUES 
    (NEW.id, 'Withdrawal', 1800.00, 'EUR', 'Crypto platform', 'Online Account', 'Successful'),
    (NEW.id, 'Deposit', 1005.00, 'EUR', 'MoonPay', 'Crypto.com', 'Successful');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

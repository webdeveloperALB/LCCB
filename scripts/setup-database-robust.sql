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

-- Function to generate client ID with better uniqueness
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

-- Improved function to handle new user signup with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with error handling
  BEGIN
    INSERT INTO profiles (id, client_id, full_name, email)
    VALUES (
      NEW.id,
      generate_client_id(),
      COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1), 'User'),
      NEW.email
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  -- Initialize balances for all currencies with error handling
  BEGIN
    INSERT INTO crypto_balances (user_id, balance) VALUES (NEW.id, 0);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create crypto balance for user %: %', NEW.id, SQLERRM;
  END;
  
  BEGIN
    INSERT INTO euro_balances (user_id, balance) VALUES (NEW.id, 0);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create euro balance for user %: %', NEW.id, SQLERRM;
  END;
  
  BEGIN
    INSERT INTO cad_balances (user_id, balance) VALUES (NEW.id, 0);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create cad balance for user %: %', NEW.id, SQLERRM;
  END;
  
  BEGIN
    INSERT INTO usd_balances (user_id, balance) VALUES (NEW.id, 0);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create usd balance for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_crypto_balances_user_id ON crypto_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_euro_balances_user_id ON euro_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_cad_balances_user_id ON cad_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_usd_balances_user_id ON usd_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Add messages table for user-specific messages
CREATE TABLE IF NOT EXISTS user_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'info', -- 'info', 'alert', 'success', 'warning'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add currencies table for real exchange rates
CREATE TABLE IF NOT EXISTS currencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol VARCHAR(5) NOT NULL,
  exchange_rate_to_usd DECIMAL(15, 6) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add cryptocurrencies table
CREATE TABLE IF NOT EXISTS cryptocurrencies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  price_usd DECIMAL(15, 2) NOT NULL,
  price_change_24h DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cryptocurrencies ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own messages" ON user_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read currencies" ON currencies FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can read cryptocurrencies" ON cryptocurrencies FOR SELECT USING (TRUE);

-- Insert major world currencies with real exchange rates (to USD)
INSERT INTO currencies (code, name, symbol, exchange_rate_to_usd) VALUES
('USD', 'US Dollar', '$', 1.00),
('EUR', 'Euro', '€', 1.09),
('GBP', 'British Pound', '£', 1.27),
('CAD', 'Canadian Dollar', 'C$', 0.74),
('JPY', 'Japanese Yen', '¥', 0.0067),
('CHF', 'Swiss Franc', 'CHF', 1.11),
('AUD', 'Australian Dollar', 'A$', 0.66),
('CNY', 'Chinese Yuan', '¥', 0.14),
('INR', 'Indian Rupee', '₹', 0.012),
('BRL', 'Brazilian Real', 'R$', 0.20),
('MXN', 'Mexican Peso', '$', 0.059),
('KRW', 'South Korean Won', '₩', 0.00076),
('SGD', 'Singapore Dollar', 'S$', 0.74),
('HKD', 'Hong Kong Dollar', 'HK$', 0.13),
('NOK', 'Norwegian Krone', 'kr', 0.094),
('SEK', 'Swedish Krona', 'kr', 0.096),
('DKK', 'Danish Krone', 'kr', 0.15),
('PLN', 'Polish Zloty', 'zł', 0.25),
('CZK', 'Czech Koruna', 'Kč', 0.044),
('HUF', 'Hungarian Forint', 'Ft', 0.0028)
ON CONFLICT (code) DO UPDATE SET
  exchange_rate_to_usd = EXCLUDED.exchange_rate_to_usd,
  updated_at = NOW();

-- Insert major cryptocurrencies with current prices
INSERT INTO cryptocurrencies (code, name, symbol, price_usd, price_change_24h) VALUES
('BTC', 'Bitcoin', 'BTC', 45000.00, 2.5),
('ETH', 'Ethereum', 'ETH', 3200.00, 1.8),
('BNB', 'Binance Coin', 'BNB', 320.00, -0.5),
('XRP', 'Ripple', 'XRP', 0.52, 3.2),
('ADA', 'Cardano', 'ADA', 0.45, 1.1),
('SOL', 'Solana', 'SOL', 98.00, 4.5),
('DOT', 'Polkadot', 'DOT', 7.20, -1.2),
('DOGE', 'Dogecoin', 'DOGE', 0.08, 5.8),
('AVAX', 'Avalanche', 'AVAX', 38.50, 2.1),
('SHIB', 'Shiba Inu', 'SHIB', 0.000024, -2.3),
('MATIC', 'Polygon', 'MATIC', 0.85, 1.9),
('LTC', 'Litecoin', 'LTC', 73.00, 0.8),
('UNI', 'Uniswap', 'UNI', 6.80, -0.9),
('LINK', 'Chainlink', 'LINK', 14.50, 2.7),
('ATOM', 'Cosmos', 'ATOM', 10.20, 1.5),
('XLM', 'Stellar', 'XLM', 0.12, 3.1),
('VET', 'VeChain', 'VET', 0.025, 0.6),
('ICP', 'Internet Computer', 'ICP', 12.80, -1.8),
('FIL', 'Filecoin', 'FIL', 5.40, 2.9),
('TRX', 'TRON', 'TRX', 0.11, 1.4)
ON CONFLICT (code) DO UPDATE SET
  price_usd = EXCLUDED.price_usd,
  price_change_24h = EXCLUDED.price_change_24h,
  updated_at = NOW();

-- Function to get real exchange rate between currencies
CREATE OR REPLACE FUNCTION get_exchange_rate(from_currency TEXT, to_currency TEXT)
RETURNS DECIMAL AS $$
DECLARE
  from_rate DECIMAL;
  to_rate DECIMAL;
BEGIN
  -- Get USD rates for both currencies
  SELECT exchange_rate_to_usd INTO from_rate FROM currencies WHERE code = UPPER(from_currency);
  SELECT exchange_rate_to_usd INTO to_rate FROM currencies WHERE code = UPPER(to_currency);
  
  -- Calculate cross rate
  IF from_rate IS NULL OR to_rate IS NULL THEN
    RETURN 1.0; -- Fallback to 1:1 if currency not found
  END IF;
  
  RETURN to_rate / from_rate;
END;
$$ LANGUAGE plpgsql;

-- Create default messages for new users
CREATE OR REPLACE FUNCTION create_default_messages(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_messages (user_id, title, content, message_type, is_read) VALUES
  (user_id_param, 'Welcome to Digital Chain Bank!', 'Your account has been successfully created. All services are now available.', 'success', FALSE),
  (user_id_param, 'Account Security', 'Please ensure your account information is up to date for security purposes.', 'info', FALSE);
END;
$$ LANGUAGE plpgsql;

-- Update the user creation trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO profiles (id, client_id, full_name, email)
  VALUES (
    NEW.id,
    generate_client_id(),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  
  -- Insert balances for all major currencies
  INSERT INTO crypto_balances (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO euro_balances (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO cad_balances (user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO usd_balances (user_id, balance) VALUES (NEW.id, 0);
  
  -- Create a default virtual card
  INSERT INTO cards (user_id, card_number, card_holder_name, expiry_month, expiry_year)
  VALUES (
    NEW.id,
    '4532' || LPAD(FLOOR(RANDOM() * 1000000000000)::TEXT, 12, '0'),
    UPPER(COALESCE(NEW.raw_user_meta_data->>'full_name', 'CARD HOLDER')),
    12,
    EXTRACT(YEAR FROM NOW()) + 3
  );
  
  -- Create default messages
  PERFORM create_default_messages(NEW.id);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    client_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_balances table
CREATE TABLE IF NOT EXISTS public.user_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    usd_balance DECIMAL(15,2) DEFAULT 0.00,
    eur_balance DECIMAL(15,2) DEFAULT 0.00,
    cad_balance DECIMAL(15,2) DEFAULT 0.00,
    btc_balance DECIMAL(15,8) DEFAULT 0.00000000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create user_messages table
CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'info' CHECK (message_type IN ('info', 'alert', 'warning', 'success')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    transaction_type TEXT NOT NULL,
    from_currency TEXT,
    to_currency TEXT,
    from_amount DECIMAL(15,8),
    to_amount DECIMAL(15,8),
    crypto_symbol TEXT,
    crypto_amount DECIMAL(15,8),
    crypto_price DECIMAL(15,2),
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own balances" ON public.user_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own balances" ON public.user_balances FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages" ON public.user_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own messages" ON public.user_messages FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin policies (for service role)
CREATE POLICY "Service role can manage all profiles" ON public.profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage all balances" ON public.user_balances FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage all messages" ON public.user_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage all transactions" ON public.transactions FOR ALL USING (auth.role() = 'service_role');

-- Function to generate client ID
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'DC' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into profiles
    INSERT INTO public.profiles (id, full_name, email, client_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        generate_client_id()
    );
    
    -- Insert initial balances
    INSERT INTO public.user_balances (user_id, usd_balance, eur_balance, cad_balance, btc_balance)
    VALUES (NEW.id, 1000.00, 500.00, 750.00, 0.01000000);
    
    -- Insert welcome message
    INSERT INTO public.user_messages (user_id, title, content, message_type)
    VALUES (
        NEW.id,
        'Welcome to Digital Chain Bank!',
        'Your account has been created successfully. You have been credited with initial balances to get started with trading and transfers.',
        'success'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON public.user_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

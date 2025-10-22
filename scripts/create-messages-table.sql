-- Create user_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'info' CHECK (message_type IN ('info', 'alert', 'success', 'warning')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON user_messages(created_at DESC);

-- Enable RLS
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own messages" ON user_messages;
CREATE POLICY "Users can view their own messages" ON user_messages
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own messages" ON user_messages;
CREATE POLICY "Users can update their own messages" ON user_messages
    FOR UPDATE USING (auth.uid() = user_id);

-- Insert sample messages for existing users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id, email FROM auth.users LOOP
        -- Insert welcome message if it doesn't exist
        INSERT INTO user_messages (user_id, title, content, message_type, is_read)
        SELECT 
            user_record.id,
            'Welcome to Digital Chain Bank!',
            'Your account has been successfully created. You now have access to all our banking services including crypto trading, currency exchange, and secure transfers.',
            'success',
            false
        WHERE NOT EXISTS (
            SELECT 1 FROM user_messages 
            WHERE user_id = user_record.id 
            AND title = 'Welcome to Digital Chain Bank!'
        );

        -- Insert account verification message
        INSERT INTO user_messages (user_id, title, content, message_type, is_read)
        SELECT 
            user_record.id,
            'Account Verification Complete',
            'Your identity has been verified and your account is now fully active. You can now access all premium features.',
            'info',
            false
        WHERE NOT EXISTS (
            SELECT 1 FROM user_messages 
            WHERE user_id = user_record.id 
            AND title = 'Account Verification Complete'
        );
    END LOOP;
END $$;

-- Create function to automatically create welcome messages for new users
CREATE OR REPLACE FUNCTION create_welcome_messages()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert welcome message
    INSERT INTO user_messages (user_id, title, content, message_type, is_read)
    VALUES (
        NEW.id,
        'Welcome to Digital Chain Bank!',
        'Your account has been successfully created. You now have access to all our banking services including crypto trading, currency exchange, and secure transfers.',
        'success',
        false
    );

    -- Insert account setup message
    INSERT INTO user_messages (user_id, title, content, message_type, is_read)
    VALUES (
        NEW.id,
        'Complete Your Account Setup',
        'To get started, please verify your identity and set up your security preferences in the Account Settings.',
        'info',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS trigger_create_welcome_messages ON auth.users;
CREATE TRIGGER trigger_create_welcome_messages
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_welcome_messages();

-- Grant necessary permissions
GRANT ALL ON user_messages TO authenticated;
GRANT ALL ON user_messages TO service_role;

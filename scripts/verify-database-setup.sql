-- Check if all tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      'profiles', 'crypto_balances', 'euro_balances', 'cad_balances', 'usd_balances',
      'transactions', 'transfers', 'deposits', 'payments', 'cards', 
      'crypto_transactions', 'external_accounts'
    ) THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'profiles', 'crypto_balances', 'euro_balances', 'cad_balances', 'usd_balances',
    'transactions', 'transfers', 'deposits', 'payments', 'cards', 
    'crypto_transactions', 'external_accounts'
  )
ORDER BY table_name;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name = 'on_auth_user_created';

-- Test functions
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('generate_client_id', 'generate_card_number', 'handle_new_user');

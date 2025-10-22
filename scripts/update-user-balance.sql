-- Example: Update Kevin's Euro balance to 1000
-- First, find Kevin's user ID
SELECT id, full_name, email, client_id 
FROM profiles 
WHERE full_name ILIKE '%kevin%' OR email ILIKE '%kevin%';

-- Update Kevin's Euro balance (replace USER_ID with actual ID from above query)
-- UPDATE euro_balances 
-- SET balance = 1000.00 
-- WHERE user_id = 'USER_ID_HERE';

-- Example for testing - Update a specific user's balances
-- Replace 'your-user-id-here' with the actual user ID
/*
UPDATE crypto_balances SET balance = 2.5 WHERE user_id = 'your-user-id-here';
UPDATE euro_balances SET balance = 1000.00 WHERE user_id = 'your-user-id-here';
UPDATE cad_balances SET balance = 1500.00 WHERE user_id = 'your-user-id-here';
UPDATE usd_balances SET balance = 800.00 WHERE user_id = 'your-user-id-here';
*/

-- Add a transaction record for the balance update
/*
INSERT INTO transactions (user_id, type, amount, currency, description, platform, status)
VALUES (
  'your-user-id-here',
  'Admin Adjustment',
  1000.00,
  'EUR',
  'Balance adjustment by administrator',
  'Admin Panel',
  'Successful'
);
*/

-- View all users and their current balances
SELECT 
  p.full_name,
  p.email,
  p.client_id,
  COALESCE(cb.balance, 0) as crypto_balance,
  COALESCE(eb.balance, 0) as euro_balance,
  COALESCE(cadb.balance, 0) as cad_balance,
  COALESCE(ub.balance, 0) as usd_balance
FROM profiles p
LEFT JOIN crypto_balances cb ON p.id = cb.user_id
LEFT JOIN euro_balances eb ON p.id = eb.user_id
LEFT JOIN cad_balances cadb ON p.id = cadb.user_id
LEFT JOIN usd_balances ub ON p.id = ub.user_id
ORDER BY p.full_name;

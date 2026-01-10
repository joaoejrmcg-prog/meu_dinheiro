-- Check the recent expense and its account linkage
SELECT id, description, amount, type, account_id, is_paid 
FROM movements 
WHERE type = 'expense' 
ORDER BY created_at DESC 
LIMIT 5;

-- Check available accounts
SELECT id, name, type, balance 
FROM accounts;

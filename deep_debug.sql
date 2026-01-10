-- =====================================================
-- Deep Debug: Accounts and Movements
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. List all accounts with their IDs, types, and balances
SELECT 'Accounts' as table_name, id, name, type, balance 
FROM accounts;

-- 2. List the specific expense again to see if account_id is still null
SELECT 'Expense' as table_name, id, description, amount, account_id 
FROM movements 
WHERE description ILIKE '%almoço%';

-- 3. Check if there is ANY account with type 'wallet'
SELECT 'Wallet Check' as table_name, count(*) as wallet_count 
FROM accounts 
WHERE type = 'wallet';

-- 4. Manually calculate what the balance SHOULD be for each account
SELECT 
    a.name,
    a.balance as current_balance,
    COALESCE(SUM(CASE WHEN m.type = 'income' THEN m.amount ELSE -m.amount END), 0) as calculated_from_movements
FROM accounts a
LEFT JOIN movements m ON m.account_id = a.id
GROUP BY a.id, a.name, a.balance;

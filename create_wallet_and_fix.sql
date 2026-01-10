-- =====================================================
-- Create Missing Wallet and Fix Orphans
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Create 'Carteira' account if it doesn't exist
INSERT INTO accounts (user_id, name, type, balance)
SELECT 
  auth.uid(), 
  'Carteira', 
  'wallet', 
  0
FROM auth.users
WHERE id = auth.uid()
AND NOT EXISTS (SELECT 1 FROM accounts WHERE type = 'wallet' AND user_id = auth.uid());

-- 2. Link orphaned movements to the (now existing) 'wallet' account
WITH wallet_account AS (
  SELECT id FROM accounts WHERE type = 'wallet' AND user_id = auth.uid() LIMIT 1
)
UPDATE movements
SET account_id = (SELECT id FROM wallet_account)
WHERE account_id IS NULL AND type IN ('income', 'expense') AND user_id = auth.uid();

-- 3. Recalculate balances (Final Fix)
UPDATE public.accounts SET balance = 0 WHERE user_id = auth.uid();

WITH calculated_balances AS (
  SELECT 
    account_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total
  FROM public.movements
  WHERE is_paid = true AND account_id IS NOT NULL AND (type = 'income' OR type = 'expense') AND user_id = auth.uid()
  GROUP BY account_id
)
UPDATE public.accounts
SET balance = cb.total
FROM calculated_balances cb
WHERE public.accounts.id = cb.account_id;

-- 4. Verify
SELECT name, balance FROM accounts WHERE user_id = auth.uid();

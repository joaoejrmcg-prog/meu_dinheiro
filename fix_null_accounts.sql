-- =====================================================
-- Fix Orphaned Movements (Null Account ID)
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Update orphaned movements to use the 'wallet' (Carteira) account
WITH wallet_account AS (
  SELECT id FROM accounts WHERE type = 'wallet' LIMIT 1
)
UPDATE movements
SET account_id = (SELECT id FROM wallet_account)
WHERE account_id IS NULL AND type IN ('income', 'expense');

-- 2. Recalculate balances again to be sure
UPDATE public.accounts SET balance = 0;

WITH calculated_balances AS (
  SELECT 
    account_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total
  FROM public.movements
  WHERE is_paid = true AND account_id IS NOT NULL AND (type = 'income' OR type = 'expense')
  GROUP BY account_id
)
UPDATE public.accounts
SET balance = cb.total
FROM calculated_balances cb
WHERE public.accounts.id = cb.account_id;

-- 3. Verify
SELECT name, balance FROM accounts;

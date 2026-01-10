-- =====================================================
-- Global Fix for Orphaned Movements
-- Execute in Supabase SQL Editor
-- Works for ALL users, does not rely on auth.uid()
-- =====================================================

-- 1. Link orphaned movements to the user's 'wallet' account
UPDATE public.movements m
SET account_id = a.id
FROM public.accounts a
WHERE m.account_id IS NULL 
  AND m.user_id = a.user_id 
  AND a.type = 'wallet';

-- 2. Recalculate balances for ALL accounts
-- First reset to 0
UPDATE public.accounts SET balance = 0;

-- Then sum up paid movements
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

-- 3. Verify results
SELECT a.name, a.balance, m.description, m.amount 
FROM public.accounts a
JOIN public.movements m ON m.account_id = a.id
WHERE m.account_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 5;

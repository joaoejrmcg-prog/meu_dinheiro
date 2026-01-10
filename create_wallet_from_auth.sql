-- =====================================================
-- Create Wallet Directly from auth.users
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Insert Wallet for EVERY auth.user that doesn't have one
INSERT INTO public.accounts (user_id, name, type, balance)
SELECT u.id, 'Carteira', 'wallet', 0
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.user_id = u.id AND a.type = 'wallet'
);

-- 2. Now link the orphaned movement to the wallet
UPDATE public.movements m
SET account_id = a.id
FROM public.accounts a
WHERE m.account_id IS NULL 
  AND m.user_id = a.user_id 
  AND a.type = 'wallet';

-- 3. Recalculate balances
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

-- 4. Verify
SELECT 'Accounts' as table_name, * FROM public.accounts;
SELECT 'Movements' as table_name, id, description, amount, account_id FROM public.movements;

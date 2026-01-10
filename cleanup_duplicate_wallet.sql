-- =====================================================
-- Clean Up Duplicate Wallet
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Delete the wallet with 0 balance (the duplicate)
DELETE FROM public.accounts 
WHERE type = 'wallet' 
  AND balance = 0
  AND id != (
    SELECT id FROM public.accounts 
    WHERE type = 'wallet' AND balance != 0 
    LIMIT 1
  );

-- 2. If both have 0 balance, keep only the older one
DELETE FROM public.accounts a1
WHERE type = 'wallet'
  AND EXISTS (
    SELECT 1 FROM public.accounts a2 
    WHERE a2.user_id = a1.user_id 
      AND a2.type = 'wallet' 
      AND a2.created_at < a1.created_at
  );

-- 3. Verify
SELECT * FROM public.accounts WHERE type = 'wallet';

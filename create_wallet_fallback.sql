-- =====================================================
-- Create Wallet Account Manually (Fallback)
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Insert Wallet for EVERY user that has a profile but no wallet
INSERT INTO public.accounts (user_id, name, type, balance)
SELECT p.user_id, 'Carteira', 'wallet', 0
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.user_id = p.user_id AND a.type = 'wallet'
);

-- 2. Verify
SELECT 'Accounts Created' as status, COUNT(*) as total FROM public.accounts;
SELECT * FROM public.accounts;

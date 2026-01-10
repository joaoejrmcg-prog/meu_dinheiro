-- =====================================================
-- COMPLETE FIX: Triggers + Backfill for Profiles & Wallets
-- Execute in Supabase SQL Editor
-- =====================================================

-- ============================================
-- 1. ENSURE generate_referral_code EXISTS
-- ============================================
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. TRIGGER: Create Profile on Signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, referral_code)
  VALUES (NEW.id, generate_referral_code());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
AFTER INSERT ON auth.users 
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. TRIGGER: Create Wallet on Profile Creation
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_init() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.accounts (user_id, name, type, balance)
  VALUES (NEW.user_id, 'Carteira', 'wallet', 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;
CREATE TRIGGER on_profile_created_init
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_init();

-- ============================================
-- 4. BACKFILL: Create Profiles for Existing Users
-- ============================================
INSERT INTO public.profiles (user_id, referral_code)
SELECT id, generate_referral_code()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles);

-- ============================================
-- 5. BACKFILL: Create Wallets for Existing Users
-- ============================================
INSERT INTO public.accounts (user_id, name, type, balance)
SELECT u.id, 'Carteira', 'wallet', 0
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a 
    WHERE a.user_id = u.id AND a.type = 'wallet'
);

-- ============================================
-- 6. VERIFY
-- ============================================
SELECT 'Profiles' as table_name, COUNT(*) as total FROM profiles;
SELECT 'Wallets' as table_name, COUNT(*) as total FROM accounts WHERE type = 'wallet';

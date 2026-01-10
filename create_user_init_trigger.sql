-- =====================================================
-- Automate User Initialization (Wallet & Categories)
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Create the Initialization Function
CREATE OR REPLACE FUNCTION public.handle_new_user_init()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Create Default 'Carteira' Account
  INSERT INTO public.accounts (user_id, name, type, balance)
  VALUES (NEW.user_id, 'Carteira', 'wallet', 0)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger on profiles
DROP TRIGGER IF EXISTS on_profile_created_init ON public.profiles;
CREATE TRIGGER on_profile_created_init
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_init();

-- 3. Backfill for existing users (just in case)
INSERT INTO public.accounts (user_id, name, type, balance)
SELECT user_id, 'Carteira', 'wallet', 0
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.user_id = p.user_id AND a.type = 'wallet'
);

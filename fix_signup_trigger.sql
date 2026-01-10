-- ============================================
-- FIX: Handle New User & Referrals
-- ============================================

-- 1. Ensure generate_referral_code exists
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
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

-- 2. Update handle_new_user to process referral_code from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  referrer_id UUID;
  referral_code_input TEXT;
  new_referral_code TEXT;
  done BOOLEAN := FALSE;
BEGIN
  -- Get referral code from metadata (if any)
  referral_code_input := NEW.raw_user_meta_data->>'referral_code';

  -- Find referrer if code exists
  IF referral_code_input IS NOT NULL AND referral_code_input <> '' THEN
    SELECT user_id INTO referrer_id FROM public.profiles WHERE referral_code = referral_code_input;
  END IF;

  -- Retry loop for unique referral code generation
  WHILE NOT done LOOP
    new_referral_code := generate_referral_code();
    
    BEGIN
      INSERT INTO public.profiles (user_id, referral_code, referred_by, referred_by_code)
      VALUES (
        NEW.id,
        new_referral_code,
        referrer_id,
        referral_code_input
      );
      done := TRUE;
    EXCEPTION WHEN unique_violation THEN
      -- If code exists, loop runs again
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

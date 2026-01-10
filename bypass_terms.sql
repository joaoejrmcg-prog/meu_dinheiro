-- Ensure profiles table exists (it should, but let's be safe)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_by_code TEXT,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mark Terms as Accepted for ALL users
UPDATE public.profiles
SET terms_accepted_at = NOW()
WHERE terms_accepted_at IS NULL;

-- ============================================
-- INITIAL SCHEMA MIGRATION
-- Consolidates all previous SQL scripts into a single baseline.
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_by_code TEXT,
  cpf TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_cpf_format CHECK (cpf IS NULL OR (cpf ~ '^\d{11}$'))
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON profiles(cpf);

-- Function to generate referral code
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

-- Trigger for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, referral_code)
  VALUES (NEW.id, generate_referral_code());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. SUBSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('vip', 'pro', 'light', 'trial')),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'overdue', 'canceled', 'trial')),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  asaas_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can manage subscriptions" ON subscriptions FOR ALL USING (true);

-- Trigger for new user subscription
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'trial', NOW() + INTERVAL '7 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- ============================================
-- 3. DAILY USAGE
-- ============================================
CREATE TABLE IF NOT EXISTS daily_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage" ON daily_usage FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can manage usage" ON daily_usage FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);

-- ============================================
-- 4. REFERRAL REWARDS
-- ============================================
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_days INTEGER NOT NULL DEFAULT 30,
  reward_granted BOOLEAN DEFAULT FALSE,
  payment_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referred_user_id)
);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rewards" ON referral_rewards FOR SELECT USING (referrer_id = auth.uid());
CREATE POLICY "Service role can insert rewards" ON referral_rewards FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update rewards" ON referral_rewards FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_granted ON referral_rewards(reward_granted);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id);

-- ============================================
-- 5. CLIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients" ON clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own clients" ON clients FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own clients" ON clients FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own clients" ON clients FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- ============================================
-- 6. APPOINTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date_time TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own appointments" ON appointments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own appointments" ON appointments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own appointments" ON appointments FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own appointments" ON appointments FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(date_time);

-- ============================================
-- 7. FINANCIAL RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    payment_method TEXT,
    status TEXT CHECK (status IN ('paid', 'pending')) DEFAULT 'paid',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own financial records" ON financial_records FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own financial records" ON financial_records FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own financial records" ON financial_records FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own financial records" ON financial_records FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_financial_records_user_id ON financial_records(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_client_id ON financial_records(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_due_date ON financial_records(due_date);

-- ============================================
-- 8. SUPPORT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reply TEXT,
    reply_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own support messages" ON support_messages FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own support messages" ON support_messages FOR INSERT WITH CHECK (user_id = auth.uid());
-- Only service role (admin) should update support messages (reply)
CREATE POLICY "Service role can update support messages" ON support_messages FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);

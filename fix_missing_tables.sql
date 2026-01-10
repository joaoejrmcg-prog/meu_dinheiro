-- =====================================================
-- FIX: Adicionar colunas faltantes e criar subscriptions
-- Execute no Supabase SQL Editor
-- =====================================================

-- 1. Adicionar colunas faltantes em profiles (ignora se já existir)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB;

-- 2. Criar tabela subscriptions (se não existir)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'trial',
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  asaas_subscription_id TEXT,
  asaas_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. Habilitar RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas (ignorar erros se já existirem)
DROP POLICY IF EXISTS "Users can view their own subscription" ON subscriptions;
CREATE POLICY "Users can view their own subscription" ON subscriptions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON subscriptions FOR ALL USING (true);

-- 5. Inserir subscription para usuários que não têm
INSERT INTO subscriptions (user_id, plan, status, current_period_end)
SELECT 
    id,
    'trial',
    'trial',
    NOW() + INTERVAL '30 days'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM subscriptions);

-- 6. Atualizar profiles existentes
UPDATE profiles SET onboarding_complete = TRUE, terms_accepted_at = NOW() 
WHERE terms_accepted_at IS NULL;

-- Verificar
SELECT 'Subscriptions:' as tabela, COUNT(*) as total FROM subscriptions;

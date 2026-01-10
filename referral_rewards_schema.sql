-- Tabela para rastrear recompensas de indicação
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

-- Habilitar RLS
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas suas próprias recompensas
CREATE POLICY "Users can view their own rewards"
  ON referral_rewards FOR SELECT
  USING (referrer_id = auth.uid());

-- Política: Sistema pode inserir recompensas
CREATE POLICY "Service role can insert rewards"
  ON referral_rewards FOR INSERT
  WITH CHECK (true);

-- Política: Sistema pode atualizar recompensas
CREATE POLICY "Service role can update rewards"
  ON referral_rewards FOR UPDATE
  USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_granted ON referral_rewards(reward_granted);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id);

-- Adicionar campo referred_by_code à tabela profiles (se não existir)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Comentários para documentação
COMMENT ON TABLE referral_rewards IS 'Rastreia recompensas concedidas por indicações';
COMMENT ON COLUMN referral_rewards.referrer_id IS 'Usuário que fez a indicação';
COMMENT ON COLUMN referral_rewards.referred_user_id IS 'Usuário que foi indicado';
COMMENT ON COLUMN referral_rewards.reward_days IS 'Quantidade de dias concedidos como recompensa';
COMMENT ON COLUMN referral_rewards.reward_granted IS 'Se a recompensa já foi concedida';
COMMENT ON COLUMN referral_rewards.payment_confirmed_at IS 'Data/hora em que o pagamento foi confirmado';

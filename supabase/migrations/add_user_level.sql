-- Adiciona campo user_level à tabela profiles
-- Nível 0 = Tutorial, 1 = Carteira, 2 = Organização, 3 = Crédito, 4 = Planejamento

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_level INTEGER DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.user_level IS 'Nível do usuário: 0=Tutorial, 1=Carteira, 2=Organização, 3=Crédito, 4=Planejamento';

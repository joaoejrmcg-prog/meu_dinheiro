-- Adicionar coluna para contar ações do nível (para progressão gamificada)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS level_actions_count INTEGER DEFAULT 0;

-- Comentário
COMMENT ON COLUMN profiles.level_actions_count IS 'Contador de ações bem-sucedidas para progressão de nível';

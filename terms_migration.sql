-- Adicionar coluna para rastrear aceite dos termos
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Comentário para documentação
COMMENT ON COLUMN profiles.terms_accepted_at IS 'Data e hora em que o usuário aceitou os Termos de Uso';

-- Adiciona campo para controlar se tutorial do nível atual foi completado
-- Se false (pulou ou não fez), precisa de 10 interações para ir ao próximo nível
-- Se true (completou), precisa só de 2 interações

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_level_tutorial_completed BOOLEAN DEFAULT true;

-- Comentário explicativo
COMMENT ON COLUMN profiles.current_level_tutorial_completed IS 
'Indica se o usuário completou (true) ou pulou (false) o tutorial do nível atual. Se pulou, precisa de 10 interações para desbloquear próximo nível.';

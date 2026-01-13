-- ============================================
-- ETAPA 2: RECRIAR O TRIGGER (COM PROTEÇÃO)
-- Execute DEPOIS de confirmar que a Etapa 1 funcionou
-- ============================================

-- Primeiro, verificar o estado atual dos triggers
SELECT 
    tgname AS trigger_name,
    tgenabled AS enabled_status,
    -- 'O' = ORIGIN, 'D' = DISABLED, 'R' = REPLICA, 'A' = ALWAYS
    CASE tgenabled 
        WHEN 'O' THEN '✅ Ativo (Origin)'
        WHEN 'A' THEN '✅ Ativo (Always)'
        WHEN 'D' THEN '❌ DESABILITADO'
        WHEN 'R' THEN '⚠️ Replica only'
        ELSE tgenabled
    END AS status_readable
FROM pg_trigger
WHERE tgname LIKE '%subscription%' OR tgname LIKE '%user_created%';

-- Recriar a função com proteção contra duplicatas
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription() 
RETURNS TRIGGER AS $$
BEGIN
  -- ON CONFLICT: Se já existir subscription pra esse user, não faz nada
  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'trial', NOW() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Se der qualquer erro, loga mas não bloqueia a criação do usuário
    RAISE WARNING 'Erro ao criar subscription para user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dropar e recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;

CREATE TRIGGER on_auth_user_created_subscription 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_subscription();

-- Verificar que o trigger foi criado
SELECT 
    tgname AS trigger_name,
    CASE tgenabled 
        WHEN 'O' THEN '✅ Ativo'
        WHEN 'A' THEN '✅ Ativo (Always)'
        WHEN 'D' THEN '❌ DESABILITADO'
        ELSE tgenabled
    END AS status
FROM pg_trigger
WHERE tgname = 'on_auth_user_created_subscription';

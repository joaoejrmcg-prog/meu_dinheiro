-- ============================================
-- FIX: Subscriptions não sendo criadas para novos usuários
-- Execute no SQL Editor do Supabase
-- ============================================

-- 1. Verificar se o trigger existe
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name,
    tgenabled AS is_enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE '%subscription%';

-- 2. Recriar a função (caso tenha sido modificada)
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'trial', NOW() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO NOTHING; -- Evita erro se já existir
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Dropar e recriar o trigger para garantir que está ativo
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription 
  AFTER INSERT ON auth.users 
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_subscription();

-- 4. BACKFILL: Criar subscriptions para usuários que não têm
INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
SELECT 
    u.id,
    'trial',
    'trial',
    NOW() + INTERVAL '7 days'
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
WHERE s.id IS NULL;

-- 5. Verificar resultado
SELECT 
    'Total usuários' AS metric,
    (SELECT COUNT(*) FROM auth.users)::TEXT AS value
UNION ALL
SELECT 
    'Usuários COM subscription',
    (SELECT COUNT(*) FROM public.subscriptions)::TEXT
UNION ALL
SELECT 
    'Usuários SEM subscription',
    (SELECT COUNT(*) FROM auth.users u LEFT JOIN public.subscriptions s ON u.id = s.user_id WHERE s.id IS NULL)::TEXT;

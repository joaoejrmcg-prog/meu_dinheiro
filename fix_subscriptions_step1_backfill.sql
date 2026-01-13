-- ============================================
-- ETAPA 1: BACKFILL SEGURO (APENAS INSERE O QUE FALTA)
-- Execute PRIMEIRO este bloco
-- ============================================

-- Visualizar primeiro (SELECT apenas - não modifica nada)
SELECT 
    u.id AS user_id,
    u.email,
    CASE WHEN s.id IS NOT NULL THEN '✅ TEM' ELSE '❌ FALTA' END AS subscription_status
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
ORDER BY u.created_at;

-- Se estiver tudo certo, execute este INSERT
-- Só adiciona para quem NÃO tem, não mexe em quem já tem
INSERT INTO public.subscriptions (user_id, plan, status, current_period_end)
SELECT 
    u.id,
    'trial',
    'trial',
    NOW() + INTERVAL '7 days'
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id
WHERE s.id IS NULL;

-- Verificar resultado
SELECT 
    u.email,
    s.plan,
    s.status,
    s.current_period_end
FROM auth.users u
JOIN public.subscriptions s ON u.id = s.user_id
ORDER BY u.created_at;

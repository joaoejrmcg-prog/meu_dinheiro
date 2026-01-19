-- ⚠️ RESET COMPLETO - MEU DINHEIRO IA ⚠️
-- Execute no Supabase SQL Editor

DO $$
DECLARE
    target_user_id UUID := '39ecfa99-00c2-4c0a-b307-6ba93621889b';
BEGIN
    -- Tabelas financeiras principais
    DELETE FROM movements WHERE user_id = target_user_id;
    DELETE FROM recurrences WHERE user_id = target_user_id;
    DELETE FROM accounts WHERE user_id = target_user_id;
    DELETE FROM credit_cards WHERE user_id = target_user_id;
    
    -- Tabelas auxiliares
    DELETE FROM notifications WHERE user_id = target_user_id;
    DELETE FROM daily_usage WHERE user_id = target_user_id;
    
    RAISE NOTICE '✅ Todos os dados financeiros apagados!';
END $$;

-- Verificar se limpou
SELECT 'recurrences' as tabela, COUNT(*) as total FROM recurrences WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b'
UNION ALL
SELECT 'movements', COUNT(*) FROM movements WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b'
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b';

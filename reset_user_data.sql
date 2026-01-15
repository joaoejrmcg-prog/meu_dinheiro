-- ⚠️ SCRIPT PARA RESETAR DADOS FINANCEIROS DO USUÁRIO ⚠️
-- Execute no Supabase SQL Editor
-- Isso vai APAGAR todos os dados de teste e zerar os saldos

-- Substitua pelo seu UID se necessário
DO $$
DECLARE
    target_user_id UUID := '39ecfa99-00c2-4c0a-b307-6ba93621889b';
BEGIN
    -- 1. Apagar todos os movimentos
    DELETE FROM movements WHERE user_id = target_user_id;
    RAISE NOTICE 'Movimentos apagados';

    -- 2. Apagar todas as recorrências
    DELETE FROM recurrences WHERE user_id = target_user_id;
    RAISE NOTICE 'Recorrências apagadas';

    -- 3. Apagar notificações
    DELETE FROM notifications WHERE user_id = target_user_id;
    RAISE NOTICE 'Notificações apagadas';

    -- 4. Resetar saldos das contas para zero (mantém as contas)
    UPDATE accounts 
    SET balance = 0, initial_balance = 0 
    WHERE user_id = target_user_id;
    RAISE NOTICE 'Saldos resetados para zero';

    -- 5. Resetar nível do usuário para 1 (opcional - descomente se quiser)
    -- UPDATE profiles SET user_level = 1 WHERE id = target_user_id;
    -- RAISE NOTICE 'Nível resetado para 1';

    RAISE NOTICE '✅ Dados limpos com sucesso!';
END $$;

-- Verificar resultado
SELECT 'Movimentos restantes:' as info, COUNT(*) as total FROM movements WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b'
UNION ALL
SELECT 'Recorrências restantes:', COUNT(*) FROM recurrences WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b'
UNION ALL
SELECT 'Notificações restantes:', COUNT(*) FROM notifications WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b';

-- Ver contas com saldos zerados
SELECT name, type, balance, initial_balance 
FROM accounts 
WHERE user_id = '39ecfa99-00c2-4c0a-b307-6ba93621889b';

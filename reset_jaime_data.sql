-- ⚠️ SCRIPT PARA REMOVER DADOS DO USUÁRIO JAIME (V2 - Seguro) ⚠️
-- Execute isso no SQL Editor do Supabase

DO $$
DECLARE
    target_email TEXT := 'jaimerodriguesjunior@outlook.com';
    target_user_id UUID;
BEGIN
    -- 1. Buscar o ID do usuário pelo email
    SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

    -- Validar se encontrou
    IF target_user_id IS NULL THEN
        RAISE NOTICE '❌ Usuário % não encontrado!', target_email;
        RETURN;
    END IF;

    RAISE NOTICE '🚀 Iniciando limpeza para o usuário: % (ID: %)', target_email, target_user_id;

    -- 2. Apagar dados (Com verificação se a tabela existe para evitar erros)

    -- Tabelas Core (Geralmente existem)
    DELETE FROM public.movements WHERE user_id = target_user_id;
    DELETE FROM public.recurrences WHERE user_id = target_user_id;
    DELETE FROM public.loans WHERE user_id = target_user_id;
    DELETE FROM public.reserves WHERE user_id = target_user_id;
    
    -- Tabela Monthly Closings (Verificar existência)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'monthly_closings') THEN
        EXECUTE 'DELETE FROM public.monthly_closings WHERE user_id = $1' USING target_user_id;
    END IF;

    -- Tabela Financial Records (Causou erro anteriormente)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'financial_records') THEN
        EXECUTE 'DELETE FROM public.financial_records WHERE user_id = $1' USING target_user_id;
    END IF;
    
    -- Ativos
    DELETE FROM public.credit_cards WHERE user_id = target_user_id;
    DELETE FROM public.accounts WHERE user_id = target_user_id;
    
    -- Categorias
    DELETE FROM public.categories WHERE user_id = target_user_id;

    -- Funcionalidades Extras
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        DELETE FROM public.notifications WHERE user_id = target_user_id;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'advisor_notifications') THEN
        DELETE FROM public.advisor_notifications WHERE user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_usage') THEN
        DELETE FROM public.daily_usage WHERE user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'appointments') THEN
        EXECUTE 'DELETE FROM public.appointments WHERE user_id = $1' USING target_user_id;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
        EXECUTE 'DELETE FROM public.clients WHERE user_id = $1' USING target_user_id;
    END IF;
    
    -- Suporte
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_messages') THEN
        DELETE FROM public.support_messages WHERE user_id = target_user_id;
    END IF;

    RAISE NOTICE '✅ Limpeza concluída com sucesso para %!', target_email;
    
END $$;

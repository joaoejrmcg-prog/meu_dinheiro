-- =====================================================
-- DIAGNÓSTICO: Verificação da Fase 1 (Database)
-- Execute no Supabase SQL Editor e cole o resultado aqui
-- =====================================================

-- 1. Listar todas as tabelas existentes no schema public
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Verificar estrutura da tabela 'movements' (se existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'movements'
ORDER BY ordinal_position;

-- 3. Verificar estrutura da tabela 'accounts' (se existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'accounts'
ORDER BY ordinal_position;

-- 4. Verificar estrutura da tabela 'reserves' (se existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'reserves'
ORDER BY ordinal_position;

-- 5. Verificar estrutura da tabela 'loans' (se existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loans'
ORDER BY ordinal_position;

-- 6. Verificar estrutura da tabela 'profiles' (se existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

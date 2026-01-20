-- Script para listar triggers nas tabelas loans e movements
-- Rode isso no SQL Editor do Supabase para ver o que está causando a duplicação

SELECT 
    event_object_table as "Tabela", 
    trigger_name as "Nome do Trigger", 
    action_timing as "Momento", 
    event_manipulation as "Evento"
FROM information_schema.triggers
WHERE event_object_table IN ('loans', 'movements')
ORDER BY event_object_table, trigger_name;

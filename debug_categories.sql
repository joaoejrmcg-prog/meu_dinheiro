-- =====================================================
-- Debug Categories and Movements
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Check expenses for Jan 2026
SELECT 
    id, 
    date, 
    description, 
    amount, 
    type, 
    category, 
    created_at
FROM movements
WHERE 
    type = 'expense' 
    AND date >= '2026-01-01' 
    AND date <= '2026-01-31'
ORDER BY date DESC;

-- 2. Check all distinct categories currently in use
SELECT DISTINCT category FROM movements;

-- 3. Check if there are any movements with null category
SELECT count(*) as sem_categoria 
FROM movements 
WHERE category IS NULL OR category = '';

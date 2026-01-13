-- =====================================================
-- Add due_date column to movements table
-- Execute in Supabase SQL Editor
-- =====================================================

-- Add due_date column (nullable, for future payment tracking)
ALTER TABLE public.movements 
ADD COLUMN IF NOT EXISTS due_date DATE NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.movements.due_date IS 'Data de vencimento para pagamentos futuros (compras a prazo)';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'movements' 
AND column_name = 'due_date';

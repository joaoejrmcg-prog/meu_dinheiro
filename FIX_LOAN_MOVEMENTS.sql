-- Fix existing loan movements that were created without is_loan flag
-- This updates movements that have "Empréstimo" in the description
-- but is_loan = false

UPDATE public.movements
SET is_loan = true
WHERE 
    is_loan = false
    AND (
        description ILIKE 'Empréstimo%'
        OR description ILIKE '%emprestado%'
        OR description ILIKE 'Pagamento: %'
        OR description ILIKE 'Recebimento: %'
    );

-- Verify the fix
SELECT id, description, amount, type, is_loan 
FROM public.movements 
WHERE description ILIKE '%empréstimo%' 
   OR description ILIKE '%emprestado%'
   OR description ILIKE 'Pagamento: %'
   OR description ILIKE 'Recebimento: %'
ORDER BY created_at DESC;

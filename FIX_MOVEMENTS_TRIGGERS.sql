-- =====================================================
-- FIX DEFINITIVO: Remove TODOS os triggers de movements
-- =====================================================

-- 1. Remover TODOS os triggers da tabela movements (sem exceção)
-- Isso vai eliminar qualquer trigger oculto que esteja atualizando a tabela loans indevidamente
DO $$ 
DECLARE 
    t text; 
BEGIN 
    FOR t IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'movements' 
    LOOP 
        EXECUTE 'DROP TRIGGER IF EXISTS ' || t || ' ON public.movements'; 
    END LOOP; 
END $$;

-- 2. Recriar APENAS o trigger de saldo de conta (essencial e seguro)
CREATE OR REPLACE FUNCTION public.handle_new_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF (TG_OP = 'INSERT') THEN
    IF NEW.is_paid = true AND NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  
  -- Handle DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.is_paid = true AND OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;

  -- Handle UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert OLD effect
    IF OLD.is_paid = true AND OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      END IF;
    END IF;
    
    -- Apply NEW effect
    IF NEW.is_paid = true AND NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_movement_change
AFTER INSERT OR UPDATE OR DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.handle_new_movement();

-- 3. Corrigir os empréstimos bugados (onde remaining é o dobro do total)
UPDATE public.loans 
SET remaining_amount = total_amount 
WHERE remaining_amount = total_amount * 2;

-- 4. Recalcular saldos (para garantir)
UPDATE public.accounts SET balance = initial_balance;

WITH calculated_balances AS (
  SELECT 
    account_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total
  FROM public.movements
  WHERE is_paid = true AND account_id IS NOT NULL AND (type = 'income' OR type = 'expense')
  GROUP BY account_id
)
UPDATE public.accounts
SET balance = balance + cb.total
FROM calculated_balances cb
WHERE public.accounts.id = cb.account_id;

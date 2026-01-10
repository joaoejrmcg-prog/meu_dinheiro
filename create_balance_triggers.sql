-- =====================================================
-- Create Triggers to Auto-Update Account Balances
-- Execute in Supabase SQL Editor
-- =====================================================

-- 1. Create the Trigger Function
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

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS on_movement_change ON public.movements;
CREATE TRIGGER on_movement_change
AFTER INSERT OR UPDATE OR DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.handle_new_movement();

-- 3. One-time Fix: Recalculate all balances
-- Reset all balances to 0
UPDATE public.accounts SET balance = 0;

-- Sum all PAID movements per account and update
WITH calculated_balances AS (
  SELECT 
    account_id,
    SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as total
  FROM public.movements
  WHERE is_paid = true AND account_id IS NOT NULL AND (type = 'income' OR type = 'expense')
  GROUP BY account_id
)
UPDATE public.accounts
SET balance = cb.total
FROM calculated_balances cb
WHERE public.accounts.id = cb.account_id;

-- 4. Verify results
SELECT name, balance FROM public.accounts;

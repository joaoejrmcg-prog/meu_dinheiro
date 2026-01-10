-- =====================================================
-- Recalculate Account Balances
-- This script recalculates the balance for all accounts
-- based on initial_balance + all movements
-- Execute in Supabase SQL Editor
-- =====================================================

-- Step 1: Reset balance to initial_balance
UPDATE public.accounts
SET balance = COALESCE(initial_balance, 0);

-- Step 2: Add all income movements
UPDATE public.accounts a
SET balance = balance + COALESCE((
    SELECT SUM(m.amount)
    FROM public.movements m
    WHERE m.account_id = a.id
    AND m.type = 'income'
), 0);

-- Step 3: Subtract all expense movements
UPDATE public.accounts a
SET balance = balance - COALESCE((
    SELECT SUM(m.amount)
    FROM public.movements m
    WHERE m.account_id = a.id
    AND m.type = 'expense'
), 0);

-- Step 4: Subtract all outgoing transfers
UPDATE public.accounts a
SET balance = balance - COALESCE((
    SELECT SUM(m.amount)
    FROM public.movements m
    WHERE m.account_id = a.id
    AND m.type = 'transfer'
), 0);

-- Verify
SELECT name, initial_balance, balance FROM public.accounts;

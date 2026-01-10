-- Add initial_balance column to accounts table
-- This represents the starting balance when the account was created
-- It is NOT treated as income, but as a "previous month carry-over"

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(12,2) DEFAULT 0.00;

-- Backfill existing accounts: set initial_balance = current balance
-- This is a one-time operation for existing data
UPDATE public.accounts 
SET initial_balance = balance 
WHERE initial_balance IS NULL OR initial_balance = 0;

-- Add comment for documentation
COMMENT ON COLUMN public.accounts.initial_balance IS 'Starting balance when account was created. Used for historical balance calculations. Not counted as income.';

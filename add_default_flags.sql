-- Add is_default column to accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Add is_default column to credit_cards
ALTER TABLE public.credit_cards 
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Create partial unique index to ensure only one default account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_user_default 
ON public.accounts (user_id) 
WHERE is_default = TRUE;

-- Create partial unique index to ensure only one default card per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_cards_user_default 
ON public.credit_cards (user_id) 
WHERE is_default = TRUE;

-- Function to set default account
CREATE OR REPLACE FUNCTION set_default_account(account_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from the account
  SELECT user_id INTO v_user_id FROM public.accounts WHERE id = account_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Reset all accounts for this user to false
  UPDATE public.accounts 
  SET is_default = FALSE 
  WHERE user_id = v_user_id;

  -- Set the specific account to true
  UPDATE public.accounts 
  SET is_default = TRUE 
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set default card
CREATE OR REPLACE FUNCTION set_default_card(card_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from the card
  SELECT user_id INTO v_user_id FROM public.credit_cards WHERE id = card_id;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Card not found';
  END IF;

  -- Reset all cards for this user to false
  UPDATE public.credit_cards 
  SET is_default = FALSE 
  WHERE user_id = v_user_id;

  -- Set the specific card to true
  UPDATE public.credit_cards 
  SET is_default = TRUE 
  WHERE id = card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: Set 'Carteira' as default for existing users who have it
UPDATE public.accounts
SET is_default = TRUE
WHERE name = 'Carteira' 
  AND type = 'wallet'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts a2 
    WHERE a2.user_id = public.accounts.user_id 
    AND a2.is_default = TRUE
  );

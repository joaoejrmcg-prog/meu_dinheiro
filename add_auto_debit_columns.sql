-- Migration: Add auto-debit support to recurrences table
-- Date: 2026-01-17
-- Description: Adds is_auto_debit and variable_amount columns for automatic bank debits

-- Add is_auto_debit column
ALTER TABLE recurrences ADD COLUMN IF NOT EXISTS is_auto_debit BOOLEAN DEFAULT false;

-- Add variable_amount column (for bills that vary each month like electricity)
ALTER TABLE recurrences ADD COLUMN IF NOT EXISTS variable_amount BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN recurrences.is_auto_debit IS 'Indicates the bank automatically debits this bill on due date';
COMMENT ON COLUMN recurrences.variable_amount IS 'Indicates the amount varies each month (e.g., electricity bill)';

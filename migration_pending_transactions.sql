-- Add status and due_date columns to financial_records
ALTER TABLE financial_records 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('paid', 'pending')) DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Update existing records to be 'paid' (since they were created before this feature)
UPDATE financial_records SET status = 'paid' WHERE status IS NULL;

-- Comment on columns
COMMENT ON COLUMN financial_records.status IS 'Status da transação: paid (pago) ou pending (pendente)';
COMMENT ON COLUMN financial_records.due_date IS 'Data de vencimento para contas a pagar/receber';

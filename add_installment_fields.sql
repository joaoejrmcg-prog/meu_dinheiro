-- Adiciona campos para suporte a parcelamentos na tabela movements
-- Executar no Supabase antes de testar a funcionalidade de parcelamentos

-- 1. installment_group_id: Agrupa todas as parcelas de uma mesma compra
--    Permite consultar "todas as parcelas da TV" ou "quanto falta pagar"
ALTER TABLE movements 
ADD COLUMN IF NOT EXISTS installment_group_id UUID DEFAULT NULL;

-- 2. Garante que installments_current e installments_total existem (já existem no schema original)
-- Apenas para compatibilidade, caso a tabela seja mais nova:
ALTER TABLE movements 
ADD COLUMN IF NOT EXISTS installments_current INTEGER DEFAULT 1;

ALTER TABLE movements 
ADD COLUMN IF NOT EXISTS installments_total INTEGER DEFAULT 1;

-- Índice para melhorar consultas de parcelas agrupadas
CREATE INDEX IF NOT EXISTS idx_movements_installment_group 
ON movements(installment_group_id) 
WHERE installment_group_id IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN movements.installment_group_id IS 
'UUID que agrupa todas as parcelas de uma mesma compra parcelada. NULL para movimentos avulsos.';

COMMENT ON COLUMN movements.installments_current IS 
'Número da parcela atual (1, 2, 3...). Default 1 para movimentos avulsos.';

COMMENT ON COLUMN movements.installments_total IS 
'Total de parcelas. Default 1 para movimentos avulsos.';

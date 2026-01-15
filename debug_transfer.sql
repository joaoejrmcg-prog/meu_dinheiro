-- Debug: Investigar problema de transferência
-- Execute no Supabase SQL Editor

-- 1. Ver todas as contas do usuário com saldos
SELECT id, name, type, balance, is_default, created_at
FROM accounts
WHERE user_id = auth.uid()
ORDER BY created_at;

-- 2. Ver as últimas 15 movimentações
SELECT 
    m.id,
    m.description,
    m.amount,
    m.type,
    m.date,
    a.name as account_name,
    m.is_paid,
    m.created_at
FROM movements m
LEFT JOIN accounts a ON m.account_id = a.id
WHERE m.user_id = auth.uid()
ORDER BY m.created_at DESC
LIMIT 15;

-- 3. Ver especificamente as transferências
SELECT 
    m.id,
    m.description,
    m.amount,
    m.type,
    a.name as account_name,
    a.id as account_id,
    m.created_at
FROM movements m
LEFT JOIN accounts a ON m.account_id = a.id
WHERE m.user_id = auth.uid()
  AND m.type = 'transfer'
ORDER BY m.created_at DESC
LIMIT 10;

-- 4. Recalcular saldo da conta Itaú manualmente
-- Primeiro, encontra o ID da conta Itaú
SELECT id, name, balance FROM accounts 
WHERE user_id = auth.uid() AND LOWER(name) LIKE '%ita%';

-- 5. Calcular o que o saldo DEVERIA ser baseado nos movimentos
SELECT 
    a.id,
    a.name,
    a.balance as current_balance,
    COALESCE(SUM(CASE 
        WHEN m.type IN ('income', 'transfer') AND m.account_id = a.id AND m.is_paid = true 
        THEN m.amount 
        ELSE 0 
    END), 0) as total_incomes,
    COALESCE(SUM(CASE 
        WHEN m.type = 'expense' AND m.account_id = a.id AND m.is_paid = true 
        THEN m.amount 
        ELSE 0 
    END), 0) as total_expenses,
    -- Para transfers, precisamos considerar direção
    COALESCE(SUM(CASE 
        WHEN m.type = 'transfer' AND m.account_id = a.id AND m.description LIKE '%←%' 
        THEN m.amount 
        WHEN m.type = 'transfer' AND m.account_id = a.id AND m.description LIKE '%→%' 
        THEN -m.amount 
        ELSE 0 
    END), 0) as net_transfers
FROM accounts a
LEFT JOIN movements m ON m.account_id = a.id AND m.is_paid = true
WHERE a.user_id = auth.uid()
GROUP BY a.id, a.name, a.balance;

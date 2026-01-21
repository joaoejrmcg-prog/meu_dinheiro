-- Verificar as últimas recorrências criadas
SELECT 
    r.id,
    r.description,
    r.amount,
    r.type,
    r.due_day,
    r.credit_card_id,
    c.name as credit_card_name,
    r.created_at
FROM recurrences r
LEFT JOIN credit_cards c ON r.credit_card_id = c.id
ORDER BY r.created_at DESC
LIMIT 5;

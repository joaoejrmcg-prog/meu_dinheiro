# Plano de Teste: Empréstimos via IA

Siga estes passos no chat da aplicação para validar a nova funcionalidade.

## Cenário 1: Pegar Emprestado (Com Slot Filling)
**Objetivo:** Testar se a IA identifica a intenção, pede os dados que faltam e registra corretamente a entrada de dinheiro.

1. **Usuário:** "Peguei emprestado com o Agiota"
   - *Esperado:* IA deve perguntar o valor.
2. **Usuário:** "5000"
   - *Esperado:* IA deve perguntar se tem data de vencimento ou confirmar o registro.
   - *Resultado:* Deve criar um Empréstimo (`taken`) de 5000 e uma Receita de 5000 na conta padrão.

## Cenário 2: Pagar Dívida Parcial
**Objetivo:** Testar se o comando "Paguei X" reconhece o empréstimo e abate a dívida.

1. **Usuário:** "Paguei o Agiota, 2000"
   - *Esperado:* IA deve confirmar o pagamento de 2000 para "Agiota" e mostrar o saldo devedor restante (3000).
   - *Resultado:* Deve reduzir o `remaining_amount` do empréstimo e criar uma Despesa de 2000.

## Cenário 3: Emprestar Dinheiro (Fluxo Direto)
**Objetivo:** Testar o registro direto de um empréstimo concedido.

1. **Usuário:** "Emprestei 200 pro Pedro pra ele pagar o almoço"
   - *Esperado:* IA deve registrar imediatamente (tem valor, descrição e intenção clara).
   - *Resultado:* Deve criar um Empréstimo (`given`) de 200 e uma Despesa de 200 na conta padrão.

## Cenário 4: Receber Pagamento (Quitação)
**Objetivo:** Testar o recebimento de um empréstimo concedido.

1. **Usuário:** "O Pedro me devolveu os 200"
   - *Esperado:* IA deve identificar "Pedro", ver que ele deve 200 e registrar a quitação.
   - *Resultado:* Deve zerar o `remaining_amount` do empréstimo do Pedro e criar uma Receita de 200.

## Cenário 5: Consulta de Saldo Real (Opcional)
**Objetivo:** Verificar se o saldo da conta reflete essas movimentações.

1. **Usuário:** "Qual meu saldo atual?"
   - *Esperado:* O saldo deve considerar: +5000 (agiota) -2000 (pgto agiota) -200 (pedro) +200 (pgto pedro) = +3000 líquidos em relação ao início.

## Cenário 6: Empréstimo com Plano de Pagamento (Novo)
**Objetivo:** Testar a criação automática de parcelas futuras.

1. **Usuário:** "Peguei 1200 com o Banco Z"
   - *Esperado:* IA registra empréstimo e pergunta "Você já sabe como vai pagar?".
2. **Usuário:** Clicar em "Já sei"
3. **Usuário:** "12x de 100 todo dia 10"
   - *Esperado:* IA confirma criação do plano.
   - *Resultado:* Deve criar 12 movimentos futuros de R$100 (Despesa) vencendo todo dia 10.

## Cenário 7: Pagar Parcela Específica
**Objetivo:** Testar se a IA encontra e paga uma parcela específica do plano.

1. **Usuário:** "Paguei a parcela do Banco Z"
   - *Esperado:* IA deve encontrar a próxima parcela pendente do Banco Z (vencimento mais próximo).
   - *Resultado:* Deve marcar a parcela como paga (`is_paid=true`) e debitar do saldo.

---
**Comando SQL para limpar dados de teste:**
```sql
DELETE FROM loans WHERE description IN ('Agiota', 'Pedro');
DELETE FROM movements WHERE description LIKE '%Agiota%' OR description LIKE '%Pedro%';
```

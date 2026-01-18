# 📦 Planejamento: Parcelamentos

## Objetivo
Ensinar a IA a lidar com compras parceladas no cartão de crédito.

---

## Cenários a Implementar

### 1. Cadastrar parcelamento
**Exemplo de comando:**
```
Comprei uma TV de 3000 em 10x no cartão Nubank
```

**O que deve acontecer:**
- Criar 10 movimentos, um para cada mês
- Cada parcela = R$ 300
- Primeira parcela vence na próxima fatura do cartão
- Descrição: "TV (1/10)", "TV (2/10)", etc.

---

### 2. Consultar parcelas
**Exemplo:**
```
Quais parcelas tenho no Nubank?
```

**Resposta esperada:**
- Lista agrupada por compra
- Mostra parcela atual / total
- Valor restante

---

### 3. Antecipar parcelas (futuro)
**Exemplo:**
```
Quero antecipar 3 parcelas da TV
```

---

## Estrutura de Dados

### Tabela `movements` (já existe)
Campos relevantes:
- `installments_current` - Parcela atual (ex: 3)
- `installments_total` - Total de parcelas (ex: 10)
- `card_id` - Cartão usado
- `description` - Deve incluir "(X/Y)"

### Tabela `credit_cards` (já existe)
- `closing_day` - Dia de fechamento
- `due_day` - Dia de vencimento

---

## Regras de Negócio

### Cálculo da primeira parcela
1. Pegar `closing_day` do cartão
2. Se compra foi ANTES do fechamento → entra na fatura do mês atual
3. Se compra foi DEPOIS do fechamento → entra na fatura do próximo mês

### Datas das parcelas
- Parcela 1: Próxima fatura
- Parcela 2: Fatura seguinte
- ...e assim por diante

---

## Intents a Criar

### `CREATE_INSTALLMENT`
- Slots: description, amount, installments, card_name
- Cria N movimentos com parcelas

### `LIST_INSTALLMENTS`
- Slots: card_name (opcional)
- Lista parcelas pendentes

### `CHECK_INSTALLMENT`
- Slots: search_term
- Mostra detalhes de uma compra parcelada

---

## Testes Planejados

1. **Parcelamento básico:** "Comprei geladeira de 2400 em 12x no Nubank"
2. **Consultar parcelas:** "Quantas parcelas tenho no cartão?"
3. **Parcela específica:** "Quanto falta da geladeira?"
4. **Múltiplos parcelamentos:** Criar 2+ e verificar lista
5. **Fechamento de fatura:** Testar antes/depois do dia de fechamento

---

## Dependências

- [ ] Verificar se `credit_cards` tem dados de teste
- [ ] Verificar se há cartão padrão definido
- [ ] Revisar lógica de `closing_day` e `due_day`

---

## Arquivos a Modificar

1. `ai.ts` - Adicionar intents CREATE_INSTALLMENT, LIST_INSTALLMENTS
2. `financial.ts` - Função `createInstallmentPurchase()`
3. Possivelmente `calendar.ts` - Exibir parcelas futuras

---

## Próximos Passos

Na próxima sessão:
1. Ler `.agent/ERROS_CRITICOS.md`
2. Verificar estrutura atual das tabelas
3. Implementar `createInstallmentPurchase`
4. Adicionar intent no prompt da IA
5. Testar cenários

# Testes de Débito Automático (DA)

> **Referência**: Tutorial L3 - Primeira funcionalidade ensinada

---

## 📋 O que foi prometido no tutorial

```
Para cadastrar um débito automático, me diga:
• "Conta de luz de 150 reais todo dia 10, débito automático"
• "Condomínio de 800 reais, débito automático no Itaú"

Eu registro e, quando chegar o dia, o valor sai sozinho da conta.
```

---

## 🎯 Comportamento Esperado

Débito Automático (DA) é uma **recorrência que é marcada automaticamente como paga** no dia do vencimento, pois o banco já fez o débito.

### Diferença de Recorrência Normal:
| Tipo | Comportamento no dia de vencimento |
|------|-----------------------------------|
| Recorrência Normal | Cria movimento **pendente** (is_paid = false) |
| Débito Automático | Cria movimento **pago** (is_paid = true) |

---

## 🧪 Testes Simples

### Teste 1: Comando básico com DA
**Input:** "Conta de luz de 150 reais todo dia 10, débito automático"
**Esperado:**
- Intent: CREATE_RECURRENCE (ou novo intent CREATE_AUTO_DEBIT?)
- Campos: description="Conta de luz", amount=150, due_day=10, is_auto_debit=true
- Mensagem: "✅ Registrado! Conta de luz de R$ 150, todo dia 10, débito automático."

### Teste 2: DA com conta específica
**Input:** "Condomínio de 800 reais, débito automático no Itaú"
**Esperado:**
- Intent: CREATE_RECURRENCE
- Campos: description="Condomínio", amount=800, account_name="Itaú", is_auto_debit=true
- Mensagem confirmando conta e débito automático

### Teste 3: DA sem valor (pergunta posterior)
**Input:** "Conta de água todo dia 15 em débito automático"
**Esperado:**
- Slot-filling pedindo valor
- Após resposta, cria recorrência com is_auto_debit=true

### Teste 4: Variações de linguagem
**Inputs:**
- "débito automático da conta de internet, 120 reais, dia 20"
- "pago luz em débito automático, 180 no dia 5"
- "meu IPTU está em débito automático, 350 todo trimestre"

---

## 💪 Testes de Stress

### Stress 1: Múltiplos DA em sequência
**Input:** "Cadastra em débito automático: luz 150 dia 10, água 80 dia 15 e internet 120 dia 20"
**Esperado:** Cria 3 recorrências com is_auto_debit=true

### Stress 2: Confusão DA vs Normal
**Input:** "Quero cadastrar conta de luz em débito automático... na verdade não, quero pagar manualmente"
**Esperado:** Clarifica com usuário ou cria como recorrência normal

### Stress 3: DA com data passada este mês
**Input:** "Débito automático da academia, 99 reais todo dia 5" (sendo dia 17)
**Esperado:** Cria pro próximo mês ou pergunta se quer registrar o deste mês como pago

### Stress 4: Edição de DA existente
**Input:** "Muda o valor do débito automático da luz pra 180"
**Esperado:** Atualiza recorrência existente mantendo is_auto_debit=true

### Stress 5: Cancelamento de DA
**Input:** "Cancela o débito automático do condomínio"
**Esperado:** Remove a recorrência

---

## ✅ Decisão Tomada: Opção B

### Abordagem Escolhida
Adicionar flag `is_auto_debit` na tabela `recurrences` com fluxo de 3 passos.

### Fluxo do Usuário (3 passos)

**Passo 1: Criar a conta recorrente**
```
"Conta de luz todo dia 10"
→ Cria recorrência normal (pendente)
```

**Passo 2: Marcar como Débito Automático**
```
"A conta de luz é débito automático"
→ Atualiza recurrence com is_auto_debit = true
```

**Passo 3: Informar valor do mês (quando a conta chegar)**
```
"A luz desse mês veio 185 reais"
→ Cria movimento do mês com valor informado, já pago
```

### ⚠️ Detalhe Importante
- Nem toda conta recorrente tem valor fixo
- Exemplo: conta de luz varia todo mês
- Por isso o usuário precisa informar o valor quando a conta chegar
- Sistema marca como pago automaticamente no dia de vencimento SE tiver valor informado

---

## 🔧 Implementação Necessária (PARA DEPOIS)

### Banco de Dados
```sql
ALTER TABLE recurrences ADD COLUMN is_auto_debit BOOLEAN DEFAULT false;
ALTER TABLE recurrences ADD COLUMN variable_amount BOOLEAN DEFAULT false;
```

### Prompt da IA
- Reconhecer "débito automático" no contexto de recorrência
- Novo intent ou modificar CREATE_RECURRENCE para incluir is_auto_debit
- Intent para atualizar valor mensal da conta variável

### Lógica de Processamento
- Cron/trigger que verifica recorrências DA no dia de vencimento
- Se valor fixo: cria movimento como pago
- Se valor variável: aguarda input do usuário

---

## 📝 Status

- [x] Testes documentados
- [x] Decisão de implementação tomada (Opção B)
- [ ] Script SQL para adicionar colunas
- [ ] Atualizar prompt da IA
- [ ] Implementar lógica de processamento
- [ ] Testar casos manualmente

# Contexto da Sessão

> **Última Atualização:** 14/01/2026 às 14:46

---

## 📌 Sessão de 14/01/2026 - Correção de Fluxo de Caixa

### 1. Movimentos Pendentes - Lógica Corrigida

**Problema:** Movimentos com `is_paid = false` estavam vinculando conta e afetando saldo.

**Correção:**
- `createMovement` não vincula `account_id` para pendentes
- `createMovement` não atualiza saldo para pendentes
- IA não menciona conta na resposta para pendentes

**Arquivos:** `finance-core.ts`, `ai.ts`

---

### 2. Consistência Entre Páginas

**Problema:** Página Financeiro e Relatórios incluíam pendentes, Dashboard não.

**Correção:**
- `financial/page.tsx`: `getMonthSummary(month, year, 'paid')`
- `reports.ts`: filtro `is_paid !== false` nos cálculos

---

### 3. Gráfico de Fluxo de Caixa - Múltiplos Bugs

**Problema Principal:** Saldo -8.145,60 vs real 4.254,40

**Bugs encontrados:**
1. **Transferências contadas como despesas** - `else` capturava `type='transfer'`
2. **Saldo inicial errado** - calculava desde dia 1, mas usuário existe desde dia 13
3. **Dados de todos usuários** - SQL debug sem filtro de user_id
4. **Linha duplicada no tooltip** - 6 linhas em vez de 3

**Correções:**
- Mudança de `else` para `else if (m.type === 'expense')`
- Filtro de `is_loan`, `is_reserve`, `is_reimbursement`
- Seleção de campos extras na query
- Legenda limpa com `legendType="none"` para linhas pontilhadas

**Arquivo:** `actions/financial.ts` - função `getCashFlowChartData`

---

### 4. Página de Assets - Cache

**Problema:** Saldo desatualizado ao abrir a página.

**Correção:** Chamada `recalculateBalances()` no `loadData`.

**Arquivo:** `assets/page.tsx`

---

### 5. Festa de Nível - Repetição

**Problema:** Mensagem de parabéns aparecia múltiplas vezes.

**Correção:** Contador trava em 10 até subir de nível.

**Arquivo:** `profile.ts`

---

## 📊 Dados Confirmados via SQL

```
Seu usuário em Janeiro/2026:
- Despesas: R$ 4.245,60 (28 movimentos)
- Receitas: R$ 5.200,00 (4 movimentos)
- Transferências: R$ 12.400,00 (6 movimentos) - não afeta balanço

Contas:
- Itaú: R$ 50,00
- Carteira: R$ 4.204,40
- Total: R$ 4.254,40
```

---

## ⚠️ Atenção para a Próxima Sessão

1. **Remover console.log de debug** em `getCashFlowChartData`

2. **Testar gráfico** após as correções (Ctrl+Shift+R)

3. **Pendente:** Definir como lidar com contas atrasadas no gráfico

4. **Leitura Obrigatória:**
   - `RULES.md` - Diretrizes de governança
   - `PROJECT_CONTEXT.md` - Arquitetura e tabelas

# Backlog de Melhorias - Meu Dinheiro IA

## ✅ RESOLVIDO (2026-01-22)

### ~~Corrigir Erro de Build (`getFinancialStatus`)~~
~~O build atual vai falhar! O Advisor (Cron Job) precisa passar `userId` para `getFinancialStatus`, mas a função não aceita argumentos.~~

**Correção aplicada em `src/app/actions/finance-core.ts`:**
1. ✅ `getFinancialStatus` agora aceita um `userId` opcional.
2. ✅ Lógica híbrida implementada:
   - **Se receber `userId` (modo Cron)**: Usa `SUPABASE_SERVICE_ROLE_KEY` para criar cliente Admin, ignorando RLS.
   - **Se NÃO receber (modo Normal)**: Continua usando sessão do usuário logado (cookies).
3. ✅ `recalculateBalances` é pulado no modo admin.

---


## Próximos Passos

### Advisor (Conselheiro Financeiro) ✅
- [x] **Briefing Semanal** - Relatório automático todo domingo (ou manual via `/api/advisor/briefing`). Aparece no sino de notificações.
- [x] **Reações no Chat** - Advisor tem personalidade (Empatia/Celebração). 50% de chance de aparecer para não ser invasivo.
- [x] **Infraestrutura** - Tabela `advisor_briefings`, suporte a Markdown, Cron Job via `vercel.json`.
- [x] **Fatura Inteligente** - Pagar a fatura agora avança corretamente as datas das assinaturas (Spotify, Netflix, etc.) para o próximo mês via `payInvoice`.

### Notificações
- [ ] **Web Push Notifications (Nativo)** - Implementar Service Worker e VAPID Keys para notificações push no Android/iOS (vibrar celular), além do sino in-app.

### Cartões de Crédito
- [x] **Slot-Filling: Limite do Cartão** - Ao criar cartão, perguntar o limite (com opção "sem limite" para pular).
- [x] **Parcelamento Híbrido (Cartão + Entrada)** - Se usuário disser "10x no cartão com entrada", responder explicando que o sistema não suporta híbrido e pedir para lançar entrada separada.
- [x] **Pagamento de Fatura (Baixa em Lote)** - "Paguei a fatura do Nubank". Deve marcar como `is_paid=true` todos os movimentos daquela fatura (mês/ano).

### Empréstimos
- [x] **Empréstimos Complexos (Parcelados e Sem Data)**:
    - Suporte a 3 cenários de Empréstimo (Tomado e Concedido):
        1.  **Data Fixa**: "Vou pagar dia 10".
        2.  **Sem Data**: "Não sei quando vou pagar" (Dívida aberta).
        3.  **Parcelado**: "Vou pagar em 10x de 110 todo dia 5" (Gera recorrência ou parcelas).
- [x] **Vínculo Movimento-Empréstimo (Tech Debt)**: O movimento inicial de criação do empréstimo (`createMovement` em `ai.ts`) agora recebe o `loan_id` e usa `skipLoanUpdate: true` para evitar duplicação do saldo devedor.
- [x] **Ajuste de Saldo Inteligente**: O comando "Meu saldo é X" agora cria um movimento de ajuste (`type: 'adjustment'`) com a diferença, mantendo o histórico consistente, e suporta qualquer conta (não apenas a Carteira).

### Interface
- [x] **Detalhes no Card da Agenda**: Mostrar o nome da conta ou cartão de onde vem o débito dentro do modal de detalhes do dia.
- [x] **Extrato de Fatura no Card**: Ao clicar no card do cartão (tela Patrimônio), abrir modal com extrato da próxima fatura.
- [x] **Página de Ajuda com Instruções do Programa**: Guia de funcionalidades por nível com comandos de exemplo e dicas importantes.

### Inteligência
- [x] **Desfazer Inteligente (Parcelamentos)** - Ao pedir para "cancelar o último", se for um parcelamento, apagar TODAS as parcelas (e entrada) geradas naquele comando, não apenas o último registro do banco.
- [x] **Múltiplos Comandos na Mesma Frase** - IA identifica e pede para lançar o segundo separado. (UX aceitável para MVP)
- [x] **Virada do Mês** - Resumo de como foi o mês no dia 1º. *(Já implementado via MonthlyClosingModal)*
- [ ] **Classificação Automática** - IA sugerir categorias baseado no histórico.
- [x] **Simulação de Cenários (SIMULATE_SCENARIO)** - Handler implementado em `ai.ts`.
- [/] **Categorização em Recorrências/Parcelamentos/Cartão** - Parcialmente implementado. Ver seção "Bugs Críticos" abaixo.

---

## 🐛 Bugs Críticos (2026-01-23)

### 1. Slot-Filling Quebrado em CREATE_RECURRENCE (Assinaturas)

**Sintoma:**
Ao criar uma assinatura com "Assinei Netflix por 45 reais", a IA pergunta o dia do vencimento. Quando o usuário responde "5", a IA interpreta como R$ 5,00 (valor) em vez de `due_day: 5`, e também esquece que era uma recorrência, registrando como despesa única.

**Exemplos de falha:**
```
Usuário: "Assinei Netflix por 45 reais"
IA: "Anotado! Netflix por R$45. Qual o dia do mês que essa conta vence?"
Usuário: "5"
IA: "✅ Anotado! Despesa de R$ 5,00 com Netflix em Lazer." ❌ (deveria ser recorrência de R$45)
```

**Causa provável:**
O fluxo de `CONFIRMATION_REQUIRED` não está preservando os dados acumulados (`amount`, `description`, `originalIntent`) quando o usuário fornece a resposta de slot-filling. O contexto anterior está sendo perdido ou sobrescrito.

**Arquivos envolvidos:**
- `src/app/actions/ai.ts`: Lógica de `CONFIRMATION_REQUIRED` e acúmulo de slots.
- Possivelmente o `processCommand` ou função que recebe a resposta do usuário.

**Risco de correção:** ALTO (pode afetar outros intents que usam slot-filling).

---

### 2. "Assinei X no Itaú" não reconhece cartão

**Sintoma:**
Ao dizer "Assinei Netflix no Itaú", a IA deveria entender que "Itaú" é o cartão de crédito e usar `card_name: "Itaú"`. Atualmente, está ignorando ou tratando como conta bancária.

**Causa provável:**
O `SYSTEM_INSTRUCTION` não deixa claro quando usar `card_name` vs `account_name` para recorrências. A IA pode estar confundindo os dois, especialmente se o usuário tem conta E cartão com o mesmo nome.

**Arquivos envolvidos:**
- `src/app/actions/ai.ts`: `SYSTEM_INSTRUCTION` do `CREATE_RECURRENCE`.

---

### 3. Categorização Parcialmente Implementada

**Status atual:**
| Intent | SYSTEM_INSTRUCTION | Handler | Status |
|--------|-------------------|---------|--------|
| `CREATE_INSTALLMENT` | ✅ Slot `category` adicionado | ✅ Lookup + passagem de `categoryId` | ✅ Funcionando |
| `CREATE_RECURRENCE` | ✅ Slot `category` adicionado | ✅ Lookup + passagem de `category_id` | ❌ Bloqueado pelo bug #1 |
| `CREDIT_CARD_PURCHASE` | ❌ Falta slot `category` | ❌ Falta lookup | ❌ Não implementado |

**Próximos passos:**
1. Resolver o bug #1 de slot-filling primeiro.
2. Depois, testar `CREATE_RECURRENCE` novamente.
3. Por fim, implementar categorização em `CREDIT_CARD_PURCHASE`.

---

## Notas da Sessão (2026-01-22)

**Restauração de backup**: O código foi restaurado para o commit `6e63a1f` devido a problemas de contexto durante a implementação. O commit `88e930c` (Advisor) continha alterações que precisam ser refeitas manualmente.

**O que foi perdido e precisa ser refeito:**
1. Correção de `getFinancialStatus` para aceitar `userId` opcional (build vai falhar sem isso).

**O que está preservado:**
- Advisor: Briefing, Reações, Infraestrutura (tabela, arquivos, cron)
- Fatura Inteligente: `payInvoice` avança datas de recorrências
- Todos os 9 itens do backlog original

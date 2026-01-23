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
- [ ] **Categorização em Recorrências/Parcelamentos/Cartão** - Os handlers já têm a lógica (`getCategoryByName`), mas o SYSTEM_INSTRUCTION não instrui a IA a extrair o slot `category` para esses intents. Adicionar o slot na documentação de `CREATE_RECURRENCE`, `CREATE_INSTALLMENT` e `CREDIT_CARD_PURCHASE`.

---

## Notas da Sessão (2026-01-22)

**Restauração de backup**: O código foi restaurado para o commit `6e63a1f` devido a problemas de contexto durante a implementação. O commit `88e930c` (Advisor) continha alterações que precisam ser refeitas manualmente.

**O que foi perdido e precisa ser refeito:**
1. Correção de `getFinancialStatus` para aceitar `userId` opcional (build vai falhar sem isso).

**O que está preservado:**
- Advisor: Briefing, Reações, Infraestrutura (tabela, arquivos, cron)
- Fatura Inteligente: `payInvoice` avança datas de recorrências
- Todos os 9 itens do backlog original

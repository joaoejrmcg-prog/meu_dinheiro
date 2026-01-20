# Tarefa: Implementação do Tutorial Nível 4

## Planejamento
- [x] Rascunhar texto do tutorial (`L4_TUTORIAL_DRAFT.md`)
- [x] Refinar explicação de Empréstimos e Previsão
- [x] Criar backlog para melhorias técnicas de Empréstimos (`backlog.md`)
- [x] Obter aprovação do usuário ("autorizo")

## Implementação Tutorial
- [x] Atualizar `src/app/lib/levels.ts` com configuração do Nível 4
- [x] Implementar lógica do tutorial em `src/app/hooks/useCommandCenterLogic.ts`
    - [x] Intro
    - [x] Metas
    - [x] Empréstimos
    - [x] Previsão
    - [x] Simulação
    - [x] Conclusão
- [x] **Correções Pós-Implementação**
    - [x] Corrigir altura do container (input empurrado)
    - [x] Remover nota de cálculo da simulação
    - [x] Corrigir mensagem de "Parabéns" duplicada
    - [x] Melhorar layout da Home (overflow e flex)

## Implementação IA (Nível 4)
- [x] **Empréstimos (Loans)**
    - [x] Adicionar intent `CREATE_LOAN`
    - [x] Implementar handler com slot-filling
    - [x] Criar movimento financeiro automático
    - [x] Atualizar `RECONCILE_PAYMENT` para pagar empréstimos
- [x] **Metas (Goals)**
    - [x] Adicionar intent `CREATE_GOAL`
    - [x] Adicionar intent `ADD_TO_GOAL`
    - [x] Implementar handlers
- [x] **Previsão (Forecast)**
    - [x] Criar action `calculateForecast`
    - [x] Adicionar intent `GET_FORECAST`
    - [x] Adicionar intent `PROJECT_GOAL`

## Verificação
- [x] Build passou com sucesso
- [ ] Testar fluxo completo do tutorial
- [ ] **Verificação de Funcionalidades**
    - [x] Previsão Financeira (Forecast)
    - [x] Cartões de Crédito (Criação, Fatura, Parcelamento)

## Implementação: Consultas de Cartão de Crédito
- [x] **Novos Intents no SYSTEM_INSTRUCTION**
    - [x] `GET_INVOICE` - Consultar valor da fatura
    - [x] `GET_BEST_CARD` - Melhor cartão para comprar hoje
    - [x] `GET_CARD_LIMITS` - Limites disponíveis
- [x] **Funções de Suporte (`assets.ts` / `financial.ts`)**
    - [x] `getInvoiceDetails(cardId, month, year)`
    - [x] `getBestCardToBuy()`
    - [x] `getCardLimits()`
- [x] **Handlers em `ai.ts`**
    - [x] Handler GET_INVOICE
    - [x] Handler GET_BEST_CARD
    - [x] Handler GET_CARD_LIMITS
- [x] **Recorrência no Cartão**
    - [x] Atualizar `CREATE_RECURRENCE` para aceitar `card_name`
    - [x] Calcular `due_date` baseado no vencimento do cartão

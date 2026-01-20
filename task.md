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
- [ ] **Metas (Goals)**
    - [ ] Adicionar intent `CREATE_GOAL`
    - [ ] Adicionar intent `ADD_TO_GOAL`
    - [ ] Implementar handlers
- [ ] **Previsão (Forecast)**
    - [ ] Criar action `calculateForecast`
    - [ ] Adicionar intent `GET_FORECAST`

## Verificação
- [x] Build passou com sucesso
- [ ] Testar fluxo completo do tutorial

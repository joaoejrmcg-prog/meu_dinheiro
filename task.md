    - [x] Empréstimos
    - [x] Previsão
    - [x] Simulação
    - [x] Conclusão
- [x] **Correções Pós-Implementação**
    - [x] Criar action `calculateForecast`
    - [x] Adicionar intent `GET_FORECAST`
    - [x] Adicionar intent `PROJECT_GOAL`

## Verificação
- [x] Build passou com sucesso
- [ ] Testar fluxo completo do tutorial
    - [x] Handler GET_INVOICE
    - [x] Handler GET_BEST_CARD
    - [x] Handler GET_CARD_LIMITS
- [x] **Recorrência no Cartão**
    - [x] Atualizar `CREATE_RECURRENCE` para aceitar `card_name`
    - [x] Calcular `due_date` baseado no vencimento do cartão

# Tarefa: Refatorar Guia de Funcionalidades
- [x] Definir estrutura de dados (Categorias e Comandos)
- [x] Implementar UI de abas/cards para categorias
- [x] Implementar lista de comandos interativa (Click-to-Copy)
- [x] Adicionar animações de transição
- [x] Atualizar descrições dos comandos para serem mais explicativas e conversacionais

# Tarefa: Verificar Lógica de Limite do Cartão
- [x] Verificar se o sistema pede o limite na criação (Sim)
- [x] Verificar se é possível alterar o limite depois (Backend: Sim, AI: Sim - Implementado)

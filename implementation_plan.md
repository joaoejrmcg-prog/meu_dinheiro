# Plano de Implementação: Tutorial Nível 4 (Estrategista)

## Objetivo
Implementar o tutorial do Nível 4 (Estrategista), focado em **Metas**, **Empréstimos** e **Simulações**.

## Arquivos a Modificar

### 1. `src/app/lib/levels.ts`
*   **Ação**: Atualizar a configuração do Nível 4.
*   **Detalhe**: Garantir que o tema e descrição estejam alinhados com "Planejamento".

### 2. `src/app/hooks/useCommandCenterLogic.ts`
*   **Ação**: Adicionar lógica do tutorial L4 no `processTutorialInput`.
*   **Passos do Tutorial**:
    1.  **L4_INTRO**: Mensagem de boas-vindas ("Você chegou ao topo!").
    2.  **L4_GOALS_EXPLAIN**: Explicação sobre Metas ("Dar um rumo pro dinheiro").
    3.  **L4_PLANNING_EXPLAIN**: Explicação sobre Empréstimos e Previsão.
    4.  **L4_SIMULATION_TASK**: Missão prática ("E se eu economizar...").
    5.  **L4_DONE**: Encerramento e desbloqueio oficial.

### 3. `src/app/actions/ai.ts`
*   **Ação**: Verificar se features do nível 4 (`goals`, `simulation`, `loan`) estão sendo desbloqueadas corretamente.
*   **Detalhe**: A lógica atual `if (userLevel <= 3)` já deve liberar nível 4, mas vou confirmar.

## Detalhes do Fluxo (Texto Aprovado)

```typescript
// L4 Intro
"Uau! Você chegou ao topo! 🏆\nBem-vindo ao **Nível 4: Estrategista**.\n\nAté agora, você aprendeu a controlar o passado e o presente.\nA partir de hoje, você vai desenhar o seu **futuro**."

// L4 Goals
"Sabe aquele dinheiro que sobra? Agora você pode dar um **rumo** pra ele.\n\nChamamos de **Metas**.\nVocê pode criar 'caixinhas' virtuais para separar seu dinheiro e acompanhar seu progresso.\n\nExemplos:\n• \"Criar meta de Viagem para o Japão valor 15 mil\"\n• \"Guardar 200 reais na reserva de emergência\"\n• \"Quanto falta pro meu Carro Novo?\""

// L4 Planning
"Também liberei o controle de **Empréstimos** (pra nunca mais esquecer quem te deve 😉) e a **Previsão**, que projeta como estará sua conta nos próximos 6 meses.\n\nTudo isso está no novo menu **Planejamento** 🎯.\n\nExemplos:\n• \"Emprestei 50 pro João\"\n• \"Peguei 1000 emprestado no banco\"\n• \"Como vai estar meu saldo em dezembro?\""

// L4 Simulation
"Pra começar, que tal uma simulação rápida?\n\nO poder dos juros compostos e da constância é mágico.\n\nExperimente me perguntar algo como:\n• \"E se eu economizar 300 reais por mês?\"\n• \"Quanto junta se eu guardar 50 por semana?\"\n• \"E se eu cortar 100 reais de lanche?\""

// L4 Done
"Perfeito! Agora você tem todas as ferramentas.\n\n1. **Carteira e Contas** para o dia a dia.\n2. **Cartões** para o crédito.\n3. **Planejamento** para o futuro.\n\nVocê é oficialmente um **Estrategista Financeiro**. O mundo é seu! 🚀"
```

## Verificação
1.  Simular término do Nível 3.
2.  Verificar se botão "Ir para Nível 4" aparece e funciona.
3.  Seguir fluxo do tutorial.
4.  Confirmar desbloqueio de intents de planejamento.

# Backlog de Melhorias Técnicas

## Empréstimos (Loans)
- [ ] **Lançamento Automático no Caixa**:
    - Ao criar um empréstimo do tipo `taken` (Peguei emprestado), criar automaticamente uma **Receita** na conta padrão com a descrição "Entrada de Empréstimo: [Descrição]".
    - Ao criar um empréstimo do tipo `given` (Emprestei), criar automaticamente uma **Despesa** na conta padrão com a descrição "Saída de Empréstimo: [Descrição]".
    - **Motivo**: Garantir que o saldo da conta reflita a entrada ou saída real do dinheiro, mantendo a coerência contábil.

- [ ] **Empréstimos Complexos (Parcelados e Sem Data)**:
    - Suporte a 3 cenários de Empréstimo (Tomado e Concedido):
        1.  **Data Fixa**: "Vou pagar dia 10".
        2.  **Sem Data**: "Não sei quando vou pagar" (Dívida aberta).
        3.  **Parcelado**: "Vou pagar em 10x de 110 todo dia 5" (Gera recorrência ou parcelas).
    - Atualizar `createLoan` e lógica de IA para suportar esses fluxos.

## Tela de Ajuda
- [ ] **Página de Ajuda com Instruções do Programa**:
    - Criar página `/ajuda` ou modal com resumo das funcionalidades de cada nível.
    - Permitir que o usuário reveja as instruções do tutorial a qualquer momento.
    - Referenciado na mensagem final do Tutorial Nível 4.

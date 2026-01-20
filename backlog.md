# Backlog de Melhorias - Meu Dinheiro IA

## Próximos Passos

### Cartões de Crédito
- [ ] **Slot-Filling: Limite do Cartão** - Ao criar cartão, perguntar o limite (com botão [Sem limite] para quem não quer/sabe informar).
- [ ] **Parcelamento Híbrido (Cartão + Entrada)** - Se usuário disser "10x no cartão com entrada", responder explicando que o sistema não suporta híbrido e pedir para lançar entrada separada.
- [ ] **Pagamento de Fatura (Baixa em Lote)** - "Paguei a fatura do Nubank". Deve marcar como `is_paid=true` todos os movimentos daquela fatura (mês/ano).

### Empréstimos
- [ ] **Empréstimos Complexos (Parcelados e Sem Data)**:
    - Suporte a 3 cenários de Empréstimo (Tomado e Concedido):
        1.  **Data Fixa**: "Vou pagar dia 10".
        2.  **Sem Data**: "Não sei quando vou pagar" (Dívida aberta).
        3.  **Parcelado**: "Vou pagar em 10x de 110 todo dia 5" (Gera recorrência ou parcelas).

### Interface
- [ ] **Detalhes no Card da Agenda**: Mostrar o nome da conta ou cartão de onde vem o débito dentro do modal de detalhes do dia.
- [ ] **Extrato de Fatura no Card**: Ao clicar no card do cartão (tela Patrimônio), abrir modal com extrato da próxima fatura.
- [ ] **Página de Ajuda com Instruções do Programa**:
    - Criar página `/ajuda` ou modal com resumo das funcionalidades de cada nível.
    - Permitir que o usuário reveja as instruções do tutorial a qualquer momento.

### Inteligência
- [ ] **Desfazer Inteligente (Parcelamentos)** - Ao pedir para "cancelar o último", se for um parcelamento, apagar TODAS as parcelas (e entrada) geradas naquele comando, não apenas o último registro do banco.
- [ ] **Múltiplos Comandos na Mesma Frase** - Suportar "Gastei 50 no Nubank e 30 no Itaú" (hoje a IA só pega o primeiro).
- [ ] **Virada do Mês** - Resumo de como foi o mês no dia 1º.
- [ ] **Classificação Automática** - IA sugerir categorias baseado no histórico.

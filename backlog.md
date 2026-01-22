# Backlog de Melhorias - Meu Dinheiro IA

## Próximos Passos

### Cartões de Crédito
- [x] **Slot-Filling: Limite do Cartão** - Ao criar cartão, perguntar o limite (com opção "sem limite" para pular).
- [x] **Parcelamento Híbrido (Cartão + Entrada)** - Se usuário disser "10x no cartão com entrada", responder explicando que o sistema não suporta híbrido e pedir para lançar entrada separada.
- [x] **Pagamento de Fatura (Baixa em Lote)** - "Paguei a fatura do Nubank". Deve marcar como `is_paid=true` todos os movimentos daquela fatura (mês/ano).

### Empréstimos
- [ ] **Empréstimos Complexos (Parcelados e Sem Data)**:
    - Suporte a 3 cenários de Empréstimo (Tomado e Concedido):
        1.  **Data Fixa**: "Vou pagar dia 10".
        2.  **Sem Data**: "Não sei quando vou pagar" (Dívida aberta).
        3.  **Parcelado**: "Vou pagar em 10x de 110 todo dia 5" (Gera recorrência ou parcelas).

### Interface
- [x] **Detalhes no Card da Agenda**: Mostrar o nome da conta ou cartão de onde vem o débito dentro do modal de detalhes do dia.
- [x] **Extrato de Fatura no Card**: Ao clicar no card do cartão (tela Patrimônio), abrir modal com extrato da próxima fatura.
- [x] **Página de Ajuda com Instruções do Programa**: Guia de funcionalidades por nível com comandos de exemplo e dicas importantes.

### Inteligência
- [x] **Desfazer Inteligente (Parcelamentos)** - Ao pedir para "cancelar o último", se for um parcelamento, apagar TODAS as parcelas (e entrada) geradas naquele comando, não apenas o último registro do banco.
- [ ] **Múltiplos Comandos na Mesma Frase** - Suportar "Gastei 50 no Nubank e 30 no Itaú" (hoje a IA só pega o primeiro).
- [x] **Virada do Mês** - Resumo de como foi o mês no dia 1º. *(Já implementado via MonthlyClosingModal)*
- [ ] **Classificação Automática** - IA sugerir categorias baseado no histórico.
- [ ] **Categorização em Recorrências/Parcelamentos/Cartão** - A IA categoriza movimentos normais (REGISTER_MOVEMENT), mas não categoriza recorrências (CREATE_RECURRENCE), parcelamentos (CREATE_INSTALLMENT) ou compras no cartão (CREDIT_CARD_PURCHASE). Adicionar slot `category` no SYSTEM_INSTRUCTION e passar `category_id` nos handlers.
- [x] **Simulação de Cenários (SIMULATE_SCENARIO)** - Implementar handler no backend (`ai.ts`) para responder a perguntas como "E se eu economizar 100 reais?". Atualmente só funciona scriptado no Tutorial.

Perguntas e observaçoes preenchido pelo usuário: 
- Está categorizando contas de cartao?
Como o sistema lida com a diferenca se eu peco pra ajustar o valor da carteira?
"Almoco de 50 no nubank" está no lugar errado. Essa frase lanca o valor na conta corrente nubank, nao no cartao de crédito.

# Proposta de Tutorial Nível 4 (Estrategista)

## Contexto
O Nível 4 é o último nível atual. O usuário já domina gastos, receitas, cartões e parcelamentos. Agora o foco é **Planejamento e Futuro**.

## Funcionalidades Desbloqueadas
1.  **Menu Planejamento**: Nova tela com Metas, Fixos, Previsão e Empréstimos.
2.  **Metas (Reserves)**: Criar objetivos de poupança.
3.  **Empréstimos (Loans)**: Gerenciar dívidas e créditos.
4.  **Simulações**: Intent `SIMULATE_SCENARIO` ("E se eu economizar...").
5.  **Previsão**: Gráfico de projeção de saldo.

## Texto do Tutorial (Fluxo Sugerido)

### 1. Mensagem de Boas-vindas (Ao desbloquear)
> **IA:** "Uau! Você chegou ao topo! 🏆
> Bem-vindo ao **Nível 4: Estrategista**.
>
> Até agora, você aprendeu a controlar o passado e o presente.
> A partir de hoje, você vai desenhar o seu **futuro**."

*(Botão: "Como assim?")*

### 2. Explicação das Metas
> **IA:** "Sabe aquele dinheiro que sobra? Agora você pode dar um **rumo** pra ele.
>
> Não importa se está na Poupança, em Ações ou embaixo do colchão.
> Aqui você cria **Metas** para 'carimbar' esse dinheiro.
>
> Assim você sabe que R$ 2.000 são para 'Viagem' e R$ 3.000 para 'Reserva', sem misturar as coisas."
>
> **Exemplos do que você poderá dizer:**
> *   *"Criar meta de Viagem para o Japão valor 15 mil"*
> *   *"Guardar 200 reais na reserva de emergência"*
> *   *"Quanto falta pro meu Carro Novo?"*

*(Botão: "Legal!")*

### 3. Explicação de Empréstimos
> **IA:** "Também liberei o controle de **Empréstimos**.
>
> **Como funciona:**
> Quando você diz 'Peguei 1000 emprestado', eu coloco R$ 1000 na sua conta (porque o dinheiro entrou) e anoto que você deve isso.
> Quando diz 'Emprestei 500', eu tiro da sua conta e anoto que devem pra você."
>
> **Exemplos:**
> *   *"Peguei 1000 com minha mãe pra pagar quando der"* (Sem data)
> *   *"Emprestei 50 pro João pra receber dia 10"* (Data fixa)
> *   *"Peguei 5000 no banco pra pagar em 10x de 600"* (Parcelado)

*(Botão: "Entendi")*

### 4. Explicação da Previsão
> **IA:** "E por fim, a **Previsão**.
>
> Com base no que você gasta e recebe, eu projeto como estará sua conta nos próximos 6 meses.
> Assim você sabe se vai sobrar dinheiro pro Natal ou se precisa economizar agora."
>
> **Exemplo:**
> *   *"Como vai estar meu saldo em dezembro?"*

*(Botão: "Quero testar")*

### 5. Missão Prática (Simulação)
> **IA:** "Pra começar, que tal uma simulação rápida?
>
> O poder dos juros compostos e da constância é mágico.
>
> Experimente me perguntar algo como:"
>
> **Exemplos:**
> *   **"E se eu economizar 300 reais por mês?"**
> *   *"Quanto junta se eu guardar 50 por semana?"*
> *   *"E se eu cortar 100 reais de lanche?"*

*(Aguardar usuário digitar algo similar a simulação ou meta)*

### 6. Encerramento
> **IA:** "Perfeito! Agora você tem todas as ferramentas.
>
> 1. **Carteira e Contas** para o dia a dia.
> 2. **Cartões** para o crédito.
> 3. **Planejamento** para o futuro.
>
> Você é oficialmente um **Estrategista Financeiro**. O mundo é seu! 🚀"

---

## Detalhes Técnicos para Implementação

1.  **Atualizar `src/app/lib/levels.ts`**:
    *   Definir textos do Level 4.
    *   Configurar triggers de desbloqueio.

2.  **Atualizar `src/app/components/TutorialOverlay.tsx`** (ou onde fica a lógica do tutorial):
    *   Implementar o fluxo acima.

3.  **Verificar `detectBlockedFeature` em `ai.ts`**:
    *   Garantir que ao atingir nível 4, as keywords `goals`, `simulation`, `loan` parem de ser bloqueadas. (A lógica atual `if (userLevel <= 3)` já faz isso, pois nível 4 > 3).

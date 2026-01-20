# SISTEMA DE NÍVEIS - Meu Dinheiro

> **Conceito**: Gamificação do aprendizado financeiro. O usuário "evolui" desbloqueando funcionalidades conforme ganha experiência no app.

---

## 🎓 Nível 0 — Tutorial

**Tema**: *"Primeiro contato"*

### O que acontece:
O usuário é guiado pela IA em um onboarding conversacional mínimo.

### Fluxo do Tutorial:

```
IA:
"Oi 😊
Vamos começar só com o básico: ver quanto entra e quanto sai.
Depois eu te mostro outras coisas."

"Me diga: quanto dinheiro você tem agora para usar este mês?"

Usuário:
3.500

IA:
"Perfeito. Vou considerar que você começa o mês com R$ 3.500 disponíveis.
Agora, sempre que você gastar ou receber dinheiro, é só me avisar."
```

### ⚠️ Regra importante sobre o valor inicial:
O valor informado pelo usuário **NÃO deve ser registrado como salário ou receita**.

Deve ser tratado como **saldo inicial** — como se fosse a sobra de um mês que não existiu. É apenas o ponto de partida do programa, sem categoria de entrada.

> Tecnicamente: pode ser um campo `initial_balance` na carteira, ou uma transação com tipo especial `INITIAL_BALANCE` que não aparece em relatórios de receitas.

### Objetivo:
- Criar a carteira inicial com saldo (sem gerar entrada/receita)
- Ensinar a mecânica básica de conversar com a IA
- Transição automática para Nível 1

---

## 🟢 Nível 1 — Carteira

**Tema**: *"Dinheiro vivo"*

### Funcionalidades disponíveis:
- ✅ Saldo único (Carteira)
- ✅ Entradas (receitas)
- ✅ Gastos (despesas)
- ✅ Categorias
- ✅ Relatórios básicos

### O que o usuário aprende:
- Registrar movimentações
- Não gastar mais do que tem
- Ver dinheiro sobrar

### Objetivo para avançar:
- Fechar um período positivo, OU
- Atingir X lançamentos (definir quantidade)

### ❌ Bloqueado neste nível:
- Contas bancárias
- Cartões de crédito
- Empréstimos
- Parcelamentos
- Recorrências

---

## 🟡 Nível 2 — Organização

**Tema**: *"Onde o dinheiro está"*

### Novas funcionalidades desbloqueadas:
- ✅ Múltiplas contas (banco, dinheiro físico, etc.)
- ✅ Transferências entre contas
- ✅ Contas recorrentes
- ✅ Lembretes/Notificações

### O que o usuário aprende:
- Dinheiro tem "lugares" diferentes
- Contas se repetem todo mês
- O futuro existe (planejamento básico)

### Objetivo para avançar:
- Atingir X lançamentos (definir quantidade)

---

## 🔵 Nível 3 — Crédito

**Tema**: *"Dinheiro que não é seu"*

### Novas funcionalidades desbloqueadas:
- ✅ Cartões de crédito
- ✅ Parcelamentos
- ✅ Faturas
- ✅ Empréstimos (formais e informais)

### O que o usuário aprende:
- Dívida ≠ renda
- Parcelamento ≠ pagamento
- Empréstimo é obrigação futura

### Objetivo para avançar:
- Atingir X lançamentos (definir quantidade)

---

## 🟣 Nível 4 — Planejamento

**Tema**: *"Dominar o tempo"*

### Novas funcionalidades desbloqueadas:
- ✅ Metas financeiras
- ✅ Reserva formal
- ✅ Previsão de meses
- ✅ Simulações

### O que o usuário se torna:
- Proativo
- Estratégico
- Menos reativo

---

## 🔧 Decisões de Implementação

### Critério de progressão
- **Controle do usuário**: O usuário pode escolher avançar
- **Escalonamento por lançamentos**: Quantidade mínima de transações para desbloquear
- **A definir**: Quantos lançamentos para cada nível

### Comportamento da IA
> ⚠️ **Decisão pendente**

Opções possíveis:
1. **IA nivelada**: Só entende comandos do nível atual
2. **IA recusa**: Entende tudo, mas recusa comandos fora do nível
3. **Desbloqueio automático**: Se usuário pede algo avançado, desbloqueia e explica

A escolha depende do que for mais seguro programar.

### Menu e Relatórios
- Itens bloqueados aparecem com **ícone de cadeado** 🔒
- Mostra que o programa tem mais a oferecer
- Incentiva curiosidade e progressão

### Categorias
- Disponíveis desde o **Nível 1**

---

## 📋 Status de Implementação (Atualizado 13/01/2026)

| Feature | Existe no código? | Nível | Status |
|---------|-------------------|-------|--------|
| Carteira | ✅ Sim (`accounts` com tipo "wallet") | 1 | ✅ Funcional |
| Transações | ✅ Sim (`movements` table) | 1 | ✅ Funcional |
| Categorias | ✅ Sim (`categories` table) | 1 | ✅ Funcional |
| Múltiplas contas | ✅ Sim (`accounts` - bank, savings) | 2 | ✅ Funcional |
| Transferências | ✅ Sim (type "transfer" em movements) | 2 | ✅ Funcional |
| Recorrências | ✅ Sim (`recurrences` table) | 2 | ✅ Funcional + Edição |
| Notificações | ✅ Sim (`notifications` table) | 2 | ✅ Funcional |
| Cartões de crédito | ✅ Sim (`credit_cards` table) | 3 | ✅ Funcional |
| Parcelamentos | ✅ Sim (installments em movements) | 3 | ✅ Funcional |
| Faturas | ✅ Sim (lógica em reports.ts) | 3 | ✅ Funcional |
| Empréstimos | ✅ Sim (`loans` table) | 3 | ✅ Funcional |
| Metas | ⚠️ Parcial (existe `reserves`) | 4 | ⚠️ Parcial |
| Previsão de meses | ❌ Não existe | 4 | ❌ Pendente |
| Simulações | ⚠️ Parcial (intent SIMULATE_SCENARIO) | 4 | ⚠️ Básico |

---

## 🔴 O QUE FALTA IMPLEMENTAR

### 1. **Banco de Dados** ✅ CONCLUÍDO
| Item | Descrição | Status |
|------|-----------|--------|
| Campo `user_level` | Na tabela `profiles` | ✅ Implementado |
| Campo `level_transaction_count` | Contador de transações | ✅ Implementado |
| Tipo `INITIAL_BALANCE` | Flag `is_initial_balance` em movements | ✅ Implementado |

---

### 2. **Componente Sidebar.tsx** ✅ CONCLUÍDO
| Item | Descrição | Status |
|------|-----------|--------|
| Lógica de lock por nível | Mostrar/ocultar itens por nível | ✅ Implementado |
| Ícone de cadeado 🔒 | Para itens bloqueados | ✅ Implementado |
| Badge de nível | Mostra "Lvl X" para itens bloqueados | ✅ Implementado |

---

### 3. **Tutorial/Onboarding (Nível 0 → 1)** ✅ CONCLUÍDO
| Item | Descrição | Status |
|------|-----------|--------|
| Fluxo conversacional | IA guia usuário inicial | ✅ Implementado |
| Detecção de novo usuário | Verificar se `user_level = 0` | ✅ Implementado |
| Criação de carteira + saldo | Registrar saldo inicial | ✅ Implementado |
| Transição automática | Mudar para nível 1 após tutorial | ✅ Implementado |
| Tutorial Nível 2 | Segundo tutorial para progressão | ✅ Implementado |

---

### 4. **Lógica da IA (CommandCenter)** ✅ CONCLUÍDO
| Item | Descrição | Status |
|------|-----------|--------|
| Verificar nível do usuário | Antes de processar comandos | ✅ Implementado |
| Incrementar contador | Ao registrar transação | ✅ Implementado |
| Lógica de desbloqueio | Verificar se atingiu threshold | ✅ Implementado |
| Milestone de 10 ações | Notificação ao atingir | ✅ Implementado |

---

### 5. **Ações de Progressão** ✅ CONCLUÍDO
| Item | Descrição | Status |
|------|-----------|--------|
| Função `getUserLevel()` | Buscar nível atual | ✅ Em `profile.ts` |
| Função `updateUserLevel()` | Subir de nível | ✅ Em `profile.ts` |
| Incrementar contador | `incrementActionCount()` | ✅ Em `profile.ts` |

---

## 📦 RESUMO: STATUS ATUAL

1. **Fase 1 - Base (Backend)** ✅ CONCLUÍDO
   - [x] Campos no banco (`user_level`, `level_transaction_count`)
   - [x] Actions para gerenciar nível

2. **Fase 2 - Tutorial** ✅ CONCLUÍDO
   - [x] Fluxo de onboarding conversacional
   - [x] Flag `is_initial_balance` em movements
   - [x] Tutorial nível 1 e nível 2

3. **Fase 3 - UI Gating** ✅ CONCLUÍDO
   - [x] Sidebar com lógica de níveis
   - [x] Ícones de cadeado
   - [x] Bloqueio por nível

4. **Fase 4 - Progressão** ✅ CONCLUÍDO
   - [x] Incrementar contador a cada transação
   - [x] Milestone de 10 ações para sugerir nível 2

5. **Fase 5 - Polish** ⚠️ PARCIAL
   - [ ] Relatórios com preview bloqueado
   - [ ] Indicadores de progresso no menu
   - [x] Adaptar IA por nível

---

## 📝 Notas

- Sistema de níveis está **funcional e em uso**
- Usuários começam no nível 0 (tutorial) e progridem até 4
- Sidebar exibe itens bloqueados com cadeado e badge de nível
- IA recusa comandos de níveis superiores com mensagem amigável


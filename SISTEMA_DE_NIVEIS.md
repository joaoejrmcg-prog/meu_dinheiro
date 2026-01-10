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

## 📋 Status de Implementação

| Feature | Existe no código? | Nível |
|---------|-------------------|-------|
| Carteira | ✅ Sim (`accounts` com tipo "wallet") | 1 |
| Transações | ✅ Sim (`movements` table) | 1 |
| Categorias | ✅ Sim (`categories` table) | 1 |
| Múltiplas contas | ✅ Sim (`accounts` - bank, savings) | 2 |
| Transferências | ✅ Sim (type "transfer" em movements) | 2 |
| Recorrências | ✅ Sim (`recurrences` table) | 2 |
| Notificações | ✅ Sim (`notifications` table) | 2 |
| Cartões de crédito | ✅ Sim (`credit_cards` table) | 3 |
| Parcelamentos | ✅ Sim (installments em movements) | 3 |
| Faturas | ✅ Sim (lógica em reports.ts) | 3 |
| Empréstimos | ✅ Sim (`loans` table) | 3 |
| Metas | ⚠️ Parcial (existe `reserves`) | 4 |
| Previsão de meses | ❌ Não existe | 4 |
| Simulações | ❌ Não existe | 4 |

---

## 🔴 O QUE FALTA IMPLEMENTAR

### 1. **Banco de Dados**
| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Campo `user_level` | Adicionar à tabela `profiles` (INTEGER, default 0) | 🔴 Alta |
| Campo `level_transaction_count` | Contador de transações para progressão | 🟡 Média |
| Tipo `INITIAL_BALANCE` | Transação especial para saldo inicial do tutorial | 🔴 Alta |

**SQL necessário:**
```sql
ALTER TABLE profiles 
ADD COLUMN user_level INTEGER DEFAULT 0,
ADD COLUMN level_transaction_count INTEGER DEFAULT 0;
```

---

### 2. **Componente Sidebar.tsx**
| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Prop `userLevel` | Receber nível do usuário | 🔴 Alta |
| Lógica de lock | Mostrar/ocultar itens por nível | 🔴 Alta |
| Ícone de cadeado 🔒 | Para itens bloqueados | 🟡 Média |
| Indicador de progresso | Mostrar quantas transações faltam | 🟢 Baixa |

**Estrutura sugerida:**
```typescript
const menuItems = [
  { icon: Home, label: "Início (IA)", href: "/", minLevel: 0 },
  { icon: PieChart, label: "Visão Geral", href: "/dashboard", minLevel: 1 },
  { icon: DollarSign, label: "Financeiro", href: "/financial", minLevel: 1 },
  { icon: Calendar, label: "Calendário", href: "/calendar", minLevel: 2 },
  { icon: Wallet, label: "Contas e Cartões", href: "/assets", minLevel: 2 },
  { icon: Target, label: "Planejamento", href: "/planning", minLevel: 4 },
  { icon: BarChart3, label: "Relatórios", href: "/reports", minLevel: 1 },
];
```

---

### 3. **Tutorial/Onboarding (Nível 0)**
| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Fluxo conversacional | IA guia usuário inicial | 🔴 Alta |
| Detecção de novo usuário | Verificar se `user_level = 0` | 🔴 Alta |
| Criação de carteira + saldo | Registrar `INITIAL_BALANCE` | 🔴 Alta |
| Transição automática | Mudar para nível 1 após tutorial | 🔴 Alta |

**Arquivos afetados:**
- `src/app/page.tsx` (home/IA)
- `src/app/hooks/useCommandCenterLogic.ts`
- `src/app/actions/onboarding.ts`

---

### 4. **Lógica da IA (CommandCenter)**
| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Verificar nível do usuário | Antes de processar comandos | 🟡 Média |
| System prompt dinâmico | Adaptar instruções por nível | 🟡 Média |
| Incrementar contador | Ao registrar transação | 🔴 Alta |
| Lógica de desbloqueio | Verificar se atingiu threshold | 🔴 Alta |

---

### 5. **Relatórios (Reports)**
| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Gráficos com cadeado | Visual de bloqueio | 🟢 Baixa |
| Tooltip explicativo | "Desbloqueie no nível X" | 🟢 Baixa |

---

### 6. **Ações de Progressão**
| Item | Descrição | Prioridade |
|------|-----------|-----------|
| Função `checkLevelUp()` | Verificar se pode subir de nível | 🔴 Alta |
| Função `unlockLevel()` | Subir de nível + notificar usuário | 🔴 Alta |
| Action `getUserLevel()` | Buscar nível atual | 🔴 Alta |
| Action `updateUserLevel()` | Atualizar nível | 🔴 Alta |

---

## 📦 RESUMO: ORDEM DE IMPLEMENTAÇÃO SUGERIDA

1. **Fase 1 - Base (Backend)**
   - [ ] Adicionar campos no banco (`user_level`, `level_transaction_count`)
   - [ ] Criar actions para gerenciar nível (`getUserLevel`, `updateUserLevel`)
   
2. **Fase 2 - Tutorial**
   - [ ] Implementar fluxo de onboarding conversacional
   - [ ] Criar tipo de transação `INITIAL_BALANCE`
   - [ ] Transição automática nível 0 → 1

3. **Fase 3 - UI Gating**
   - [ ] Modificar Sidebar com lógica de níveis
   - [ ] Adicionar ícones de cadeado
   - [ ] Bloquear rotas por nível

4. **Fase 4 - Progressão**
   - [ ] Incrementar contador a cada transação
   - [ ] Implementar `checkLevelUp()` automático
   - [ ] Notificar usuário ao subir de nível

5. **Fase 5 - Polish**
   - [ ] Relatórios com preview bloqueado
   - [ ] Indicadores de progresso no menu
   - [ ] Adaptar IA por nível (opcional)

---

## 📝 Notas

- Este documento é uma **especificação conceitual**
- A implementação técnica será feita posteriormente
- Campos sugeridos no banco: `profiles.user_level` e `profiles.level_transaction_count`

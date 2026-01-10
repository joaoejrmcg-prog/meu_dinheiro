# PROJETO: SaaS Gestor Financeiro Pessoal via IA (AI-First)

> [!IMPORTANT]
> **STATUS DO CÓDIGO (LEGADO VS NOVO):**
> Este repositório contém muito código legado de um projeto anterior.
> - **A ÚNICA VERDADE** é este arquivo (`PROJECT_CONTEXT.md`).
> - **Banco de Dados:** O único arquivo SQL válido e implementado é `finance_schema.sql`. O restante deve ser ignorado ou migrado.
> - **Funcionalidades Ativas:** Apenas o menu "Perfil", "Indicar Amigos" e o layout da tela de IA foram atualizados.
> - **Todo o resto** (tabelas antigas, componentes não listados acima) é código morto ou pendente de refatoração.
> **NÃO ASSUMA** que o código existente funciona ou segue as regras atuais sem verificar este arquivo.

## 🎯 OBJETIVO DO PROJETO
Criar uma aplicação SaaS B2C para gestão financeira pessoal.
A interface principal é um **Chat via IA** que atua como um assistente financeiro pessoal. O sistema ajuda o usuário a cadastrar cartões, lançar gastos, controlar contas a pagar/receber e visualizar insights financeiros.

---

## 🛠️ TECH STACK (IMUTÁVEL)
- **Frontend:** Next.js (Foco em PWA/Mobile).
- **Voz (Input):** Web Speech API (Nativa do navegador) - **CUSTO ZERO**.
- **Backend/DB:** Supabase (Postgres, Auth, RLS, Edge Functions).
- **Pagamentos (SaaS):** Integração Asaas (Pix/Assinatura) para cobrar o usuário pelo uso do software.
- **AI Core:** Integração LLM (OpenAI/Gemini) para processamento de gastos, categorização e insights.

---

## 🧠 FILOSOFIA DE DESENVOLVIMENTO
1.  **Backend Manda, Frontend Obedece:** Regras de negócio ficam no banco (RLS) ou Edge Functions.
2.  **Simplicidade Radical:** O usuário não quer preencher formulários complexos. Ele quer falar "Gastei 50 reais no Uber" e pronto.
3.  **Privacidade Absoluta:** Multi-tenancy rigoroso. Dados financeiros são sensíveis.
4.  **Automação Inteligente:** A IA deve categorizar gastos automaticamente e identificar recorrências (Netflix, Academia).

---

## 📱 FRONTEND & UX RULES
1.  **Chat-First:** A home é o chat. O usuário interage falando ou digitando.
2.  **Dashboard Visual:** Gráficos de gastos por categoria, evolução mensal e faturas de cartão.
3.  **Agenda Financeira:** Visualização de calendário para contas a pagar e receber.

---

## 🔒 REGRAS DE BANCO DE DADOS & SEGURANÇA (CRÍTICO)
1.  **Multi-Tenancy:**
    - TODAS as tabelas de dados (`transactions`, `payment_methods`, `categories`) DEVEM ter `user_id`.
    - RLS Obrigatório.
2.  **Tabelas Core (Mantidas):**
    - `profiles`: Dados cadastrais.
    - `subscriptions`: Controle da assinatura do SaaS (Asaas).
    - `referral_rewards`: Sistema de indicação.
3.  **Novas Tabelas de Domínio:**
    - `payment_methods`: Cartões de Crédito, Contas Bancárias, Vale Refeição.
    - `transactions`: Receitas e Despesas. Colunas: `amount`, `description`, `date`, `category_id`, `payment_method_id`, `installments` (parcelas).
    - `categories`: Alimentação, Transporte, Lazer (Sugeridas pela IA, editáveis).
    - `recurrences`: Contas fixas (Aluguel, Streaming).

---

## 🤖 COMPORTAMENTO DA IA (SYSTEM PROMPT RULES)
**Persona:** Assistente Financeiro Pessoal (Organizado, Proativo, Analítico).
1.  **Registro de Gastos:**
    - Input: "Comprei um tênis de 300 reais em 3x no Nubank".
    - Ação: Identificar valor (300), parcelas (3), método (Nubank), categoria (Vestuário - inferida).
    - Confirmação: "Lançar R$ 300,00 (3x R$ 100,00) no Nubank como Vestuário?"
2.  **Consultas e Insights:**
    - Input: "Quanto gastei com Uber esse mês?"
    - Ação: Query no banco filtrando categoria/descrição e somar.
3.  **Gestão de Cartões:**
    - Alertar sobre fechamento de fatura ou limite (se disponível).

---

## 💳 REGRAS DE NEGÓCIO: PLANOS (SaaS)
1.  **Planos:**
    -   `free`: Manual (sem IA ou limitado).
    -   `pro`: IA Ilimitada, Múltiplos Cartões, Gráficos Avançados.
2.  **Status:**
    -   `active`: Acesso total.
    -   `overdue`: Bloqueio de novos lançamentos.

---

## 🚀 ROADMAP DE MIGRAÇÃO (PIVOT)

### FASE 1: Limpeza e Estrutura
- [ ] Criar novas tabelas (`payment_methods`, `transactions`, `categories`).
- [ ] Remover tabelas antigas (`services`, `clients`) - *Cuidado com dependências*.
- [ ] Atualizar tipos TypeScript.

### FASE 2: Cérebro da IA
- [ ] Reescrever System Prompt (`CommandCenter`) para contexto financeiro.
- [ ] Criar Tools/Functions para `insert_transaction`, `get_balance`, `add_card`.

### FASE 3: Interface
- [ ] Transformar Agenda de Serviços em Agenda Financeira (Contas a Pagar).
- [ ] Criar Dashboard Financeiro (Gráficos).
- [ ] Ajustar fluxo de Onboarding (Cadastrar Cartões em vez de Serviços).

# PROJETO: SaaS Gestor Financeiro Pessoal via IA (AI-First)

> **Última Atualização:** 13/01/2026

> [!IMPORTANT]
> **CÓDIGO LEGADO:** Este repositório contém código herdado de outro projeto.
> - **A ÚNICA VERDADE** são os arquivos de contexto: `CONTEXTO_SESSAO.md`, `PROJECT_CONTEXT.md`, `RULES.md`
> - **NÃO ASSUMA** que código existente funciona sem verificar estes arquivos.

---

## 🎯 OBJETIVO DO PROJETO

Criar uma aplicação SaaS B2C para gestão financeira pessoal.
A interface principal é um **Chat via IA** que atua como um assistente financeiro pessoal.

---

## 🛠️ TECH STACK

| Tecnologia | Uso |
|------------|-----|
| **Next.js 16** | Frontend (PWA/Mobile) |
| **Supabase** | Backend, Auth, Database (Postgres), RLS |
| **Gemini AI** | Processamento de linguagem natural |
| **OpenAI TTS** | Geração de áudio para respostas |
| **Web Speech API** | Input de voz (custo zero) |
| **Asaas** | Pagamentos (Pix/Assinatura) |

---

## 📁 ESTRUTURA PRINCIPAL

```
src/app/
├── actions/           # Server Actions (Backend)
│   ├── ai.ts          # Processamento IA (intents, handlers)
│   ├── finance-core.ts # Movimentações, saldos
│   ├── financial.ts   # CRUD movements, recurrences
│   ├── assets.ts      # Contas, cartões, recalculateBalances
│   ├── categories.ts  # Categorias
│   ├── reminders.ts   # Notificações de pagamento
│   └── profile.ts     # Perfil, níveis de usuário
├── components/
│   ├── CommandCenter.tsx  # Chat principal com IA
│   └── ...
├── hooks/
│   └── useCommandCenterLogic.ts # Lógica do chat
├── dashboard/         # Dashboard principal
├── financial/         # Tela Financeiro (Gastos/Receitas/Recorrentes)
├── calendar/          # Calendário financeiro
└── ...
```

---

## 🗄️ TABELAS DO BANCO (Supabase)

### Tabelas Core
| Tabela | Descrição |
|--------|-----------|
| `profiles` | Dados do usuário, `user_level` (1-4), configurações |
| `subscriptions` | Controle de assinatura SaaS |
| `accounts` | Contas bancárias/carteiras (`balance`, `initial_balance`, `type`) |
| `credit_cards` | Cartões de crédito (`closing_day`, `due_day`) |
| `categories` | Categorias de gastos/receitas |
| `movements` | Todas as movimentações financeiras |
| `recurrences` | Contas fixas recorrentes |
| `notifications` | Sistema de notificações do usuário |

### Campos Importantes em `movements`
- `is_paid` - Se já foi pago/recebido
- `due_date` - Data de vencimento (para contas a pagar)
- `is_loan`, `is_reserve`, `is_reimbursement` - Flags especiais
- `is_initial_balance` - Marca saldo inicial

---

## 🤖 INTENTS DA IA (ai.ts)

| Intent | Descrição |
|--------|-----------|
| `REGISTER_MOVEMENT` | Registrar gasto/receita |
| `GET_FINANCIAL_STATUS` | Consultar saldo atual |
| `DELETE_LAST_MOVEMENT` | Apagar último lançamento |
| `CORRECT_LAST_ACCOUNT` | Corrigir conta do último lançamento |
| `RECONCILE_PAYMENT` | Marcar conta pendente como paga |
| `UPDATE_PENDING_AMOUNT` | Atualizar valor de conta pendente |
| `CREATE_RECURRENCE` | Criar conta recorrente |
| `ADJUST_BALANCE` | Corrigir saldo inicial da carteira |
| `SET_DEFAULT_ACCOUNT` | Definir conta padrão |
| `SIMULATE_SCENARIO` | Simulações "e se" |
| `CANCEL_ACTION` | Cancelar ação atual |

---

## 📊 SISTEMA DE NÍVEIS

| Nível | Nome | Funcionalidades |
|-------|------|-----------------|
| 1 | Carteira | Básico: gastos, receitas, saldo |
| 2 | Organização | + Recorrências, categorias, calendário |
| 3 | Controle Total | + Múltiplas contas, cartões de crédito |
| 4 | Estrategista | + Metas, projeções, análises avançadas |

> Ver `SISTEMA_DE_NIVEIS.md` para detalhes completos.

---

## 🔒 REGRAS DE SEGURANÇA

1. **Multi-Tenancy:** TODAS as tabelas têm `user_id` e RLS obrigatório
2. **Server Actions:** Regras de negócio ficam no backend
3. **Validação:** Sempre verificar usuário autenticado antes de operações

---

## 📱 UX PRINCIPLES

1. **Chat-First:** A home é o chat. Interação por texto ou voz.
2. **Simplicidade:** Usuário fala "Gastei 50 no Uber" e pronto.
3. **Feedback Visual:** Indicadores de "pensando", sucesso (verde), erro (vermelho)
4. **Edição Manual:** Formulários disponíveis para ajuste fino

---

## ⚠️ REGRAS DE GOVERNANÇA

Ver arquivo `RULES.md` para:
- Autorização explícita obrigatória
- Proibições de alterações automáticas
- Procedimentos de validação

# ⚠️ ERROS CRÍTICOS - LEIA ANTES DE CADA SESSÃO ⚠️

Este documento contém erros cometidos que **NÃO DEVEM SE REPETIR**.

---

## 1. NUNCA usar `git checkout` sem verificar mudanças

**Data:** 2026-01-18

**O que aconteceu:**
- Claude usou `git checkout -- src/app/actions/ai.ts` para "restaurar" um arquivo que tinha erro
- O arquivo tinha **mudanças não commitadas** de horas de trabalho
- Tudo foi perdido e precisou ser reimplementado às pressas

**Regra:**
```bash
# SEMPRE rodar isso ANTES de qualquer git checkout:
git status

# Se aparecer "modified:", NÃO fazer checkout!
```

---

## 2. Lógica de Débito Automático (DA) - CUIDADO!

**Existem DOIS tipos de DA:**

| Tipo | `variable_amount` | Comportamento no Calendário |
|------|-------------------|----------------------------|
| Valor FIXO (ex: condomínio R$150) | `false` | Mostrar R$150 TODOS os meses |
| Valor VARIÁVEL (ex: luz) | `true` | Mostrar R$0 até usuário informar |

**Lógica Crítica:**
- Quando `variable_amount = false` → O valor da recorrência deve aparecer em TODOS os meses futuros
- Quando `variable_amount = true` → Só mostra valor quando usuário diz "a luz veio X reais"

**Código relevante:**
- `financial.ts` → `getCalendarMovements()` (ou similar)
- Deve verificar `variable_amount` antes de decidir se mostra 0 ou o valor fixo

---

## 3. Antes de Editar Arquivos Grandes

1. Verificar se há mudanças não commitadas: `git status`
2. Se tiver, committar antes: `git commit -am "wip: salvando estado atual"`
3. Só depois fazer edições

---

## Como Usar Este Arquivo

Ao iniciar uma nova sessão, peça:
> "Leia o arquivo .agent/ERROS_CRITICOS.md antes de começar"

Isso garante que os erros não se repitam.

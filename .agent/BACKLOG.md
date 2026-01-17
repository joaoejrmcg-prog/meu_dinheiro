# Backlog de Correções Pendentes

Este arquivo contém funcionalidades que precisam ser revisadas/corrigidas em sessões futuras.

---

## 1. Respostas Verdes da IA

**Data identificada:** 2026-01-17

**Descrição do problema:**
As respostas da IA que representam ações completadas com sucesso devem aparecer em **verde** (fundo verde claro, borda verde). Isso é importante porque:
- Somente respostas "verdes" (type: 'success') descontam uma interação do limite diário
- Usuários dos planos Trial e Light têm limite de 10 interações/dia
- O contador "X respostas verdes restantes" se refere a essas respostas finais

**Arquivos relacionados:**
- `src/app/components/CommandCenter.tsx` - Estilos das mensagens
- `src/app/hooks/useCommandCenterLogic.ts` - Lógica de types das mensagens
- `src/app/actions/ai.ts` - Processamento de comandos da IA

**O que verificar:**
1. Mensagens com `type: 'success'` devem ter fundo verde (`bg-green-50`, `border-green-300`)
2. A mudança de `!bg-green-50` para sobrescrever o `bg-white` base pode precisar de ajuste
3. Verificar se a IA está corretamente retornando `type: 'success'` para ações completadas

**Status:** ⏳ Pendente

---

## Como usar este arquivo

Adicione novas entradas seguindo o formato acima. Marque como ✅ Resolvido quando corrigir.

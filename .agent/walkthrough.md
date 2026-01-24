# Walkthrough: Correções de Recorrência e Categorização

Nesta sessão, corrigimos dois problemas críticos na interação com a IA.

## 1. Correção do Slot-Filling de Recorrência

**O Problema:**
Ao criar uma recorrência (ex: "Assinei Netflix"), a IA perguntava o dia. Quando o usuário respondia apenas o número (ex: "15"), o sistema interpretava erradamente como um **novo gasto** de R$ 15,00.

**A Solução:**
- **Frontend (`useCommandCenterLogic.ts`):** Modificamos a lógica para respeitar o `originalIntent`. Se a IA estava criando uma recorrência, o frontend agora deixa o número passar para a IA em vez de interceptá-lo como valor.
- **Backend (`ai.ts`):** Atualizamos o prompt para instruir a IA a tratar números isolados como `due_day` quando estiver no contexto de criação de recorrência.

**Resultado:**
Agora o fluxo funciona corretamente:
1. User: "Assinei Netflix"
2. IA: "Qual dia?"
3. User: "15"
4. IA: "Recorrência criada dia 15" ✅

## 2. Categorização de Parcelamentos

**O Problema:**
Compras parceladas (`CREATE_INSTALLMENT` e `CREDIT_CARD_PURCHASE`) não estavam recebendo categoria automática (ficavam como "Outros"), pois a instrução de categorização não estava explícita para esses comandos.

**A Solução:**
- **Prompt (`ai.ts`):** Adicionamos o slot `category` na definição de `CREDIT_CARD_PURCHASE` e reforçamos a instrução para inferir a categoria automaticamente em `CREATE_INSTALLMENT`.

**Resultado:**
Compras parceladas agora são categorizadas corretamente:
- "Bateria pro carro" -> **Transporte** ✅
- "Tênis na Centauro" -> **Vestuário** ✅

## Arquivos Alterados
- `src/app/actions/ai.ts`
- `src/app/hooks/useCommandCenterLogic.ts`

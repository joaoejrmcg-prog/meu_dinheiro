# Plano de Testes: Correção de Recorrências e Slot-Filling

Siga estes passos para validar as correções.

## Cenário 1: Slot-Filling de Assinatura (O Bug do "5 reais")

**Objetivo:** Verificar se a IA entende que o número isolado é o DIA, não o valor.

1. **Comando:** "Assinei Netflix por 45 reais"
   - **Esperado:** IA pergunta: "Qual o dia do vencimento?" (ou similar)
2. **Comando:** "5"
   - **Esperado (Antes do Fix):** IA registra despesa única de R$ 5,00. ❌
   - **Esperado (Após Fix):** IA registra **Recorrência** de **R$ 45,00** todo dia **5**. ✅

## Cenário 2: Assinatura no Cartão (Reconhecimento de Contexto)

**Objetivo:** Verificar se a IA reconhece o cartão mesmo se o usuário não disser explicitamente "cartão".

1. **Comando:** "Assinei Spotify no Nubank" (Assumindo que Nubank é um cartão)
   - **Esperado:** IA pergunta o valor e o dia (se não inferir).
2. **Comando:** "21,90 todo dia 10"
   - **Esperado:** IA cria recorrência de R$ 21,90 no **Cartão Nubank** (não conta bancária).

## Cenário 3: Slot-Filling Reverso (Valor)

**Objetivo:** Garantir que o fix não quebrou o fluxo normal de perguntar valor.

1. **Comando:** "Gastei no Uber"
   - **Esperado:** IA pergunta: "Qual o valor?"
2. **Comando:** "30"
   - **Esperado:** IA registra despesa de R$ 30,00 no Uber.

## Cenário 4: Débito Automático (Fluxo Completo)

**Objetivo:** Testar a criação de débito automático.

1. **Comando:** "Conta de luz é débito automático"
   - **Esperado:** IA pergunta valor e dia (se não houver recorrência prévia).
2. **Comando:** "150 dia 15"
   - **Esperado:** IA cria recorrência com flag de débito automático.

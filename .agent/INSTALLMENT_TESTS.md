# Plano de Testes: Categorização de Parcelamentos

Vamos verificar se a IA está categorizando corretamente as compras parceladas.

## Cenário 1: Compra Parcelada no Cartão (Inferência Automática)

**Objetivo:** Verificar se a IA infere a categoria baseada no nome da loja ou item.

1. **Comando:** "Comprei um tênis na Centauro em 3x de 150 no Nubank"
   - **Esperado:**
     - Descrição: "tênis" (ou "tênis na Centauro")
     - Valor Total: R$ 450,00
     - Parcelas: 3x de R$ 150,00
     - Cartão: Nubank
     - **Categoria:** "Vestuário" ou "Compras" (Não deve ser "Outros")

## Cenário 2: Compra Parcelada no Carnê (Categoria Explícita)

**Objetivo:** Verificar se a IA aceita categoria informada pelo usuário.

1. **Comando:** "Fiz um carnê nas Casas Bahia de uma geladeira, 10x de 300, categoria Casa"
   - **Esperado:**
     - Descrição: "geladeira"
     - Valor Total: R$ 3.000,00
     - Parcelas: 10x de R$ 300,00
     - **Categoria:** "Casa"

## Cenário 3: Compra Híbrida (Entrada + Parcelas)

**Objetivo:** Verificar se a categoria se aplica a todos os movimentos (entrada e parcelas).

1. **Comando:** "Comprei um sofá de 2000, dei 500 de entrada e o resto em 5x, categoria Móveis"
   - **Esperado:**
     - Entrada: R$ 500,00 (Categoria: Móveis)
     - Parcelas: 5x de R$ 300,00 (Categoria: Móveis)

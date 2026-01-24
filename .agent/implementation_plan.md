# Plano de Implementação: Melhoria na Categorização de Parcelamentos

**Objetivo:** Garantir que compras parceladas (`CREATE_INSTALLMENT` e `CREDIT_CARD_PURCHASE`) tenham a categoria inferida automaticamente pela IA, assim como acontece nos gastos à vista.

## Mudanças Propostas

### 1. Atualizar `src/app/actions/ai.ts`

- **Modificar `SYSTEM_INSTRUCTION`**:
  - Na seção `CREATE_INSTALLMENT` (item 15), reforçar a instrução para usar a "CATEGORIZAÇÃO INTELIGENTE".
  - Na seção `CREDIT_CARD_PURCHASE` (item 16), fazer o mesmo.
  - Instruir explicitamente: "SEMPRE tente inferir a categoria baseado na descrição (ex: Tênis -> Vestuário), usando as mesmas regras de CATEGORIZAÇÃO INTELIGENTE."

## Plano de Verificação

### Testes Manuais
Executar os cenários definidos em `.agent/INSTALLMENT_TESTS.md`:
1. "Comprei um tênis na Centauro em 3x de 150 no Nubank" -> Deve vir com categoria **Vestuário**.
2. "Comprei geladeira de 3000 em 10x" -> Deve vir com categoria **Moradia** ou **Casa**.

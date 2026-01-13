# Handoff: Implementação de Slot-Filling Explícito

## Problema
A IA (Gemini) não mantém contexto entre turnos de conversa. Quando o usuário diz "vendi um celular dia 15" e depois responde só "1050", a IA esquece a descrição e pergunta "do que se trata?".

## Solução Aprovada
Implementar **slot-filling explícito** com estado no frontend.

## Arquivos a Modificar

### 1. `src/app/hooks/useCommandCenterLogic.ts`
Adicionar estado `pendingSlots`:
```typescript
const [pendingSlots, setPendingSlots] = useState<{
  intent?: string;
  description?: string;
  amount?: number;
  date?: string;
  dueDate?: string;
  type?: 'income' | 'expense';
  category?: string;
} | null>(null);
```

Lógica:
- Se input é só número e há `pendingSlots` → preencher `amount`
- Se todos slots obrigatórios preenchidos → executar ação

### 2. `src/app/actions/ai.ts`
Modificar para retornar slots estruturados + lista de slots faltantes.

## Prompt para Iniciar

```
Implemente slot-filling explícito para a IA financeira.

Problema: quando usuário diz "vendi um celular dia 15" e depois responde só "1050", a IA esquece a descrição.

Solução: 
1. Adicionar estado `pendingSlots` em useCommandCenterLogic.ts
2. Se input é só número e há pendingSlots, preencher amount automaticamente
3. Se todos slots obrigatórios preenchidos, executar createMovement

Arquivos:
- src/app/hooks/useCommandCenterLogic.ts
- src/app/actions/ai.ts

Não quebre fluxos existentes (ex: "Gastei 50 no almoço" deve continuar funcionando)
```

## Testes de Validação
1. "Vendi X dia Y" → pergunta valor → "120" → registra corretamente com descrição X
2. "Gastei 50 no almoço" → registra diretamente (slots já completos)
3. "Apaga o último" → funciona normalmente

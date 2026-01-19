# Notas Técnicas: Correções de Layout e Tutorial (Nível 4)

**Data:** 19/01/2026
**Contexto:** Implementação do Tutorial Nível 4 e correções de interface.

## 1. Problema de Layout (Input "empurrado")

### Sintoma
O campo de input do chat (`CommandCenter`) estava sendo empurrado para fora da tela ou cortado na Home Page.

### Causa Raiz
O arquivo `src/app/page.tsx` continha múltiplos containers `flex` aninhados desnecessariamente, alguns sem restrições de altura adequadas (`min-h-0`), impedindo que o `flex-1` funcionasse como esperado para ocupar apenas o espaço disponível. Além disso, o `main` no `ClientLayout.tsx` permitia scroll na página inteira.

### Solução Aplicada
1.  **Simplificação do `src/app/page.tsx`**:
    *   Remoção de `div`s aninhadas redundantes.
    *   Estrutura simplificada para:
        ```tsx
        <div className="h-full flex flex-col ...">
            <Confetti />
            <PaymentReminder />
            <div className="flex-1 min-h-0 ..."> {/* Wrapper do Chat */}
                <CommandCenter />
            </div>
            <Footer className="flex-shrink-0" />
        </div>
        ```
2.  **Ajuste no `src/app/components/ClientLayout.tsx`**:
    *   Alterado o `main` para usar `overflow-hidden` especificamente na Home Page (`/`), forçando o scroll a ser gerenciado internamente pelo `CommandCenter`.

## 2. Problema de Scrollbar no Textarea

### Sintoma
O input de texto mostrava uma barra de rolagem vertical mesmo quando vazio ou com pouco texto.

### Solução Aplicada
*   **Controle Dinâmico de Overflow**: No `src/app/components/CommandCenter.tsx`, o estilo `overflow-y` do textarea agora é alterado dinamicamente via JavaScript/React:
    ```typescript
    // Only show scrollbar if content exceeds max height (200px)
    textarea.style.overflowY = textarea.scrollHeight > 200 ? 'auto' : 'hidden';
    ```

## 3. Problema de Duplicação na Simulação (Nível 4)

### Sintoma
A mensagem de resultado da simulação de juros compostos aparecia duas vezes ou piscava na tela.

### Causa Raiz
1.  A IA tentava processar o input do usuário durante o tutorial, causando conflito com a lógica local do tutorial.
2.  Falta de uma chave única (`key`) para a mensagem no React, causando problemas de reconciliação durante re-renders.

### Solução Aplicada
1.  **Bloqueio de IA**: Adicionado guarda no `useCommandCenterLogic.ts` para impedir processamento de IA durante steps `L4_` (exceto `L4_SIMULATION_TASK`).
2.  **ID Único**: Adicionado timestamp ao ID da mensagem para garantir unicidade:
    ```typescript
    id: 'l4-simulation-result-' + Date.now()
    ```

## 4. Lógica de Simulação Local

Para garantir resposta instantânea e determinística, a simulação de juros compostos do Nível 4 é calculada localmente no frontend (`useCommandCenterLogic.ts`), sem chamada à API da IA.

**Fórmula usada:**
```typescript
const monthlyRate = 0.005; // 0.5% a.m.
const futureValue = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
```

---
*Este documento serve como referência para futuras manutenções no layout da Home e lógica de tutoriais.*

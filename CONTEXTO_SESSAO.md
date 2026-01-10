# Contexto da Sessão

## 📌 Últimas Alterações (Sessão Atual)

### 1. Correções Críticas
- **Bug `account_id` NULL:** Corrigido. Se não houver conta padrão, o sistema agora cria/busca automaticamente uma conta "Carteira" (`getOrCreateWallet`) para garantir que nenhum movimento fique órfão.
- **Trial de 7 Dias:** Confirmado que a regra está no banco de dados (`handle_new_user_subscription`).

### 2. Melhorias de UX (IA & Chat)
- **Comando "Cancela":** Intercepta palavras como "cancela", "esquece", "me enganei". Não apaga o histórico, apenas confirma o cancelamento e para o processamento.
- **Comando "Desfazer":** Intercepta "apagar último", "desfazer". Busca o último movimento do usuário e o deleta, confirmando a ação.
- **UI da IA:**
  - Fundo menos escuro (`#1a1a1a`) para melhor leitura.
  - Mensagens do usuário em azul sólido para diferenciar da IA.
  - Indicador "🎤 Ouvindo..." visível acima do input quando o microfone está ativo.
  - **Cabeçalho:** Agora mostra Status/Créditos na esquerda e Plano/Vencimento na direita.

### 3. Comportamento da IA
- **Prompt Ajustado:** A IA agora age como um assistente que "anota" (ex: "✅ Anotado: Gastei R$ 50..."), sem repetir o que o usuário disse e sem fazer perguntas de follow-up desnecessárias ("Precisa de mais alguma coisa?").

---

## ⚠️ Atenção para a Próxima Sessão

1.  **Código Legado/Lixo:** Este projeto contém arquivos herdados de outro sistema. **MUITO CUIDADO** ao assumir que algo existe ou funciona. Sempre verifique o arquivo antes de usar.
2.  **Leitura Obrigatória:**
    -   Leia `RULES.md` para entender as diretrizes de governança (autorização explícita).
    -   Leia `PROJECT_CONTEXT.md` para entender a arquitetura e tabelas oficiais.
3.  **Foco Atual:** Testes do **Nível 1 (Carteira)**.
4.  **Próximos Passos:**
    -   Validar estabilidade do Nível 1.
    -   Definir e implementar regras de transição para o Nível 2 (Organização).
    -   **NÃO** implementar funcionalidades de níveis superiores (2, 3, 4) sem autorização explícita.

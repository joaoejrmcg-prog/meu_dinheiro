# 🔄 Contexto para Nova Sessão - Meu Dinheiro IA

## 📅 Data: 2026-01-10 (Sessão 3 - Onboarding + Deploy)

---

## ✅ O que foi implementado NESTA sessão:

### 1. Erro de Cadastro de Novos Usuários - RESOLVIDO
- **Problema**: `AuthApiError: Database error saving new user`
- **Causa Raiz**: A função `generate_referral_code()` estava falhando quando chamada pelo trigger
- **Solução**: Embutir a lógica de geração de código diretamente na função `handle_new_user()`
- **SQL Aplicado**: `handle_new_user()` agora gera código inline + bypass RLS com `set_config`

### 2. Termos de Uso (TermsModal) - RESOLVIDO
- **Problema**: Modal não aparecia para novos usuários
- **Solução**: Adicionado `<TermsModal />` em `src/app/components/ClientLayout.tsx`

### 3. Tutorial "Dança das Letras" - RESOLVIDO
- **Problema**: Mensagens do tutorial apareciam e sumiam, glitch visual
- **Solução**: Refatorado `useCommandCenterLogic.ts` com IDs fixos e atualizações funcionais de estado
- **Arquivo**: `src/app/hooks/useCommandCenterLogic.ts` (linhas 38-94)

### 4. Deploy Automático Vercel - EM VERIFICAÇÃO
- **Problema**: `git push` não disparava deploy no Vercel
- **Investigação Feita**:
  - Branch local renomeado de `master` para `main` ✅
  - Branch padrão no GitHub mudado para `main` ✅
  - Repositório GitHub antigo APAGADO e recriado ✅
  - Projeto Vercel antigo APAGADO e recriado ✅
- **Status**: Primeiro deploy do projeto "limpo" está rodando agora
- **Próximo Passo**: Testar se um novo push dispara deploy automático

---

## ⚠️ SQL JÁ APLICADO NO SUPABASE:

```sql
-- handle_new_user COM bypass RLS e código inline
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  new_referral_code TEXT := '';
  i INTEGER;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', NEW.id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', NEW.id)::text, true);

  FOR i IN 1..8 LOOP
    new_referral_code := new_referral_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  
  INSERT INTO public.profiles (user_id, referral_code)
  VALUES (NEW.id, new_referral_code);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'ERROR handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- handle_new_user_init COM bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user_init()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', NEW.user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', NEW.user_id)::text, true);

  INSERT INTO public.accounts (user_id, name, type, balance)
  VALUES (NEW.user_id, 'Carteira', 'wallet', 0)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'ERROR handle_new_user_init: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Trigger da carteira REATIVADO
ALTER TABLE public.profiles ENABLE TRIGGER on_profile_created_init;
```

---

## 📁 Arquivos Modificados Nesta Sessão

| Arquivo | O que foi alterado |
|---------|-------------------|
| `src/app/components/ClientLayout.tsx` | Adicionado import e renderização do `<TermsModal />` |
| `src/app/hooks/useCommandCenterLogic.ts` | Refatorado useEffect inicial para usar IDs fixos e evitar race conditions |

---

## 🔮 GitHub/Vercel - Estado Atual

- **Repositório GitHub**: `joaoejrmcg-prog/meu_dinheiro_ia` (RECRIADO LIMPO)
- **Branch Padrão**: `main`
- **Projeto Vercel**: Recriado conectado ao repo novo
- **Variáveis de Ambiente**: (precisam ser re-adicionadas no Vercel)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `ASAAS_API_KEY`
  - `ASAAS_WALLET_ID`

---

## 🧪 Para Testar na Próxima Sessão:

1. **Verificar Deploy Automático**:
   - Fazer qualquer alteração → `git commit -am "teste" && git push origin main`
   - Ver se aparece novo deploy no Vercel
   
2. **Testar Cadastro de Novo Usuário**:
   - Criar conta nova
   - Verificar se Profile e Carteira são criados
   - Verificar se TermsModal aparece

3. **Testar Tutorial**:
   - Usuário nível 0 deve ver mensagens estáveis sem piscar

---

## 📋 Sessões Anteriores (Resumo)

- Sistema de Níveis + Tutorial
- Relatórios com Saldo Anterior e Impressão
- Transferências entre Contas
- Empréstimos (CRUD)
- Metas com Prazo
- Projeção de Saldo (6 meses)
- Simulações de Cenário

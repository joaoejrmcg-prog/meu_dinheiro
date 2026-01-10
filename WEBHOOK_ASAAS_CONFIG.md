# 🔐 Guia de Configuração do Webhook Asaas

## ⚠️ IMPORTANTE: Configure isso ANTES de usar em produção!

O webhook agora está **protegido por token de segurança**. Sem a configuração correta, os webhooks do Asaas serão rejeitados.

---

## 📋 Passo 1: Gerar Token Secreto

Você precisa de um token secreto único. Use um destes métodos:

### Opção A: Gerar Online
Acesse: https://www.uuidgenerator.net/
Copie o UUID gerado (exemplo: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Opção B: Gerar no Terminal
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell (Windows)
[guid]::NewGuid().ToString()
```

**Guarde este token com segurança!** Você vai usar em 2 lugares.

---

## 📋 Passo 2: Adicionar no `.env.local`

Abra o arquivo `.env.local` na raiz do projeto e adicione:

```env
# Token de segurança do webhook Asaas
ASAAS_WEBHOOK_TOKEN=seu_token_secreto_aqui
```

**Exemplo:**
```env
ASAAS_WEBHOOK_TOKEN=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

> ⚠️ **NUNCA** commite este arquivo no Git! Ele já deve estar no `.gitignore`.

---

## 📋 Passo 3: Configurar no Painel Asaas Sandbox

### 3.1 Acessar Configurações de Webhook

1. Faça login em: **https://sandbox.asaas.com**
2. No menu lateral esquerdo, clique em **"Configurações"** (ícone de engrenagem)
3. Clique em **"Webhooks"** ou **"Integrações" → "Webhooks"**

### 3.2 Adicionar Novo Webhook

Clique em **"Adicionar Webhook"** ou **"Novo Webhook"**

### 3.3 Preencher Configurações

| Campo | Valor |
|-------|-------|
| **Nome** | `Webhook Produção` ou `Meu Negócio IA` |
| **URL** | `https://seu-dominio.com/api/asaas/webhook` |
| **Token de Acesso** | Cole o mesmo token do `.env.local` |
| **Eventos** | Marque os seguintes: |

**Eventos Importantes:**
- ✅ `PAYMENT_CONFIRMED` - Quando pagamento é confirmado
- ✅ `PAYMENT_RECEIVED` - Quando pagamento é recebido
- ✅ `PAYMENT_OVERDUE` - Quando pagamento está vencido
- ✅ `PAYMENT_REFUNDED` - Quando pagamento é estornado (opcional)

### 3.4 Testar Webhook

Após salvar, o Asaas mostra opção **"Testar Webhook"**:
1. Clique em **"Testar"**
2. Você deve ver: `✓ Webhook testado com sucesso` ou similar
3. Se falhar, verifique se o token está correto

---

## 🧪 Passo 4: Testar Localmente (ngrok)

Para testar webhooks localmente durante desenvolvimento:

### 4.1 Instalar ngrok
```bash
# Windows (Chocolatey)
choco install ngrok

# Ou baixar de: https://ngrok.com/download
```

### 4.2 Expor localhost
```bash
ngrok http 3000
```

Você receberá uma URL como: `https://abc123.ngrok.io`

### 4.3 Configurar no Asaas Sandbox
Use a URL do ngrok: `https://abc123.ngrok.io/api/asaas/webhook`

### 4.4 Verificar Logs
No terminal onde roda `npm run dev`, você verá:
```
[WEBHOOK SECURITY] Token validated successfully ✓
Received Asaas Webhook: PAYMENT_CONFIRMED abc123
```

---

## ✅ Checklist de Validação

- [ ] Token gerado e salvo com segurança
- [ ] Token adicionado no `.env.local`
- [ ] Servidor reiniciado (`npm run dev`)
- [ ] Webhook configurado no painel Asaas
- [ ] Mesmo token usado nos 2 lugares
- [ ] Teste do webhook passou com sucesso
- [ ] Logs mostram "Token validated successfully ✓"

---

## 🚨 Solução de Problemas

### Erro: `ASAAS_WEBHOOK_TOKEN not configured`
- Verifique se adicionou a variável no `.env.local`
- Reinicie o servidor com `npm run dev`

### Erro: `401 Unauthorized`
- O token no Asaas está diferente do `.env.local`
- Compare os dois tokens caractere por caractere

### Webhook não chega
- Verifique se a URL está correta
- Se local, use ngrok para expor
- Confirme que os eventos estão marcados

### Logs não aparecem
- Verifique o console do terminal
- Olhe também nos logs do Asaas (painel → Webhooks → Histórico)

---

## 🔐 Segurança

### ✅ O que está protegido agora:
- Apenas Asaas pode enviar webhooks válidos
- Tentativas maliciosas são logadas e bloqueadas
- Token secreto nunca exposto publicamente

### ⚠️ Boas Práticas:
- **Nunca** compartilhe o token do webhook
- Use tokens diferentes para sandbox e produção
- Rotacione o token periodicamente (a cada 6 meses)
- Monitore logs de tentativas bloqueadas

---

## 🎯 Próximos Passos

Após configurar o webhook:

1. ✅ Testar criação de assinatura
2. ✅ Simular pagamento no sandbox
3. ✅ Verificar se status atualiza corretamente
4. ✅ Testar estorno/cancelamento
5. ✅ Repetir processo para produção (com URL real)

---

**Dúvidas?** Consulte a [Documentação Oficial do Asaas](https://docs.asaas.com/reference/webhooks)

# 🧪 Testes de Stress - Débito Automático

Execute cada teste e anote o resultado. Cole os erros/comportamentos inesperados aqui pra corrigirmos.

---

## 🔧 Pré-requisitos
- [ ] Dev server rodando (`npm run dev`)
- [ ] Logado no app
- [ ] Ter pelo menos 1 conta bancária cadastrada (ex: "Itaú", "Nubank")

---

## Teste 1: Comando básico com DA
**Digitar no chat:**
```
Conta de luz de 150 reais todo dia 10, débito automático
```

**Esperado:**
- ✅ Cria recorrência com `is_auto_debit = true`
- ✅ Mensagem confirma "débito automático"
- ✅ Aparece com ícone ⚡ na aba Recorrências

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

## Teste 2: DA com conta específica
**Digitar:**
```
Condomínio de 800 reais, débito automático no Itaú
```

**Esperado:**
- ✅ Vincula à conta Itaú
- ✅ Confirma conta + débito automático na msg

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

## Teste 3: DA sem valor (slot-filling)
**Digitar:**
```
Conta de água todo dia 15 em débito automático
```

**Esperado:**
- ✅ IA pergunta o valor
- ✅ Após responder, cria com `is_auto_debit = true`

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

## Teste 4: Variações de linguagem
**Testar cada um separadamente:**

```
débito automático da conta de internet, 120 reais, dia 20
```
```
pago luz em débito automático, 180 no dia 5
```
```
minha netflix é débito automático, 55 reais
```

**Resultado:**
- [ ] Todos funcionaram
- [ ] Falhou: _________________

---

## 💪 STRESS TESTS

### Stress 1: Múltiplos DA em sequência
**Digitar:**
```
Cadastra em débito automático: luz 150 dia 10, água 80 dia 15 e internet 120 dia 20
```

**Esperado:** Cria 3 recorrências separadas

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

### Stress 2: Marcar existente como DA
**Passo 1 - criar normal:**
```
Academia 99 reais todo dia 5
```
**Passo 2 - marcar como DA:**
```
A academia é débito automático
```

**Esperado:** Atualiza a recorrência existente

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

### Stress 3: Consultar se é DA
**Digitar:**
```
A conta de luz é débito automático?
```

**Esperado:** IA responde sim/não baseado no cadastro

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

### Stress 4: Listar todos os DA
**Digitar:**
```
Quais contas estão em débito automático?
```

**Esperado:** Lista todas as recorrências com `is_auto_debit = true`

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

### Stress 5: Informar valor do mês (conta variável)
**Pré-requisito:** Ter uma conta de luz como DA

**Digitar:**
```
A luz desse mês veio 185 reais
```

**Esperado:** 
- Cria movimento do mês com R$ 185
- Marca como pago automaticamente

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

### Stress 6: Editar valor de DA existente
**Digitar:**
```
Muda o valor do débito automático da luz pra 180
```

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

### Stress 7: Cancelar DA
**Digitar:**
```
Cancela o débito automático do condomínio
```

**Esperado:** Remove ou desativa a recorrência

**Resultado:**
- [ ] Funcionou
- [ ] Erro: _________________

---

## 📝 Anotações Gerais

Cole aqui qualquer comportamento estranho, mensagens de erro do console, ou prints:

```
(cole aqui)
```

---

## Próximos Passos

Após executar, traga os resultados e corrigimos juntos! 🚀

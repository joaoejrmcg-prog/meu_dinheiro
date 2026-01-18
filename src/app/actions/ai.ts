"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AIResponse, IntentType } from "../types";
import { createMovement, getFinancialStatus, deleteLastMovement, updateLastMovementAccount } from "./finance-core";
import { setWalletInitialBalance } from "./assets";

// Initialize OpenAI for TTS only (optional - works without it)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Helper to get all available Gemini API keys
const getGeminiApiKeys = () => {
  const keys = [
    process.env.GEMINI_SECRET_KEY_1,
    process.env.GEMINI_SECRET_KEY_2,
    process.env.GEMINI_SECRET_KEY_3,
    process.env.GEMINI_SECRET_KEY_4,
    process.env.GEMINI_SECRET_KEY_5
  ].filter((key): key is string => !!key && key.length > 0);

  return [...new Set(keys)];
};

const SYSTEM_INSTRUCTION = `
Você é o "Guardião da Lógica Financeira" do app Meu Dinheiro.
Sua missão é proteger a verdade dos números. Você não é apenas um chatbot, você é um contador rigoroso.

### REGRAS DE OURO (CRÍTICO):
1. **Empréstimo ≠ Renda**:
   - Se o usuário "pegou dinheiro emprestado", isso aumenta o saldo (Caixa), mas NÃO é receita.
   - Flag: \`is_loan: true\`, \`type: 'income'\`, \`loan_type: 'taken'\`.

2. **Reserva ≠ Gasto**:
   - Se o usuário "guardou dinheiro" (ex: "Guardei 200 pra viagem"), isso sai da conta mas NÃO é despesa.
   - Flag: \`is_reserve: true\`, \`type: 'transfer'\`.

3. **Reembolso ≠ Renda**:
   - Se o usuário recebeu um reembolso, isso anula um gasto anterior.
   - Flag: \`is_reimbursement: true\`.

4. **Pagamento de Empréstimo**:
   - Se o usuário pagou uma dívida, isso reduz o saldo mas NÃO é despesa (é redução de passivo).
   - Flag: \`is_loan: true\`, \`type: 'expense'\`, \`loan_type: 'taken'\`.

5. **Transferência entre Contas**:
   - Se o usuário "transferiu", "passou", "moveu", "depositou" ou "saquei" dinheiro.
   - Exemplos: "Transferi 500 da Carteira pro Nubank", "Passei 200 do banco pra carteira".
   - **DEPÓSITO**: "Depositei 300 no Itaú" = Transferência da Carteira para o Itaú.
     - \`from_account\`: "Carteira" (sempre, para depósitos).
     - \`to_account\`: nome do banco mencionado.
   - **SAQUE**: "Saquei 200 do Itaú", "Fiz um saque de 500", "Tirei 300 do banco" = Transferência do banco para a Carteira.
     - \`from_account\`: nome do banco mencionado (ou conta padrão se não especificar).
     - \`to_account\`: "Carteira" (sempre, para saques).
   - Flag: \`is_transfer: true\`, \`from_account\`: conta origem, \`to_account\`: conta destino.
   - Isso NÃO é receita nem despesa, apenas movimentação interna.

### CATEGORIZAÇÃO INTELIGENTE:

**Para RECEITAS (income):**
- "salário", "pagamento do trabalho", "holerite" → category: "Salário"
- "freelance", "bico", "extra", "trabalho extra" → category: "Freelance"
- "vendi", "venda" → category: "Vendas"
- "presente", "ganhei de presente" → category: "Presente"
- "reembolso", "me devolveram" → category: "Reembolso"
- "investimento", "rendimento", "dividendo" → category: "Investimentos"
- Se não conseguir inferir (ex: "recebi", "ganhei", "entrou" sem contexto) → category: "Outros"

**Para DESPESAS (expense):**
- "almoço", "jantar", "café", "comida", "restaurante", "mercado", "supermercado", "padaria", "lanche", "pizza", "hambúrguer", "açougue", "feira" → category: "Alimentação"
- "uber", "99", "gasolina", "combustível", "estacionamento", "transporte", "ônibus", "metrô", "passagem", "pedágio", "conserto do carro", "conserto de carro", "oficina", "mecânico", "pneu", "borracharia", "revisão", "funilaria", "lanternagem", "troca de óleo", "lataria", "manutenção do carro", "manutenção do veículo", "IPVA", "licenciamento", "seguro do carro" → category: "Transporte"
- "aluguel", "condomínio", "luz", "água", "internet", "gás", "IPTU", "sofá", "móvel", "móveis", "cadeira", "mesa", "estante", "guarda-roupa", "armário", "colchão", "cama", "geladeira", "fogão", "máquina de lavar", "microondas", "eletrodoméstico", "tapete", "cortina", "decoração", "reforma", "pintura", "encanador", "eletricista" → category: "Moradia"
- "remédio", "farmácia", "médico", "consulta", "exame", "dentista", "psicólogo", "terapia", "plano de saúde", "academia", "hospital", "cirurgia", "vacina", "óculos", "lente" → category: "Saúde"
- "cinema", "show", "festa", "bar", "lazer", "streaming", "netflix", "spotify", "disney", "amazon prime", "hbo", "youtube premium", "assinatura", "jogo", "videogame", "playstation", "xbox", "viagem", "hotel", "passeio" → category: "Lazer"
- "curso", "livro", "escola", "faculdade", "mensalidade escolar", "material escolar", "apostila", "uniforme escolar" → category: "Educação"
- "roupa", "camisa", "camiseta", "calça", "vestido", "blusa", "jaqueta", "casaco", "sapato", "tênis", "sandália", "chinelo", "calçado", "meia", "cueca", "calcinha", "sutiã", "bermuda", "short", "saia", "moletom" → category: "Vestuário"
- "cabeleireiro", "barbeiro", "manicure", "pedicure", "salão", "corte de cabelo", "depilação", "estética", "limpeza", "faxina", "diarista", "empregada", "lavanderia", "costureira", "alfaiate" → category: "Serviços"
- "shopping", "compras", "presente", "eletrônico", "celular", "computador", "notebook", "tablet", "fone", "relógio" → category: "Compras"
- Se não conseguir inferir → category: "Outros"

### INTENÇÕES (INTENTS):

1. **REGISTER_MOVEMENT** (Registrar qualquer movimentação)
   - **Slots Obrigatórios (para gastos avulsos)**:
     - \`amount\` (Valor).
     - \`description\` (Descrição).
   - **DISTINÇÃO IMPORTANTE - ÚNICO vs RECORRENTE**:
     - "Conta de luz vence dia 10" → movimento ÚNICO (deste mês só)
     - "Conta de luz vence **TODO** dia 10" → RECORRENTE (use CREATE_RECURRENCE)
     - Palavras-chave para RECORRENTE: "todo mês", "toda semana", "todo dia X", "mensal", "semanal"
   - **Para movimentos ÚNICOS com due_date**:
     - Se não mencionar valor, pergunte: "Qual o valor desta conta?"
   - **Slots de Lógica (Inferir)**:
     - \`type\`: 'income' | 'expense' | 'transfer'.
     - \`category\`: Nome da categoria (SEMPRE inferir baseado nas regras acima).
     - \`date\`: Data em que a compra/transação foi feita (YYYY-MM-DD).
     - \`due_date\`: Data de vencimento (YYYY-MM-DD). Use quando o usuário disser "pagar dia X", "vence dia X", "até dia X".
     - \`is_paid\`: boolean. Se tem \`due_date\` no futuro, marcar como \`false\`. Se for pagamento à vista/imediato, marcar como \`true\`.
     - \`is_loan\`: boolean.
     - \`loan_type\`: 'taken' (peguei) | 'given' (emprestei).
     - \`is_reserve\`: boolean.
     - \`reserve_name\`: Nome da reserva (ex: "Viagem").
   - **IMPORTANTE**: NÃO pergunte em qual conta o dinheiro entrou/saiu. O sistema usa a conta padrão automaticamente.
   - **IMPORTANTE - MAPEAMENTO DE CONTAS**:
     - Se o usuário mencionar "no dinheiro", "em dinheiro", "do dinheiro" → \`account_name\`: "Carteira"
     - Isso indica que a transação é na conta de dinheiro físico (Carteira), não na conta bancária padrão.
     - Exemplo: "Recebi 50 no dinheiro" → registrar na conta "Carteira"
     - Exemplo: "Gastei 30 em dinheiro" → registrar na conta "Carteira"
   - **IMPORTANTE - PIX e DÉBITO**:
     - Se o usuário mencionar "pix", "no pix", "por pix", "débito", "no débito", "cartão de débito" → \`payment_method\`: "bank"
     - Isso indica que a transação sai de conta bancária, NÃO de dinheiro físico.
     - Exemplo: "Comprei tênis de 180 no pix" → \`payment_method\`: "bank"
     - Exemplo: "Paguei 50 no débito" → \`payment_method\`: "bank"
     - **ESPECIAL**: Se o usuário especificar o banco junto com pix/débito (ex: "pix do Itaú", "pix do Nubank", "débito do Bradesco"):
       - Extraia o nome do banco e use \`account_name\`: "[nome do banco]" 
       - NÃO use \`payment_method\` neste caso, já sabemos a conta!
       - Exemplo: "paguei no pix do itau" → \`account_name\`: "Itaú"
       - Exemplo: "pix do nubank" → \`account_name\`: "Nubank"
   - **IMPORTANTE sobre PAGAMENTOS FUTUROS**:
     - Se o usuário disse "comprei X e vou pagar dia Y" ou "pago dia Y":
       - \`date\` = data da compra (geralmente hoje)
       - \`due_date\` = dia Y do mês atual (se Y > hoje) ou do próximo mês (se Y < hoje)
       - \`is_paid\` = false


2. **GET_FINANCIAL_STATUS** (Consultar saúde financeira)
   - Gatilhos: "Como estou?", "Saldo real", "Quanto ganhei de verdade?".
   - Retorna: Renda Real vs Fluxo de Caixa.

3. **ADJUST_BALANCE** (Corrigir saldo inicial)
   - Gatilhos: "Corrija meu saldo inicial", "Meu saldo inicial é", "Ajusta meu saldo pra".
   - **Slots Obrigatórios**:
     - \`amount\` (Novo valor do saldo).
   - Cria um ajuste de saldo (receita ou despesa de ajuste).

4. **SIMULATE_SCENARIO** (Simular economia)
   - Gatilhos: "E se eu economizar 50 no Uber?", "Se eu cortar 100 de lanche", "Quanto junta se guardar 200 por mês?".
   - **Slots**:
     - \`amount\` (Valor economizado).
     - \`category\` (Categoria/Item onde vai economizar).
     - \`period\` (Frequência: 'monthly' (padrão) ou 'once').
   - **Ação**: Apenas calcula e projeta, NÃO registra nada.

5. **DELETE_LAST_MOVEMENT** (Apagar último lançamento)
   - Gatilhos: "Apaga o último", "Exclui o último lançamento", "Desfaz o último registro", "Cancela isso".
   - **Ação**: Remove o movimento mais recente do banco de dados.

5b. **CORRECT_LAST_MOVEMENT** (Corrigir último lançamento) ⚠️ IMPORTANTE
   - **QUANDO USAR**: Quando o usuário quer corrigir algo do último lançamento (valor, descrição, conta, etc).
   - **Gatilhos**: "Me enganei, foi X", "Errei, era X", "Não foi X, foi Y", "Era X não Y", "Corrige pra X", "O certo é X", "Na verdade foi X", "O valor certo é X", "Era no X não no Y", "Digitei errado".
   - **Exemplos**:
     - "Não foi 80, foi 90" → CORRECT_LAST_MOVEMENT, new_amount: 90
     - "Era no Itaú, não na Carteira" → CORRECT_LAST_MOVEMENT, new_account: "Itaú"
     - "O certo é camiseta, não camisa" → CORRECT_LAST_MOVEMENT, new_description: "camiseta"
   - **Slots**:
     - \`new_amount\`: Novo valor (se for correção de valor).
     - \`new_description\`: Nova descrição (se for correção de descrição).
     - \`new_account\`: Nova conta (se for correção de conta).
   - **Ação**: Busca o último lançamento e atualiza o campo especificado.

6. **CONFIRMATION_REQUIRED**
   - Use APENAS se faltar \`amount\` ou \`description\`.

7. **RECONCILE_PAYMENT** (Confirmar pagamento de conta existente) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário diz que PAGOU algo que provavelmente já existe como conta pendente.
   - **Gatilhos**: "Paguei o X", "Paguei a X", "Quitei o X", "Já paguei o X", "Liquidei o X", "Paguei a conta de X".
   - **Exemplos que DEVEM usar este intent**:
     - "Paguei o IPTU" → RECONCILE_PAYMENT, search_term: "IPTU"
     - "Paguei a conta de luz" → RECONCILE_PAYMENT, search_term: "luz"
     - "Paguei o conserto do carro" → RECONCILE_PAYMENT, search_term: "conserto do carro"
     - "Paguei o aluguel" → RECONCILE_PAYMENT, search_term: "aluguel"
     - "Paguei a conta de luz de 180" → RECONCILE_PAYMENT, search_term: "luz", amount: 180
     - "Quitei o colégio por 500" → RECONCILE_PAYMENT, search_term: "colégio", amount: 500
   - **Exemplos que NÃO usam este intent** (gasto novo sem conta pendente):
     - "Paguei 50 no mercado" → REGISTER_MOVEMENT (gasto avulso!)
     - "Gastei 30 no uber" → REGISTER_MOVEMENT
   - **Regra de Ouro**: "Paguei" + nome de algo (sem valor no início) = RECONCILE_PAYMENT
   - **IMPORTANTE**: NÃO peça valor! O sistema vai buscar a conta pendente e usar o valor existente. Se o usuário não mencionar valor, use o valor da conta pendente.
   - **Slots**:
     - \`search_term\`: O que foi pago (ex: "luz", "IPTU", "aluguel", "conserto do carro").
     - \`amount\`: Valor pago (OPCIONAL - use apenas se o usuário mencionar).
   - **Ação**: Busca conta pendente, atualiza valor se fornecido, marca como pago.

7b. **UPDATE_PENDING_AMOUNT** (Informar valor de conta pendente SEM pagar)
   - **QUANDO USAR**: Quando o usuário quer informar o valor de uma conta que chegou, mas ainda não pagou.
   - **Gatilhos**: "Chegou a conta de X de Y", "A conta de X veio Y", "A conta de X é Y"
   - **Exemplos**:
     - "Chegou a conta de luz de 180" → UPDATE_PENDING_AMOUNT, search_term: "luz", amount: 180
     - "A conta de água veio 95" → UPDATE_PENDING_AMOUNT, search_term: "água", amount: 95
   - **Slots**:
     - \`search_term\`: O que é a conta (ex: "luz", "água", "internet").
     - \`amount\`: Valor da conta (OBRIGATÓRIO).
   - **Ação**: Busca conta pendente e atualiza apenas o valor (não marca como pago).

8. **CORRECT_LAST_ACCOUNT** (Corrigir conta do último lançamento)
   - **QUANDO USAR**: Quando o usuário percebe que o último lançamento foi registrado na conta errada.
   - **Gatilhos**: 
     - "Não foi no X, foi no Y"
     - "Era na Carteira"
     - "Muda pra Carteira"
     - "Na verdade foi no dinheiro"
     - "Errei a conta, era no Nubank"
   - **Exemplos**:
     - "Não foi no Itaú, foi no dinheiro" → CORRECT_LAST_ACCOUNT, new_account: "Carteira"
     - "Muda pra Carteira" → CORRECT_LAST_ACCOUNT, new_account: "Carteira"
     - "Era no Nubank" → CORRECT_LAST_ACCOUNT, new_account: "Nubank"
   - **IMPORTANTE**: "dinheiro", "em dinheiro", "no dinheiro" = conta "Carteira"
   - **Slots**:
     - \`new_account\`: Nome da conta correta (ex: "Carteira", "Nubank", "Itaú").
   - **Ação**: Atualiza o último movimento para usar a nova conta.

9. **SET_DEFAULT_ACCOUNT** (Definir conta principal)
   - **QUANDO USAR**: Quando o usuário quer mudar qual conta é a principal/padrão.
   - **Gatilhos**:
     - "Torna a X minha conta principal"
     - "Minha conta principal agora é X"
     - "Define X como conta padrão"
     - "Quero que a X seja a conta principal"
   - **Exemplos**:
     - "Torna a Carteira minha conta principal" → SET_DEFAULT_ACCOUNT, account_name: "Carteira"
     - "Minha conta principal agora é o Nubank" → SET_DEFAULT_ACCOUNT, account_name: "Nubank"
   - **Slots**:
     - \`account_name\`: Nome da conta que será a principal.
   - **Ação**: Define a conta como padrão para novos lançamentos.

10. **CREATE_ACCOUNT** (Criar nova conta bancária)
   - **QUANDO USAR**: Quando o usuário quer criar uma nova conta/banco.
   - **Gatilhos**:
     - "Criar conta no X"
     - "Abri uma conta no X"
     - "Quero criar uma conta no X"
     - "Nova conta no X"
     - "Adicionar banco X"
   - **Exemplos**:
     - "Criar conta no Santander" → CREATE_ACCOUNT, account_name: "Santander", account_type: "bank"
     - "Abri uma conta no Inter" → CREATE_ACCOUNT, account_name: "Inter", account_type: "bank"
     - "Quero criar uma conta poupança" → CREATE_ACCOUNT, account_name: "Poupança", account_type: "savings"
   - **Slots**:
     - \`account_name\`: Nome da conta/banco (OBRIGATÓRIO).
     - \`account_type\`: Tipo da conta - "bank" (padrão) ou "savings".
   - **Ação**: Cria a conta e confirma para o usuário.

11. **CREATE_RECURRENCE** (Criar conta recorrente/mensal)
   - **QUANDO USAR**: Quando o usuário menciona "TODO dia X", "toda semana", "mensal", "todo mês".
   - **Gatilhos**:
     - "Minha conta de X vence TODO dia Y"
     - "Pago X todo mês dia Y"
     - "Recebo salário todo dia Y"
     - "Conta de X é mensal, dia Y"
   - **Exemplos**:
     - "Conta de luz vence todo dia 10" → CREATE_RECURRENCE, description: "Conta de luz", due_day: 10, type: "expense"
     - "Recebo salário todo dia 5" → CREATE_RECURRENCE, description: "Salário", due_day: 5, type: "income"
     - "Aluguel de 1500 todo dia 10" → CREATE_RECURRENCE, description: "Aluguel", due_day: 10, amount: 1500, type: "expense"
   - **IMPORTANTE**: NÃO exija valor para recorrências. Se o usuário não mencionar, registre com \`amount: 0\`.
   - **Slots**:
     - \`description\`: Nome da conta (ex: "Conta de luz", "Aluguel", "Salário").
     - \`due_day\`: Dia do mês (1-31).
     - \`amount\`: Valor (OPCIONAL - usar 0 se não informado).
     - \`type\`: 'income' | 'expense'.
     - \`frequency\`: 'monthly' (padrão) | 'weekly'.
    - **Ação**: Cria uma recorrência que aparecerá no calendário todo mês.

11. **DELETE_RECURRENCE** (Cancelar/excluir conta recorrente)
   - **QUANDO USAR**: Quando o usuário quer parar de acompanhar uma conta recorrente.
   - **Gatilhos**:
     - "Cancela o X"
     - "Tira a recorrência do X"
     - "Não tenho mais X"
     - "Exclui o X das recorrentes"
     - "Para de cobrar X"
   - **Exemplos**:
     - "Cancela o aluguel" → DELETE_RECURRENCE, search_term: "aluguel"
     - "Tira a netflix" → DELETE_RECURRENCE, search_term: "netflix"
     - "Não tenho mais internet" → DELETE_RECURRENCE, search_term: "internet"
   - **Slots**:
     - \`search_term\`: Nome da recorrência a ser cancelada.
   - **Ação**: Busca e desativa a recorrência correspondente.

12. **SET_AUTO_DEBIT** (Criar/marcar débito automático) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário menciona "débito automático", "DA", "debita automático", ou diz que o banco paga sozinho.
   - **Gatilhos**:
     - "X é débito automático"
     - "Coloca X em débito automático"
     - "débito automático"
     - "X de Y reais dia Z, débito automático"
   - **Exemplos**:
     - "Conta de luz de 150 dia 10, débito automático" → SET_AUTO_DEBIT, search_term: "luz", amount: 150, due_day: 10
     - "Condomínio de 800 reais, débito automático no Itaú" → SET_AUTO_DEBIT, search_term: "condomínio", amount: 800, account_name: "Itaú"
     - "A conta de água é débito automático" → SET_AUTO_DEBIT, search_term: "água"
   - **Slots**:
     - \`search_term\`: Nome da conta (OBRIGATÓRIO).
     - \`amount\`: Valor (OPCIONAL - se não informado, é conta variável).
     - \`due_day\`: Dia do vencimento (OPCIONAL se já existe recorrência).
     - \`account_name\`: Banco do débito (OPCIONAL).
   - **Ação**: Cria ou atualiza recorrência com is_auto_debit = true.

13. **CHECK_AUTO_DEBIT** (Verificar se é débito automático)
   - **QUANDO USAR**: Quando o usuário pergunta se algo é débito automático.
   - **Gatilhos**:
     - "X é débito automático?"
     - "Minha conta de X é débito automático?"
   - **Slots**:
     - \`search_term\`: O que verificar.
   - **Ação**: Busca recorrência e informa se is_auto_debit é true ou false.

14. **LIST_AUTO_DEBITS** (Listar todos os débitos automáticos)
   - **QUANDO USAR**: Quando o usuário quer saber quais contas estão em DA.
   - **Gatilhos**:
     - "Quais são meus débitos automáticos?"
     - "Lista os débitos automáticos"
     - "O que está em débito automático?"
   - **Ação**: Busca todas as recorrências com is_auto_debit = true e lista.

### REGRAS CRÍTICAS DE SLOT-FILLING (LEIA COM ATENÇÃO):

Ao receber o CONTEXTO DA CONVERSA, você DEVE usar as informações já fornecidas.

**EXEMPLO CORRETO:**
- Usuário: "Vendi um jogo de cadeiras antigas e vou receber dia 25"
- IA pergunta: "Qual o valor?"
- Usuário responde: "120"
- **AÇÃO CORRETA**: Registrar IMEDIATAMENTE com:
  - \`description\`: "jogo de cadeiras antigas" (já foi dito!)
  - \`amount\`: 120
  - \`due_date\`: 2026-01-25
  - \`type\`: income
  - **NÃO pergunte "do que se trata?" ou "qual a descrição?" - JÁ FOI DITO!**

**REGRA DE OURO**: Se no CONTEXTO DA CONVERSA o usuário já mencionou O QUE foi (estante, cadeira, tênis, etc.), isso É a descrição. Use-a diretamente.

### INTERPRETAÇÃO DE DATAS:
- "hoje" → data atual (fornecida abaixo)
- "ontem" → data atual - 1 dia
- "anteontem" → data atual - 2 dias
- "dia X" ou "no dia X" → dia X do mês atual
- Se nenhuma data mencionada → usar data atual
- SEMPRE retornar o slot \`date\` no formato YYYY-MM-DD

### FORMATO DE RESPOSTA (JSON PURO):
{
  "intent": "INTENT_NAME",
  "data": { ...slots... },
  "message": "Texto para o usuário.",
  "spokenMessage": "Texto curto para falar."
}

### REGRAS DE COMUNICAÇÃO:
- **NÃO repita o que o usuário disse**. Você é um assistente que ANOTA, não um papagaio.
- Após registrar, confirme de forma concisa como um assistente: 
  - ✅ "Anotado! Despesa de R$ 150 com peça de bike em Compras."
  - ✅ "Marquei! R$ 50 de almoço em Alimentação."
  - ✅ "Receita de R$ 1.000 registrada como Salário."
  - ✅ "Anotado! R$ 180 com tênis em Compras, vence em 20/01/2026."
- **QUANDO A CONTA FOR ESPECIFICADA** (ex: "no dinheiro", "no Nubank", "na Carteira"):
  - Mencione a conta na resposta: "Anotado! R$ 50 de almoço em Alimentação, na **Carteira**."
  - Se a conta não foi especificada, não mencione (usará a padrão automaticamente).
- **DATAS NA MENSAGEM**: Sempre mostre datas no formato brasileiro (dd/mm/aaaa), ex: "20/01/2026".
- **DATAS NO JSON**: Mantenha o formato YYYY-MM-DD no campo \`date\` e \`due_date\` do JSON.
- **NÃO use "Gastei", "Recebi"** na resposta - você está anotando para o usuário, não falando por ele.
- **NÃO faça perguntas de follow-up** (nada de "Precisa de mais alguma coisa?").
- Seja **direto e conciso**. Uma ou duas linhas no máximo.
- Só faça perguntas se **faltar informação obrigatória** (valor ou descrição).
- **MÚLTIPLAS TRANSAÇÕES**: Se o usuário mencionar MAIS DE UMA transação na mesma frase (ex: "50 no mercado e 30 no uber"):
  - Registre APENAS A PRIMEIRA transação no JSON.
  - Na mensagem, avise sobre a outra: "✅ Anotado! R$ 50 com mercado em Alimentação. 💡 Me diz o uber separado pra eu anotar também!"

### COMANDOS COMPOSTOS (PERGUNTA + AÇÃO) ⚠️ CRÍTICO:

Quando o usuário faz uma **pergunta E pede uma ação** na mesma frase, você DEVE:
1. **PRIORIZAR A AÇÃO** - Execute o registro/ação PRIMEIRO
2. **Usar o intent da AÇÃO** - Retorne o intent correspondente à ação (ex: REGISTER_MOVEMENT)
3. **Adicionar flag \`also_query\`** - Indique que há uma consulta pendente

**Exemplos:**
- "quanto gastei esse mês? ah, e anota 30 de lanche"
  → Intent: REGISTER_MOVEMENT (registrar o lanche)
  → data: { amount: 30, description: "lanche", type: "expense", category: "Alimentação", also_query: "GET_FINANCIAL_STATUS" }
  → message: "✅ Anotado! R$ 30 de lanche em Alimentação."

- "anota 50 de uber e me diz como tô"
  → Intent: REGISTER_MOVEMENT
  → data: { amount: 50, description: "uber", type: "expense", category: "Transporte", also_query: "GET_FINANCIAL_STATUS" }
  → message: "✅ Anotado! R$ 50 de uber em Transporte."

- "como tá meu saldo? aproveita e marca 20 de café"
  → Intent: REGISTER_MOVEMENT (PRIORIZE A AÇÃO!)
  → data: { amount: 20, description: "café", type: "expense", category: "Alimentação", also_query: "GET_FINANCIAL_STATUS" }
  → message: "✅ Anotado! R$ 20 de café em Alimentação."

**REGRA DE OURO**: Se tem AÇÃO + PERGUNTA, sempre retorne o intent da AÇÃO com also_query indicando a consulta.
O sistema vai processar a ação E depois executar a consulta automaticamente.
`;

// Keywords that indicate features from higher levels
const LEVEL_KEYWORDS = {
  // Level 2+ features
  transfer: ['transferi', 'transferir', 'transferência', 'passei pro', 'passei pra', 'movi pro', 'movi pra', 'moveu pro', 'moveu pra', 'depositei', 'depositar', 'depósito', 'saquei', 'saque', 'tirei do'],
  accounts: ['nubank', 'itaú', 'itau', 'bradesco', 'caixa', 'santander', 'inter', 'c6', 'picpay', 'mercado pago', 'conta bancária', 'banco'],
  recurring: ['recorrente', 'todo mês', 'mensal', 'mensalmente', 'recorrência', 'agendar', 'agendamento', 'agendei', 'programar', 'programei', 'lembrete', 'até dia', 'até o dia', 'de hoje até', 'até 202', 'vou pagar dia', 'pagar dia', 'pago dia', 'vence dia', 'vencimento dia', 'pro dia', 'pra dia'],
  // Level 3+ features  
  creditCard: ['cartão', 'cartao', 'crédito', 'credito', 'fatura', 'parcelei', 'parcelado', 'parcelas', 'em x vezes', 'em 2x', 'em 3x', 'em 4x', 'em 5x', 'em 6x', 'em 10x', 'em 12x'],
  loan: ['empréstimo', 'emprestimo', 'emprestei', 'emprestado', 'devo', 'dívida', 'divida', 'peguei emprestado', 'me emprestou'],
  // Level 4+ features
  goals: ['meta', 'objetivo', 'reserva', 'guardar pra', 'juntar pra', 'poupar'],
  simulation: ['e se', 'simular', 'simulação', 'projeção', 'projetar'],
} as const;

// Friendly messages for blocked features (no level numbers!)
// Style: Validate first → Redirect gently → Promise future
const FRIENDLY_BLOCKS: Record<string, string> = {
  transfer: "Que bom que você tá organizando! 😊 Por enquanto, anota isso como você fazia antes. Primeiro, vamos ficar craques em registrar o dinheiro do dia a dia. Logo, logo vamos fazer tudo por aqui!",
  accounts: "Boa! Você já tá pensando em organizar suas contas. 🏦 Por agora, anota como fazia antes. Primeiro vamos dominar o básico juntos, e logo você vai poder fazer tudo isso aqui!",
  recurring: "Boa ideia! 📅 Agendamentos e lembretes estão chegando em breve. Por enquanto, me avisa quando pagar cada conta que eu registro pra você. Logo, logo vou te lembrar automaticamente!",
  creditCard: "Entendi! 💳 Por enquanto, anota o valor que você gastou normalmente. Tipo: \"Gastei 50 no mercado\". Em breve a gente organiza seus cartões juntos!",
  loan: "Anotado! 📝 Por enquanto, continua controlando isso como fazia antes. Logo vamos organizar empréstimos e dívidas juntos aqui!",
  goals: "Que legal que você já pensa em metas! 🎯 Continua registrando seu dia a dia que logo vamos montar seus objetivos juntos!",
  simulation: "Adoro a curiosidade! 🔮 Primeiro vamos conhecer bem seus gastos, e aí as simulações vão fazer muito mais sentido!",
};

function detectBlockedFeature(input: string, userLevel: number): string | null {
  const lowerInput = input.toLowerCase();

  // Level 1: Only basic income/expense allowed
  if (userLevel <= 1) {
    // Check Level 2+ features
    for (const keyword of LEVEL_KEYWORDS.transfer) {
      if (lowerInput.includes(keyword)) return 'transfer';
    }
    for (const keyword of LEVEL_KEYWORDS.accounts) {
      if (lowerInput.includes(keyword)) return 'accounts';
    }
    for (const keyword of LEVEL_KEYWORDS.recurring) {
      if (lowerInput.includes(keyword)) return 'recurring';
    }
  }

  // Level 1-2: Block Level 3+ features
  if (userLevel <= 2) {
    for (const keyword of LEVEL_KEYWORDS.creditCard) {
      if (lowerInput.includes(keyword)) return 'creditCard';
    }
    for (const keyword of LEVEL_KEYWORDS.loan) {
      if (lowerInput.includes(keyword)) return 'loan';
    }
  }

  // Level 1-3: Block Level 4+ features
  if (userLevel <= 3) {
    for (const keyword of LEVEL_KEYWORDS.goals) {
      if (lowerInput.includes(keyword)) return 'goals';
    }
    // Note: simulation is actually handled by AI, so we keep it available
  }

  return null;
}

export async function processCommand(input: string, history: string[] = [], inputType: 'text' | 'voice' = 'text', userLevel: number = 1): Promise<AIResponse> {
  // Check for blocked features based on user level
  const blockedFeature = detectBlockedFeature(input, userLevel);
  if (blockedFeature) {
    const blockMessage = FRIENDLY_BLOCKS[blockedFeature] || "🚧 Essa função ainda não está disponível pra você. Continua usando o básico que logo você desbloqueia!";
    const levelUpPrompt = "\n\n💡 Mas, se já se sente seguro pra aprender mais como eu funciono, diga: \"Ir para Nível 2\" quando estiver pronto! Mas recomendo continuar se familiarizando com as funções simples primeiro.";

    return {
      intent: 'BLOCKED_FEATURE',
      message: blockMessage + levelUpPrompt,
      confidence: 1
    };
  }

  const geminiKeys = getGeminiApiKeys();

  if (geminiKeys.length === 0) {
    return {
      intent: 'UNKNOWN',
      message: "Erro: Nenhuma chave da API do Gemini configurada.",
      confidence: 0
    };
  }

  const targetModel = "gemini-2.5-flash";
  let lastError: any = null;
  let parsedResponse: any = null;
  let userProvidedBankName: string | null = null; // Track if user just provided bank name for PIX/Débito


  // 1. Process Logic with Gemini
  for (const [index, apiKey] of geminiKeys.entries()) {
    try {
      console.log(`🤖 Tentando API Key ${index + 1}/${geminiKeys.length}...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: targetModel,
        systemInstruction: SYSTEM_INSTRUCTION
      });

      // Use Brazil timezone (GMT-3)
      const now = new Date();
      const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const formattedDate = brazilDate.toLocaleDateString('pt-BR');
      const isoDate = brazilDate.toISOString().split('T')[0];
      const timeContext = `Hoje é ${formattedDate} (${isoDate}). Use esta data como referência para "hoje", "ontem", etc.`;


      // Build conversation context from history
      let conversationContext = '';
      if (history && history.length > 0) {
        conversationContext = '\n### CONTEXTO DA CONVERSA (últimas mensagens):\n' +
          history.slice(-6).join('\n') + '\n\n';
      }

      // CODE-LEVEL SLOT FILLING: If user just sent a number, find description from history
      let enrichedInput = input;
      const isJustNumber = /^\d+([.,]\d+)?$/.test(input.trim());
      if (isJustNumber && history && history.length > 0) {
        // Look for description in the MOST RECENT user message (reverse to find last)
        const userMessages = history.filter(h => h.startsWith('Usuário:'));
        const prevUserMsg = userMessages[userMessages.length - 1]; // Get the LAST one
        if (prevUserMsg) {
          // Extract key info from that message
          const msgContent = prevUserMsg.replace('Usuário:', '').trim();
          // Add explicit context to the input
          enrichedInput = `O valor é ${input}. (CONTEXTO: o usuário disse antes "${msgContent}" - USE ESSA INFORMAÇÃO COMO DESCRIÇÃO, NÃO PERGUNTE NOVAMENTE!)`;
        }
      }

      // SLOT FILLING: If AI asked for bank account (PIX/Débito) and user responds with bank name
      const lastAIMessage = history?.filter(h => h.startsWith('IA:') || h.startsWith('Assistente:')).pop();
      const wasPendingBankAccount = lastAIMessage?.includes('débito sai de qual conta bancária');

      if (wasPendingBankAccount && history && history.length > 0) {
        // Find the original transaction request from history
        const userMessages = history.filter(h => h.startsWith('Usuário:'));
        // Get the message before the bank name (the original transaction)
        const originalRequest = userMessages.length >= 2 ? userMessages[userMessages.length - 2] : null;

        if (originalRequest) {
          const originalContent = originalRequest.replace('Usuário:', '').trim();
          userProvidedBankName = input.trim(); // Save the bank name user provided
          // User is responding with bank name - combine with original request
          enrichedInput = `${originalContent}. (IMPORTANTE: Registrar na conta "${userProvidedBankName}", NÃO pergunte a conta novamente! O usuário já respondeu que é ${userProvidedBankName})`;
        }
      }


      let prompt = `${timeContext}${conversationContext}Usuário: ${enrichedInput}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);

      // DEBUG: Log the AI's chosen intent
      console.log('[AI DEBUG] Intent:', parsedResponse.intent, '| Data:', JSON.stringify(parsedResponse.data));
      console.log(`✅ Sucesso com API Key ${index + 1}`);
      break;
    } catch (error: any) {
      console.warn(`⚠️ Falha na API Key ${index + 1}: ${error.message}`);
      lastError = error;
      continue;
    }
  }

  if (!parsedResponse) {
    return {
      intent: 'UNKNOWN',
      message: "Erro ao processar comando.",
      confidence: 0
    };
  }

  // 2. EXECUTE SERVER ACTIONS (The "Hands")
  let executionResult = null;
  let finalMessage = parsedResponse.message;
  let hitMilestone = false; // Track if user hit 10 actions milestone

  if (parsedResponse.intent === 'REGISTER_MOVEMENT') {
    const d = parsedResponse.data;

    // ===== TRANSFER HANDLING =====
    if (d.is_transfer && d.to_account) {
      const { getAccountByName, getAccountBalance, getDefaultAccount } = await import('./assets');
      const { createTransfer } = await import('./financial');

      // Handle transfer without specifying source account
      let fromAccountName = d.from_account;
      if (!fromAccountName || fromAccountName.toLowerCase() === d.to_account?.toLowerCase()) {
        // Try to use default account as origin
        const defaultAcc = await getDefaultAccount();
        if (defaultAcc) {
          // Use default account (whatever type it is - wallet or bank)
          fromAccountName = defaultAcc.name;
        } else {
          // No default account set - ask user
          finalMessage = `❓ De qual conta você quer transferir? (ex: "da Carteira", "do Nubank")`;
          return {
            intent: parsedResponse.intent as IntentType,
            data: parsedResponse.data,
            message: finalMessage,
            confidence: 0.9
          };
        }
      }

      const fromAcc = await getAccountByName(fromAccountName);
      const toAcc = await getAccountByName(d.to_account);

      if (!fromAcc || !toAcc) {
        const missingAcc = !fromAcc ? fromAccountName : d.to_account;
        finalMessage = `❌ Conta "${missingAcc}" não encontrada. Verifique se você já cadastrou essa conta.`;
      } else {
        const fromBalance = await getAccountBalance(fromAcc.id);

        if (fromBalance < d.amount) {
          // Insufficient balance - return confirmation request
          const formattedBalance = fromBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const formattedAmount = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          return {
            intent: 'TRANSFER_CONFIRM_NEGATIVE' as IntentType,
            data: {
              ...d,
              fromAccountId: fromAcc.id,
              toAccountId: toAcc.id,
              fromAccountName: fromAcc.name,
              toAccountName: toAcc.name,
              currentBalance: fromBalance
            },
            message: `⚠️ A conta "${fromAcc.name}" tem apenas ${formattedBalance} e você quer transferir ${formattedAmount}.\n\nQuer fazer assim mesmo e deixar o saldo negativo?`,
            confidence: 1
          };
        } else {
          // Sufficient balance - execute transfer
          const result = await createTransfer({
            fromAccountId: fromAcc.id,
            toAccountId: toAcc.id,
            amount: d.amount,
            description: d.description || `Transferência para ${toAcc.name}`,
            date: d.date || new Date().toISOString().split('T')[0]
          });

          if (result.success) {
            const formattedAmount = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            finalMessage = `✅ Transferência de ${formattedAmount} de ${fromAcc.name} para ${toAcc.name} realizada!`;
          } else {
            finalMessage = `❌ ${result.error}`;
          }
        }
      }
    } else {
      // ===== NORMAL MOVEMENT (not a transfer) =====
      // Logic to determine Card ID
      let cardId = undefined;
      if (d.payment_method === 'credit_card') {
        // TODO: Lookup card by name if d.account_name is provided

        // If no specific card identified (or generic), try default
        const { getDefaultCard } = await import('./assets');
        const defaultCard = await getDefaultCard();
        if (defaultCard) {
          cardId = defaultCard.id;
        }
      }

      // Lookup category ID by name
      let categoryId = undefined;
      if (d.category) {
        const { getCategoryByName } = await import('./categories');
        const category = await getCategoryByName(d.category);
        if (category) {
          categoryId = category.id;
        }
      }

      // Lookup account ID by name if AI specified an account
      // ONLY link account if payment is NOT pending (will pay later = no account yet)
      let accountId = undefined;
      const isPending = d.is_paid === false || (d.due_date && !d.is_paid);

      // If user just provided bank name in response to our question, use it directly
      if (userProvidedBankName && !isPending) {
        const { getAccountByName } = await import('./assets');
        const account = await getAccountByName(userProvidedBankName);
        if (account) {
          accountId = account.id;
        } else {
          // Account not found - ask again with helpful tip
          return {
            intent: 'CONFIRMATION_REQUIRED' as IntentType,
            data: { ...d, askingForAccount: true },
            message: `❓ Não encontrei a conta "${userProvidedBankName}". Qual conta você quer usar?\n\n💡 Se quiser criar uma nova conta, cancela e me diz: "Criar conta no ${userProvidedBankName}"`,
            confidence: 0.9
          };
        }
      }
      // First check if AI already specified an account name (from user response)
      else if (d.account_name && !isPending) {
        const { getAccountByName } = await import('./assets');
        const account = await getAccountByName(d.account_name);
        if (account) {
          accountId = account.id;
        } else {
          // Account not found - ask which account to use
          return {
            intent: 'CONFIRMATION_REQUIRED' as IntentType,
            data: { ...d, askingForAccount: true },
            message: `❓ Não encontrei a conta "${d.account_name}". Qual conta você quer usar?\n\n💡 Se quiser criar uma nova conta, cancela e me diz: "Criar conta no ${d.account_name}"`,
            confidence: 0.9
          };
        }
      }
      // Handle PIX/Débito: check if default account is Carteira (wallet)
      // Only ask if we don't already have an account specified
      else if (d.payment_method === 'bank' && !isPending && !accountId) {
        const { getDefaultAccount } = await import('./assets');
        const defaultAccount = await getDefaultAccount();

        if (defaultAccount?.type === 'wallet') {
          // Default account is Carteira - need to ask which bank account
          return {
            intent: 'CONFIRMATION_REQUIRED' as IntentType,
            data: { ...d, askingForAccount: true },
            message: `💳 O débito sai de qual conta bancária?`,
            confidence: 0.9
          };
        } else if (defaultAccount) {
          // Default account is a bank - use it
          accountId = defaultAccount.id;
        }
      }


      // Call finance-core
      const result = await createMovement({
        description: d.description,
        amount: d.amount,
        type: d.type || 'expense',
        date: d.date || new Date().toISOString().split('T')[0],
        dueDate: d.due_date,
        isPaid: d.is_paid,
        accountId: isPending ? undefined : accountId, // No account for pending payments
        cardId: cardId,
        categoryId: categoryId,
        isLoan: d.is_loan,
        loanType: d.loan_type,
        loanDescription: d.description,
        loanTotal: d.amount,
        isReserve: d.is_reserve,
      });

      if (result.success) {
        // Include account name in the message if available (natural language)
        // But NOT for pending payments - they don't have an account yet
        // And NOT if AI already specified account_name (to avoid duplication)
        // And NOT if message contains a tip (💡) - it's a special response
        let accountSuffix = '';
        const hasSpecialMessage = parsedResponse.message?.includes('💡') || parsedResponse.message?.includes('separado');
        if (result.accountName && !isPending && !d.account_name && !hasSpecialMessage) {
          accountSuffix = `, no ${result.accountName}`;
        }

        // Avoid duplicate ✅ if AI message already starts with it
        const prefix = parsedResponse.message?.startsWith('✅') ? '' : '✅ ';
        finalMessage = `${prefix}${parsedResponse.message}${accountSuffix}`;
        hitMilestone = result.hitMilestone || false;

        // Handle compound commands: if there's a pending query, execute it and append
        if (d.also_query === 'GET_FINANCIAL_STATUS') {
          const status = await getFinancialStatus();
          if (status) {
            const previousFormatted = status.previousBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const incomeFormatted = status.realIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const expenseFormatted = status.realExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const totalFormatted = status.totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            finalMessage += `\n\n📊 **Fluxo de Caixa**\n\n• Saldo Anterior: ${previousFormatted}\n• Receitas (+): ${incomeFormatted}\n• Despesas (-): ${expenseFormatted}\n\n💰 **Saldo Atual:** ${totalFormatted}`;
          }
        }
      } else {
        finalMessage = `❌ Erro ao registrar: ${result.error}`;
      }
    }
  }

  if (parsedResponse.intent === 'GET_FINANCIAL_STATUS') {
    const status = await getFinancialStatus();
    if (status) {
      const previousFormatted = status.previousBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const incomeFormatted = status.realIncome.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const expenseFormatted = status.realExpense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const totalFormatted = status.totalBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      finalMessage = `📊 **Fluxo de Caixa**\n\n• Saldo Anterior: ${previousFormatted}\n• Receitas (+): ${incomeFormatted}\n• Despesas (-): ${expenseFormatted}\n\n💰 **Saldo Atual:** ${totalFormatted}`;
    }
  }

  if (parsedResponse.intent === 'ADJUST_BALANCE') {
    const d = parsedResponse.data;
    if (d.amount && d.amount > 0) {
      // Update wallet balance directly
      const result = await setWalletInitialBalance(d.amount);

      if (result.success) {
        const formatted = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        finalMessage = `✅ Saldo da Carteira ajustado para ${formatted}!`;
      } else {
        finalMessage = `❌ Erro ao ajustar saldo: ${result.error}`;
      }
    } else {
      finalMessage = `❌ Não entendi o valor. Tente: "Corrija meu saldo inicial pra R$ 3500"`;
    }
  }

  if (parsedResponse.intent === 'SIMULATE_SCENARIO') {
    const d = parsedResponse.data;
    if (d.amount && d.amount > 0) {
      const monthly = d.amount;
      const yearly = monthly * 12;
      const formattedMonthly = monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const formattedYearly = yearly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      const categoryText = d.category ? ` em ${d.category}` : '';

      finalMessage = `🔮 **Simulação:**\n\nSe você economizar ${formattedMonthly}${categoryText} todo mês:\n\n💰 **Em 1 ano:** você terá ${formattedYearly} a mais!\n\nQue tal criar uma meta para isso?`;
    } else {
      finalMessage = "Para simular, preciso de um valor. Ex: 'E se eu economizar 50 reais?'";
    }
  }

  if (parsedResponse.intent === 'DELETE_LAST_MOVEMENT') {
    const result = await deleteLastMovement();
    if (result.success) {
      finalMessage = `🗑️ Pronto! Apaguei o lançamento "${result.deletedDescription}".`;
    } else {
      finalMessage = `❌ ${result.error}`;
    }
  }

  // Handle CORRECT_LAST_MOVEMENT intent (correct value, description, or account of last movement)
  if (parsedResponse.intent === 'CORRECT_LAST_MOVEMENT') {
    const d = parsedResponse.data;
    const { getLastMovement, updateMovement } = await import('./financial');

    const lastMovement = await getLastMovement();
    if (!lastMovement) {
      finalMessage = `❌ Não encontrei nenhum lançamento para corrigir.`;
    } else {
      const updates: any = {};
      const changes: string[] = [];

      // Check what needs to be corrected
      if (d.new_amount && d.new_amount > 0) {
        updates.amount = d.new_amount;
        const formattedOld = lastMovement.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedNew = d.new_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        changes.push(`valor de ${formattedOld} para ${formattedNew}`);
      }

      if (d.new_description) {
        updates.description = d.new_description;
        changes.push(`descrição de "${lastMovement.description}" para "${d.new_description}"`);
      }

      if (d.new_account) {
        const { getAccountByName } = await import('./assets');
        const newAccount = await getAccountByName(d.new_account);
        if (newAccount) {
          updates.account_id = newAccount.id;
          changes.push(`conta para ${newAccount.name}`);
        } else {
          finalMessage = `❌ Conta "${d.new_account}" não encontrada.`;
        }
      }

      if (changes.length > 0 && !finalMessage) {
        await updateMovement(lastMovement.id, updates);
        finalMessage = `✏️ Corrigido! Mudei ${changes.join(', ')}.`;
      } else if (!finalMessage) {
        finalMessage = `❓ Não entendi o que você quer corrigir. Tente: "não foi 80, foi 90" ou "era no Itaú".`;
      }
    }
  }

  if (parsedResponse.intent === 'CORRECT_LAST_ACCOUNT') {
    const d = parsedResponse.data;
    if (d.new_account) {
      const result = await updateLastMovementAccount(d.new_account);
      if (result.success) {
        finalMessage = `✏️ Corrigido! "${result.movementDescription}" mudou de ${result.oldAccountName} para **${result.newAccountName}**.`;
      } else {
        finalMessage = `❌ ${result.error}`;
      }
    } else {
      finalMessage = `❌ Não entendi para qual conta você quer mudar. Tente: "muda pra Carteira" ou "era no Nubank".`;
    }
  }

  if (parsedResponse.intent === 'SET_DEFAULT_ACCOUNT') {
    const d = parsedResponse.data;
    if (d.account_name) {
      const { getAccountByName, setDefaultAccount } = await import('./assets');
      const account = await getAccountByName(d.account_name);
      if (account) {
        try {
          await setDefaultAccount(account.id);
          finalMessage = `✅ Pronto! Agora a conta **${account.name}** é sua conta principal. Todos os novos lançamentos vão para ela por padrão.`;
        } catch (e: any) {
          finalMessage = `❌ Erro ao definir conta principal: ${e.message}`;
        }
      } else {
        finalMessage = `❌ Conta "${d.account_name}" não encontrada. Verifique o nome e tente novamente.`;
      }
    } else {
      finalMessage = `❌ Não entendi qual conta você quer tornar principal. Tente: "Torna a Carteira minha conta principal".`;
    }
  }

  // Handle CREATE_ACCOUNT intent
  if (parsedResponse.intent === 'CREATE_ACCOUNT') {
    const d = parsedResponse.data;
    if (d.account_name) {
      const { getAccountByName, createAccount } = await import('./assets');

      // Check if account already exists
      const existingAccount = await getAccountByName(d.account_name);
      if (existingAccount) {
        finalMessage = `ℹ️ A conta "${existingAccount.name}" já existe! Você pode usá-la normalmente.`;
      } else {
        // Create the account
        const accountType = d.account_type === 'savings' ? 'savings' : 'bank';
        try {
          const newAccount = await createAccount({
            name: d.account_name,
            type: accountType,
            balance: 0
          });

          if (newAccount) {
            finalMessage = `✅ Conta "${newAccount.name}" criada com sucesso! Agora você pode usar ela nos seus lançamentos.`;
          } else {
            finalMessage = `❌ Erro ao criar a conta. Tente novamente.`;
          }
        } catch (e: any) {
          finalMessage = `❌ Erro ao criar conta: ${e.message}`;
        }
      }
    } else {
      finalMessage = `❌ Não entendi o nome da conta. Tente: "Criar conta no Santander" ou "Abri uma conta no Inter".`;
    }
  }

  // Handle RECONCILE_PAYMENT - mark pending movement as paid (with optional amount update)
  if (parsedResponse.intent === 'RECONCILE_PAYMENT') {
    const d = parsedResponse.data;
    if (d.search_term) {
      const { findPendingMovement, updatePendingMovement } = await import('./finance-core');
      const findResult = await findPendingMovement(d.search_term);
      console.log('[RECONCILE_PAYMENT] findResult:', findResult.success, findResult.movement?.id);
      if (findResult.success && findResult.movement) {
        const updateResult = await updatePendingMovement({
          movementId: findResult.movement.id,
          amount: d.amount,
          markAsPaid: true
        });
        console.log('[RECONCILE_PAYMENT] updateResult:', updateResult.success, updateResult.error);
        if (updateResult.success) {
          const mov = updateResult.movement;
          const formattedAmount = mov.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const accountSuffix = updateResult.accountName ? `, debitado da ${updateResult.accountName}` : '';
          finalMessage = `✅ Marcado como pago! "${mov.description}" - ${formattedAmount}${accountSuffix}`;
        } else {
          finalMessage = `❌ ${updateResult.error}`;
        }
      } else {
        finalMessage = `❌ ${findResult.error}`;
      }
    } else {
      finalMessage = `❌ Não entendi qual conta você pagou. Tente: "Paguei a conta de luz".`;
    }
  }

  // Handle UPDATE_PENDING_AMOUNT - update value of pending movement without paying
  if (parsedResponse.intent === 'UPDATE_PENDING_AMOUNT') {
    const d = parsedResponse.data;
    if (d.search_term && d.amount) {
      const { findPendingMovement, updatePendingMovement } = await import('./finance-core');
      const findResult = await findPendingMovement(d.search_term);
      if (findResult.success && findResult.movement) {
        const updateResult = await updatePendingMovement({
          movementId: findResult.movement.id,
          amount: d.amount,
          markAsPaid: false
        });
        if (updateResult.success) {
          const mov = updateResult.movement;
          const formattedAmount = mov.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          finalMessage = `✅ Valor atualizado! "${mov.description}" agora é ${formattedAmount}. Quando pagar, me avise!`;
        } else {
          finalMessage = `❌ ${updateResult.error}`;
        }
      } else {
        // Not found as pending movement - check if it's an auto-debit recurrence
        const { findRecurrenceByDescription, updateRecurrenceAmount } = await import('./financial');
        const recResult = await findRecurrenceByDescription(d.search_term);

        if (recResult.success && recResult.recurrence && recResult.recurrence.is_auto_debit) {
          // It's an auto-debit recurrence - just update the amount for this month
          // DO NOT create a movement yet - that happens when user confirms payment on due date
          const updateResult = await updateRecurrenceAmount({
            recurrenceId: recResult.recurrence.id,
            amount: d.amount
          });

          if (updateResult.success) {
            const formattedAmount = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            // Parse date correctly to avoid timezone issues
            const [year, month, day] = recResult.recurrence.next_due_date.split('-');
            const dueDateStr = `${day}/${month}`;
            const accountText = updateResult.accountName ? ` no ${updateResult.accountName}` : '';
            finalMessage = `✅ Anotado! "${recResult.recurrence.description}" de ${formattedAmount}${accountText} vence dia ${dueDateStr}. No dia, vou te perguntar se o débito aconteceu.`;
          } else {
            finalMessage = `❌ ${updateResult.error}`;
          }
        } else if (recResult.success && recResult.recurrence) {
          // Recurrence exists but is not auto-debit
          finalMessage = `📝 "${recResult.recurrence.description}" não está configurada como débito automático. Quer que eu marque como paga?`;
        } else {
          finalMessage = `❌ ${findResult.error}`;
        }
      }
    } else {
      finalMessage = `❌ Preciso saber qual conta e o valor. Tente: "Chegou a conta de luz de 180".`;
    }
  }


  // Handle CREATE_RECURRENCE - create a recurring bill/income
  if (parsedResponse.intent === 'CREATE_RECURRENCE') {
    const d = parsedResponse.data;
    if (d.description && d.due_day) {
      const { createRecurrence } = await import('./financial');

      // Calculate next due date
      const now = new Date();
      const currentDay = now.getDate();
      let nextDueDate: Date;

      if (d.due_day > currentDay) {
        // This month
        nextDueDate = new Date(now.getFullYear(), now.getMonth(), d.due_day);
      } else {
        // Next month
        nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, d.due_day);
      }

      const nextDueDateStr = nextDueDate.toISOString().split('T')[0];

      try {
        await createRecurrence({
          description: d.description,
          amount: d.amount || 0,
          type: d.type || 'expense',
          frequency: d.frequency || 'monthly',
          next_due_date: nextDueDateStr
        });

        const typeLabel = d.type === 'income' ? 'recebimento' : 'conta';
        const dayLabel = d.due_day;
        const amountText = d.amount ? ` de R$ ${d.amount.toLocaleString('pt-BR')}` : '';

        finalMessage = `✅ ${typeLabel === 'conta' ? 'Conta' : 'Recebimento'} recorrente criado! "${d.description}"${amountText} vai aparecer no calendário todo dia ${dayLabel}.`;
      } catch (e: any) {
        finalMessage = `❌ Erro ao criar recorrência: ${e.message}`;
      }
    } else {
      finalMessage = `❌ Não entendi. Tente: "Conta de luz vence todo dia 10".`;
    }
  }

  // Handle DELETE_RECURRENCE - cancel/delete a recurring bill/income
  if (parsedResponse.intent === 'DELETE_RECURRENCE') {
    const d = parsedResponse.data;
    if (d.search_term) {
      const { findRecurrenceByDescription, deleteRecurrence } = await import('./financial');
      const findResult = await findRecurrenceByDescription(d.search_term);

      if (findResult.success && findResult.recurrence) {
        try {
          await deleteRecurrence(findResult.recurrence.id);
          finalMessage = `✅ Recorrência "${findResult.recurrence.description}" cancelada! Não vai mais aparecer no calendário.`;
        } catch (e: any) {
          finalMessage = `❌ Erro ao cancelar recorrência: ${e.message}`;
        }
      } else {
        finalMessage = `❌ ${findResult.error}`;
      }
    } else {
      finalMessage = `❌ Não entendi qual recorrência você quer cancelar. Tente: "Cancela o aluguel".`;
    }
  }

  // Handle SET_AUTO_DEBIT - create or mark recurrence as auto-debit
  if (parsedResponse.intent === 'SET_AUTO_DEBIT') {
    const d = parsedResponse.data;
    if (d.search_term) {
      const { findRecurrenceForAutoDebit, setAutoDebit, createRecurrence } = await import('./financial');
      const { getAccountByName } = await import('./assets');

      // If user specified bank, validate it exists
      if (d.account_name) {
        const account = await getAccountByName(d.account_name);
        if (!account) {
          finalMessage = `❌ Não encontrei a conta "${d.account_name}". Primeiro crie a conta dizendo: "Criar conta no ${d.account_name}"`;
          return {
            intent: parsedResponse.intent as IntentType,
            data: parsedResponse.data,
            message: finalMessage,
            confidence: 0.9
          };
        }
      }

      const findResult = await findRecurrenceForAutoDebit(d.search_term);

      if (findResult.success && findResult.recurrence) {
        // Recurrence exists - check if wallet
        if (findResult.isWallet) {
          finalMessage = `⚠️ "${findResult.recurrence.description}" está na Carteira. Débito automático só funciona em contas bancárias.\n\n💡 Me diga em qual banco você quer registrar, ex: "no Itaú" ou "no Nubank"`;
        } else if (!findResult.accountName && !d.account_name) {
          // Recurrence exists but no bank linked - ask for bank
          finalMessage = `📝 "${findResult.recurrence.description}" está cadastrada, mas sem conta bancária. Em qual banco é o débito automático?`;
        } else {
          // Has bank (either existing or provided in slot-filling)
          let bankNameToShow = findResult.accountName;

          // If user provided account_name in slot-filling, link it
          if (d.account_name && !findResult.recurrence.account_id) {
            const account = await getAccountByName(d.account_name);
            if (account) {
              bankNameToShow = account.name;
              // Update recurrence with the account
              const { updateRecurrence } = await import('./financial');
              await updateRecurrence(findResult.recurrence.id, { account_id: account.id });
            }
          }

          // Mark as auto-debit
          const result = await setAutoDebit(findResult.recurrence.id, true);
          if (result.success) {
            const bankName = bankNameToShow ? ` no ${bankNameToShow}` : '';
            finalMessage = `✅ Pronto! "${findResult.recurrence.description}"${bankName} agora é débito automático. Quando chegar o dia, o valor sai sozinho da conta.`;
          } else {
            finalMessage = `❌ ${result.error}`;
          }
        }
      } else if (findResult.notFound) {
        // Recurrence doesn't exist - check if we have enough info to create
        if (d.due_day && (d.amount || d.amount === 0)) {
          // We have enough info - create recurrence with auto-debit
          let accountId = undefined;
          if (d.account_name) {
            const account = await getAccountByName(d.account_name);
            if (account) accountId = account.id;
          }

          // Calculate next due date
          const now = new Date();
          const currentDay = now.getDate();
          let nextDueDate: Date;

          if (d.due_day > currentDay) {
            nextDueDate = new Date(now.getFullYear(), now.getMonth(), d.due_day);
          } else {
            nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, d.due_day);
          }

          const nextDueDateStr = nextDueDate.toISOString().split('T')[0];
          const description = d.search_term.charAt(0).toUpperCase() + d.search_term.slice(1);

          try {
            // If amount is provided, it's fixed (variable_amount = false)
            // If no amount, it varies each month (variable_amount = true)
            const hasFixedAmount = d.amount && d.amount > 0;
            const newRec = await createRecurrence({
              description: description,
              amount: d.amount || 0,
              type: 'expense',
              frequency: 'monthly',
              next_due_date: nextDueDateStr,
              account_id: accountId,
              is_auto_debit: true,
              variable_amount: !hasFixedAmount
            });

            const amountText = hasFixedAmount ? ` de R$ ${d.amount.toLocaleString('pt-BR')}` : '';
            const bankText = d.account_name ? ` no ${d.account_name}` : '';
            const fixedTip = hasFixedAmount ? ' O valor vai se repetir todo mês.' : '';
            const variableTip = !hasFixedAmount ? `\n\n💡 Quando a conta chegar, me diga o valor: "A ${d.search_term} veio X reais"` : '';
            finalMessage = `✅ Cadastrado! "${newRec.description}"${amountText} todo dia ${d.due_day}${bankText} como débito automático.${fixedTip}${variableTip}`;
          } catch (e: any) {
            finalMessage = `❌ Erro ao criar recorrência: ${e.message}`;
          }
        } else {
          // Need slot-filling - ask for missing info
          const missingInfo: string[] = [];
          if (!d.due_day) missingInfo.push('dia de vencimento');
          if (!d.amount && d.amount !== 0) missingInfo.push('valor (ou "variável" se muda todo mês)');

          const bankHint = d.account_name ? '' : '\n• Em qual banco?';

          return {
            intent: 'CONFIRMATION_REQUIRED' as IntentType,
            data: {
              pendingAutoDebit: true,
              search_term: d.search_term,
              account_name: d.account_name,
              amount: d.amount,
              due_day: d.due_day
            },
            message: `📝 Vou cadastrar "${d.search_term}" como débito automático. Me diz:\n\n• Qual o ${missingInfo.join(' e o ')}?${bankHint}\n\n💡 Exemplo: "Dia 10, uns 150 reais, no Itaú"`,
            confidence: 0.9
          };
        }
      } else {
        finalMessage = `❌ ${findResult.error}`;
      }
    } else {
      finalMessage = `❌ Qual conta você quer marcar como débito automático? Tente: "A conta de luz é débito automático".`;
    }
  }

  // Handle CHECK_AUTO_DEBIT - check if a recurrence is auto-debit
  if (parsedResponse.intent === 'CHECK_AUTO_DEBIT') {
    const d = parsedResponse.data;
    if (d.search_term) {
      const { findRecurrenceByDescription } = await import('./financial');
      const findResult = await findRecurrenceByDescription(d.search_term);

      if (findResult.success && findResult.recurrence) {
        const rec = findResult.recurrence;
        if (rec.is_auto_debit) {
          const [year, month, day] = rec.next_due_date.split('-');
          const dueDateStr = `${day}/${month}`;
          const amountStr = rec.amount > 0
            ? ` de ${rec.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
            : '';
          finalMessage = `✅ Sim! "${rec.description}"${amountStr} está em débito automático. Próximo vencimento: ${dueDateStr}.`;
        } else {
          finalMessage = `❌ Não. "${rec.description}" NÃO está em débito automático. Quer que eu configure? Diga: "Coloca ${d.search_term} em débito automático".`;
        }
      } else {
        finalMessage = `📝 Não encontrei nenhuma conta recorrente com "${d.search_term}". Você pode criar uma dizendo: "Minha conta de ${d.search_term} é débito automático, todo dia X".`;
      }
    } else {
      finalMessage = `❌ Qual conta você quer verificar? Tente: "Minha conta de água é débito automático?"`;
    }
  }

  // Handle LIST_AUTO_DEBITS - list all auto-debit accounts
  if (parsedResponse.intent === 'LIST_AUTO_DEBITS') {
    const { getRecurrences } = await import('./financial');
    const recurrences = await getRecurrences();
    const autoDebits = recurrences.filter(r => r.is_auto_debit && r.active);

    if (autoDebits.length === 0) {
      finalMessage = `📝 Você não tem nenhuma conta em débito automático cadastrada ainda.\n\n💡 Para criar, diga: "A conta de luz é débito automático no Itaú"`;
    } else {
      const list = autoDebits.map(ad => {
        const amountStr = ad.amount > 0
          ? ` (${ad.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
          : ' (variável)';
        const accountStr = ad.account_name ? ` → ${ad.account_name}` : '';
        return `• ${ad.description}${amountStr}${accountStr}`;
      }).join('\n');
      finalMessage = `⚡ Suas contas em débito automático:\n\n${list}`;
    }
  }

  // 3. Generate Audio
  let audioData: string | undefined = undefined;
  if (inputType === 'voice' && parsedResponse.spokenMessage && openai) {
    try {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: parsedResponse.spokenMessage,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      audioData = buffer.toString('base64');
    } catch (e) { console.error(e); }
  }

  // Handle undefined finalMessage (e.g., multiple transactions or unhandled intent)
  if (!finalMessage) {
    finalMessage = parsedResponse.message || '👋 Desculpe, não consegui processar isso. Por favor, me diga uma coisa de cada vez!';
  }

  console.log('[AI FINAL] Returning message:', finalMessage.substring(0, 100));

  return {
    intent: parsedResponse.intent as IntentType,
    data: parsedResponse.data,
    message: finalMessage,
    spokenMessage: parsedResponse.spokenMessage,
    confidence: 0.9,
    audio: audioData,
    hitMilestone
  };
}

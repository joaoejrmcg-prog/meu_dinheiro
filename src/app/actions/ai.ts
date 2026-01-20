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

7. **RECONCILE_PAYMENT** (Confirmar pagamento de conta existente OU empréstimo) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário diz que PAGOU algo ou RECEBEU pagamento de empréstimo.
   - **Gatilhos**: "Paguei o X", "Paguei a X", "Quitei o X", "Já paguei o X", "Liquidei o X", "Paguei a conta de X", "Devolvi pro X", "Paguei o X 500", "X me pagou", "X me devolveu", "Recebi de X", "O X me pagou", "A X me pagou", "Fulano me devolveu o dinheiro".
   - **Exemplos que DEVEM usar este intent**:
     - "Paguei o IPTU" → RECONCILE_PAYMENT, search_term: "IPTU"
     - "Paguei a conta de luz" → RECONCILE_PAYMENT, search_term: "luz"
     - "Paguei o conserto do carro" → RECONCILE_PAYMENT, search_term: "conserto do carro"
     - "Paguei o aluguel" → RECONCILE_PAYMENT, search_term: "aluguel"
     - "Paguei a conta de luz de 180" → RECONCILE_PAYMENT, search_term: "luz", amount: 180
     - "Quitei o colégio por 500" → RECONCILE_PAYMENT, search_term: "colégio", amount: 500
     - "Paguei o João, 500" → RECONCILE_PAYMENT, search_term: "João", amount: 500 (pode ser empréstimo!)
     - "Devolvi 200 pro Pedro" → RECONCILE_PAYMENT, search_term: "Pedro", amount: 200 (pagamento de empréstimo)
     - "A Monica me pagou 200" → RECONCILE_PAYMENT, search_term: "Monica", amount: 200 (recebimento de empréstimo)
     - "Recebi 500 do João" → RECONCILE_PAYMENT, search_term: "João", amount: 500 (recebimento de empréstimo)
     - "O Pedro me devolveu os 200" → RECONCILE_PAYMENT, search_term: "Pedro", amount: 200
   - **Exemplos que NÃO usam este intent** (gasto novo sem conta pendente):
     - "Paguei 50 no mercado" → REGISTER_MOVEMENT (gasto avulso!)
     - "Gastei 30 no uber" → REGISTER_MOVEMENT
   - **Regra de Ouro**: "Paguei" + nome de algo (sem valor no início) = RECONCILE_PAYMENT
   - **IMPORTANTE**: NÃO peça valor! O sistema busca primeiro em contas pendentes, depois em empréstimos. Se o usuário não mencionar valor, usa o valor existente.
   - **Slots**:
     - \`search_term\`: O que foi pago (ex: "luz", "IPTU", "aluguel", "João" para empréstimo).
     - \`amount\`: Valor pago (OPCIONAL - use apenas se o usuário mencionar).
   - **Ação**: Busca conta pendente, se não achar busca empréstimo ativo, atualiza valor se fornecido, marca como pago/abate do saldo devedor.

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

15. **CREATE_INSTALLMENT** (Compra parcelada / Crediário / Carnê) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário menciona "parcelado", "em X vezes", "carnê", "crediário", ou faz uma compra com entrada+resto.
   - **DETECÇÃO DE PARCELAMENTO IMPLÍCITO (CRÍTICO)**:
     - Se detectar "me deu/paguei X" + "resto/falta/vai pagar" → É parcelamento com entrada implícita.
     - "dei 50 de entrada" → hasDownPayment=true, downPaymentValue=50
     - "o resto" / "vai pagar depois" / "falta" → indica valor pendente.
     - Neste caso, defina installments=2 (entrada + resto) se não especificar quantidade.
   - **SLOTS OBRIGATÓRIOS**: Se detectar parcelamento, GARANTA que tem TODOS estes dados. Se faltar QUALQUER UM, retorne intent="CONFIRMATION_REQUIRED" perguntando APENAS o que falta:
     **CRÍTICO:** No JSON de resposta, você DEVE incluir o objeto \`data\` com TODOS os campos já identificados (acumulados).
     **CRÍTICO:** Para \`hasDownPayment\`, PERGUNTE: "Foi com ou sem entrada?" (Evite perguntas Sim/Não).
     **REGRA DE DEPENDÊNCIA:** Se \`hasDownPayment\` for true, \`downPaymentValue\` torna-se OBRIGATÓRIO.
     **CRÍTICO:** \`dueDate\` é OBRIGATÓRIO para parcelamentos. NÃO assuma "hoje". PERGUNTE.
     1. \`description\` (O que comprou?)
     2. \`amount\` (Valor TOTAL - se usuário disse "o resto", pergunte o valor total)
     3. \`installments\` (Quantas vezes?)
     4. \`hasDownPayment\` (Teve entrada? true/false)
     5. \`downPaymentValue\` (Valor da entrada, OBRIGATÓRIO se hasDownPayment=true)
     6. \`dueDate\` (Data da primeira parcela/vencimento - formato YYYY-MM-DD)
     7. \`store\` (OPCIONAL - onde comprou)
   - **Gatilhos**:
     - "Comprei X em Y vezes"
     - "Parcelei X em Y vezes"
     - "Comprei X no carnê"
     - "X parcelado em Y vezes"
     - "Dei entrada de X e o resto em Y vezes"
   - **Exemplos**:
     - "Comprei TV de 2500 em 10x" → CONFIRMATION_REQUIRED perguntando dueDate e hasDownPayment
     - "Parcelei geladeira em 12x de 150" → amount=1800, installments=12, perguntar dueDate e hasDownPayment
     - "Comprei sapato de 180, dei entrada de 80, resto em 2x dia 10/02" → CREATE_INSTALLMENT, amount=180, installments=3, hasDownPayment=true, downPaymentValue=80, dueDate="2026-02-10"
   - **CÁLCULO**: Valor da parcela = (totalAmount - downPaymentValue) / (installments - 1 se tiver entrada, senão installments)
   - **Exemplo de Fluxo COMPLETO**:
     User: "Comprei uma TV de 3000 em 10x nas Casas Bahia"
     AI: { intent: "CONFIRMATION_REQUIRED", message: "Certo! TV de R$3.000 em 10x nas Casas Bahia. Foi com ou sem entrada?", data: { originalIntent: "CREATE_INSTALLMENT", description: "TV", amount: 3000, installments: 10, store: "Casas Bahia" } }
     User: "Sem entrada"
     AI: { intent: "CONFIRMATION_REQUIRED", message: "E qual a data do primeiro vencimento?", data: { originalIntent: "CREATE_INSTALLMENT", description: "TV", amount: 3000, installments: 10, store: "Casas Bahia", hasDownPayment: false } }
     User: "Dia 20 de fevereiro"
     AI: { intent: "CREATE_INSTALLMENT", data: { description: "TV", amount: 3000, installments: 10, store: "Casas Bahia", hasDownPayment: false, downPaymentValue: 0, dueDate: "2026-02-20" }, message: "✅ Registrado! TV parcelada em 10x de R$300, primeiro vencimento em 20/02/2026." }

16. **CREDIT_CARD_PURCHASE** (Compra no cartão de crédito) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário menciona "no cartão", "no crédito", "cartão de crédito", ou menciona um nome de cartão específico (Nubank, Itaú, etc).
   - **IMPORTANTE**: Compras no cartão NÃO têm entrada e NÃO pedem data (a data é calculada automaticamente pelo fechamento/vencimento do cartão).
   - **SLOTS OBRIGATÓRIOS**: 
     1. \`description\` (O que comprou?)
     2. \`amount\` (Valor)
     3. \`installments\` (Quantas vezes? Use 1 se não mencionou parcelamento)
     4. \`card_name\` (OPCIONAL - nome do cartão. Se não especificado, usa o cartão principal)
   - **Gatilhos**:
     - "Comprei X no cartão"
     - "Gastei X no crédito"
     - "Paguei X no cartão"
     - "Comprei X em Yx no cartão"
     - "Comprei X no Nubank" (nome do cartão)
     - "X no crédito do Itaú"
   - **Exemplos**:
     - "Comprei uma janta de 120 no cartão" → CREDIT_CARD_PURCHASE, description: "janta", amount: 120, installments: 1
     - "Gastei 500 no cartão em 5x" → CREDIT_CARD_PURCHASE, description: "compra", amount: 500, installments: 5
     - "Paguei o tênis de 350 no Nubank" → CREDIT_CARD_PURCHASE, description: "tênis", amount: 350, installments: 1, card_name: "Nubank"
     - "Comprei geladeira de 3000 em 10x no cartão" → CREDIT_CARD_PURCHASE, description: "geladeira", amount: 3000, installments: 10
   - **NÃO PERGUNTE**:
     - Se teve entrada (cartão nunca tem)
     - Data de vencimento (é calculada automaticamente)
   - **PERGUNTE APENAS SE FALTAR**:
     - O que comprou (description)
     - Valor (amount)
   - **DISTINÇÃO IMPORTANTE** (Cartão x Carnê):
     - "Comprei em 10x no cartão" → CREDIT_CARD_PURCHASE
     - "Comprei em 10x no carnê" → CREATE_INSTALLMENT (pede data e entrada)
     - "Parcelei nas Casas Bahia" → CREATE_INSTALLMENT (crediário de loja)

17. **CREATE_LOAN** (Registrar empréstimo) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário menciona "empréstimo", "emprestei", "peguei emprestado", "devo", "dívida", "me deve".
   - **DISTINÇÃO CRÍTICA**:
     - "Peguei emprestado" / "Devo" / "Dívida" → type: 'taken' (eu peguei = entra dinheiro, cria passivo)
     - "Emprestei" / "Me deve" / "Passei emprestado" → type: 'given' (eu emprestei = sai dinheiro, cria ativo)
   - **SLOTS**:
     1. \`description\` (OBRIGATÓRIO - Com quem? Ex: "João", "Banco X", "meu irmão")
     2. \`amount\` (OBRIGATÓRIO - Valor total)
     3. \`type\` (OBRIGATÓRIO - 'taken' ou 'given'. INFIRA do contexto. Se ambíguo, PERGUNTE: "Você pegou emprestado ou emprestou pra alguém?")
     4. \`due_date\` (OPCIONAL - Data de vencimento do empréstimo em si. NÃO exija.)
     5. \`interest_rate\` (OPCIONAL - Taxa de juros mensal)
     6. \`installments\` (OPCIONAL - Se usuário já disser como vai pagar. Ex: "em 5x")
     7. \`installment_value\` (OPCIONAL - Valor da parcela)
     8. \`payment_due_day\` (OPCIONAL - Dia de vencimento das parcelas. Ex: "todo dia 10")
   - **Gatilhos para 'taken'**: "peguei emprestado", "me emprestou", "devo X pra", "dívida com", "to devendo", "peguei X com"
   - **Gatilhos para 'given'**: "emprestei", "me deve", "passei emprestado pra", "fulano me deve", "emprestei X pro"
   - **Exemplos**:
     - "Peguei 500 emprestado com o João" → CREATE_LOAN, amount: 500, description: "João", type: 'taken'
     - "Emprestei 200 pro Pedro" → CREATE_LOAN, amount: 200, description: "Pedro", type: 'given'
     - "Devo 1000 pro banco, vence dia 10" → CREATE_LOAN, amount: 1000, description: "banco", type: 'taken', due_date: "YYYY-MM-10"
     - "O João me deve 300" → CREATE_LOAN, amount: 300, description: "João", type: 'given'
     - "Peguei 1000 no Banco X pra pagar em 10x de 100 todo dia 5" → CREATE_LOAN, amount: 1000, description: "Banco X", type: 'taken', installments: 10, installment_value: 100, payment_due_day: 5
   - **Fluxo com Slot-Filling**:
     - User: "Peguei emprestado com o João"
       AI: { intent: "CONFIRMATION_REQUIRED", message: "Qual o valor que você pegou emprestado com o João?", data: { originalIntent: "CREATE_LOAN", description: "João", type: "taken" } }
     - User: "500"
       AI: { intent: "CREATE_LOAN", data: { description: "João", amount: 500, type: "taken" }, message: "✅ Empréstimo registrado! R$500 pegos com João." }
   - **IMPORTANTE**: NÃO exija data de vencimento. Empréstimos sem data aparecerão como pendências em qualquer projeção futura.

18. **LOAN_PAYMENT_PLAN** (Plano de pagamento de empréstimo)
   - **QUANDO USAR**: Quando o usuário informa como vai pagar ou receber um empréstimo.
   - **CONTEXTO**: Só usar se no histórico recente foi perguntado "como vai pagar/receber o empréstimo".
   - **SLOTS OBRIGATÓRIOS**:
     1. \`installments\` (Número de parcelas. Ex: 10)
     2. \`installment_value\` (Valor de cada parcela. Ex: 500)
     3. \`due_day\` (Dia do vencimento, 1-31. Ex: 5)
   - **Gatilhos**:
     - "10x de 500 todo dia 5"
     - "parcela única dia 10"
     - "5x de 200 no dia 15"
     - "em 12 parcelas de 100 todo dia 1"
   - **Exemplos**:
     - "10x de 500 todo dia 5" → LOAN_PAYMENT_PLAN, installments: 10, installment_value: 500, due_day: 5
     - "parcela única dia 10" → LOAN_PAYMENT_PLAN, installments: 1, installment_value: null, due_day: 10
     - "vou pagar tudo dia 20" → LOAN_PAYMENT_PLAN, installments: 1, installment_value: null, due_day: 20

19. **CREATE_GOAL** (Criar meta/reserva)
   - **QUANDO USAR**: Quando o usuário quer criar uma meta de economia.
   - **Gatilhos**: "Criar meta", "Nova meta", "Quero juntar dinheiro para X", "Vou criar um cofrinho para X"
   - **SLOTS**:
     1. \`description\` (OBRIGATÓRIO - Nome da meta. Ex: "Viagem", "Carro Novo", "Presente da Clarinha")
     2. \`amount\` (OPCIONAL - Valor alvo. Ex: 5000)
     3. \`deadline\` (OPCIONAL - Data limite. Ex: "dezembro de 2026")
   - **Exemplos**:
     - "Criar meta Viagem pro Japão de 15 mil" → CREATE_GOAL, description: "Viagem pro Japão", amount: 15000
     - "Quero juntar dinheiro pra um carro" → CREATE_GOAL, description: "Carro"
     - "Nova meta: Reserva de Emergência, 10 mil" → CREATE_GOAL, description: "Reserva de Emergência", amount: 10000

20. **ADD_TO_GOAL** (Aportar/Guardar na meta)
   - **QUANDO USAR**: Quando o usuário quer guardar dinheiro em uma meta existente.
   - **Gatilhos**: "Guardar X na meta Y", "Colocar X no Y", "Guardei X pro Y", "Vou reservar X pra Y"
   - **SLOTS**:
     1. \`amount\` (OBRIGATÓRIO - Valor a guardar)
     2. \`search_term\` (OBRIGATÓRIO - Nome ou parte do nome da meta)
     3. \`account_name\` (OPCIONAL - Conta de origem. Default: conta padrão)
   - **LÓGICA ESPECIAL**: Se a meta não for encontrada, retorne CONFIRMATION_REQUIRED perguntando se o usuário quer criar uma nova meta com esse nome.
   - **Exemplos**:
     - "Guardar 200 na Viagem" → ADD_TO_GOAL, amount: 200, search_term: "Viagem"
     - "Guardei 100 pro presente da Clarinha" → ADD_TO_GOAL, amount: 100, search_term: "presente da Clarinha"
     - "Vou colocar 500 no cofrinho do carro" → ADD_TO_GOAL, amount: 500, search_term: "carro"

21. **WITHDRAW_FROM_GOAL** (Resgatar/Usar da meta)
   - **QUANDO USAR**: Quando o usuário quer tirar dinheiro de uma meta para usar.
   - **Gatilhos**: "Tirar X da meta Y", "Resgatar X do Y", "Vou usar X da reserva Y", "Pegar X do cofrinho"
   - **SLOTS**:
     1. \`amount\` (OBRIGATÓRIO - Valor a resgatar)
     2. \`search_term\` (OBRIGATÓRIO - Nome da meta)
     3. \`account_name\` (OPCIONAL - Conta de destino. Default: conta padrão)
   - **Exemplos**:
     - "Tirar 1000 da Viagem" → WITHDRAW_FROM_GOAL, amount: 1000, search_term: "Viagem"
     - "Vou usar 500 da reserva de emergência" → WITHDRAW_FROM_GOAL, amount: 500, search_term: "reserva de emergência"
     - "Resgatar 200 do cofrinho do carro" → WITHDRAW_FROM_GOAL, amount: 200, search_term: "carro"

22. **CHECK_GOAL** (Consultar meta)
   - **QUANDO USAR**: Quando o usuário quer saber o status de uma meta.
   - **Gatilhos**: "Quanto falta pra X?", "Como está a meta X?", "Status da viagem", "Quanto já guardei pro carro?"
   - **SLOTS**:
     1. \`search_term\` (OPCIONAL - Nome da meta. Se não informado, lista todas)
   - **Exemplos**:
     - "Quanto falta pra Viagem?" → CHECK_GOAL, search_term: "Viagem"
     - "Como estão minhas metas?" → CHECK_GOAL
     - "Quanto já guardei pro carro?" → CHECK_GOAL, search_term: "carro"

### REGRAS CRÍTICAS DE SLOT-FILLING (LEIA COM ATENÇÃO):

Ao receber o CONTEXTO DA CONVERSA, você DEVE usar as informações já fornecidas.

**REGRA CRÍTICA PARA PARCELAMENTOS** ⚠️:
Se no histórico recente você (IA) fez uma pergunta sobre parcelamento (entrada, valor da entrada, data de vencimento), e o usuário respondeu APENAS com um número ou uma resposta curta, **CONTINUE O FLUXO DE PARCELAMENTO**:
- Recupere TODOS os dados já fornecidos do histórico (description, amount, installments, etc.).
- Adicione a nova informação ao slot correto.
- Se ainda faltar algum slot obrigatório, pergunte APENAS o que falta.
- NÃO registre como movimento avulso! Use CONFIRMATION_REQUIRED até ter TODOS os dados.

**EXEMPLO COMPLETO DE FLUXO CREATE_INSTALLMENT:**
1. User: "Comprei uma TV de 3000 em 10x"
   AI: { intent: "CONFIRMATION_REQUIRED", message: "Certo! TV de R$3.000 em 10x. Foi com ou sem entrada?", data: { originalIntent: "CREATE_INSTALLMENT", description: "TV", amount: 3000, installments: 10 } }
2. User: "com entrada"
   AI: { intent: "CONFIRMATION_REQUIRED", message: "Qual foi o valor da entrada?", data: { originalIntent: "CREATE_INSTALLMENT", description: "TV", amount: 3000, installments: 10, hasDownPayment: true } }
3. User: "1200"
   **CORRETO**: AI recupera do histórico que é parcelamento, adiciona downPaymentValue=1200, e pergunta o que falta:
   AI: { intent: "CONFIRMATION_REQUIRED", message: "Entrada de R$1.200. E qual a data do primeiro vencimento?", data: { originalIntent: "CREATE_INSTALLMENT", description: "TV", amount: 3000, installments: 10, hasDownPayment: true, downPaymentValue: 1200 } }
   **ERRADO**: Registrar como movimento avulso de R$1200! ❌
4. User: "dia 20 de fevereiro"
   AI: { intent: "CREATE_INSTALLMENT", data: { description: "TV", amount: 3000, installments: 10, hasDownPayment: true, downPaymentValue: 1200, dueDate: "2026-02-20" }, message: "✅ Parcelamento registrado! TV de R$3.000 com entrada de R$1.200 e 9x de R$200, primeiro vencimento em 20/02/2026." }

**EXEMPLO CORRETO (Movimento Avulso):**
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
  }

  // Level 1-3: Block Level 4+ features (loans, goals)
  if (userLevel <= 3) {
    for (const keyword of LEVEL_KEYWORDS.loan) {
      if (lowerInput.includes(keyword)) return 'loan';
    }
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



      // Validate type - if AI sent loan type instead of movement type, convert it
      let movementType: 'income' | 'expense' | 'transfer' | 'adjustment' = d.type || 'expense';
      if (d.type === 'taken') {
        movementType = 'income'; // Took loan = money comes in
      } else if (d.type === 'given') {
        movementType = 'expense'; // Gave loan = money goes out
      } else if (!['income', 'expense', 'transfer', 'adjustment'].includes(d.type)) {
        movementType = 'expense'; // Fallback
      }

      // Call finance-core
      const result = await createMovement({
        description: d.description,
        amount: d.amount,
        type: movementType,
        date: d.date || new Date().toISOString().split('T')[0],
        dueDate: d.due_date,
        isPaid: d.is_paid,
        accountId: isPending ? undefined : accountId, // No account for pending payments
        cardId: cardId,
        categoryId: categoryId,
        isLoan: d.is_loan || d.type === 'taken' || d.type === 'given',
        loanType: d.loan_type || (d.type === 'taken' || d.type === 'given' ? d.type : undefined),
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
        // Not found as pending movement - try to find as loan
        const { getLoans } = await import('./loans');
        const { registerLoanPayment } = await import('./loans');
        const loans = await getLoans();

        // Search for loan by description (case-insensitive partial match)
        const searchLower = d.search_term.toLowerCase();
        const matchingLoan = loans.find(loan =>
          loan.description.toLowerCase().includes(searchLower) && loan.remaining_amount > 0
        );

        if (matchingLoan) {
          // Found a loan! Register payment
          const paymentAmount = d.amount || matchingLoan.remaining_amount; // If no amount specified, pay full remaining
          const paymentResult = await registerLoanPayment({
            loanId: matchingLoan.id,
            amount: paymentAmount
          });

          if (paymentResult.success) {
            const formattedPayment = paymentAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const formattedRemaining = paymentResult.newRemainingAmount?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            if (matchingLoan.type === 'taken') {
              // I owed someone - I'm paying back
              if (paymentResult.newRemainingAmount === 0) {
                finalMessage = `✅ Empréstimo quitado! Você pagou ${formattedPayment} para **${matchingLoan.description}**. Dívida encerrada! 🎉`;
              } else {
                finalMessage = `✅ Pagamento registrado! ${formattedPayment} pago para **${matchingLoan.description}**.\n📊 Saldo devedor: ${formattedRemaining}`;
              }
            } else {
              // Someone owed me - they're paying back
              if (paymentResult.newRemainingAmount === 0) {
                finalMessage = `✅ Empréstimo recebido! **${matchingLoan.description}** te devolveu ${formattedPayment}. Crédito quitado! 🎉`;
              } else {
                finalMessage = `✅ Pagamento recebido! ${formattedPayment} recebido de **${matchingLoan.description}**.\n📊 Ainda falta: ${formattedRemaining}`;
              }
            }
          } else {
            finalMessage = `❌ Erro ao registrar pagamento: ${paymentResult.error}`;
          }
        } else {
          finalMessage = `❌ ${findResult.error} (Também não encontrei empréstimo com "${d.search_term}")`;
        }
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

  // Handle CREATE_INSTALLMENT - create installment purchase (carnê/crediário)
  if (parsedResponse.intent === 'CREATE_INSTALLMENT') {
    const d = parsedResponse.data;

    // Validate required fields
    if (!d.description || !d.amount || !d.installments || !d.dueDate || d.hasDownPayment === undefined) {
      // Missing required data - this shouldn't happen as AI should ask via CONFIRMATION_REQUIRED
      finalMessage = `❌ Faltam dados para o parcelamento. Me diga o que comprou, valor total, quantas parcelas, se teve entrada e quando vence a primeira.`;
    } else {
      const { createInstallmentPurchase } = await import('./financial');

      const result = await createInstallmentPurchase({
        description: d.description,
        totalAmount: d.amount,
        installments: d.installments,
        hasDownPayment: d.hasDownPayment,
        downPaymentValue: d.downPaymentValue || 0,
        firstDueDate: d.dueDate,
        store: d.store,
        type: d.type || 'expense'
      });

      if (result.success && result.movements) {
        const installmentValue = d.hasDownPayment
          ? Math.round((d.amount - (d.downPaymentValue || 0)) / (d.installments - 1) * 100) / 100
          : Math.round(d.amount / d.installments * 100) / 100;

        const formattedInstallment = installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedTotal = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const storeText = d.store ? ` (${d.store})` : '';

        // Format due date for display
        const [year, month, day] = d.dueDate.split('-');
        const dueDateDisplay = `${day}/${month}/${year}`;

        if (d.hasDownPayment && d.downPaymentValue > 0) {
          const formattedEntry = d.downPaymentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const remainingInstallments = d.installments - 1;
          finalMessage = `✅ Parcelamento registrado!${storeText}\n\n📦 **${d.description}**: ${formattedTotal}\n💵 Entrada: ${formattedEntry}\n📅 ${remainingInstallments}x de ${formattedInstallment} (1ª parcela: ${dueDateDisplay})`;
        } else {
          finalMessage = `✅ Parcelamento registrado!${storeText}\n\n📦 **${d.description}**: ${formattedTotal}\n📅 ${d.installments}x de ${formattedInstallment} (1ª parcela: ${dueDateDisplay})`;
        }
      } else {
        finalMessage = `❌ Erro ao criar parcelamento: ${result.error}`;
      }
    }
  }

  // Handle CREDIT_CARD_PURCHASE - single or installment purchase on credit card
  if (parsedResponse.intent === 'CREDIT_CARD_PURCHASE') {
    const d = parsedResponse.data;

    // Validate required fields
    if (!d.description || !d.amount) {
      finalMessage = `❌ Faltam dados. Me diga o que comprou e o valor.`;
    } else {
      const { createCreditCardPurchase } = await import('./financial');
      const { getDefaultCard, getCardByName } = await import('./assets');

      // Get card - either by name or default
      let card = null;
      if (d.card_name) {
        card = await getCardByName(d.card_name);
        if (!card) {
          finalMessage = `❌ Não encontrei o cartão "${d.card_name}". Você já cadastrou ele?`;
          return {
            intent: parsedResponse.intent as IntentType,
            data: parsedResponse.data,
            message: finalMessage,
            confidence: 0.9
          };
        }
      } else {
        card = await getDefaultCard();
        if (!card) {
          finalMessage = `❌ Você não tem nenhum cartão cadastrado. Cadastre um cartão primeiro no tutorial ou me diga: "Quero cadastrar um cartão"`;
          return {
            intent: parsedResponse.intent as IntentType,
            data: parsedResponse.data,
            message: finalMessage,
            confidence: 0.9
          };
        }
      }

      const result = await createCreditCardPurchase({
        description: d.description,
        amount: d.amount,
        installments: d.installments || 1,
        cardId: card.id
      });

      if (result.success && result.movements) {
        const installments = d.installments || 1;
        const installmentValue = Math.round((d.amount / installments) * 100) / 100;
        const formattedInstallment = installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const formattedTotal = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Get first due date for display
        const firstDueDate = result.movements[0]?.due_date;
        let dueDateDisplay = '';
        if (firstDueDate) {
          const [year, month, day] = firstDueDate.split('-');
          dueDateDisplay = ` (vence ${day}/${month})`;
        }

        if (installments > 1) {
          finalMessage = `✅ Lançado no ${result.cardName}!\n\n💳 **${d.description}**: ${formattedTotal}\n📅 ${installments}x de ${formattedInstallment}${dueDateDisplay}`;
        } else {
          finalMessage = `✅ Lançado no ${result.cardName}!\n\n💳 **${d.description}**: ${formattedTotal}${dueDateDisplay}`;
        }
      } else {
        finalMessage = `❌ Erro ao lançar no cartão: ${result.error}`;
      }
    }
  }

  // Handle CREATE_LOAN - register loan (taken or given)
  if (parsedResponse.intent === 'CREATE_LOAN') {
    const d = parsedResponse.data;

    // Validate required fields
    if (!d.description || !d.amount || !d.type) {
      finalMessage = `❌ Faltam dados. Me diga o valor, com quem foi e se você pegou ou emprestou.`;
    } else {
      const { createLoan } = await import('./loans');
      const { createMovement } = await import('./finance-core');
      const { getDefaultAccount, getAccountByName } = await import('./assets');

      // 1. Create the loan record
      console.log(`[CREATE_LOAN] Creating loan: ${d.description}, amount: ${d.amount}`);
      const loanResult = await createLoan({
        description: d.description,
        total_amount: d.amount,
        type: d.type, // 'taken' or 'given'
        due_date: d.due_date || undefined,
        interest_rate: d.interest_rate || undefined
      });

      if (!loanResult.success) {
        finalMessage = `❌ Erro ao registrar empréstimo: ${loanResult.error}`;
      } else {
        // 2. Create the corresponding financial movement
        let accountId = undefined;
        if (d.account_name) {
          const account = await getAccountByName(d.account_name);
          if (account) accountId = account.id;
        }
        if (!accountId) {
          const defaultAcc = await getDefaultAccount();
          if (defaultAcc) accountId = defaultAcc.id;
        }

        // For 'taken': income (money comes in)
        // For 'given': expense (money goes out)
        const movementType = d.type === 'taken' ? 'income' : 'expense';
        const movementDescription = d.type === 'taken'
          ? `Empréstimo recebido de ${d.description}`
          : `Empréstimo para ${d.description}`;

        // Create movement WITHOUT isLoan/loanId to avoid double-updating remaining_amount
        // The loan was already created with correct remaining_amount above
        await createMovement({
          description: movementDescription,
          amount: d.amount,
          type: movementType,
          date: new Date().toISOString().split('T')[0],
          categoryId: undefined,
          accountId: accountId,
          isPaid: true
          // isLoan and loanId intentionally omitted - they cause remaining_amount to be updated again
        });

        // 3. Format success message
        const formattedAmount = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (d.type === 'taken') {
          finalMessage = `✅ Empréstimo registrado!\n\n💰 ${formattedAmount} pegos emprestado de **${d.description}**\n📥 Entrada de ${formattedAmount} anotada na sua conta.`;
          if (d.due_date) {
            const [y, m, day] = d.due_date.split('-');
            finalMessage += `\n📅 Vencimento: ${day}/${m}/${y}`;
          }
        } else {
          finalMessage = `✅ Empréstimo registrado!\n\n💸 ${formattedAmount} emprestados para **${d.description}**\n📤 Saída de ${formattedAmount} anotada na sua conta.`;
          if (d.due_date) {
            const [y, m, day] = d.due_date.split('-');
            finalMessage += `\n📅 Retorno previsto: ${day}/${m}/${y}`;
          }
        }

        // 4. Check if payment plan data was provided in the same intent
        if (d.installments && d.payment_due_day) {
          const { createLoanPaymentPlan } = await import('./loans');

          const planResult = await createLoanPaymentPlan({
            installments: d.installments,
            installmentValue: d.installment_value,
            dueDay: d.payment_due_day,
            loanType: d.type,
            description: d.description,
            loanId: loanResult.data?.id,
            totalAmount: d.amount
          });

          if (planResult.success) {
            const installmentValue = d.installment_value || (planResult.calculatedValue || 0);
            const formattedValue = installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            finalMessage += `\n\n✅ Plano de pagamento criado!\n📅 ${d.installments}x de ${formattedValue} todo dia ${d.payment_due_day}.`;

            // Return success immediately, no need to ask for plan
            return {
              intent: 'CREATE_LOAN' as IntentType,
              data: parsedResponse.data,
              message: finalMessage,
              confidence: 1.0
            };
          }
        }

        // 5. Return special intent to ask about payment plan (ONLY if not created above)
        return {
          intent: 'LOAN_ASK_PAYMENT_PLAN' as IntentType,
          data: {
            loanId: loanResult.data?.id,
            loanType: d.type,
            description: d.description,
            amount: d.amount
          },
          message: finalMessage,
          confidence: 1.0
        };
      }
    }
  }

  // Handle LOAN_PAYMENT_PLAN - create future movements for loan payments
  if (parsedResponse.intent === 'LOAN_PAYMENT_PLAN') {
    const d = parsedResponse.data;

    if (!d.installments || !d.due_day) {
      finalMessage = `❌ Não entendi o plano de pagamento. Me diga algo como "10x de 500 todo dia 5".`;
    } else {
      const { createLoanPaymentPlan } = await import('./loans');

      // Extract loan info from context passed in message (frontend enriches the message)
      // Format: (CONTEXTO EMPRÉSTIMO: empréstimo de X com Y, tipo: Z, ...)
      let loanDescription = d.description || 'Empréstimo';
      let loanType: 'taken' | 'given' = d.loan_type || 'taken';
      let loanId = d.loan_id;

      // Try to extract from input context if not in data
      const contextMatch = input.match(/CONTEXTO EMPRÉSTIMO:([^)]+)/i);
      if (contextMatch) {
        const contextStr = contextMatch[1];
        // Extract description: "empréstimo de X com Y" -> Y
        const descMatch = contextStr.match(/com\s+([^,]+)/i);
        if (descMatch) loanDescription = descMatch[1].trim();

        // Extract type
        if (contextStr.includes('tipo: given')) loanType = 'given';

        // Extract loanId
        const loanIdMatch = contextStr.match(/loanId:\s*([^,\s]+)/i);
        if (loanIdMatch && loanIdMatch[1] !== 'undefined') loanId = loanIdMatch[1];
      }

      console.log('[LOAN_PAYMENT_PLAN] Description:', loanDescription, '| Type:', loanType, '| LoanId:', loanId);

      const result = await createLoanPaymentPlan({
        installments: d.installments,
        installmentValue: d.installment_value,
        dueDay: d.due_day,
        loanType,
        description: loanDescription,
        loanId
      });

      if (result.success) {
        const installmentValue = d.installment_value || (result.calculatedValue || 0);
        const formattedValue = installmentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (d.installments === 1) {
          finalMessage = `✅ Pagamento agendado!\n\n📅 Parcela única de ${formattedValue} todo dia ${d.due_day}.`;
        } else {
          finalMessage = `✅ Plano de pagamento criado!\n\n📅 ${d.installments} parcelas de ${formattedValue} todo dia ${d.due_day}.`;
        }
      } else {
        finalMessage = `❌ Erro ao criar plano: ${result.error}`;
      }
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
        // DA requires: day, value (or 0 for variable), AND bank account
        if (d.due_day && (d.amount || d.amount === 0) && d.account_name) {
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
          if (!d.account_name) missingInfo.push('banco');


          return {
            intent: 'CONFIRMATION_REQUIRED' as IntentType,
            data: {
              pendingAutoDebit: true,
              search_term: d.search_term,
              account_name: d.account_name,
              amount: d.amount,
              due_day: d.due_day
            },
            message: `📝 Vou cadastrar "${d.search_term}" como débito automático. Me diz:\n\n• Qual o ${missingInfo.join(', o ')}?\n\n💡 Exemplo: "Dia 10, uns 150 reais, no Itaú"`,
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

  // Handle CREATE_GOAL - create a new financial goal/reserve
  if (parsedResponse.intent === 'CREATE_GOAL') {
    const d = parsedResponse.data;

    if (!d.description) {
      finalMessage = `🎯 Qual é o nome da sua meta? Por exemplo: "Viagem", "Carro Novo", "Reserva de Emergência".`;
    } else {
      const { createReserve, getReserves } = await import('./planning');

      // Check if goal with similar name already exists
      const existingGoals = await getReserves();
      const existingGoal = existingGoals.find(g =>
        g.name.toLowerCase().includes(d.description.toLowerCase()) ||
        d.description.toLowerCase().includes(g.name.toLowerCase())
      );

      if (existingGoal) {
        finalMessage = `⚠️ Já existe uma meta chamada "${existingGoal.name}". Você quer aportar nela? Diga: "Guardar X na ${existingGoal.name}"`;
      } else {
        try {
          // Generate a color based on description (simple hash)
          const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
          const colorIndex = d.description.charCodeAt(0) % colors.length;

          const result = await createReserve({
            name: d.description,
            target_amount: d.amount || undefined,
            deadline: d.deadline || undefined,
            color: colors[colorIndex]
          });

          const targetStr = d.amount
            ? ` de ${d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
            : '';
          const deadlineStr = d.deadline ? ` até ${d.deadline}` : '';

          finalMessage = `🎯 Meta criada!\n\n**${d.description}**${targetStr}${deadlineStr}\n\n💡 Para guardar dinheiro, diga: "Guardar X na ${d.description}"`;
        } catch (error) {
          finalMessage = `❌ Erro ao criar meta: ${error}`;
        }
      }
    }
  }

  // Handle ADD_TO_GOAL - deposit money into a goal (transfer from account to goal)
  if (parsedResponse.intent === 'ADD_TO_GOAL') {
    const d = parsedResponse.data;

    if (!d.amount || !d.search_term) {
      finalMessage = `💰 Quanto você quer guardar e em qual meta? Por exemplo: "Guardar 200 na Viagem"`;
    } else {
      const { getReserves, addToReserve } = await import('./planning');
      const goals = await getReserves();

      // Find goal by name (fuzzy match)
      const goal = goals.find(g =>
        g.name.toLowerCase().includes(d.search_term.toLowerCase()) ||
        d.search_term.toLowerCase().includes(g.name.toLowerCase())
      );

      if (!goal) {
        // Goal not found - ask if user wants to create
        finalMessage = `📝 Não encontrei a meta "${d.search_term}". Quer criar uma nova meta com esse nome?\n\n💡 Responda: "Sim" ou "Criar meta ${d.search_term}"`;
        return {
          intent: 'CONFIRMATION_REQUIRED' as IntentType,
          data: {
            originalIntent: 'ADD_TO_GOAL',
            amount: d.amount,
            search_term: d.search_term,
            suggestCreate: true
          },
          message: finalMessage,
          confidence: 0.9
        };
      }

      try {
        // 1. Register the transfer (account -> goal) as expense
        const { createMovement } = await import('./finance-core');
        const { getDefaultAccount, getAccountByName: getAccByName } = await import('./assets');

        let accountId = undefined;
        if (d.account_name) {
          const account = await getAccByName(d.account_name);
          accountId = account?.id;
        } else {
          const defaultAccount = await getDefaultAccount();
          accountId = defaultAccount?.id;
        }

        await createMovement({
          description: `Guardado na meta ${goal.name}`,
          amount: d.amount,
          type: 'expense',
          date: new Date().toISOString().split('T')[0],
          accountId: accountId,
          isPaid: true,
          isReserve: true,
          reserveId: goal.id
        });

        // 2. Update goal balance - REMOVED because createMovement already handles it via isReserve flag
        // const result = await addToReserve(goal.id, d.amount);
        
        // Fetch updated goal to show correct balance
        const updatedGoals = await getReserves();
        const updatedGoal = updatedGoals.find(g => g.id === goal.id) || goal;

        const formattedAmount = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const newBalance = updatedGoal.current_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let progressStr = '';
        if (updatedGoal.target_amount && updatedGoal.target_amount > 0) {
          const percent = Math.round((updatedGoal.current_amount / updatedGoal.target_amount) * 100);
          const remaining = updatedGoal.target_amount - updatedGoal.current_amount;
          const remainingStr = remaining > 0
            ? `Faltam ${remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
            : `Meta atingida! 🎉`;
          progressStr = `\n📊 Progresso: ${percent}% (${remainingStr})`;
        }

        finalMessage = `✅ Guardado!\n\n💰 ${formattedAmount} → ${goal.name}\n🎯 Saldo da meta: ${newBalance}${progressStr}`;
      } catch (error) {
        finalMessage = `❌ Erro ao guardar: ${error}`;
      }
    }
  }

  // Handle WITHDRAW_FROM_GOAL - withdraw money from a goal (transfer from goal to account)
  if (parsedResponse.intent === 'WITHDRAW_FROM_GOAL') {
    const d = parsedResponse.data;

    if (!d.amount || !d.search_term) {
      finalMessage = `💸 Quanto você quer resgatar e de qual meta? Por exemplo: "Tirar 500 da Viagem"`;
    } else {
      const { getReserves, addToReserve } = await import('./planning');
      const goals = await getReserves();

      // Find goal by name
      const goal = goals.find(g =>
        g.name.toLowerCase().includes(d.search_term.toLowerCase()) ||
        d.search_term.toLowerCase().includes(g.name.toLowerCase())
      );

      if (!goal) {
        finalMessage = `📝 Não encontrei a meta "${d.search_term}". Verifique o nome e tente novamente.`;
      } else if (goal.current_amount < d.amount) {
        const currentStr = goal.current_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        finalMessage = `⚠️ A meta "${goal.name}" só tem ${currentStr}. Não dá pra resgatar ${d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
      } else {
        try {
          // 1. Register the transfer (goal -> account) as income
          const { createMovement } = await import('./finance-core');
          const { getDefaultAccount, getAccountByName: getAccByName2 } = await import('./assets');

          let accountId = undefined;
          if (d.account_name) {
            const account = await getAccByName2(d.account_name);
            accountId = account?.id;
          } else {
            const defaultAccount = await getDefaultAccount();
            accountId = defaultAccount?.id;
          }

          await createMovement({
            description: `Resgate da meta ${goal.name}`,
            amount: d.amount,
            type: 'income',
            date: new Date().toISOString().split('T')[0],
            accountId: accountId,
            isPaid: true,
            isReserve: true,
            reserveId: goal.id
          });

          // 2. Update goal balance (subtract)
          const result = await addToReserve(goal.id, -d.amount);

          const formattedAmount = d.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const newBalance = result.newAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          finalMessage = `✅ Resgatado!\n\n💸 ${formattedAmount} ← ${goal.name}\n🎯 Saldo restante na meta: ${newBalance}\n\n💡 O dinheiro está disponível na sua conta agora.`;
        } catch (error) {
          finalMessage = `❌ Erro ao resgatar: ${error}`;
        }
      }
    }
  }

  // Handle CHECK_GOAL - show goal status
  if (parsedResponse.intent === 'CHECK_GOAL') {
    const d = parsedResponse.data;

    const { getReserves } = await import('./planning');
    const goals = await getReserves();

    if (goals.length === 0) {
      finalMessage = `📝 Você ainda não tem nenhuma meta criada.\n\n💡 Para criar, diga: "Criar meta Viagem de 5000"`;
    } else if (d.search_term) {
      // Find specific goal
      const goal = goals.find(g =>
        g.name.toLowerCase().includes(d.search_term.toLowerCase()) ||
        d.search_term.toLowerCase().includes(g.name.toLowerCase())
      );

      if (!goal) {
        finalMessage = `📝 Não encontrei a meta "${d.search_term}". Suas metas são:\n${goals.map(g => `• ${g.name}`).join('\n')}`;
      } else {
        const currentStr = goal.current_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (goal.target_amount && goal.target_amount > 0) {
          const targetStr = goal.target_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          const percent = Math.round((goal.current_amount / goal.target_amount) * 100);
          const remaining = goal.target_amount - goal.current_amount;

          // Visual progress bar
          const filled = Math.round(percent / 10);
          const empty = 10 - filled;
          const progressBar = '█'.repeat(Math.min(filled, 10)) + '░'.repeat(Math.max(empty, 0));

          if (remaining > 0) {
            const remainingStr = remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            finalMessage = `🎯 **${goal.name}**\n\n[${progressBar}] ${percent}%\n\n💰 Guardado: ${currentStr}\n🎯 Meta: ${targetStr}\n📊 Faltam: ${remainingStr}`;
          } else {
            finalMessage = `🎉 **${goal.name}** - META ATINGIDA!\n\n[${progressBar}] ${percent}%\n\n💰 Guardado: ${currentStr}\n🎯 Meta: ${targetStr}\n\n🚀 Você já pode usar esse dinheiro!`;
          }
        } else {
          finalMessage = `🎯 **${goal.name}**\n\n💰 Guardado: ${currentStr}\n\n(Sem valor alvo definido)`;
        }
      }
    } else {
      // List all goals
      const goalList = goals.map(g => {
        const currentStr = g.current_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (g.target_amount && g.target_amount > 0) {
          const percent = Math.round((g.current_amount / g.target_amount) * 100);
          return `• **${g.name}**: ${currentStr} (${percent}%)`;
        } else {
          return `• **${g.name}**: ${currentStr}`;
        }
      }).join('\n');

      finalMessage = `🎯 Suas metas:\n\n${goalList}\n\n💡 Para detalhes, pergunte: "Quanto falta pra [nome]?"`;
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

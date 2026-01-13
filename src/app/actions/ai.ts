"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AIResponse, IntentType } from "../types";
import { createMovement, getFinancialStatus, deleteLastMovement } from "./finance-core";
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
   - Se o usuário "transferiu", "passou", "moveu" ou "depositou" dinheiro.
   - Exemplos: "Transferi 500 da Carteira pro Nubank", "Passei 200 do banco pra carteira".
   - **DEPÓSITO**: "Depositei 300 no Itaú" = Transferência da Carteira para o Itaú.
     - \`from_account\`: "Carteira" (sempre, para depósitos).
     - \`to_account\`: nome do banco mencionado.
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
- "almoço", "jantar", "café", "comida", "restaurante", "mercado", "supermercado" → category: "Alimentação"
- "uber", "99", "gasolina", "combustível", "estacionamento", "transporte" → category: "Transporte"
- "aluguel", "condomínio", "luz", "água", "internet", "gás" → category: "Moradia"
- "remédio", "farmácia", "médico", "consulta", "exame" → category: "Saúde"
- "cinema", "show", "festa", "bar", "lazer", "streaming" → category: "Lazer"
- "curso", "livro", "escola", "faculdade" → category: "Educação"
- "roupa", "camisa", "camiseta", "calça", "vestido", "blusa", "jaqueta", "casaco", "sapato", "tênis", "sandália", "chinelo", "calçado", "meia", "cueca", "calcinha", "sutiã" → category: "Vestuário"
- "shopping", "compras", "presente", "eletrônico", "celular" → category: "Compras"
- Se não conseguir inferir → category: "Outros"

### INTENÇÕES (INTENTS):

1. **REGISTER_MOVEMENT** (Registrar qualquer movimentação)
   - **Slots Obrigatórios**:
     - \`amount\` (Valor).
     - \`description\` (Descrição).
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

6. **CONFIRMATION_REQUIRED**
   - Use APENAS se faltar \`amount\` ou \`description\`.

7. **RECONCILE_PAYMENT** (Confirmar pagamento de conta existente) ⚠️ PRIORIDADE ALTA
   - **QUANDO USAR**: Quando o usuário diz que PAGOU algo que provavelmente já existe como conta pendente.
   - **Gatilhos**: "Paguei o X", "Paguei a X", "Quitei o X", "Já paguei o X", "Liquidei o X", "Paguei a conta de X".
   - **Exemplos que DEVEM usar este intent**:
     - "Paguei o IPTU" → RECONCILE_PAYMENT, search_term: "IPTU"
     - "Paguei a vara de pescar" → RECONCILE_PAYMENT, search_term: "vara de pescar"
     - "Quitei o colégio" → RECONCILE_PAYMENT, search_term: "colégio"
     - "Paguei a conta de luz" → RECONCILE_PAYMENT, search_term: "luz"
   - **Exemplos que NÃO usam este intent** (gasto novo com valor):
     - "Paguei 50 no mercado" → REGISTER_MOVEMENT (tem valor!)
     - "Gastei 30 no uber" → REGISTER_MOVEMENT
   - **Regra de Ouro**: Se o usuário diz "paguei" + nome de algo SEM mencionar valor = RECONCILE_PAYMENT
   - **Slots**:
     - \`search_term\`: O que foi pago (extrair do texto, ex: "vara de pescar", "IPTU", "aluguel").
   - **Ação**: O sistema vai buscar movimentos pendentes com esse nome.

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
- **DATAS NA MENSAGEM**: Sempre mostre datas no formato brasileiro (dd/mm/aaaa), ex: "20/01/2026".
- **DATAS NO JSON**: Mantenha o formato YYYY-MM-DD no campo \`date\` e \`due_date\` do JSON.
- **NÃO use "Gastei", "Recebi"** na resposta - você está anotando para o usuário, não falando por ele.
- **NÃO faça perguntas de follow-up** (nada de "Precisa de mais alguma coisa?").
- Seja **direto e conciso**. Uma ou duas linhas no máximo.
- Só faça perguntas se **faltar informação obrigatória** (valor ou descrição).
`;

// Keywords that indicate features from higher levels
const LEVEL_KEYWORDS = {
  // Level 2+ features
  transfer: ['transferi', 'transferir', 'transferência', 'passei pro', 'passei pra', 'movi pro', 'movi pra', 'moveu pro', 'moveu pra', 'depositei', 'depositar', 'depósito'],
  accounts: ['nubank', 'itaú', 'itau', 'bradesco', 'caixa', 'santander', 'inter', 'c6', 'picpay', 'mercado pago', 'conta bancária', 'banco'],
  recurring: ['recorrente', 'todo mês', 'mensal', 'mensalmente', 'recorrência', 'agendar', 'agendamento', 'agendei', 'programar', 'programei', 'lembrete', 'até dia', 'até o dia', 'de hoje até', 'até 202'],
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

      let prompt = `${timeContext}${conversationContext}Usuário: ${enrichedInput}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
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

  if (parsedResponse.intent === 'REGISTER_MOVEMENT') {
    const d = parsedResponse.data;

    // ===== TRANSFER HANDLING =====
    if (d.is_transfer && d.from_account && d.to_account) {
      const { getAccountByName, getAccountBalance } = await import('./assets');
      const { createTransfer } = await import('./financial');

      const fromAcc = await getAccountByName(d.from_account);
      const toAcc = await getAccountByName(d.to_account);

      if (!fromAcc || !toAcc) {
        const missingAcc = !fromAcc ? d.from_account : d.to_account;
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

      // Call finance-core
      const result = await createMovement({
        description: d.description,
        amount: d.amount,
        type: d.type || 'expense',
        date: d.date || new Date().toISOString().split('T')[0],
        dueDate: d.due_date,
        isPaid: d.is_paid,
        cardId: cardId,
        categoryId: categoryId,
        isLoan: d.is_loan,
        loanType: d.loan_type,
        loanDescription: d.description,
        loanTotal: d.amount,
        isReserve: d.is_reserve,
      });

      if (result.success) {
        finalMessage = `✅ ${parsedResponse.message}`;
      } else {
        finalMessage = `❌ Erro ao registrar: ${result.error}`;
      }
    }
  }

  if (parsedResponse.intent === 'GET_FINANCIAL_STATUS') {
    const status = await getFinancialStatus();
    if (status) {
      finalMessage = `📊 Renda Real: R$ ${status.realIncome.toFixed(2)}\n💸 Despesa Real: R$ ${status.realExpense.toFixed(2)}\n💰 Saldo Líquido: R$ ${status.balance.toFixed(2)}`;
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

  return {
    intent: parsedResponse.intent as IntentType,
    data: parsedResponse.data,
    message: finalMessage,
    spokenMessage: parsedResponse.spokenMessage,
    confidence: 0.9,
    audio: audioData
  };
}

"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { AIResponse, IntentType } from "../types";
import { createMovement, getFinancialStatus } from "./finance-core";
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
   - Se o usuário "transferiu", "passou", ou "moveu" dinheiro de uma conta para outra.
   - Exemplos: "Transferi 500 da Carteira pro Nubank", "Passei 200 do banco pra carteira".
   - Flag: \`is_transfer: true\`, \`from_account\`: nome da conta origem, \`to_account\`: nome da conta destino.
   - Isso NÃO é receita nem despesa, apenas movimentação interna.

### CATEGORIZAÇÃO INTELIGENTE:

**Para RECEITAS (income):**
- "recebi", "ganhei", "entrou" sem contexto específico → category: "Salário"
- "freelance", "bico", "extra", "trabalho extra" → category: "Freelance"
- "vendi", "venda" → category: "Vendas"
- "presente", "ganhei de presente" → category: "Presente"
- "reembolso", "me devolveram" → category: "Reembolso"
- "investimento", "rendimento", "dividendo" → category: "Investimentos"

**Para DESPESAS (expense):**
- "almoço", "jantar", "café", "comida", "restaurante", "mercado", "supermercado" → category: "Alimentação"
- "uber", "99", "gasolina", "combustível", "estacionamento", "transporte" → category: "Transporte"
- "aluguel", "condomínio", "luz", "água", "internet", "gás" → category: "Moradia"
- "remédio", "farmácia", "médico", "consulta", "exame" → category: "Saúde"
- "cinema", "show", "festa", "bar", "lazer", "streaming" → category: "Lazer"
- "curso", "livro", "escola", "faculdade" → category: "Educação"
- "roupa", "sapato", "compras", "shopping" → category: "Compras"
- Se não conseguir inferir → category: "Outros"

### INTENÇÕES (INTENTS):

1. **REGISTER_MOVEMENT** (Registrar qualquer movimentação)
   - **Slots Obrigatórios**:
     - \`amount\` (Valor).
     - \`description\` (Descrição).
   - **Slots de Lógica (Inferir)**:
     - \`type\`: 'income' | 'expense' | 'transfer'.
     - \`category\`: Nome da categoria (SEMPRE inferir baseado nas regras acima).
     - \`is_loan\`: boolean.
     - \`loan_type\`: 'taken' (peguei) | 'given' (emprestei).
     - \`is_reserve\`: boolean.
     - \`reserve_name\`: Nome da reserva (ex: "Viagem").
   - **IMPORTANTE**: NÃO pergunte em qual conta o dinheiro entrou/saiu. O sistema usa a conta padrão automaticamente.

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

5. **CONFIRMATION_REQUIRED**
   - Se faltar \`amount\` ou \`description\`.

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
`;

// Keywords that indicate features from higher levels
const LEVEL_KEYWORDS = {
  // Level 2+ features
  transfer: ['transferi', 'transferir', 'transferência', 'passei pro', 'passei pra', 'movi pro', 'movi pra', 'moveu pro', 'moveu pra'],
  accounts: ['nubank', 'itaú', 'itau', 'bradesco', 'caixa', 'santander', 'inter', 'c6', 'picpay', 'mercado pago', 'conta bancária', 'banco'],
  recurring: ['recorrente', 'todo mês', 'mensal', 'mensalmente', 'recorrência'],
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
  recurring: "Olha só, já pensando em contas fixas! 📅 Por enquanto, me avisa quando pagar cada uma. Logo, logo vou te ajudar a automatizar isso!",
  creditCard: "Entendi! 💳 Por enquanto, anota o valor que você gastou normalmente. Tipo: \"Gastei 50 no mercado\". Em breve a gente organiza seus cartões juntos!",
  loan: "Anotado mentalmente! 📝 Por enquanto, continua controlando isso como fazia antes. Logo vamos organizar empréstimos e dívidas juntos aqui!",
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
    return {
      intent: 'BLOCKED_FEATURE',
      message: FRIENDLY_BLOCKS[blockedFeature] || "🚧 Essa função ainda não está disponível pra você. Continua usando o básico que logo você desbloqueia!",
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
      let prompt = `${timeContext}\nUsuário: ${input}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
      break;
    } catch (error: any) {
      console.warn(`Gemini Error: ${error.message}`);
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

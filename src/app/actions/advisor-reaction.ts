'use server';

import { getGeminiModel } from "../lib/gemini";

export async function getAdvisorReaction(transaction: any, categoryName: string) {
    try {
        // Regra 0: Fator de Aleatoriedade (50% de chance de NÃO reagir para não ser chato)
        if (Math.random() > 0.5) {
            return null;
        }

        // Regra 1: Celebração (Pagamento de Fatura < Média) - Simplificado por enquanto
        if (categoryName.toLowerCase().includes('fatura') || categoryName.toLowerCase().includes('cartão')) {
            // Aqui poderíamos comparar com média histórica se tivéssemos query pronta
            // Por enquanto, vamos reagir apenas ao fato de pagar a fatura
            return await generateReaction("celebration", `O usuário pagou a fatura do cartão: ${transaction.description} valor ${transaction.amount}`);
        }

        // Regra 2: Empatia (Gastos "Chatos")
        const sadCategories = ['mecânico', 'saúde', 'manutenção', 'veterinário', 'farmácia', 'multa'];
        if (sadCategories.some(c => categoryName.toLowerCase().includes(c))) {
            return await generateReaction("empathy", `O usuário teve um gasto chato: ${transaction.description} valor ${transaction.amount} na categoria ${categoryName}`);
        }

        return null; // Sem reação necessária

    } catch (error) {
        console.error('Error getting advisor reaction:', error);
        return null; // Falha silenciosa para não travar o chat
    }
}

async function generateReaction(type: "celebration" | "empathy", context: string) {
    const model = getGeminiModel("gemini-2.5-flash");

    let systemPrompt = "";
    if (type === "celebration") {
        systemPrompt = "Seja um treinador entusiasta. Parabenize o usuário pela ação financeira positiva. Use 1 frase curta e motivadora com emoji.";
    } else {
        systemPrompt = "Seja um amigo compreensivo. Valide a frustração desse gasto inesperado ou chato. Use 1 frase curta e acolhedora com emoji.";
    }

    const prompt = `${systemPrompt}\nCONTEXTO: ${context}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
}

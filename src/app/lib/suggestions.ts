import { UserLevel } from "./levels";

export type SuggestionContext = 'home' | 'financial' | 'reports' | 'calendar';

const HOME_SUGGESTIONS: Record<number, string[]> = {
    0: [
        "Me ajuda a começar",
        "O que você faz?",
        "Como uso a IA?",
    ],
    1: [
        "Gastei 50 no almoço",
        "Recebi 1000 de salário",
        "Qual meu saldo atual?",
        "Quanto gastei de Uber?",
    ],
    2: [
        "Transferir 100 da carteira pro banco",
        "Paguei conta de luz 150",
        "Qual meu saldo total?",
        "Dica: errou a conta? Diga 'foi no [nome]'",
    ],
    3: [
        "Parcela de 200 no cartão",
        "Peguei 500 emprestado",
        "Quanto devo no cartão?",
        "Simular economia de 50",
    ],
    4: [
        "Guardei 200 pra viagem",
        "Criar meta de 5000 em 6 meses",
        "Como está minha projeção?",
        "Investi 500 no CDB",
    ],
};

const FINANCIAL_SUGGESTIONS: Record<number, string[]> = {
    0: [
        "Como registro um gasto?",
        "Como vejo meu saldo?",
        "O que são receitas?",
    ],
    1: [
        "Ontem gastei 40 de Uber",
        "Desfazer último lançamento",
        "Dica: diga 'cancela' se errar",
        "Recebi 50 de reembolso",
    ],
    2: [
        "Ver gastos por categoria",
        "Quanto gastei esse mês?",
        "Desfazer última transferência",
        "Ver extrato do banco",
    ],
    3: [
        "Ver fatura do cartão",
        "Quanto devo no total?",
        "Pagar fatura parcial",
    ],
    4: [
        "Ver rendimento da poupança",
        "Quanto falta pra minha meta?",
        "Analisar meus gastos",
    ],
};

const REPORTS_SUGGESTIONS: Record<number, string[]> = {
    0: [
        "Como analiso meus gastos?",
        "O que é fluxo de caixa?",
        "Resumo do mês",
    ],
    1: [
        "Quanto gastei de mercado?",
        "Qual meu maior gasto?",
        "Resumo de receitas",
        "Gastei muito com Uber?",
    ],
    2: [
        "Análise de fluxo de caixa",
        "Diferença Real vs Caixa",
        "Quanto economizei?",
        "Gastos por categoria",
    ],
    3: [
        "Projeção de fatura",
        "Análise de endividamento",
        "Comparar com mês passado",
    ],
    4: [
        "Evolução patrimonial",
        "Rentabilidade da carteira",
        "Análise de investimentos",
    ],
};

const CALENDAR_SUGGESTIONS: Record<number, string[]> = {
    0: [
        "O que vence hoje?",
        "Tenho contas essa semana?",
        "Resumo do dia",
    ],
    1: [
        "Quanto vou gastar esse mês?",
        "Tenho algo pra receber?",
        "Próximas contas a pagar",
    ],
    2: [
        "Minha conta de água vence dia 10",
        "Lembrar de pagar aluguel dia 5",
        "Recebo salário dia 30",
        "Agendar pagamento pra dia 20",
    ],
    3: [
        "Previsão de saldo pro dia 30",
        "Simular gasto no dia 15",
        "Vencimento do cartão",
    ],
    4: [
        "Projeção de fluxo de caixa",
        "Melhor dia para compras",
        "Planejamento mensal",
    ],
};

export function getSuggestionsForLevel(level: UserLevel, count: number = 4, context: SuggestionContext = 'home'): string[] {
    let source = HOME_SUGGESTIONS;
    if (context === 'financial') source = FINANCIAL_SUGGESTIONS;
    if (context === 'reports') source = REPORTS_SUGGESTIONS;
    if (context === 'calendar') source = CALENDAR_SUGGESTIONS;

    // Se nível 0, retorna fixo
    if (level === 0) return source[0];

    // Coleta sugestões do nível atual
    const currentLevelSugs = source[level] || [];

    // Se tivermos o suficiente, retorna
    if (currentLevelSugs.length >= count) {
        return currentLevelSugs.slice(0, count);
    }

    // Se não, completa com sugestões de níveis anteriores (do maior para o menor)
    const result = [...currentLevelSugs];
    for (let i = level - 1; i >= 1 && result.length < count; i--) {
        const sugs = source[i] || [];
        for (const s of sugs) {
            if (result.length < count && !result.includes(s)) {
                result.push(s);
            }
        }
    }

    return result;
}
